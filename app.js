await import(`./dist/gazefollower2.min.js?v=${Date.now()}`);
import { particleFX } from './src/ParticleFX.js';

const GazeFollower2 = window.GazeFollower2 || window.webgazer;

// Defensive compatibility shim in case an older bundle is cached or running
if (GazeFollower2) {
    if (typeof GazeFollower2.setHeuristicFilter !== 'function') {
        GazeFollower2.setHeuristicFilter = function(bool, look_ahead = 2) {
            if (typeof this.applyKalmanFilter === 'function') {
                return this.applyKalmanFilter(bool);
            }
            this.enableGazeFilter = !!bool;
            if (this.filter && typeof look_ahead === 'number' && look_ahead >= 1) {
                this.filter.lookAhead = look_ahead;
                this.filter.look_ahead = look_ahead;
            }
            return this;
        };
    }
    if (typeof GazeFollower2.applyKalmanFilter !== 'function') {
        GazeFollower2.applyKalmanFilter = function(bool, look_ahead) {
            return this.setHeuristicFilter(bool, look_ahead);
        };
    }
    if (typeof GazeFollower2.applySmoothingFilter !== 'function') {
        GazeFollower2.applySmoothingFilter = function(bool, look_ahead) {
            return this.setHeuristicFilter(bool, look_ahead);
        };
    }
}

const jsPsych = initJsPsych({
    display_element: 'jspsych-container',
    on_finish: function() {
        const csvData = jsPsych.data.get().csv();
        jsPsych.data.displayData();
    }
});

let config = {
    caliMode: '13-point',
    caliOrder: 'random',
    caliMethod: 'click',
    caliAlgorithm: 'ridge',
    caliAlpha: 1.0,
    caliLatency: 4,
    lissajousSpeed: 250,
    doValidation: true,
    valMode: 'random',
    valRandomCount: 13,
    gazeFilter: true,
    look_ahead: 2,
    screenWidthCm: 34.5,
    screenHeightCm: 19.4,
    eyeDistanceCm: 60.0
};

// Screen geometry and visual angle helper using physical width (cm), height (cm), and viewing distance (cm)
function getScreenGeometry(screenWidthCm, screenHeightCm, eyeDistCm) {
    const screenW = window.innerWidth || window.screen.width || 1920;
    const screenH = window.innerHeight || window.screen.height || 1080;
    const widthCm = (typeof screenWidthCm === 'number' && screenWidthCm > 0) ? screenWidthCm : 34.5;
    const heightCm = (typeof screenHeightCm === 'number' && screenHeightCm > 0) ? screenHeightCm : 19.4;
    const distCm = (typeof eyeDistCm === 'number' && eyeDistCm > 0) ? eyeDistCm : 60.0;

    // Physical size per pixel along X and Y axes
    const cmPerPxX = widthCm / screenW;
    const cmPerPxY = heightCm / screenH;
    const mmPerPxX = cmPerPxX * 10;
    const mmPerPxY = cmPerPxY * 10;
    const cmPerPx = (cmPerPxX + cmPerPxY) / 2;
    const mmPerPx = cmPerPx * 10;

    // Pixels per cm & DPI along X and Y axes
    const pxPerCmX = screenW / widthCm;
    const pxPerCmY = screenH / heightCm;
    const dpiX = pxPerCmX * 2.54;
    const dpiY = pxPerCmY * 2.54;

    // Pixels per degree (PPD) along X and Y axes:
    // 1 deg at distance distCm subtends distCm * (pi / 180) cm
    const cmPerDeg = distCm * (Math.PI / 180);
    const ppdX = pxPerCmX * cmPerDeg;
    const ppdY = pxPerCmY * cmPerDeg;

    // Diagonal summary for badge display
    const diagCm = Math.sqrt(widthCm * widthCm + heightCm * heightCm);
    const diagInches = diagCm / 2.54;
    const diagPx = Math.sqrt(screenW * screenW + screenH * screenH);
    const ppi = diagPx / diagInches;

    const cmToDeg = (dCm) => 2 * Math.atan(dCm / (2 * distCm)) * (180 / Math.PI);

    return {
        screenW,
        screenH,
        widthCm,
        heightCm,
        distCm,
        diagCm,
        diagInches,
        diagPx,
        ppi,
        dpiX,
        dpiY,
        cmPerPxX,
        cmPerPxY,
        mmPerPxX,
        mmPerPxY,
        cmPerPx,
        mmPerPx,
        ppdX,
        ppdY,
        cmToDeg,
        calcVisualAngle: (errPx) => {
            const errCm = errPx * cmPerPx;
            const deg = cmToDeg(errCm);
            return { errCm, deg };
        }
    };
}

/**
 * D3 Sliding-Window Evaluation Algorithm for Eye Tracking Accuracy & Precision.
 * Slides a window of size `winSize` (default 8 frames, stride 1) over a point's gaze samples,
 * selecting the optimal fixation window that minimizes d3 = ACC^2 * STD^2.
 *
 * @param {Array<{x: number, y: number, timestamp?: number}>} samples Gaze predictions in pixels
 * @param {{x: number, y: number}} targetPx Ground-truth target coordinates in pixels
 * @param {ReturnType<typeof getScreenGeometry>} geometry Screen & viewing geometry
 * @param {number} [winSize=8] Sliding window size in frames
 */
function computeD3Metrics(samples, targetPx, geometry, winSize = 8) {
    const valid = (samples || []).filter(s => s && Number.isFinite(s.x) && Number.isFinite(s.y));
    const tx = targetPx.x;
    const ty = targetPx.y;

    if (valid.length === 0) {
        return {
            predicted: { x: NaN, y: NaN },
            errPx: NaN,
            errCm: NaN,
            deg: NaN,
            accPx: NaN,
            accCm: NaN,
            accMm: NaN,
            accDeg: NaN,
            rmsPx: NaN,
            rmsCm: NaN,
            rmsMm: NaN,
            rmsDeg: NaN,
            stdPx: NaN,
            stdCm: NaN,
            stdDeg: NaN,
            d3: NaN,
            totalSamples: 0,
            windowSize: 0
        };
    }

    const effWin = Math.min(winSize, valid.length);
    const gtCmX = tx * geometry.cmPerPxX;
    const gtCmY = ty * geometry.cmPerPxY;
    const gtDegX = tx / geometry.ppdX;
    const gtDegY = ty / geometry.ppdY;

    let bestIdx = 0;
    let minD3 = Infinity;
    const windows = [];

    for (let i = 0; i <= valid.length - effWin; i++) {
        const win = valid.slice(i, i + effWin);

        let sumPxX = 0, sumPxY = 0;
        let sumCmX = 0, sumCmY = 0;
        let sumDegX = 0, sumDegY = 0;

        const ptsCm = [];
        const ptsDeg = [];

        for (let k = 0; k < effWin; k++) {
            const pxX = win[k].x;
            const pxY = win[k].y;
            const cmX = pxX * geometry.cmPerPxX;
            const cmY = pxY * geometry.cmPerPxY;
            const degX = pxX / geometry.ppdX;
            const degY = pxY / geometry.ppdY;

            sumPxX += pxX;
            sumPxY += pxY;
            sumCmX += cmX;
            sumCmY += cmY;
            sumDegX += degX;
            sumDegY += degY;

            ptsCm.push({ x: cmX, y: cmY });
            ptsDeg.push({ x: degX, y: degY });
        }

        const meanPxX = sumPxX / effWin;
        const meanPxY = sumPxY / effWin;
        const meanCmX = sumCmX / effWin;
        const meanCmY = sumCmY / effWin;
        const meanDegX = sumDegX / effWin;
        const meanDegY = sumDegY / effWin;

        // Accuracy (Euclidean distance between window mean and ground truth)
        const accPx = Math.hypot(meanPxX - tx, meanPxY - ty);
        const accCm = Math.hypot(meanCmX - gtCmX, meanCmY - gtCmY);
        const accDeg = Math.hypot(meanDegX - gtDegX, meanDegY - gtDegY);

        // Spatial STD within window
        let varPx = 0, varCm = 0, varDeg = 0;
        for (let k = 0; k < effWin; k++) {
            varPx += (win[k].x - meanPxX) ** 2 + (win[k].y - meanPxY) ** 2;
            varCm += (ptsCm[k].x - meanCmX) ** 2 + (ptsCm[k].y - meanCmY) ** 2;
            varDeg += (ptsDeg[k].x - meanDegX) ** 2 + (ptsDeg[k].y - meanDegY) ** 2;
        }
        const stdPx = Math.sqrt(varPx / effWin);
        const stdCm = Math.sqrt(varCm / effWin);
        const stdDeg = Math.sqrt(varDeg / effWin);

        // Sample-to-sample RMS precision within window
        let rmsPx = 0, rmsCm = 0, rmsDeg = 0;
        if (effWin >= 2) {
            let diffSqPx = 0, diffSqCm = 0, diffSqDeg = 0;
            for (let k = 0; k < effWin - 1; k++) {
                diffSqPx += (win[k + 1].x - win[k].x) ** 2 + (win[k + 1].y - win[k].y) ** 2;
                diffSqCm += (ptsCm[k + 1].x - ptsCm[k].x) ** 2 + (ptsCm[k + 1].y - ptsCm[k].y) ** 2;
                diffSqDeg += (ptsDeg[k + 1].x - ptsDeg[k].x) ** 2 + (ptsDeg[k + 1].y - ptsDeg[k].y) ** 2;
            }
            rmsPx = Math.sqrt(diffSqPx / (effWin - 1));
            rmsCm = Math.sqrt(diffSqCm / (effWin - 1));
            rmsDeg = Math.sqrt(diffSqDeg / (effWin - 1));
        }

        // D3 criterion: d3 = ACC^2 * STD^2
        const d3Val = (accDeg ** 2) * (stdDeg ** 2);

        windows.push({
            meanPxX,
            meanPxY,
            accPx,
            accCm,
            accDeg,
            stdPx,
            stdCm,
            stdDeg,
            rmsPx,
            rmsCm,
            rmsDeg,
            d3Val
        });

        if (d3Val < minD3) {
            minD3 = d3Val;
            bestIdx = i;
        }
    }

    const best = windows[bestIdx];
    return {
        predicted: { x: best.meanPxX, y: best.meanPxY },
        errPx: best.accPx,
        errCm: best.accCm,
        deg: best.accDeg,
        accPx: best.accPx,
        accCm: best.accCm,
        accMm: best.accCm * 10,
        accDeg: best.accDeg,
        rmsPx: best.rmsPx,
        rmsCm: best.rmsCm,
        rmsMm: best.rmsCm * 10,
        rmsDeg: best.rmsDeg,
        stdPx: best.stdPx,
        stdCm: best.stdCm,
        stdDeg: best.stdDeg,
        d3: best.d3Val,
        bestWindowIndex: bestIdx,
        totalSamples: valid.length,
        windowSize: effWin
    };
}

// 1. Onboarding & Camera Access Phase
const request_camera = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div class="studio-card" style="max-width: 540px; text-align: center; margin: 0 auto; padding: 36px 32px;">
            <div style="width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 14px; background: #e8f3ff; border: 1px solid #bedaff; display: flex; align-items: center; justify-content: center;">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#165dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                </svg>
            </div>
            <h2 style="font-size: 22px; font-weight: 700; color: #1d2129; margin-bottom: 8px; letter-spacing: -0.01em;">GazeFollower2 Web Eye Tracking</h2>
            <p style="color: #4e5969; font-size: 14px; line-height: 1.6; margin-bottom: 22px;">
                Real-time in-browser gaze estimation powered by client-side neural vision models, requiring no specialized hardware.
            </p>
            <p style="font-size: 13px; color: #86909c; line-height: 1.5; margin-bottom: 8px;">
                Please allow camera access when prompted by your browser. Video frames are processed strictly within your browser and never uploaded.
            </p>
        </div>
    `,
    choices: ['Grant Camera Access'],
    button_html: '<button class="studio-btn" style="margin-top: 20px; min-width: 240px;">%choice%</button>',
    on_finish: async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.error("Camera permission denied:", e);
        }
    }
};

// 2. Fullscreen Phase
const enter_fullscreen = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div class="studio-card" style="max-width: 500px; text-align: center; margin: 0 auto; padding: 32px 28px;">
            <div style="width: 52px; height: 52px; margin: 0 auto 16px; border-radius: 12px; background: #e8f3ff; border: 1px solid #bedaff; display: flex; align-items: center; justify-content: center;">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#165dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </div>
            <h3 style="font-size: 20px; font-weight: 700; color: #1d2129; margin-bottom: 8px;">Fullscreen Calibration & Tracking</h3>
            <p style="color: #4e5969; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                To maintain screen coordinate mapping accuracy and metric visual angle calculations, the session will operate in fullscreen mode.
            </p>
        </div>
    `,
    choices: ['Enter Fullscreen'],
    button_html: '<button class="studio-btn" style="margin-top: 15px; min-width: 220px;">%choice%</button>',
    on_finish: async () => {
        const el = document.documentElement;
        const requestFS = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
        if (requestFS && !document.fullscreenElement && !document.webkitFullscreenElement) {
            try {
                await requestFS.call(el);
            } catch (e) {
                console.warn("Fullscreen request error:", e);
            }
        }
    }
};

// 3. Studio Setup & Preview Dashboard
const setup_panel = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 1140px; margin: 0 auto; padding: 12px 0;">
            <!-- Header Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 8px; background: #165dff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(22, 93, 255, 0.25);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <circle cx="12" cy="12" r="4"></circle>
                            <path d="M4.93 4.93l4.24 4.24"></path>
                            <path d="M14.83 14.83l4.24 4.24"></path>
                            <path d="M14.83 9.17l4.24-4.24"></path>
                            <path d="M4.93 19.07l4.24-4.24"></path>
                        </svg>
                    </div>
                    <div>
                        <h2 style="font-size: 18px; font-weight: 700; color: #1d2129; letter-spacing: -0.01em;">GazeFollower2 Control Center</h2>
                        <p style="font-size: 12px; color: #86909c;">Hardware geometry & gaze calibration setup</p>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <span id="badge-fps" class="status-pill info"><span class="pulse-dot"></span> 30 FPS Live</span>
                    <span id="badge-status" class="status-pill info"><span class="pulse-dot"></span> Initializing...</span>
                </div>
            </div>

            <!-- Two-Column Workspace Layout -->
            <div style="display: grid; grid-template-columns: 440px 1fr; gap: 20px; width: 100%;">
                
                <!-- Left Column: Camera Viewfinder & Preprocessing -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="studio-card" style="padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-size: 13px; font-weight: 600; color: #1d2129;">Live Viewfinder</span>
                            <span id="badge-face-tracking" class="status-pill info" style="font-size: 11px;">Face Tracking: Detecting...</span>
                        </div>
                        <div id="video-anchor" style="position: relative; width: 100%; aspect-ratio: 4/3; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                            <div id="sdk-status-wrap" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.92); z-index: 10;">
                                <div style="width: 32px; height: 32px; border: 3px solid #e5e6eb; border-top-color: #165dff; border-radius: 50%; animation: gf-spin 1s linear infinite; margin-bottom: 12px;"></div>
                                <p id="sdk-status" style="color: #4e5969; font-size: 13px; font-weight: 500;">Loading neural model...</p>
                            </div>
                        </div>
                    </div>

                    <!-- AI Preprocessing Controls -->
                    <div class="studio-card" style="padding: 18px;">
                        <span style="font-size: 13px; font-weight: 600; color: #1d2129; display: block; margin-bottom: 12px;">Vision Preprocessing</span>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: grid; grid-template-columns: 1fr 140px; gap: 10px;">
                                <div>
                                    <label class="studio-label">Gaze Smoothing (Heuristic Filter)</label>
                                    <select id="sel-gaze-filter" class="studio-select" style="width: 100%;">
                                        <option value="true" selected>Enabled (Default)</option>
                                        <option value="false">Disabled (Raw)</option>
                                    </select>
                                </div>
                                <div id="look-ahead-wrap">
                                    <label class="studio-label"><span>look_ahead</span><span style="font-size: 11px; color: #86909c;">Default: 2</span></label>
                                    <input type="number" id="inp-look-ahead" class="studio-input" value="2" min="1" max="15" step="1" style="width: 100%;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Protocol, Display Geometry, and Validation Settings -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    
                    <!-- Card 1: Calibration Engine -->
                    <div class="studio-card" style="padding: 18px;">
                        <span style="font-size: 13px; font-weight: 600; color: #1d2129; display: block; margin-bottom: 12px;">Calibration Setup</span>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label class="studio-label">Target Pattern</label>
                                <select id="sel-cali-mode" class="studio-select" style="width: 100%;">
                                    <option value="13-point" selected>13-Point Enhanced Grid (Recommended)</option>
                                    <option value="9-point">9-Point Standard Grid</option>
                                    <option value="5-point">5-Point Fast Grid</option>
                                    <option value="random">13-Point Random Distribution</option>
                                    <option value="lissajous">Lissajous Continuous Pursuit</option>
                                </select>
                            </div>
                            <div id="cali-order-wrap">
                                <label class="studio-label">Target Order</label>
                                <select id="sel-cali-order" class="studio-select" style="width: 100%;">
                                    <option value="random" selected>Randomized (Prevents anticipation - Default)</option>
                                    <option value="sequential">Sequential Order</option>
                                </select>
                            </div>
                            <div id="lissajous-speed-wrap" style="display: none;">
                                <label class="studio-label">
                                    <span>Pursuit Speed (追随速度)</span>
                                    <span id="lissajous-dur-hint" style="font-size: 11px; color: #86909c;">~25s</span>
                                </label>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input type="number" id="inp-lissajous-speed" class="studio-input" value="250" step="25" min="50" max="800" style="flex: 1;">
                                    <select id="sel-lissajous-preset" class="studio-select" style="width: 105px; padding: 7px 6px; font-size: 12px;">
                                        <option value="custom">Preset...</option>
                                        <option value="150">150 px/s (慢速)</option>
                                        <option value="200">200 px/s (平缓)</option>
                                        <option value="250" selected>250 px/s (推荐)</option>
                                        <option value="350">350 px/s (适中)</option>
                                        <option value="500">500 px/s (快速)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="studio-label">Interaction Mode</label>
                                <select id="sel-cali-method" class="studio-select" style="width: 100%;">
                                    <option value="click" selected>Manual Click (Tactile Confirmation)</option>
                                    <option value="auto">Auto Dwell (1.5s Fixation)</option>
                                </select>
                            </div>
                            <div>
                                <label class="studio-label">Calibration Algorithm</label>
                                <select id="sel-cali-algo" class="studio-select" style="width: 100%;">
                                    <option value="ridge" selected>Multivariate Ridge (Analytical - Default)</option>
                                    <option value="svr">SVR (Support Vector Regression)</option>
                                </select>
                            </div>
                            <div id="alpha-wrap">
                                <label class="studio-label">
                                    <span>Ridge Regularization (α)</span>
                                    <span style="font-size: 11px; color: #86909c;">Default: 1.0</span>
                                </label>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input type="number" id="inp-cali-alpha" class="studio-input" value="1.0" step="0.1" min="0.0001" max="1000" style="flex: 1;">
                                    <select id="sel-alpha-preset" class="studio-select" style="width: 105px; padding: 7px 6px; font-size: 12px;">
                                        <option value="custom">Preset...</option>
                                        <option value="1.0" selected>1.0 (13-pt)</option>
                                        <option value="2.0">2.0 (9-pt)</option>
                                        <option value="3.0">3.0 (5-pt)</option>
                                        <option value="0.1">0.1</option>
                                        <option value="5.0">5.0</option>
                                        <option value="10.0">10.0</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="studio-label">Hardware Latency Compensation</label>
                                <select id="sel-cali-latency" class="studio-select" style="width: 100%;">
                                    <option value="0">0 frames (0 ms)</option>
                                    <option value="2">2 frames (~66 ms)</option>
                                    <option value="4" selected>4 frames (~133 ms - Default)</option>
                                    <option value="6">6 frames (~200 ms)</option>
                                    <option value="8">8 frames (~266 ms)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: Physical Display & Viewing Geometry -->
                    <div class="studio-card" style="padding: 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 13px; font-weight: 600; color: #1d2129;">Display & Viewing Geometry (屏幕宽高与视距)</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <select id="sel-screen-preset" class="studio-select" style="padding: 2px 8px; font-size: 11px; height: 24px;">
                                    <option value="28.6x17.9">13.3" (28.6×17.9 cm)</option>
                                    <option value="30.9x17.4">14.0" (30.9×17.4 cm)</option>
                                    <option value="34.5x19.4" selected>15.6" (34.5×19.4 cm)</option>
                                    <option value="53.1x29.9">24.0" (53.1×29.9 cm)</option>
                                    <option value="59.8x33.6">27.0" (59.8×33.6 cm)</option>
                                    <option value="70.8x39.8">32.0" (70.8×39.8 cm)</option>
                                    <option value="custom">Custom Size...</option>
                                </select>
                                <span id="geo-preview" class="status-pill info" style="font-size: 11px;">~141.4 PPI • 0.18×0.18 mm/px</span>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 10px;">
                            <div>
                                <label class="studio-label">
                                    <span>Screen Width (宽)</span>
                                </label>
                                <div style="position: relative;">
                                    <input type="number" id="inp-screen-width" class="studio-input" value="34.5" step="0.1" min="5" max="300" required style="width: 100%; padding-right: 34px;">
                                    <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #86909c;">cm</span>
                                </div>
                            </div>
                            <div>
                                <label class="studio-label">
                                    <span>Screen Height (高)</span>
                                </label>
                                <div style="position: relative;">
                                    <input type="number" id="inp-screen-height" class="studio-input" value="19.4" step="0.1" min="5" max="300" required style="width: 100%; padding-right: 34px;">
                                    <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #86909c;">cm</span>
                                </div>
                            </div>
                            <div>
                                <label class="studio-label">
                                    <span>Eye Distance (距离)</span>
                                </label>
                                <div style="position: relative;">
                                    <input type="number" id="inp-eye-distance" class="studio-input" value="60.0" step="1" min="15" max="300" required style="width: 100%; padding-right: 34px;">
                                    <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #86909c;">cm</span>
                                </div>
                            </div>
                        </div>
                        <p style="font-size: 12px; color: #86909c; line-height: 1.5;">
                            Please enter physical screen width (cm), height (cm), and viewing distance (cm) for D3 visual angle (θ°) and physical accuracy/precision evaluation.
                        </p>
                    </div>

                    <!-- Card 3: Validation Protocol -->
                    <div class="studio-card" style="padding: 18px;">
                        <span style="font-size: 13px; font-weight: 600; color: #1d2129; display: block; margin-bottom: 12px;">Validation Protocol</span>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label class="studio-label">Run Accuracy Validation</label>
                                <select id="sel-do-val" class="studio-select" style="width: 100%;">
                                    <option value="true" selected>Yes (D3 Accuracy & Precision Evaluation)</option>
                                    <option value="false">No (Skip directly to tracking)</option>
                                </select>
                            </div>
                            <div id="val-opts">
                                <label class="studio-label">Validation Pattern</label>
                                <div style="display: flex; gap: 8px;">
                                    <select id="sel-val-mode" class="studio-select" style="flex: 1;">
                                        <option value="random" selected>Random (13 Points - Default)</option>
                                        <option value="9-point">9-Point Standard</option>
                                        <option value="5-point">5-Point Fast</option>
                                    </select>
                                    <input type="number" id="inp-val-rand" class="studio-input" value="13" min="1" max="50" style="width: 65px; display: none;">
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `,
    choices: ['Start Calibration'],
    button_html: '<button class="studio-btn" id="btn-next" style="margin-top: 20px; min-width: 260px;" disabled>%choice%</button>',
    on_load: async () => {
        const btnNext = document.getElementById('btn-next');
        const status = document.getElementById('sdk-status');
        const statusWrap = document.getElementById('sdk-status-wrap');
        const badgeStatus = document.getElementById('badge-status');
        const geoPreview = document.getElementById('geo-preview');
        let sdkReady = false;

        const inpScreenWidth = document.getElementById('inp-screen-width');
        const inpScreenHeight = document.getElementById('inp-screen-height');
        const selScreenPreset = document.getElementById('sel-screen-preset');
        const inpEyeDistance = document.getElementById('inp-eye-distance');

        const isGeometryValid = () => {
            const w = parseFloat(inpScreenWidth ? inpScreenWidth.value : config.screenWidthCm);
            const h = parseFloat(inpScreenHeight ? inpScreenHeight.value : config.screenHeightCm);
            const d = parseFloat(inpEyeDistance ? inpEyeDistance.value : config.eyeDistanceCm);
            return Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0 && Number.isFinite(d) && d > 0;
        };

        const updateStartButtonState = () => {
            if (btnNext) {
                btnNext.disabled = !(sdkReady && isGeometryValid());
            }
        };

        // Geometry update helper
        const updateGeometryBadge = () => {
            const geo = getScreenGeometry(config.screenWidthCm, config.screenHeightCm, config.eyeDistanceCm);
            if (geoPreview) {
                geoPreview.innerText = `~${geo.ppi.toFixed(0)} PPI • ${geo.mmPerPxX.toFixed(2)}×${geo.mmPerPxY.toFixed(2)} mm/px`;
            }
            updateStartButtonState();
        };

        // Handlers for Physical Screen Width, Height & Eye Distance
        if (selScreenPreset && inpScreenWidth && inpScreenHeight) {
            selScreenPreset.onchange = (e) => {
                if (e.target.value !== 'custom') {
                    const parts = e.target.value.split('x');
                    if (parts.length === 2) {
                        const wCm = parseFloat(parts[0]);
                        const hCm = parseFloat(parts[1]);
                        if (wCm > 0 && hCm > 0) {
                            inpScreenWidth.value = wCm.toFixed(1);
                            inpScreenHeight.value = hCm.toFixed(1);
                            config.screenWidthCm = wCm;
                            config.screenHeightCm = hCm;
                            updateGeometryBadge();
                        }
                    }
                }
            };

            const syncCustomSize = () => {
                const wVal = parseFloat(inpScreenWidth.value);
                const hVal = parseFloat(inpScreenHeight.value);
                if (!isNaN(wVal) && wVal > 0) config.screenWidthCm = wVal;
                if (!isNaN(hVal) && hVal > 0) config.screenHeightCm = hVal;
                const key = `${wVal.toFixed(1)}x${hVal.toFixed(1)}`;
                const match = Array.from(selScreenPreset.options).some(opt => opt.value === key);
                selScreenPreset.value = match ? key : 'custom';
                updateGeometryBadge();
            };

            inpScreenWidth.oninput = syncCustomSize;
            inpScreenHeight.oninput = syncCustomSize;
        }

        if (inpEyeDistance) {
            inpEyeDistance.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                    config.eyeDistanceCm = val;
                }
                updateGeometryBadge();
            };
        }
        updateGeometryBadge();

        // Calibration options
        const methodSel = document.getElementById('sel-cali-method');
        const caliModeSel = document.getElementById('sel-cali-mode');
        const caliOrderSel = document.getElementById('sel-cali-order');
        const caliOrderWrap = document.getElementById('cali-order-wrap');
        const lissajousSpeedWrap = document.getElementById('lissajous-speed-wrap');
        const inpLissajousSpeed = document.getElementById('inp-lissajous-speed');
        const selLissajousPreset = document.getElementById('sel-lissajous-preset');
        const lissajousDurHint = document.getElementById('lissajous-dur-hint');

        const updateLissajousSpeedUI = () => {
            const isLissajous = config.caliMode === 'lissajous';
            if (caliOrderWrap) caliOrderWrap.style.display = isLissajous ? 'none' : 'block';
            if (lissajousSpeedWrap) lissajousSpeedWrap.style.display = isLissajous ? 'block' : 'none';
            if (methodSel) {
                if (isLissajous) {
                    methodSel.value = 'auto';
                    methodSel.disabled = true;
                    config.caliMethod = 'auto';
                } else {
                    methodSel.disabled = false;
                }
            }
            if (window.GazeFollower2 && GazeFollower2.caliManager) {
                const len = GazeFollower2.caliManager.computeLissajousLength();
                const durS = Math.round(len / (config.lissajousSpeed || 250));
                if (lissajousDurHint) lissajousDurHint.innerText = `~${durS}s 全程`;
                if (typeof GazeFollower2.setLissajousSpeed === 'function') {
                    GazeFollower2.setLissajousSpeed(config.lissajousSpeed);
                }
            }
        };

        if (caliModeSel) {
            caliModeSel.onchange = (e) => {
                config.caliMode = e.target.value;
                // Auto adapt default lambda based on calibration points (5-pt: 3.0, 9-pt: 2.0, 13-pt: 1.0)
                if (config.caliMode === '5-point') {
                    config.caliAlpha = 3.0;
                } else if (config.caliMode === '9-point') {
                    config.caliAlpha = 2.0;
                } else if (config.caliMode === '13-point' || config.caliMode === 'random' || config.caliMode === 'lissajous') {
                    config.caliAlpha = 1.0;
                }
                if (inpAlpha) inpAlpha.value = String(config.caliAlpha);
                if (selAlphaPreset) {
                    const match = Array.from(selAlphaPreset.options).some(opt => opt.value === String(config.caliAlpha));
                    selAlphaPreset.value = match ? String(config.caliAlpha) : 'custom';
                }
                syncAlphaUI();
                updateLissajousSpeedUI();
            };
        }

        if (inpLissajousSpeed) {
            inpLissajousSpeed.value = String(config.lissajousSpeed ?? 250);
            inpLissajousSpeed.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                    config.lissajousSpeed = val;
                    if (selLissajousPreset) {
                        const match = Array.from(selLissajousPreset.options).some(opt => opt.value === String(val));
                        selLissajousPreset.value = match ? String(val) : 'custom';
                    }
                    updateLissajousSpeedUI();
                }
            };
        }

        if (selLissajousPreset && inpLissajousSpeed) {
            selLissajousPreset.onchange = (e) => {
                if (e.target.value !== 'custom') {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val) && val > 0) {
                        inpLissajousSpeed.value = String(val);
                        config.lissajousSpeed = val;
                        updateLissajousSpeedUI();
                    }
                }
            };
        }
        updateLissajousSpeedUI();

        if (caliOrderSel) {
            caliOrderSel.onchange = (e) => config.caliOrder = e.target.value;
        }

        if (methodSel) {
            methodSel.onchange = (e) => config.caliMethod = e.target.value;
        }

        const algoSel = document.getElementById('sel-cali-algo');
        const inpAlpha = document.getElementById('inp-cali-alpha');
        const selAlphaPreset = document.getElementById('sel-alpha-preset');
        const alphaWrap = document.getElementById('alpha-wrap');

        const syncAlphaUI = () => {
            const isRidge = config.caliAlgorithm === 'ridge';
            if (alphaWrap) {
                alphaWrap.style.opacity = isRidge ? '1' : '0.4';
                alphaWrap.style.pointerEvents = isRidge ? 'auto' : 'none';
            }
            if (window.GazeFollower2) {
                if (typeof GazeFollower2.setRegression === 'function') {
                    GazeFollower2.setRegression(config.caliAlgorithm, config.caliAlpha);
                }
                if (typeof GazeFollower2.setRidgeAlpha === 'function') {
                    GazeFollower2.setRidgeAlpha(config.caliAlpha);
                }
            }
        };

        if (algoSel) {
            algoSel.value = config.caliAlgorithm;
            algoSel.onchange = (e) => {
                config.caliAlgorithm = e.target.value;
                syncAlphaUI();
            };
        }

        if (inpAlpha) {
            inpAlpha.value = String(config.caliAlpha ?? 1.0);
            inpAlpha.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                    config.caliAlpha = val;
                    if (selAlphaPreset) {
                        const str = val.toFixed(1);
                        const match = Array.from(selAlphaPreset.options).some(opt => opt.value === String(val) || opt.value === str);
                        selAlphaPreset.value = match ? (Array.from(selAlphaPreset.options).find(opt => opt.value === String(val) || opt.value === str).value) : 'custom';
                    }
                    syncAlphaUI();
                }
            };
        }

        if (selAlphaPreset && inpAlpha) {
            selAlphaPreset.onchange = (e) => {
                if (e.target.value !== 'custom') {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val) && val > 0) {
                        inpAlpha.value = String(val);
                        config.caliAlpha = val;
                        syncAlphaUI();
                    }
                }
            };
        }
        syncAlphaUI();

        const latencySel = document.getElementById('sel-cali-latency');
        if (latencySel) {
            latencySel.onchange = (e) => config.caliLatency = parseInt(e.target.value) || 0;
        }

        // Validation options
        const valSel = document.getElementById('sel-val-mode');
        const valInp = document.getElementById('inp-val-rand');
        const valOpts = document.getElementById('val-opts');
        const doValSel = document.getElementById('sel-do-val');

        if (valSel && valInp) {
            valSel.onchange = (e) => {
                config.valMode = e.target.value;
                valInp.style.display = (e.target.value === 'random') ? 'block' : 'none';
            };
            valInp.oninput = (e) => config.valRandomCount = parseInt(e.target.value) || 13;
        }

        if (doValSel && valOpts) {
            doValSel.onchange = (e) => {
                config.doValidation = (e.target.value === 'true');
                valOpts.style.opacity = config.doValidation ? '1' : '0.4';
                valOpts.style.pointerEvents = config.doValidation ? 'auto' : 'none';
            };
        }

        // Gaze smoothing (Heuristic filter) & look_ahead option
        const gazeFilterSel = document.getElementById('sel-gaze-filter');
        const inpLookAhead = document.getElementById('inp-look-ahead');
        const lookAheadWrap = document.getElementById('look-ahead-wrap');

        const syncHeuristicFilter = () => {
            if (lookAheadWrap) {
                lookAheadWrap.style.opacity = config.gazeFilter ? '1' : '0.4';
                lookAheadWrap.style.pointerEvents = config.gazeFilter ? 'auto' : 'none';
            }
            if (window.GazeFollower2) {
                GazeFollower2.setHeuristicFilter(config.gazeFilter, config.look_ahead);
            }
        };

        if (gazeFilterSel) {
            gazeFilterSel.value = config.gazeFilter !== false ? 'true' : 'false';
            gazeFilterSel.onchange = (e) => {
                config.gazeFilter = (e.target.value === 'true');
                syncHeuristicFilter();
            };
        }

        if (inpLookAhead) {
            inpLookAhead.value = String(config.look_ahead ?? 2);
            inpLookAhead.oninput = (e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed) && parsed >= 1) {
                    config.look_ahead = parsed;
                    syncHeuristicFilter();
                }
            };
        }

        // Initialize SDK and Webcam
        try {
            while (typeof ort === 'undefined' || typeof GazeFollower2 === 'undefined' || !GazeFollower2) { 
                await new Promise(r => setTimeout(r, 100)); 
            }
            
            if (statusWrap) statusWrap.style.display = 'flex';
            await GazeFollower2.begin((progress) => {
                const percent = Math.round(progress * 100);
                status.innerText = `Loading neural model... ${percent}%`;
            });
            GazeFollower2.setHeuristicFilter(config.gazeFilter, config.look_ahead);

            const anchor = document.getElementById('video-anchor');
            if (statusWrap) statusWrap.style.display = 'none';
            if (badgeStatus) {
                badgeStatus.innerHTML = '<span class="pulse-dot"></span> Ready';
                badgeStatus.className = 'status-pill';
            }
            
            Object.assign(GazeFollower2.videoElement.style, {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', 
                transform: 'scaleX(-1)', objectFit: 'cover', maxWidth: 'none', maxHeight: 'none',
                zIndex: '1', borderRadius: '8px'
            });
            Object.assign(GazeFollower2.overlayCanvas.style, {
                position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', 
                transform: 'scaleX(-1)', objectFit: 'cover', maxWidth: 'none', maxHeight: 'none',
                zIndex: '2', borderRadius: '8px'
            });
            
            anchor.appendChild(GazeFollower2.videoElement);
            anchor.appendChild(GazeFollower2.overlayCanvas);

            GazeFollower2.showPredictionPoints(true);
            GazeFollower2.showVideo(true);

            GazeFollower2.videoElement.play().catch(e => console.warn(e));
            sdkReady = true;
            updateStartButtonState();

            const faceInterval = setInterval(() => {
                const el = document.getElementById('badge-face-tracking');
                if (!el) {
                    clearInterval(faceInterval);
                    return;
                }
                if (GazeFollower2.isFaceDetected) {
                    el.innerHTML = '<span class="pulse-dot"></span> Face Detected';
                    el.className = 'status-pill';
                } else {
                    el.innerHTML = '<span class="pulse-dot"></span> Searching Face...';
                    el.className = 'status-pill warning';
                }
            }, 250);
        } catch (e) {
            status.innerText = "Error: " + e.message;
            if (badgeStatus) {
                badgeStatus.innerText = "Init Failed";
                badgeStatus.className = 'status-pill danger';
            }
        }
    },
    on_finish: () => {
        Object.assign(GazeFollower2.videoElement.style, {
            position: 'fixed', top: '50%', left: '50%', width: 'auto', height: 'auto',
            maxWidth: '100vw', maxHeight: '100vh', transform: 'translate(-50%, -50%) scaleX(-1)'
        });
        Object.assign(GazeFollower2.overlayCanvas.style, {
            position: 'fixed', top: '50%', left: '50%', width: 'auto', height: 'auto',
            maxWidth: '100vw', maxHeight: '100vh', transform: 'translate(-50%, -50%) scaleX(-1)'
        });
        document.body.appendChild(GazeFollower2.videoElement);
        document.body.appendChild(GazeFollower2.overlayCanvas);
    }
};

// 4. Calibration Phase
const calibration_phase = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
        <div id="cali-ready-msg" style="text-align: center;">
            <h3 style="font-size: 20px; font-weight: 700; color: #1d2129; margin-bottom: 8px;">Starting Calibration...</h3>
            <p style="color: #86909c; font-size: 14px;">Please maintain steady fixation on each target on screen.</p>
        </div>
    `,
    choices: [],
    on_load: () => {
        GazeFollower2.showPredictionPoints(false);
        GazeFollower2.showVideo(false);

        GazeFollower2.caliManager.container.style.zIndex = '999999';
        if (typeof GazeFollower2.setRegression === 'function') {
            GazeFollower2.setRegression(config.caliAlgorithm, config.caliAlpha);
        }
        if (typeof GazeFollower2.setRidgeAlpha === 'function') {
            GazeFollower2.setRidgeAlpha(config.caliAlpha);
        }
        if (typeof GazeFollower2.setLissajousSpeed === 'function') {
            GazeFollower2.setLissajousSpeed(config.lissajousSpeed);
        }
        GazeFollower2.startCalibration(config.caliMode, config.caliMethod, config.caliAlgorithm, config.caliLatency, config.caliOrder);

        const originalListener = GazeFollower2.listener;
        GazeFollower2.setGazeListener((data, ts) => {
            if (data === null && ts === null) {
                GazeFollower2.setGazeListener(originalListener);
                const msg = document.getElementById('cali-ready-msg');
                if (msg) msg.innerHTML = `<h3 style="color: #00b42a; font-size: 22px;">✓ Calibration Completed Successfully!</h3>`;
                setTimeout(() => jsPsych.finishTrial(), 600);
            } else {
                if (originalListener) originalListener(data, ts);
            }
        });
    }
};

// 5. Validation Phase with D3 Accuracy & Precision Evaluation
const validation_phase = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => config.doValidation ? `
        <div id="val-hud" style="position: fixed; top: 28px; left: 50%; transform: translateX(-50%); background: #ffffff; border: 1px solid #e5e6eb; border-radius: 9999px; padding: 9px 24px; display: flex; align-items: center; gap: 12px; z-index: 1000000; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #165dff; box-shadow: 0 0 8px rgba(22,93,255,0.5);"></div>
            <span id="val-hud-text" style="font-size: 13.5px; font-weight: 600; color: #1d2129;">Validation: Target 1</span>
        </div>
    ` : '',
    choices: [],
    trial_duration: () => config.doValidation ? null : 0,
    on_load: () => {
        if (!config.doValidation) return;

        const w = window.innerWidth;
        const h = window.innerHeight;
        let points = [];
        
        if (config.valMode === '5-point') {
            points = [[w*0.2, h*0.2], [w*0.8, h*0.2], [w*0.5, h*0.5], [w*0.2, h*0.8], [w*0.8, h*0.8]];
        } else if (config.valMode === '9-point') {
            points = [
                [w*0.2, h*0.2], [w*0.5, h*0.2], [w*0.8, h*0.2],
                [w*0.2, h*0.5], [w*0.5, h*0.5], [w*0.8, h*0.5],
                [w*0.2, h*0.8], [w*0.5, h*0.8], [w*0.8, h*0.8]
            ];
        } else {
            // Random distribution
            const count = config.valRandomCount || 13;
            const padX = w * 0.12;
            const padY = h * 0.12;
            for (let i = 0; i < count; i++) {
                points.push([
                    padX + Math.random() * (w - padX * 2),
                    padY + Math.random() * (h - padY * 2)
                ]);
            }
        }

        // Clean Big-Tech Validation Target
        const targetWrap = document.createElement('div');
        Object.assign(targetWrap.style, {
            position: 'fixed',
            transform: 'translate(-50%, -50%)',
            zIndex: '999999',
            pointerEvents: 'none',
            transition: 'left 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
        });

        const pulseRing = document.createElement('div');
        Object.assign(pulseRing.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(22, 93, 255, 0.35)',
            boxShadow: '0 0 14px rgba(22, 93, 255, 0.2)'
        });
        targetWrap.appendChild(pulseRing);

        const targetCore = document.createElement('div');
        Object.assign(targetCore.style, {
            position: 'relative',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#165dff',
            border: '2.5px solid #165dff',
            boxShadow: '0 4px 14px rgba(22, 93, 255, 0.4), inset 0 0 0 3px #ffffff'
        });
        
        const targetPin = document.createElement('div');
        Object.assign(targetPin.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: '#ffffff',
            transform: 'translate(-50%, -50%)'
        });
        targetCore.appendChild(targetPin);
        targetWrap.appendChild(targetCore);

        document.body.appendChild(targetWrap);

        let currentIndex = 0;
        let currentSamples = [];
        let validationResults = [];
        const geometry = getScreenGeometry(config.screenWidthCm, config.screenHeightCm, config.eyeDistanceCm);
        
        const showNextPoint = () => {
            if (currentIndex >= points.length) {
                targetWrap.remove();
                const hud = document.getElementById('val-hud');
                if (hud) hud.remove();
                jsPsych.finishTrial({
                    screenWidthCm: config.screenWidthCm,
                    screenHeightCm: config.screenHeightCm,
                    eyeDistanceCm: config.eyeDistanceCm,
                    caliAlgorithm: config.caliAlgorithm,
                    caliAlpha: config.caliAlpha,
                    results: validationResults
                });
                return;
            }

            const tx = points[currentIndex][0];
            const ty = points[currentIndex][1];
            targetWrap.style.left = tx + 'px';
            targetWrap.style.top = ty + 'px';
            
            const hudText = document.getElementById('val-hud-text');
            if (hudText) {
                hudText.innerText = `Validation: Target ${currentIndex + 1} / ${points.length} (Please maintain steady gaze)`;
            }

            currentSamples = [];

            // Skip initial 500ms saccade orient period, then collect samples for 1500ms and run D3 (winSize=8)
            setTimeout(() => {
                const listener = (data, ts) => {
                    if (data && Number.isFinite(data.x) && Number.isFinite(data.y)) {
                        currentSamples.push({ x: data.x, y: data.y, timestamp: ts });
                    }
                };
                const old = GazeFollower2.listener;
                GazeFollower2.setGazeListener(listener);

                setTimeout(() => {
                    GazeFollower2.setGazeListener(old);

                    if (currentSamples.length === 0 && Number.isFinite(GazeFollower2.targetX) && Number.isFinite(GazeFollower2.targetY)) {
                        currentSamples.push({ x: GazeFollower2.targetX, y: GazeFollower2.targetY, timestamp: performance.now() });
                    }

                    const d3Metrics = computeD3Metrics(currentSamples, { x: tx, y: ty }, geometry, 8);

                    validationResults.push({
                        point: currentIndex + 1,
                        target: { x: tx, y: ty },
                        predicted: d3Metrics.predicted,
                        errPx: d3Metrics.accPx,
                        errCm: d3Metrics.accCm,
                        deg: d3Metrics.accDeg,
                        accPx: d3Metrics.accPx,
                        accCm: d3Metrics.accCm,
                        accMm: d3Metrics.accMm,
                        accDeg: d3Metrics.accDeg,
                        rmsPx: d3Metrics.rmsPx,
                        rmsCm: d3Metrics.rmsCm,
                        rmsMm: d3Metrics.rmsMm,
                        rmsDeg: d3Metrics.rmsDeg,
                        stdPx: d3Metrics.stdPx,
                        stdCm: d3Metrics.stdCm,
                        stdDeg: d3Metrics.stdDeg,
                        d3: d3Metrics.d3,
                        totalSamples: d3Metrics.totalSamples,
                        windowSize: d3Metrics.windowSize
                    });

                    // Subtle ripple feedback on point capture
                    particleFX.burst(tx, ty, {
                        color: '#165dff',
                        count: 16
                    });

                    currentIndex++;
                    setTimeout(() => showNextPoint(), 150);
                }, 1500);
            }, 500);
        };

        showNextPoint();
    }
};

// 6. Validation Results Dashboard (D3 Accuracy & Precision Analytics)
const validation_results = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
        if (!config.doValidation) return ``;
        
        const data = jsPsych.data.get().last(1).values()[0];
        if (!data || !data.results) return ``;

        const results = data.results;
        const validResults = results.filter(r => Number.isFinite(r.accDeg));
        const count = validResults.length || 1;

        let totalAccPx = 0, totalAccCm = 0, totalAccDeg = 0;
        let totalRmsPx = 0, totalRmsCm = 0, totalRmsDeg = 0;
        let totalStdCm = 0, totalStdDeg = 0;
        
        validResults.forEach(r => {
            totalAccPx += r.accPx;
            totalAccCm += r.accCm;
            totalAccDeg += r.accDeg;
            totalRmsPx += (r.rmsPx || 0);
            totalRmsCm += (r.rmsCm || 0);
            totalRmsDeg += (r.rmsDeg || 0);
            totalStdCm += (r.stdCm || 0);
            totalStdDeg += (r.stdDeg || 0);
        });
        
        const meanAccPx = totalAccPx / count;
        const meanAccCm = totalAccCm / count;
        const meanAccMm = meanAccCm * 10;
        const meanAccDeg = totalAccDeg / count;

        const meanRmsPx = totalRmsPx / count;
        const meanRmsCm = totalRmsCm / count;
        const meanRmsDeg = totalRmsDeg / count;
        const meanStdCm = totalStdCm / count;
        const meanStdDeg = totalStdDeg / count;

        // Rating pill badge based on academic gaze standards
        let gradeBadge = '';
        if (meanAccDeg < 1.3) {
            gradeBadge = '<span class="status-pill" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ★ Excellent Accuracy (Research Grade)</span>';
        } else if (meanAccDeg < 2.0) {
            gradeBadge = '<span class="status-pill info" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ✓ Good Accuracy (Interactive Grade)</span>';
        } else if (meanAccDeg < 3.0) {
            gradeBadge = '<span class="status-pill warning" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ▲ Moderate Accuracy (Maintain steady posture)</span>';
        } else {
            gradeBadge = '<span class="status-pill danger" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ⚠ Recalibration Recommended</span>';
        }

        const geo = getScreenGeometry(config.screenWidthCm, config.screenHeightCm, config.eyeDistanceCm);

        // Build Big-Tech Analytics Dashboard
        let html = `
            <div style="width: 100%; max-width: 980px; margin: 0 auto; text-align: left;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
                    <div>
                        <h2 style="font-size: 22px; font-weight: 700; color: #1d2129; letter-spacing: -0.01em; margin-bottom: 4px;">D3 Accuracy & Precision Analytics</h2>
                        <p style="font-size: 13px; color: #86909c;">
                            Display: ${config.screenWidthCm} × ${config.screenHeightCm} cm @ ${config.eyeDistanceCm} cm Distance • ${config.caliAlgorithm === 'ridge' ? `Multivariate Ridge (α=${config.caliAlpha})` : 'SVR'} (${results.length} validation points • D3 Sliding Window)
                        </p>
                    </div>
                    <div>
                        ${gradeBadge}
                    </div>
                </div>

                <!-- Hero Metric KPI Cards -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
                    <div class="studio-card" style="padding: 18px; border-top: 3px solid #165dff;">
                        <span style="font-size: 12px; font-weight: 600; color: #86909c; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">D3 Mean Accuracy (ACC)</span>
                        <div style="font-size: 32px; font-weight: 700; color: #165dff; letter-spacing: -0.02em;">
                            ${meanAccDeg.toFixed(2)}° <span style="font-size: 17px; font-weight: 600; color: #4e5969;">(${meanAccCm.toFixed(2)} cm)</span>
                        </div>
                        <span style="font-size: 12px; color: #86909c; margin-top: 4px; display: block;">${meanAccPx.toFixed(1)} px • ${meanAccMm.toFixed(1)} mm displacement</span>
                    </div>

                    <div class="studio-card" style="padding: 18px; border-top: 3px solid #00b42a;">
                        <span style="font-size: 12px; font-weight: 600; color: #86909c; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">D3 Mean Precision (Pre / RMS)</span>
                        <div style="font-size: 32px; font-weight: 700; color: #00b42a; letter-spacing: -0.02em;">
                            ${meanRmsDeg.toFixed(2)}° <span style="font-size: 17px; font-weight: 600; color: #4e5969;">(${meanRmsCm.toFixed(2)} cm)</span>
                        </div>
                        <span style="font-size: 12px; color: #86909c; margin-top: 4px; display: block;">RMS: ${meanRmsPx.toFixed(1)} px • STD: ${meanStdDeg.toFixed(2)}° (${meanStdCm.toFixed(2)} cm)</span>
                    </div>

                    <div class="studio-card" style="padding: 18px; border-top: 3px solid #ff7d00;">
                        <span style="font-size: 12px; font-weight: 600; color: #86909c; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">Screen & Viewing Geometry</span>
                        <div style="font-size: 26px; font-weight: 700; color: #1d2129; letter-spacing: -0.02em; margin-top: 4px;">
                            ${config.screenWidthCm}×${config.screenHeightCm} <span style="font-size: 15px; font-weight: 500; color: #86909c;">cm @ ${config.eyeDistanceCm} cm</span>
                        </div>
                        <span style="font-size: 12px; color: #86909c; margin-top: 4px; display: block;">${geo.ppdX.toFixed(1)}×${geo.ppdY.toFixed(1)} px/° • ${geo.mmPerPxX.toFixed(2)}×${geo.mmPerPxY.toFixed(2)} mm/px</span>
                    </div>
                </div>

                <!-- Per-Point Detailed Table -->
                <div class="studio-card" style="padding: 0; overflow: hidden; margin-bottom: 20px;">
                    <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #fafbfc;">
                        <span style="font-size: 13px; font-weight: 600; color: #1d2129;">Spatial Validation Details (D3 Best Fixation Window)</span>
                        <span style="font-size: 12px; color: #86909c;">Targets 1 to ${results.length}</span>
                    </div>
                    <div style="max-height: 240px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead>
                                <tr style="background: #fafbfc; color: #86909c; border-bottom: 1px solid var(--border-color); font-size: 12px;">
                                    <th style="padding: 10px 18px; font-weight: 600;">#</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">Target Position</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">D3 Predicted Gaze</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">D3 ACC (cm / px)</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">D3 ACC (°)</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">D3 Pre RMS (cm / °)</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        results.forEach(r => {
            const accDegVal = Number.isFinite(r.accDeg) ? r.accDeg : 0;
            const angleColor = accDegVal < 1.5 ? '#00b42a' : (accDegVal < 2.5 ? '#ff7d00' : '#f53f3f');
            const predX = Number.isFinite(r.predicted.x) ? Math.round(r.predicted.x) : '--';
            const predY = Number.isFinite(r.predicted.y) ? Math.round(r.predicted.y) : '--';
            const accCmStr = Number.isFinite(r.accCm) ? `${r.accCm.toFixed(2)} cm (${r.accPx.toFixed(1)} px)` : '--';
            const accDegStr = Number.isFinite(r.accDeg) ? `${r.accDeg.toFixed(2)}°` : '--';
            const rmsStr = Number.isFinite(r.rmsCm) ? `${r.rmsCm.toFixed(2)} cm (${r.rmsDeg.toFixed(2)}°)` : '--';
            html += `
                <tr style="border-bottom: 1px solid #f2f3f5; transition: background 0.15s;">
                    <td style="padding: 10px 18px; font-weight: 600; color: #4e5969;">${r.point}</td>
                    <td style="padding: 10px 18px; color: #1d2129;">(${Math.round(r.target.x)}, ${Math.round(r.target.y)})</td>
                    <td style="padding: 10px 18px; color: #1d2129;">(${predX}, ${predY})</td>
                    <td style="padding: 10px 18px; font-weight: 600; color: #1d2129;">${accCmStr}</td>
                    <td style="padding: 10px 18px; font-weight: 600; color: ${angleColor};">${accDegStr}</td>
                    <td style="padding: 10px 18px; font-weight: 600; color: #00b42a;">${rmsStr}</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        return html;
    },
    choices: () => config.doValidation ? ['Launch Live Tracking'] : [],
    button_html: '<button class="studio-btn" style="min-width: 260px; margin-top: 10px;">%choice%</button>',
    trial_duration: () => config.doValidation ? null : 0
};

// 7. Live Gaze Visualization Phase
const free_gaze = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
        <div id="gaze-hud" style="position: fixed; top: 28px; left: 50%; transform: translateX(-50%); background: #ffffff; border: 1px solid #e5e6eb; border-radius: 9999px; padding: 8px 24px; display: flex; align-items: center; gap: 14px; z-index: 1000000; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #165dff;" class="pulse-dot"></div>
            <span style="font-size: 13.5px; font-weight: 600; color: #1d2129;">Live Gaze Tracking Active</span>
            <span id="gaze-coords" style="font-size: 12.5px; font-family: monospace; color: #4e5969; background: #f2f3f5; padding: 3px 8px; border-radius: 4px;">X: --- Y: ---</span>
            <span style="font-size: 12px; color: #86909c; border-left: 1px solid #e5e6eb; padding-left: 12px;">Press [Space] to Exit</span>
        </div>
        <div style="position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); color: #86909c; font-size: 13px; pointer-events: none; background: rgba(255, 255, 255, 0.9); padding: 6px 16px; border-radius: 9999px; border: 1px solid #e5e6eb; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            Follow the tracking reticle with your eyes across the screen
        </div>
    `,
    choices: [' '],
    on_load: () => {
        let gazeCursor = document.getElementById('gaze-cursor');
        if (!gazeCursor) {
            gazeCursor = document.createElement('div');
            gazeCursor.id = 'gaze-cursor';
            document.body.appendChild(gazeCursor);
        }
        
        const coordsText = document.getElementById('gaze-coords');

        GazeFollower2.setGazeListener((data) => {
            if (data && !isNaN(data.x) && !isNaN(data.y)) {
                gazeCursor.style.display = 'block';
                gazeCursor.style.left = data.x + 'px';
                gazeCursor.style.top = data.y + 'px';
                if (coordsText) {
                    coordsText.innerText = `X: ${Math.round(data.x)}  Y: ${Math.round(data.y)}`;
                }
            }
        });
    },
    on_finish: () => {
        const gazeCursor = document.getElementById('gaze-cursor');
        if (gazeCursor) gazeCursor.style.display = 'none';
        const hud = document.getElementById('gaze-hud');
        if (hud) hud.remove();
    }
};

jsPsych.run([
    request_camera,
    enter_fullscreen, 
    setup_panel, 
    calibration_phase, 
    validation_phase, 
    validation_results, 
    free_gaze
]);
