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

// Auto-detect browser language: default to 'en' unless user environment is Chinese 'zh'
let currentLang = localStorage.getItem('gf2_lang') || 
    (((navigator.language || navigator.userLanguage || '').toLowerCase().startsWith('zh')) ? 'zh' : 'en');

const I18N = {
    en: {
        langBtn: "中文",
        grantCameraTitle: "GazeFollower2 Web Eye Tracking",
        grantCameraDesc: "Real-time in-browser gaze estimation powered by client-side neural vision models, requiring no specialized hardware.",
        grantCameraPrivacy: "Please allow camera access when prompted by your browser. Video frames are processed strictly within your browser and never uploaded.",
        grantCameraBtn: "Grant Camera Access",

        fullscreenTitle: "Fullscreen Calibration & Tracking",
        fullscreenDesc: "To maintain screen coordinate mapping accuracy and metric visual angle calculations, the session will operate in fullscreen mode.",
        fullscreenBtn: "Enter Fullscreen",

        controlCenterTitle: "GazeFollower2 Control Center",
        controlCenterSubtitle: "Hardware geometry & gaze calibration setup",
        ready: "Ready",
        initFailed: "Init Failed",
        initializing: "Initializing...",
        faceDetected: "Face Detected",
        searchingFace: "Searching Face...",
        faceDetecting: "Detecting...",

        liveViewfinder: "Live Viewfinder",
        throughput: "Throughput",
        pipelineTotal: "Pipeline Total",
        mediapipe: "MediaPipe",
        gazeNet: "GazeNet",

        inferenceModelTitle: "Inference Model",
        modelTagFP16: "FP16 Half-Precision (~3.8 MB)",
        modelTagFP32: "FP32 Full-Precision (~7.6 MB)",
        optFP16: "GazeNet_Next FP16 (3.8 MB - Half-Precision Fast)",
        optFP32: "GazeNet_Next FP32 (7.6 MB - Full-Precision SOTA)",
        modelHint: "Hot-switch models to compare download payload and GPU inference latency.",

        visionPreproc: "Vision Preprocessing",
        gazeSmoothing: "Gaze Smoothing (Heuristic Filter)",
        enabledDefault: "Enabled (Default)",
        disabledRaw: "Disabled (Raw)",
        lookAheadLabel: "look_ahead",
        lookAheadHint: "Default: 2",

        calibrationSetup: "Calibration Setup",
        targetPattern: "Target Pattern",
        opt13Pt: "13-Point Enhanced Grid (Recommended)",
        opt9Pt: "9-Point Standard Grid",
        opt5Pt: "5-Point Fast Grid",
        optRandom: "13-Point Random Distribution",
        optLissajous: "Lissajous Continuous Pursuit",
        targetOrder: "Target Order",
        optRandomOrder: "Randomized (Prevents anticipation - Default)",
        optSequentialOrder: "Sequential Order",
        pursuitSpeed: "Pursuit Speed",
        presetLabel: "Preset...",
        speedSlow: "150 px/s (Slow)",
        speedGentle: "200 px/s (Smooth)",
        speedRec: "250 px/s (Recommended)",
        speedMod: "350 px/s (Moderate)",
        speedFast: "500 px/s (Fast)",
        interactionMode: "Interaction Mode",
        optManualClick: "Manual Click (Tactile Confirmation)",
        optAutoDwell: "Auto Dwell (1.5s Fixation)",
        caliAlgorithm: "Calibration Algorithm",
        optRidge: "Multivariate Ridge (Analytical - Default)",
        optSVR: "Support Vector Regression (RBF Kernel)",
        ridgeAlpha: "Ridge Regularization (λ)",
        alphaDefault: "Default: 1.0",
        alpha5pt: "3.0 (5-pt Anti-Divergence)",
        alpha9pt: "2.0 (9-pt Standard)",
        alpha13pt: "1.0 (13-pt Enhanced)",
        latencyComp: "Hardware Latency Compensation",
        latencyFrames: "frames (~{ms} ms{def})",

        displayGeometry: "Display & Viewing Geometry",
        presetCustom: "Custom Size...",
        screenWidth: "Screen Width",
        screenHeight: "Screen Height",
        eyeDistance: "Eye Distance",
        geoHint: "Please enter physical screen width (cm), height (cm), and viewing distance (cm) for D3 visual angle (θ°) and physical accuracy/precision evaluation.",

        validationProtocol: "Validation Protocol",
        runValidation: "Run Accuracy Validation",
        optValYes: "Yes (D3 Accuracy & Precision Evaluation)",
        optValNo: "No (Skip directly to tracking)",
        valPattern: "Validation Pattern",
        optValRandom: "Random (13 Points - Default)",
        optVal9Pt: "9-Point Standard",
        optVal5Pt: "5-Point Fast",

        startCalibrationBtn: "Start Calibration",

        caliStarting: "Starting Calibration...",
        caliFixate: "Please maintain steady fixation on each target on screen.",
        caliSuccess: "Calibration Completed Successfully!",
        valTargetHud: "Validation: Target {idx}",

        valReportTitle: "D3 Accuracy & Precision Analytics",
        valReportSubtitle: "Display: {w} × {h} cm @ {d} cm Distance • {algo} ({count} validation points • D3 Sliding Window)",
        gradeExcellent: "★ Excellent Accuracy (Research Grade)",
        gradeGood: "✓ Good Accuracy (Interactive Grade)",
        gradeModerate: "▲ Moderate Accuracy (Maintain steady posture)",
        gradeRecalib: "⚠ Recalibration Recommended",
        meanAccuracyTitle: "D3 Mean Accuracy (ACC)",
        meanPrecisionTitle: "D3 Mean Precision (Pre / RMS)",
        screenGeometryTitle: "Screen & Viewing Geometry",
        displacementLabel: "{px} px • {mm} mm displacement",
        precisionSubLabel: "RMS: {px} px • STD: {deg}° ({cm} cm)",
        tableTitle: "Spatial Validation Details (D3 Best Fixation Window)",
        tableSubtitle: "Targets 1 to {count}",
        colNum: "#",
        colTargetPos: "Target Position",
        colPredGaze: "D3 Predicted Gaze",
        colAccCmPx: "D3 ACC (cm / px)",
        colAccDeg: "D3 ACC (°)",
        colPreRms: "D3 Pre RMS (cm / °)",
        launchLiveTracking: "Launch Live Tracking",

        liveTrackingActive: "Live Gaze Tracking",
        pressSpaceExit: "Press [Space] to Exit",
        followReticle: "Follow the tracking reticle with your eyes across the screen"
    },
    zh: {
        langBtn: "English",
        grantCameraTitle: "GazeFollower2 网页端视线追踪",
        grantCameraDesc: "基于端侧轻量级神经网络视觉模型的实时视线估计，无需任何外部眼动硬件。",
        grantCameraPrivacy: "请在浏览器提示时允许摄像头访问权限。视频画面仅在本地浏览器内存中计算，绝不上传云端。",
        grantCameraBtn: "允许摄像头访问",

        fullscreenTitle: "全屏标定与视线追踪",
        fullscreenDesc: "为确保屏幕像素坐标精确映射并计算毫米级视角色度量，实验将在全屏模式下运行。",
        fullscreenBtn: "进入全屏模式",

        controlCenterTitle: "GazeFollower2 控制中心",
        controlCenterSubtitle: "屏幕空间几何与视线校准参数配置",
        ready: "就绪",
        initFailed: "初始化失败",
        initializing: "初始化中...",
        faceDetected: "已检测到人脸",
        searchingFace: "寻找人脸中...",
        faceDetecting: "检测中...",

        liveViewfinder: "实时取景画面",
        throughput: "处理吞吐",
        pipelineTotal: "全链路延迟",
        mediapipe: "MediaPipe",
        gazeNet: "GazeNet",

        inferenceModelTitle: "推理模型选项",
        modelTagFP16: "FP16 半精度 (~3.8 MB)",
        modelTagFP32: "FP32 全精度 (~7.6 MB)",
        optFP16: "GazeNet_Next FP16 (3.8 MB - 半精度极速推荐)",
        optFP32: "GazeNet_Next FP32 (7.6 MB - 原始全精度基准)",
        modelHint: "支持热切换模型，可直观对比模型体积与 GPU 实时推理耗时。",

        visionPreproc: "视觉预处理与滤波",
        gazeSmoothing: "视线防抖平滑 (启发式滤波)",
        enabledDefault: "启用 (默认推荐)",
        disabledRaw: "关闭 (原始输出)",
        lookAheadLabel: "前瞻窗口 look_ahead",
        lookAheadHint: "默认: 2",

        calibrationSetup: "标定参数配置",
        targetPattern: "标定点阵排布",
        opt13Pt: "13 点增强网格 (推荐)",
        opt9Pt: "9 点标准网格",
        opt5Pt: "5 点快速网格",
        optRandom: "13 点随机空间分布",
        optLissajous: "Lissajous 连续平滑追随",
        targetOrder: "呈现顺序",
        optRandomOrder: "随机顺序 (防止预判 - 默认)",
        optSequentialOrder: "顺序呈现",
        pursuitSpeed: "追随移动速度",
        presetLabel: "预设速度...",
        speedSlow: "150 px/s (慢速)",
        speedGentle: "200 px/s (平缓)",
        speedRec: "250 px/s (推荐)",
        speedMod: "350 px/s (适中)",
        speedFast: "500 px/s (快速)",
        interactionMode: "交互采集方式",
        optManualClick: "手动点击 (触觉确认)",
        optAutoDwell: "自动注视停留 (1.5s 凝视)",
        caliAlgorithm: "标定拟合算法",
        optRidge: "多元岭回归 (解析闭式解 - 默认)",
        optSVR: "支持向量回归 (RBF 核函数)",
        ridgeAlpha: "岭回归正则化系数 (λ)",
        alphaDefault: "默认: 1.0",
        alpha5pt: "3.0 (5 点防外推失真)",
        alpha9pt: "2.0 (9 点标准)",
        alpha13pt: "1.0 (13 点完备拟合)",
        latencyComp: "硬件时延补偿",
        latencyFrames: "帧 (~{ms} ms{def})",

        displayGeometry: "屏幕显示与视距几何",
        presetCustom: "自定义尺寸...",
        screenWidth: "屏幕宽度",
        screenHeight: "屏幕高度",
        eyeDistance: "视距",
        geoHint: "请输入显示器物理宽高 (cm) 及观看距离 (cm)，用于计算视角色误差 (D3 标准) 及精确度量。",

        validationProtocol: "精度验证协议",
        runValidation: "执行精度验证",
        optValYes: "执行 (评估 D3 准确度与空间离散度)",
        optValNo: "跳过 (直接进入视线追踪)",
        valPattern: "验证点阵排布",
        optValRandom: "13 点随机分布 (默认)",
        optVal9Pt: "9 点标准网格",
        optVal5Pt: "5 点快速网格",

        startCalibrationBtn: "开始标定",

        caliStarting: "准备开始标定...",
        caliFixate: "请用视线跟随屏幕中央出现的注视目标点并保持凝视。",
        caliSuccess: "标定完成！",
        valTargetHud: "精度验证: 目标 {idx}",

        valReportTitle: "D3 视线精度与空间离散度分析报告",
        valReportSubtitle: "显示器: {w} × {h} cm @ {d} cm 视距 • {algo} ({count} 验证点 • D3 滑动窗口)",
        gradeExcellent: "★ 优异精度 (科研/学术级)",
        gradeGood: "✓ 良好精度 (人机交互级)",
        gradeModerate: "▲ 中等精度 (建议保持坐姿稳定)",
        gradeRecalib: "⚠ 建议重新标定",
        meanAccuracyTitle: "D3 平均视角色误差 (准确度)",
        meanPrecisionTitle: "D3 采样离散抖动 (精度 / RMS)",
        screenGeometryTitle: "显示器物理空间几何",
        displacementLabel: "{px} px • {mm} mm 空间位移",
        precisionSubLabel: "RMS: {px} px • STD: {deg}° ({cm} cm)",
        tableTitle: "各目标点实测明细 (D3 最佳凝视窗口)",
        tableSubtitle: "目标点 1 至 {count}",
        colNum: "#",
        colTargetPos: "目标位置",
        colPredGaze: "D3 预测注视点",
        colAccCmPx: "空间偏差 (cm / px)",
        colAccDeg: "视角色误差 (°)",
        colPreRms: "离散度 RMS (cm / °)",
        launchLiveTracking: "启动实时追踪",

        liveTrackingActive: "实时视线追踪进行中",
        pressSpaceExit: "按 [空格键] 退出",
        followReticle: "请用双眼在屏幕范围内移动，注视准星将实时跟随视线"
    }
};

function t(key, params = {}) {
    let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N['en'] && I18N['en'][key]) || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
}

let config = {
    modelPath: 'models/GazeNet_Next_fp16.onnx',
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

    // Display DPI / PPI
    const diagInches = Math.sqrt(Math.pow(widthCm / 2.54, 2) + Math.pow(heightCm / 2.54, 2));
    const diagPx = Math.sqrt(Math.pow(screenW, 2) + Math.pow(screenH, 2));
    const ppi = diagInches > 0 ? (diagPx / diagInches) : 141.2;

    // Pixels per degree (PPD) at the specified eye-to-screen distance
    const ppdX = (screenW / 2) / (Math.atan((widthCm / 2) / distCm) * (180 / Math.PI));
    const ppdY = (screenH / 2) / (Math.atan((heightCm / 2) / distCm) * (180 / Math.PI));
    const ppd = (ppdX + ppdY) / 2;

    return {
        screenW, screenH, widthCm, heightCm, distCm,
        cmPerPxX, cmPerPxY, mmPerPxX, mmPerPxY, cmPerPx, mmPerPx,
        ppi, ppdX, ppdY, ppd
    };
}

// Convert 2D Euclidean distance in pixels to visual angle in degrees
function pixelDistanceToVisualAngle(dxPx, dyPx, screenWidthCm, screenHeightCm, eyeDistCm) {
    const geo = getScreenGeometry(screenWidthCm, screenHeightCm, eyeDistCm);
    const dxCm = dxPx * geo.cmPerPxX;
    const dyCm = dyPx * geo.cmPerPxY;
    const distCm = Math.sqrt(dxCm * dxCm + dyCm * dyCm);
    const angleRad = 2 * Math.atan(distCm / (2 * geo.distCm));
    const angleDeg = angleRad * (180 / Math.PI);
    return { angleDeg, distCm, distMm: distCm * 10 };
}

// Compute D3 Sliding-Window Accuracy (ACC) & Precision (PRE/RMS) metrics
function computeD3Metrics(samples, targetPx, screenWidthCm, screenHeightCm, eyeDistCm, windowSize = 25) {
    const valid = samples.filter(s => s && Number.isFinite(s.x) && Number.isFinite(s.y));
    if (valid.length === 0) {
        return {
            accPx: NaN, accCm: NaN, accMm: NaN, accDeg: NaN,
            rmsPx: NaN, rmsCm: NaN, rmsMm: NaN, rmsDeg: NaN,
            stdPx: NaN, stdCm: NaN, stdDeg: NaN,
            d3: NaN, bestWindowIndex: -1, totalSamples: 0
        };
    }

    const effWin = Math.min(windowSize, valid.length);
    let best = null;

    for (let i = 0; i <= valid.length - effWin; i++) {
        const win = valid.slice(i, i + effWin);
        let sumX = 0, sumY = 0;
        win.forEach(p => { sumX += p.x; sumY += p.y; });
        const meanX = sumX / effWin;
        const meanY = sumY / effWin;

        const dxPx = meanX - targetPx.x;
        const dyPx = meanY - targetPx.y;
        const accPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
        const { angleDeg: accDeg, distCm: accCm } = pixelDistanceToVisualAngle(dxPx, dyPx, screenWidthCm, screenHeightCm, eyeDistCm);

        let sumSqrDiffPx = 0, sumSqrDiffCm = 0;
        let diffAngles = [];
        for (let j = 0; j < effWin - 1; j++) {
            const sx = win[j + 1].x - win[j].x;
            const sy = win[j + 1].y - win[j].y;
            sumSqrDiffPx += (sx * sx + sy * sy);
            const d = pixelDistanceToVisualAngle(sx, sy, screenWidthCm, screenHeightCm, eyeDistCm);
            sumSqrDiffCm += (d.distCm * d.distCm);
            diffAngles.push(d.angleDeg);
        }

        const rmsPx = effWin > 1 ? Math.sqrt(sumSqrDiffPx / (effWin - 1)) : 0;
        const rmsCm = effWin > 1 ? Math.sqrt(sumSqrDiffCm / (effWin - 1)) : 0;
        const rmsDeg = effWin > 1 ? Math.sqrt(diffAngles.reduce((acc, a) => acc + a * a, 0) / (effWin - 1)) : 0;

        let sumDevPx = 0, sumDevCm = 0, sumDevDeg = 0;
        win.forEach(p => {
            const devX = p.x - meanX;
            const devY = p.y - meanY;
            sumDevPx += (devX * devX + devY * devY);
            const dev = pixelDistanceToVisualAngle(devX, devY, screenWidthCm, screenHeightCm, eyeDistCm);
            sumDevCm += (dev.distCm * dev.distCm);
            sumDevDeg += (dev.angleDeg * dev.angleDeg);
        });
        const stdPx = Math.sqrt(sumDevPx / effWin);
        const stdCm = Math.sqrt(sumDevCm / effWin);
        const stdDeg = Math.sqrt(sumDevDeg / effWin);

        const d3Val = Math.sqrt(accDeg * accDeg + rmsDeg * rmsDeg);

        if (!best || d3Val < best.d3Val) {
            best = {
                d3Val, accPx, accCm, accDeg,
                rmsPx, rmsCm, rmsDeg,
                stdPx, stdCm, stdDeg,
                meanX, meanY, idx: i
            };
        }
    }

    const bestIdx = best ? best.idx : 0;
    return {
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
    stimulus: () => `
        <div class="studio-card" style="max-width: 540px; text-align: center; margin: 0 auto; padding: 36px 32px;">
            <img src="./gazefollower.png" style="width: 68px; height: 68px; margin: 0 auto 18px; border-radius: 16px; object-fit: contain; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); display: block;" alt="GazeFollower2">
            <h2 style="font-size: 22px; font-weight: 700; color: #1d2129; margin-bottom: 8px; letter-spacing: -0.01em;">${t('grantCameraTitle')}</h2>
            <p style="color: #4e5969; font-size: 14px; line-height: 1.6; margin-bottom: 22px;">
                ${t('grantCameraDesc')}
            </p>
            <p style="font-size: 13px; color: #86909c; line-height: 1.5; margin-bottom: 8px;">
                ${t('grantCameraPrivacy')}
            </p>
        </div>
    `,
    choices: () => [t('grantCameraBtn')],
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
    stimulus: () => `
        <div class="studio-card" style="max-width: 500px; text-align: center; margin: 0 auto; padding: 32px 28px;">
            <div style="width: 52px; height: 52px; margin: 0 auto 16px; border-radius: 12px; background: #e8f3ff; border: 1px solid #bedaff; display: flex; align-items: center; justify-content: center;">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#165dff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
            </div>
            <h3 style="font-size: 20px; font-weight: 700; color: #1d2129; margin-bottom: 8px;">${t('fullscreenTitle')}</h3>
            <p style="color: #4e5969; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                ${t('fullscreenDesc')}
            </p>
        </div>
    `,
    choices: () => [t('fullscreenBtn')],
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

function renderSetupHtml() {
    return `
        <div style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 1140px; margin: 0 auto; padding: 12px 0;">
            <!-- Header Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="./gazefollower.png" style="width: 38px; height: 38px; border-radius: 8px; object-fit: contain; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);" alt="GazeFollower2">
                    <div>
                        <h2 id="header-title" style="font-size: 18px; font-weight: 700; color: #1d2129; letter-spacing: -0.01em;">${t('controlCenterTitle')}</h2>
                        <p id="header-subtitle" style="font-size: 12px; color: #86909c;">${t('controlCenterSubtitle')}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="btn-lang-toggle" class="studio-btn studio-btn-secondary" style="padding: 4px 12px; font-size: 12px; height: 30px; display: inline-flex; align-items: center; gap: 4px; border-radius: 6px; cursor: pointer;">
                        🌐 <span id="btn-lang-text">${t('langBtn')}</span>
                    </button>
                    <span id="badge-status" class="status-pill info"><span class="pulse-dot"></span> ${t('initializing')}</span>
                </div>
            </div>

            <!-- Two-Column Workspace Layout -->
            <div style="display: grid; grid-template-columns: 440px 1fr; gap: 20px; width: 100%;">
                
                <!-- Left Column: Camera Viewfinder, Model & Preprocessing -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="studio-card" style="padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span id="label-viewfinder" style="font-size: 13px; font-weight: 600; color: #1d2129;">${t('liveViewfinder')}</span>
                            <span id="badge-face-tracking" class="status-pill info" style="font-size: 11px;">${t('faceDetecting')}</span>
                        </div>
                        <div id="video-anchor" style="position: relative; width: 100%; aspect-ratio: 4/3; background: #000; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                            <div id="sdk-status-wrap" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.92); z-index: 10;">
                                <div style="width: 32px; height: 32px; border: 3px solid #e5e6eb; border-top-color: #165dff; border-radius: 50%; animation: gf-spin 1s linear infinite; margin-bottom: 12px;"></div>
                                <p id="sdk-status" style="color: #4e5969; font-size: 13px; font-weight: 500;">Loading neural model...</p>
                            </div>
                        </div>


                    </div>

                    <!-- Neural Model Selector Card (ONNX Only: FP16 vs FP32) -->
                    <div class="studio-card" style="padding: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span id="label-model-title" style="font-size: 13px; font-weight: 600; color: #1d2129;">${t('inferenceModelTitle')}</span>
                            <span id="badge-model-tag" class="status-pill info" style="font-size: 11px;">${config.modelPath.includes('fp16') ? t('modelTagFP16') : t('modelTagFP32')}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <select id="sel-model-variant" class="studio-select" style="width: 100%;">
                                <option value="models/GazeNet_Next_fp16.onnx" ${config.modelPath.includes('fp16') ? 'selected' : ''}>${t('optFP16')}</option>
                                <option value="models/GazeNet_Next.onnx" ${!config.modelPath.includes('fp16') ? 'selected' : ''}>${t('optFP32')}</option>
                            </select>
                            <div id="model-hint-text" style="font-size: 11.5px; color: #86909c; line-height: 1.4;">
                                ${t('modelHint')}
                            </div>
                        </div>
                    </div>

                    <!-- AI Preprocessing Controls -->
                    <div class="studio-card" style="padding: 18px;">
                        <span id="label-vision-preproc" style="font-size: 13px; font-weight: 600; color: #1d2129; display: block; margin-bottom: 12px;">${t('visionPreproc')}</span>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="display: grid; grid-template-columns: 1fr 140px; gap: 10px;">
                                <div>
                                    <label id="label-gaze-smooth" class="studio-label">${t('gazeSmoothing')}</label>
                                    <select id="sel-gaze-filter" class="studio-select" style="width: 100%;">
                                        <option value="true" ${config.gazeFilter !== false ? 'selected' : ''}>${t('enabledDefault')}</option>
                                        <option value="false" ${config.gazeFilter === false ? 'selected' : ''}>${t('disabledRaw')}</option>
                                    </select>
                                </div>
                                <div id="look-ahead-wrap">
                                    <label class="studio-label"><span id="label-look-ahead">${t('lookAheadLabel')}</span><span id="look-ahead-hint" style="font-size: 11px; color: #86909c;">${t('lookAheadHint')}</span></label>
                                    <input type="number" id="inp-look-ahead" class="studio-input" value="${config.look_ahead || 2}" min="1" max="15" step="1" style="width: 100%;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column: Calibration Setup, Display Geometry, Validation Protocol & Start Button -->
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    
                    <!-- Card 1: Calibration Engine -->
                    <div class="studio-card" style="padding: 18px;">
                        <span id="label-cali-setup" style="font-size: 13px; font-weight: 600; color: #1d2129; display: block; margin-bottom: 12px;">${t('calibrationSetup')}</span>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label id="label-target-pattern" class="studio-label">${t('targetPattern')}</label>
                                <select id="sel-cali-mode" class="studio-select" style="width: 100%;">
                                    <option value="13-point" ${config.caliMode === '13-point' ? 'selected' : ''}>${t('opt13Pt')}</option>
                                    <option value="9-point" ${config.caliMode === '9-point' ? 'selected' : ''}>${t('opt9Pt')}</option>
                                    <option value="5-point" ${config.caliMode === '5-point' ? 'selected' : ''}>${t('opt5Pt')}</option>
                                    <option value="random" ${config.caliMode === 'random' ? 'selected' : ''}>${t('optRandom')}</option>
                                    <option value="lissajous" ${config.caliMode === 'lissajous' ? 'selected' : ''}>${t('optLissajous')}</option>
                                </select>
                            </div>
                            <div id="cali-order-wrap">
                                <label id="label-target-order" class="studio-label">${t('targetOrder')}</label>
                                <select id="sel-cali-order" class="studio-select" style="width: 100%;">
                                    <option value="random" ${config.caliOrder === 'random' ? 'selected' : ''}>${t('optRandomOrder')}</option>
                                    <option value="sequential" ${config.caliOrder === 'sequential' ? 'selected' : ''}>${t('optSequentialOrder')}</option>
                                </select>
                            </div>
                            <div id="lissajous-speed-wrap" style="display: none;">
                                <label class="studio-label">
                                    <span id="label-pursuit-speed">${t('pursuitSpeed')}</span>
                                    <span id="lissajous-dur-hint" style="font-size: 11px; color: #86909c;">~25s</span>
                                </label>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input type="number" id="inp-lissajous-speed" class="studio-input" value="250" step="25" min="50" max="800" style="flex: 1;">
                                    <select id="sel-lissajous-preset" class="studio-select" style="width: 115px; padding: 7px 6px; font-size: 12px;">
                                        <option value="custom">${t('presetLabel')}</option>
                                        <option value="150">${t('speedSlow')}</option>
                                        <option value="200">${t('speedGentle')}</option>
                                        <option value="250" selected>${t('speedRec')}</option>
                                        <option value="350">${t('speedMod')}</option>
                                        <option value="500">${t('speedFast')}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label id="label-interaction-mode" class="studio-label">${t('interactionMode')}</label>
                                <select id="sel-cali-method" class="studio-select" style="width: 100%;">
                                    <option value="click" ${config.caliMethod === 'click' ? 'selected' : ''}>${t('optManualClick')}</option>
                                    <option value="auto" ${config.caliMethod === 'auto' ? 'selected' : ''}>${t('optAutoDwell')}</option>
                                </select>
                            </div>
                            <div>
                                <label id="label-cali-algo" class="studio-label">${t('caliAlgorithm')}</label>
                                <select id="sel-cali-algo" class="studio-select" style="width: 100%;">
                                    <option value="ridge" ${config.caliAlgorithm === 'ridge' ? 'selected' : ''}>${t('optRidge')}</option>
                                    <option value="svr" ${config.caliAlgorithm === 'svr' ? 'selected' : ''}>${t('optSVR')}</option>
                                </select>
                            </div>
                            <div id="alpha-wrap">
                                <label class="studio-label">
                                    <span id="label-ridge-alpha">${t('ridgeAlpha')}</span>
                                    <span id="alpha-hint" style="font-size: 11px; color: #86909c;">${t('alphaDefault')}</span>
                                </label>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input type="number" id="inp-cali-alpha" class="studio-input" value="${config.caliAlpha || '1.0'}" step="0.1" min="0.0001" max="1000" style="flex: 1;">
                                    <select id="sel-alpha-preset" class="studio-select" style="width: 130px; padding: 7px 6px; font-size: 12px;">
                                        <option value="custom">${t('presetLabel')}</option>
                                        <option value="1.0" ${config.caliAlpha === 1.0 ? 'selected' : ''}>${t('alpha13pt')}</option>
                                        <option value="2.0" ${config.caliAlpha === 2.0 ? 'selected' : ''}>${t('alpha9pt')}</option>
                                        <option value="3.0" ${config.caliAlpha === 3.0 ? 'selected' : ''}>${t('alpha5pt')}</option>
                                        <option value="0.1">0.1</option>
                                        <option value="5.0">5.0</option>
                                        <option value="10.0">10.0</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label id="label-latency-comp" class="studio-label">${t('latencyComp')}</label>
                                <select id="sel-cali-latency" class="studio-select" style="width: 100%;">
                                    <option value="0" ${config.caliLatency === 0 ? 'selected' : ''}>0 ${t('latencyFrames', { ms: '0', def: '' })}</option>
                                    <option value="2" ${config.caliLatency === 2 ? 'selected' : ''}>2 ${t('latencyFrames', { ms: '66', def: '' })}</option>
                                    <option value="4" ${config.caliLatency === 4 ? 'selected' : ''}>4 ${t('latencyFrames', { ms: '133', def: ' - Default' })}</option>
                                    <option value="6" ${config.caliLatency === 6 ? 'selected' : ''}>6 ${t('latencyFrames', { ms: '200', def: '' })}</option>
                                    <option value="8" ${config.caliLatency === 8 ? 'selected' : ''}>8 ${t('latencyFrames', { ms: '266', def: '' })}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: Physical Display & Viewing Geometry -->
                    <div class="studio-card" style="padding: 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px; flex-wrap: wrap;">
                            <span id="label-display-geo" style="font-size: 13px; font-weight: 600; color: #1d2129;">${t('displayGeometry')}</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <select id="sel-screen-preset" class="studio-select" style="padding: 2px 8px; font-size: 11px; height: 24px;">
                                    <option value="28.6x17.9">13.3" (28.6×17.9 cm)</option>
                                    <option value="30.9x17.4">14.0" (30.9×17.4 cm)</option>
                                    <option value="34.5x19.4" selected>15.6" (34.5×19.4 cm)</option>
                                    <option value="53.1x29.9">24.0" (53.1×29.9 cm)</option>
                                    <option value="59.8x33.6">27.0" (59.8×33.6 cm)</option>
                                    <option value="70.8x39.8">32.0" (70.8×39.8 cm)</option>
                                    <option value="custom">${t('presetCustom')}</option>
                                </select>
                                <span id="geo-preview" class="status-pill info" style="font-size: 11px;">~141.4 PPI • 0.18×0.18 mm/px</span>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 10px;">
                            <div>
                                <label class="studio-label">
                                    <span id="label-screen-width">${t('screenWidth')}</span>
                                </label>
                                <div style="position: relative;">
                                    <input type="number" id="inp-screen-width" class="studio-input" value="${config.screenWidthCm}" step="0.1" min="5" max="300" required style="width: 100%; padding-right: 34px;">
                                    <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #86909c;">cm</span>
                                </div>
                            </div>
                            <div>
                                <label class="studio-label">
                                    <span id="label-screen-height">${t('screenHeight')}</span>
                                </label>
                                <div style="position: relative;">
                                    <input type="number" id="inp-screen-height" class="studio-input" value="${config.screenHeightCm}" step="0.1" min="5" max="300" required style="width: 100%; padding-right: 34px;">
                                    <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #86909c;">cm</span>
                                </div>
                            </div>
                            <div>
                                <label class="studio-label">
                                    <span id="label-eye-distance">${t('eyeDistance')}</span>
                                </label>
                                <div style="position: relative;">
                                    <input type="number" id="inp-eye-distance" class="studio-input" value="${config.eyeDistanceCm}" step="1" min="15" max="300" required style="width: 100%; padding-right: 34px;">
                                    <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #86909c;">cm</span>
                                </div>
                            </div>
                        </div>
                        <p id="geo-hint-text" style="font-size: 12px; color: #86909c; line-height: 1.5;">
                            ${t('geoHint')}
                        </p>
                    </div>

                    <!-- Card 3: Validation Protocol -->
                    <div class="studio-card" style="padding: 18px;">
                        <span id="label-val-protocol" style="font-size: 13px; font-weight: 600; color: #1d2129; display: block; margin-bottom: 12px;">${t('validationProtocol')}</span>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label id="label-run-val" class="studio-label">${t('runValidation')}</label>
                                <select id="sel-do-val" class="studio-select" style="width: 100%;">
                                    <option value="true" ${config.doValidation ? 'selected' : ''}>${t('optValYes')}</option>
                                    <option value="false" ${!config.doValidation ? 'selected' : ''}>${t('optValNo')}</option>
                                </select>
                            </div>
                            <div id="val-opts">
                                <label id="label-val-pattern" class="studio-label">${t('valPattern')}</label>
                                <div style="display: flex; gap: 8px;">
                                    <select id="sel-val-mode" class="studio-select" style="flex: 1;">
                                        <option value="random" ${config.valMode === 'random' ? 'selected' : ''}>${t('optValRandom')}</option>
                                        <option value="9-point" ${config.valMode === '9-point' ? 'selected' : ''}>${t('optVal9Pt')}</option>
                                        <option value="5-point" ${config.valMode === '5-point' ? 'selected' : ''}>${t('optVal5Pt')}</option>
                                    </select>
                                    <input type="number" id="inp-val-rand" class="studio-input" value="13" min="1" max="50" style="width: 65px; display: none;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Start Calibration Action Area (Right under Validation Protocol) -->
                    <div style="margin-top: 4px; width: 100%;">
                        <button class="studio-btn" id="btn-next" style="width: 100%; padding: 13px 24px; font-size: 15px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 14px rgba(22, 93, 255, 0.25);" disabled>
                            ${t('startCalibrationBtn')}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    `;
}

function updateLanguageDOM(lang) {
    const el = (id) => document.getElementById(id);
    
    if (el('header-title')) el('header-title').innerText = t('controlCenterTitle');
    if (el('header-subtitle')) el('header-subtitle').innerText = t('controlCenterSubtitle');
    if (el('btn-lang-text')) el('btn-lang-text').innerText = t('langBtn');
    if (el('label-viewfinder')) el('label-viewfinder').innerText = t('liveViewfinder');
    if (el('label-throughput')) el('label-throughput').innerText = t('throughput');
    if (el('label-total-latency')) el('label-total-latency').innerText = t('pipelineTotal');
    if (el('label-mediapipe')) el('label-mediapipe').innerText = t('mediapipe');
    if (el('label-gazenet')) el('label-gazenet').innerText = t('gazeNet');

    if (el('label-model-title')) el('label-model-title').innerText = t('inferenceModelTitle');
    if (el('badge-model-tag')) el('badge-model-tag').innerText = config.modelPath.includes('fp16') ? t('modelTagFP16') : t('modelTagFP32');
    if (el('model-hint-text')) el('model-hint-text').innerText = t('modelHint');

    const selModel = el('sel-model-variant');
    if (selModel && selModel.options.length >= 2) {
        selModel.options[0].text = t('optFP16');
        selModel.options[1].text = t('optFP32');
    }

    if (el('label-vision-preproc')) el('label-vision-preproc').innerText = t('visionPreproc');
    if (el('label-gaze-smooth')) el('label-gaze-smooth').innerText = t('gazeSmoothing');
    const selFilter = el('sel-gaze-filter');
    if (selFilter && selFilter.options.length >= 2) {
        selFilter.options[0].text = t('enabledDefault');
        selFilter.options[1].text = t('disabledRaw');
    }
    if (el('label-look-ahead')) el('label-look-ahead').innerText = t('lookAheadLabel');
    if (el('look-ahead-hint')) el('look-ahead-hint').innerText = t('lookAheadHint');

    if (el('label-cali-setup')) el('label-cali-setup').innerText = t('calibrationSetup');
    if (el('label-target-pattern')) el('label-target-pattern').innerText = t('targetPattern');
    const selCaliMode = el('sel-cali-mode');
    if (selCaliMode && selCaliMode.options.length >= 5) {
        selCaliMode.options[0].text = t('opt13Pt');
        selCaliMode.options[1].text = t('opt9Pt');
        selCaliMode.options[2].text = t('opt5Pt');
        selCaliMode.options[3].text = t('optRandom');
        selCaliMode.options[4].text = t('optLissajous');
    }

    if (el('label-target-order')) el('label-target-order').innerText = t('targetOrder');
    const selCaliOrder = el('sel-cali-order');
    if (selCaliOrder && selCaliOrder.options.length >= 2) {
        selCaliOrder.options[0].text = t('optRandomOrder');
        selCaliOrder.options[1].text = t('optSequentialOrder');
    }

    if (el('label-pursuit-speed')) el('label-pursuit-speed').innerText = t('pursuitSpeed');
    const selLissPreset = el('sel-lissajous-preset');
    if (selLissPreset && selLissPreset.options.length >= 6) {
        selLissPreset.options[0].text = t('presetLabel');
        selLissPreset.options[1].text = t('speedSlow');
        selLissPreset.options[2].text = t('speedGentle');
        selLissPreset.options[3].text = t('speedRec');
        selLissPreset.options[4].text = t('speedMod');
        selLissPreset.options[5].text = t('speedFast');
    }

    if (el('label-interaction-mode')) el('label-interaction-mode').innerText = t('interactionMode');
    const selMethod = el('sel-cali-method');
    if (selMethod && selMethod.options.length >= 2) {
        selMethod.options[0].text = t('optManualClick');
        selMethod.options[1].text = t('optAutoDwell');
    }

    if (el('label-cali-algo')) el('label-cali-algo').innerText = t('caliAlgorithm');
    const selAlgo = el('sel-cali-algo');
    if (selAlgo && selAlgo.options.length >= 2) {
        selAlgo.options[0].text = t('optRidge');
        selAlgo.options[1].text = t('optSVR');
    }

    if (el('label-ridge-alpha')) el('label-ridge-alpha').innerText = t('ridgeAlpha');
    if (el('alpha-hint')) el('alpha-hint').innerText = t('alphaDefault');
    const selAlphaPreset = el('sel-alpha-preset');
    if (selAlphaPreset && selAlphaPreset.options.length >= 4) {
        selAlphaPreset.options[0].text = t('presetLabel');
        selAlphaPreset.options[1].text = t('alpha13pt');
        selAlphaPreset.options[2].text = t('alpha9pt');
        selAlphaPreset.options[3].text = t('alpha5pt');
    }

    if (el('label-latency-comp')) el('label-latency-comp').innerText = t('latencyComp');
    const selLatency = el('sel-cali-latency');
    if (selLatency && selLatency.options.length >= 5) {
        selLatency.options[0].text = `0 ${t('latencyFrames', { ms: '0', def: '' })}`;
        selLatency.options[1].text = `2 ${t('latencyFrames', { ms: '66', def: '' })}`;
        selLatency.options[2].text = `4 ${t('latencyFrames', { ms: '133', def: ' - Default' })}`;
        selLatency.options[3].text = `6 ${t('latencyFrames', { ms: '200', def: '' })}`;
        selLatency.options[4].text = `8 ${t('latencyFrames', { ms: '266', def: '' })}`;
    }

    if (el('label-display-geo')) el('label-display-geo').innerText = t('displayGeometry');
    const selScreen = el('sel-screen-preset');
    if (selScreen && selScreen.options.length >= 7) {
        selScreen.options[6].text = t('presetCustom');
    }
    if (el('label-screen-width')) el('label-screen-width').innerText = t('screenWidth');
    if (el('label-screen-height')) el('label-screen-height').innerText = t('screenHeight');
    if (el('label-eye-distance')) el('label-eye-distance').innerText = t('eyeDistance');
    if (el('geo-hint-text')) el('geo-hint-text').innerText = t('geoHint');

    if (el('label-val-protocol')) el('label-val-protocol').innerText = t('validationProtocol');
    if (el('label-run-val')) el('label-run-val').innerText = t('runValidation');
    const selDoVal = el('sel-do-val');
    if (selDoVal && selDoVal.options.length >= 2) {
        selDoVal.options[0].text = t('optValYes');
        selDoVal.options[1].text = t('optValNo');
    }

    if (el('label-val-pattern')) el('label-val-pattern').innerText = t('valPattern');
    const selValMode = el('sel-val-mode');
    if (selValMode && selValMode.options.length >= 3) {
        selValMode.options[0].text = t('optValRandom');
        selValMode.options[1].text = t('optVal9Pt');
        selValMode.options[2].text = t('optVal5Pt');
    }

    if (el('btn-next')) el('btn-next').innerText = t('startCalibrationBtn');
}

// 3. Studio Setup & Preview Dashboard
const setup_panel = {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => renderSetupHtml(),
    choices: [],
    button_html: '',
    on_load: async () => {
        const btnNext = document.getElementById('btn-next');
        const status = document.getElementById('sdk-status');
        const statusWrap = document.getElementById('sdk-status-wrap');
        const badgeStatus = document.getElementById('badge-status');
        const geoPreview = document.getElementById('geo-preview');
        let sdkReady = false;

        // Language toggle
        const btnLangToggle = document.getElementById('btn-lang-toggle');
        if (btnLangToggle) {
            btnLangToggle.onclick = () => {
                currentLang = currentLang === 'zh' ? 'en' : 'zh';
                localStorage.setItem('gf2_lang', currentLang);
                updateLanguageDOM(currentLang);
            };
        }

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

        if (btnNext) {
            btnNext.onclick = () => {
                if (sdkReady && isGeometryValid()) {
                    jsPsych.finishTrial({ button_pressed: 0 });
                }
            };
        }

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
                    config.screenWidthCm = parseFloat(parts[0]);
                    config.screenHeightCm = parseFloat(parts[1]);
                    inpScreenWidth.value = config.screenWidthCm.toFixed(1);
                    inpScreenHeight.value = config.screenHeightCm.toFixed(1);
                    updateGeometryBadge();
                }
            };
        }

        if (inpScreenWidth) {
            inpScreenWidth.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                    config.screenWidthCm = val;
                    if (selScreenPreset) selScreenPreset.value = 'custom';
                    updateGeometryBadge();
                }
            };
        }

        if (inpScreenHeight) {
            inpScreenHeight.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                    config.screenHeightCm = val;
                    if (selScreenPreset) selScreenPreset.value = 'custom';
                    updateGeometryBadge();
                }
            };
        }

        if (inpEyeDistance) {
            inpEyeDistance.oninput = (e) => {
                const val = parseFloat(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                    config.eyeDistanceCm = val;
                    updateGeometryBadge();
                }
            };
        }

        updateGeometryBadge();

        // Target pattern selection
        const caliModeSel = document.getElementById('sel-cali-mode');
        const caliOrderWrap = document.getElementById('cali-order-wrap');
        const lissajousWrap = document.getElementById('lissajous-speed-wrap');
        const inpLissajousSpeed = document.getElementById('inp-lissajous-speed');
        const selLissajousPreset = document.getElementById('sel-lissajous-preset');
        const lissDurHint = document.getElementById('lissajous-dur-hint');

        const updateLissajousHint = (speed) => {
            if (lissDurHint && window.GazeFollower2 && GazeFollower2.caliManager) {
                const len = GazeFollower2.caliManager.computeLissajousLength();
                const durSec = Math.round(len / Math.max(speed, 50));
                lissDurHint.innerText = `~${durSec}s`;
                if (typeof GazeFollower2.setLissajousSpeed === 'function') {
                    GazeFollower2.setLissajousSpeed(config.lissajousSpeed);
                }
            }
        };

        if (caliModeSel) {
            caliModeSel.onchange = (e) => {
                config.caliMode = e.target.value;
                const isLiss = (config.caliMode === 'lissajous');
                if (caliOrderWrap) caliOrderWrap.style.display = isLiss ? 'none' : 'block';
                if (lissajousWrap) lissajousWrap.style.display = isLiss ? 'block' : 'none';
                if (isLiss) updateLissajousHint(config.lissajousSpeed);
            };
        }

        if (inpLissajousSpeed) {
            inpLissajousSpeed.oninput = (e) => {
                const spd = parseInt(e.target.value, 10);
                if (!Number.isNaN(spd) && spd >= 50) {
                    config.lissajousSpeed = spd;
                    if (selLissajousPreset) selLissajousPreset.value = 'custom';
                    updateLissajousHint(spd);
                }
            };
        }

        if (selLissajousPreset && inpLissajousSpeed) {
            selLissajousPreset.onchange = (e) => {
                if (e.target.value !== 'custom') {
                    const spd = parseInt(e.target.value, 10);
                    config.lissajousSpeed = spd;
                    inpLissajousSpeed.value = spd;
                    updateLissajousHint(spd);
                }
            };
        }

        const caliOrderSel = document.getElementById('sel-cali-order');
        if (caliOrderSel) {
            caliOrderSel.onchange = (e) => {
                config.caliOrder = e.target.value;
            };
        }

        const caliMethodSel = document.getElementById('sel-cali-method');
        if (caliMethodSel) {
            caliMethodSel.onchange = (e) => {
                config.caliMethod = e.target.value;
            };
        }

        const caliAlgoSel = document.getElementById('sel-cali-algo');
        const alphaWrap = document.getElementById('alpha-wrap');
        const inpAlpha = document.getElementById('inp-cali-alpha');
        const selAlphaPreset = document.getElementById('sel-alpha-preset');

        if (caliAlgoSel) {
            caliAlgoSel.onchange = (e) => {
                config.caliAlgorithm = e.target.value;
                if (alphaWrap) alphaWrap.style.display = (config.caliAlgorithm === 'ridge') ? 'block' : 'none';
                if (window.GazeFollower2) {
                    if (typeof GazeFollower2.setRegression === 'function') {
                        GazeFollower2.setRegression(config.caliAlgorithm, config.caliAlpha);
                    }
                    if (typeof GazeFollower2.setRidgeAlpha === 'function') {
                        GazeFollower2.setRidgeAlpha(config.caliAlpha);
                    }
                }
            };
        }

        if (inpAlpha) {
            inpAlpha.oninput = (e) => {
                const a = parseFloat(e.target.value);
                if (Number.isFinite(a) && a > 0) {
                    config.caliAlpha = a;
                    if (selAlphaPreset) selAlphaPreset.value = 'custom';
                    if (window.GazeFollower2 && typeof GazeFollower2.setRidgeAlpha === 'function') {
                        GazeFollower2.setRidgeAlpha(a);
                    }
                }
            };
        }

        if (selAlphaPreset && inpAlpha) {
            selAlphaPreset.onchange = (e) => {
                if (e.target.value !== 'custom') {
                    const a = parseFloat(e.target.value);
                    config.caliAlpha = a;
                    inpAlpha.value = a;
                    if (window.GazeFollower2 && typeof GazeFollower2.setRidgeAlpha === 'function') {
                        GazeFollower2.setRidgeAlpha(a);
                    }
                }
            };
        }

        const caliLatencySel = document.getElementById('sel-cali-latency');
        if (caliLatencySel) {
            caliLatencySel.onchange = (e) => {
                config.caliLatency = parseInt(e.target.value, 10);
            };
        }

        // Validation settings
        const doValSel = document.getElementById('sel-do-val');
        const valOpts = document.getElementById('val-opts');
        const valModeSel = document.getElementById('sel-val-mode');
        const valRandInp = document.getElementById('inp-val-rand');

        if (doValSel) {
            doValSel.onchange = (e) => {
                config.doValidation = (e.target.value === 'true');
                if (valOpts) valOpts.style.display = config.doValidation ? 'block' : 'none';
            };
        }

        if (valModeSel) {
            valModeSel.onchange = (e) => {
                config.valMode = e.target.value;
                if (valRandInp) {
                    valRandInp.style.display = (config.valMode === 'random') ? 'block' : 'none';
                }
            };
        }

        if (valRandInp) {
            valRandInp.oninput = (e) => {
                config.valRandomCount = parseInt(e.target.value, 10) || 13;
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

        // Neural Model Variant Switcher (ONNX Only: FP16 vs FP32)
        const selModelVariant = document.getElementById('sel-model-variant');
        const badgeModelTag = document.getElementById('badge-model-tag');
        if (selModelVariant) {
            selModelVariant.value = config.modelPath || 'models/GazeNet_Next_fp16.onnx';
            selModelVariant.onchange = async (e) => {
                const targetModel = e.target.value;
                config.modelPath = targetModel;
                if (badgeModelTag) {
                    badgeModelTag.innerText = targetModel.includes('fp16') ? t('modelTagFP16') : t('modelTagFP32');
                }
                if (statusWrap) {
                    statusWrap.style.display = 'flex';
                    status.innerText = `Loading ${targetModel.includes('fp16') ? 'FP16' : 'FP32'} model...`;
                }
                try {
                    await GazeFollower2.loadModel(targetModel, (progress) => {
                        const percent = Math.round(progress * 100);
                        if (status) status.innerText = `Loading model... ${percent}%`;
                    });
                } catch (err) {
                    console.error("Failed to switch model:", err);
                    alert("Model switch failed: " + err.message);
                } finally {
                    if (statusWrap) statusWrap.style.display = 'none';
                }
            };
        }

        const badgeFace = document.getElementById('badge-face-tracking');

        if (typeof GazeFollower2.setStatsListener === 'function') {
            GazeFollower2.setStatsListener((stats) => {
                if (badgeFace) {
                    if (stats.isFaceDetected) {
                        badgeFace.innerHTML = `<span class="pulse-dot"></span> ${t('faceDetected')}`;
                        badgeFace.className = 'status-pill';
                    } else {
                        badgeFace.innerHTML = `<span class="pulse-dot"></span> ${t('searchingFace')}`;
                        badgeFace.className = 'status-pill warning';
                    }
                }
            });
        }

        // Initialize SDK and Webcam
        try {
            while (typeof ort === 'undefined' || typeof GazeFollower2 === 'undefined' || !GazeFollower2) { 
                await new Promise(r => setTimeout(r, 100)); 
            }
            
            if (statusWrap) statusWrap.style.display = 'flex';
            if (config.modelPath && GazeFollower2.estimator) {
                GazeFollower2.estimator.modelPath = config.modelPath;
            }
            await GazeFollower2.begin((progress) => {
                const percent = Math.round(progress * 100);
                status.innerText = `Loading neural model... ${percent}%`;
            });
            GazeFollower2.setHeuristicFilter(config.gazeFilter, config.look_ahead);

            const anchor = document.getElementById('video-anchor');
            if (statusWrap) statusWrap.style.display = 'none';
            if (badgeStatus) {
                badgeStatus.innerHTML = `<span class="pulse-dot"></span> ${t('ready')}`;
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
        } catch (e) {
            status.innerText = "Error: " + e.message;
            if (badgeStatus) {
                badgeStatus.innerText = t('initFailed');
                badgeStatus.className = 'status-pill danger';
            }
        }
    },
    on_finish: () => {
        if (typeof GazeFollower2.setStatsListener === 'function') {
            GazeFollower2.setStatsListener(null);
        }
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
    stimulus: () => `
        <div id="cali-ready-msg" style="text-align: center;">
            <h3 style="font-size: 20px; font-weight: 700; color: #1d2129; margin-bottom: 8px;">${t('caliStarting')}</h3>
            <p style="color: #86909c; font-size: 14px;">${t('caliFixate')}</p>
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
                if (msg) msg.innerHTML = `<h3 style="color: #00b42a; font-size: 22px;">✓ ${t('caliSuccess')}</h3>`;
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
            <span id="val-hud-text" style="font-size: 13.5px; font-weight: 600; color: #1d2129;">${t('valTargetHud', { idx: '1' })}</span>
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
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            border: '2px solid rgba(22, 93, 255, 0.4)',
            transform: 'translate(-50%, -50%)',
            animation: 'gf-spin 2s linear infinite'
        });
        targetWrap.appendChild(pulseRing);

        const targetCore = document.createElement('div');
        Object.assign(targetCore.style, {
            width: '20px',
            height: '20px',
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
        const validationData = [];

        const showNextPoint = () => {
            if (currentIndex >= points.length) {
                targetWrap.remove();
                const hud = document.getElementById('val-hud');
                if (hud) hud.remove();
                jsPsych.finishTrial({ results: validationData });
                return;
            }

            const pt = points[currentIndex];
            const tx = pt[0];
            const ty = pt[1];

            targetWrap.style.left = tx + 'px';
            targetWrap.style.top = ty + 'px';

            const hudText = document.getElementById('val-hud-text');
            if (hudText) {
                hudText.innerText = t('valTargetHud', { idx: String(currentIndex + 1) });
            }

            setTimeout(() => {
                const currentSamples = [];
                const listener = (data) => {
                    if (data && Number.isFinite(data.x) && Number.isFinite(data.y)) {
                        currentSamples.push({ x: data.x, y: data.y, timestamp: performance.now() });
                    }
                };

                const old = GazeFollower2.listener;
                GazeFollower2.setGazeListener(listener);

                setTimeout(() => {
                    GazeFollower2.setGazeListener(old);
                    
                    if (currentSamples.length === 0 && Number.isFinite(GazeFollower2.targetX) && Number.isFinite(GazeFollower2.targetY)) {
                        currentSamples.push({ x: GazeFollower2.targetX, y: GazeFollower2.targetY, timestamp: performance.now() });
                    }

                    const d3Metrics = computeD3Metrics(
                        currentSamples, 
                        { x: tx, y: ty }, 
                        config.screenWidthCm, 
                        config.screenHeightCm, 
                        config.eyeDistanceCm, 
                        25
                    );

                    let predX = tx;
                    let predY = ty;
                    if (currentSamples.length > 0) {
                        const effWin = Math.min(25, currentSamples.length);
                        const bestStart = d3Metrics.bestWindowIndex >= 0 ? d3Metrics.bestWindowIndex : 0;
                        const win = currentSamples.slice(bestStart, bestStart + effWin);
                        let sumX = 0, sumY = 0;
                        win.forEach(p => { sumX += p.x; sumY += p.y; });
                        predX = sumX / win.length;
                        predY = sumY / win.length;
                    }

                    validationData.push({
                        point: currentIndex + 1,
                        target: { x: tx, y: ty },
                        predicted: { x: predX, y: predY },
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
            gradeBadge = `<span class="status-pill" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ${t('gradeExcellent')}</span>`;
        } else if (meanAccDeg < 2.0) {
            gradeBadge = `<span class="status-pill info" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ${t('gradeGood')}</span>`;
        } else if (meanAccDeg < 3.0) {
            gradeBadge = `<span class="status-pill warning" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ${t('gradeModerate')}</span>`;
        } else {
            gradeBadge = `<span class="status-pill danger" style="font-size: 13px; padding: 5px 12px;"><span class="pulse-dot"></span> ${t('gradeRecalib')}</span>`;
        }

        const geo = getScreenGeometry(config.screenWidthCm, config.screenHeightCm, config.eyeDistanceCm);

        // Build Big-Tech Analytics Dashboard
        let html = `
            <div style="width: 100%; max-width: 980px; margin: 0 auto; text-align: left;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
                    <div>
                        <h2 style="font-size: 22px; font-weight: 700; color: #1d2129; letter-spacing: -0.01em; margin-bottom: 4px;">${t('valReportTitle')}</h2>
                        <p style="font-size: 13px; color: #86909c;">
                            ${t('valReportSubtitle', {
                                w: String(config.screenWidthCm),
                                h: String(config.screenHeightCm),
                                d: String(config.eyeDistanceCm),
                                algo: config.caliAlgorithm === 'ridge' ? `Multivariate Ridge (α=${config.caliAlpha})` : 'SVR',
                                count: String(results.length)
                            })}
                        </p>
                    </div>
                    <div>
                        ${gradeBadge}
                    </div>
                </div>

                <!-- Hero Metric KPI Cards -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
                    <div class="studio-card" style="padding: 18px; border-top: 3px solid #165dff;">
                        <span style="font-size: 12px; font-weight: 600; color: #86909c; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">${t('meanAccuracyTitle')}</span>
                        <div style="font-size: 32px; font-weight: 700; color: #165dff; letter-spacing: -0.02em;">
                            ${meanAccDeg.toFixed(2)}° <span style="font-size: 17px; font-weight: 600; color: #4e5969;">(${meanAccCm.toFixed(2)} cm)</span>
                        </div>
                        <span style="font-size: 12px; color: #86909c; margin-top: 4px; display: block;">${t('displacementLabel', { px: meanAccPx.toFixed(1), mm: meanAccMm.toFixed(1) })}</span>
                    </div>

                    <div class="studio-card" style="padding: 18px; border-top: 3px solid #00b42a;">
                        <span style="font-size: 12px; font-weight: 600; color: #86909c; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">${t('meanPrecisionTitle')}</span>
                        <div style="font-size: 32px; font-weight: 700; color: #00b42a; letter-spacing: -0.02em;">
                            ${meanRmsDeg.toFixed(2)}° <span style="font-size: 17px; font-weight: 600; color: #4e5969;">(${meanRmsCm.toFixed(2)} cm)</span>
                        </div>
                        <span style="font-size: 12px; color: #86909c; margin-top: 4px; display: block;">${t('precisionSubLabel', { px: meanRmsPx.toFixed(1), deg: meanStdDeg.toFixed(2), cm: meanStdCm.toFixed(2) })}</span>
                    </div>

                    <div class="studio-card" style="padding: 18px; border-top: 3px solid #ff7d00;">
                        <span style="font-size: 12px; font-weight: 600; color: #86909c; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px;">${t('screenGeometryTitle')}</span>
                        <div style="font-size: 26px; font-weight: 700; color: #1d2129; letter-spacing: -0.02em; margin-top: 4px;">
                            ${config.screenWidthCm}×${config.screenHeightCm} <span style="font-size: 15px; font-weight: 500; color: #86909c;">cm @ ${config.eyeDistanceCm} cm</span>
                        </div>
                        <span style="font-size: 12px; color: #86909c; margin-top: 4px; display: block;">${geo.ppdX.toFixed(1)}×${geo.ppdY.toFixed(1)} px/° • ${geo.mmPerPxX.toFixed(2)}×${geo.mmPerPxY.toFixed(2)} mm/px</span>
                    </div>
                </div>

                <!-- Per-Point Detailed Table -->
                <div class="studio-card" style="padding: 0; overflow: hidden; margin-bottom: 20px;">
                    <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: #fafbfc;">
                        <span style="font-size: 13px; font-weight: 600; color: #1d2129;">${t('tableTitle')}</span>
                        <span style="font-size: 12px; color: #86909c;">${t('tableSubtitle', { count: String(results.length) })}</span>
                    </div>
                    <div style="max-height: 240px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead>
                                <tr style="background: #fafbfc; color: #86909c; border-bottom: 1px solid var(--border-color); font-size: 12px;">
                                    <th style="padding: 10px 18px; font-weight: 600;">${t('colNum')}</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">${t('colTargetPos')}</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">${t('colPredGaze')}</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">${t('colAccCmPx')}</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">${t('colAccDeg')}</th>
                                    <th style="padding: 10px 18px; font-weight: 600;">${t('colPreRms')}</th>
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
                    <td style="padding: 10px 18px; font-family: monospace; color: #165dff;">(${predX}, ${predY})</td>
                    <td style="padding: 10px 18px; color: #4e5969;">${accCmStr}</td>
                    <td style="padding: 10px 18px; font-weight: 600; color: ${angleColor};">${accDegStr}</td>
                    <td style="padding: 10px 18px; color: #4e5969;">${rmsStr}</td>
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
    choices: () => config.doValidation ? [t('launchLiveTracking')] : [],
    button_html: '<button class="studio-btn" style="min-width: 260px; margin-top: 10px;">%choice%</button>',
    trial_duration: () => config.doValidation ? null : 0
};

// 7. Live Gaze Visualization Phase
const free_gaze = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: () => `
        <div id="gaze-hud" style="position: fixed; top: 28px; left: 50%; transform: translateX(-50%); background: #ffffff; border: 1px solid #e5e6eb; border-radius: 9999px; padding: 8px 24px; display: flex; align-items: center; gap: 14px; z-index: 1000000; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #165dff;" class="pulse-dot"></div>
            <span style="font-size: 13.5px; font-weight: 600; color: #1d2129;">${t('liveTrackingActive')}</span>

            <span id="gaze-coords" style="font-size: 12.5px; font-family: monospace; color: #4e5969; background: #f2f3f5; padding: 3px 8px; border-radius: 4px;">X: --- Y: ---</span>
            <span style="font-size: 12px; color: #86909c; border-left: 1px solid #e5e6eb; padding-left: 12px;">${t('pressSpaceExit')}</span>
        </div>
        <div style="position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); color: #86909c; font-size: 13px; pointer-events: none; background: rgba(255, 255, 255, 0.9); padding: 6px 16px; border-radius: 9999px; border: 1px solid #e5e6eb; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            ${t('followReticle')}
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
        if (typeof GazeFollower2.setStatsListener === 'function') {
            GazeFollower2.setStatsListener(null);
        }
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
