import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
import { FaceAlignment } from './FaceAlignment.js';
import { GazeEstimator, MGazeNetGazeEstimator } from './GazeEstimator.js';
import { MultivariateRidgeCalibration } from './MultivariateRidgeCalibration.js';
import { SVRCalibration } from './SVRCalibration.js';
import { HeuristicFilter } from './HeuristicFilter.js';
import { CalibrationManager } from './CalibrationManager.js';
import { OneEuroFilter, LowPassFilter } from './OneEuroFilter.js';

export class GazeFollower2 {
    /**
     * @param {string|Object} [onnxModelPath='models/GazeNet_Next.onnx'] Model path or configuration object
     * @param {number|Object} [options={}] Optional look_ahead number or configuration object { look_ahead?: number, lookAhead?: number, enableHeuristicFilter?: boolean, enableGazeFilter?: boolean }
     */
    constructor(onnxModelPath = 'models/GazeNet_Next.onnx', options = {}) {
        let modelPath = 'models/GazeNet_Next.onnx';
        let cfg = {};

        if (onnxModelPath && typeof onnxModelPath === 'object') {
            cfg = onnxModelPath;
            if (typeof cfg.onnxModelPath === 'string') modelPath = cfg.onnxModelPath;
            else if (typeof cfg.modelPath === 'string') modelPath = cfg.modelPath;
        } else if (typeof onnxModelPath === 'string') {
            modelPath = onnxModelPath;
            if (typeof options === 'number') {
                cfg = { look_ahead: options };
            } else if (options && typeof options === 'object') {
                cfg = options;
            }
        }

        const initialEnableFilter = cfg.enableHeuristicFilter !== undefined
            ? !!cfg.enableHeuristicFilter
            : (cfg.enableGazeFilter !== undefined ? !!cfg.enableGazeFilter : true);

        const rawLookAhead = cfg.look_ahead !== undefined ? cfg.look_ahead : (cfg.lookAhead !== undefined ? cfg.lookAhead : 2);
        const initialLookAhead = (typeof rawLookAhead === 'number' && Number.isFinite(rawLookAhead) && rawLookAhead >= 1)
            ? Math.max(1, Math.round(rawLookAhead))
            : 2;

        this.enableGazeFilter = initialEnableFilter;
        this.ridgeAlpha = (typeof cfg.ridgeAlpha === 'number' && cfg.ridgeAlpha > 0)
            ? cfg.ridgeAlpha
            : ((typeof cfg.alpha === 'number' && cfg.alpha > 0) ? cfg.alpha : 3.0);
        this.faceAlignment = new FaceAlignment();
        this.estimator = new GazeEstimator(modelPath);
        this.ridgeCalibrator = new MultivariateRidgeCalibration(this.ridgeAlpha);
        this.svrCalibrator = new SVRCalibration(0.1);
        this.filter = new HeuristicFilter(initialLookAhead);
        this.caliManager = new CalibrationManager(this);
        this.caliAlgorithm = 'ridge';
        
        this.faceLandmarker = null;
        this._isReady = false;
        this.isCalibrated = false;
        this.isPaused = true;
        
        // Calibration training data
        this.collectedFeatures = [];
        this.collectedX = [];
        this.collectedY = [];
        
        this.listener = null;
        this.videoElement = null;
        this.overlayCanvas = null;
        this.showVid = true;
        this.showFaceOverlay = true;
        
        this.stream = null;
        this.lastFeatures = null;
        this.rawX = null;
        this.rawY = null;
        this.targetX = null;
        this.targetY = null;
        this.smoothX = null;
        this.smoothY = null;
        this.isFaceDetected = false;

        // Performance & Pipeline Telemetry
        this.pipelineStats = {
            fps: 0,
            totalMs: 0,
            mediapipeMs: 0,
            faceAlignMs: 0,
            gazeMs: 0,
            isFaceDetected: false
        };
        this.statsListener = null;
        this._fpsFrameCount = 0;
        this._fpsLastTime = 0;
        this._currentFps = 0;
        this._smoothTotalMs = 0;
        this._smoothMediaMs = 0;
        this._smoothGazeMs = 0;
        this._smoothAlignMs = 0;

        // Ensure methods are bound directly to instance
        this.setStatsListener = this.setStatsListener.bind(this);
        this.getPipelineStats = this.getPipelineStats.bind(this);
        this.setHeuristicFilter = this.setHeuristicFilter.bind(this);
        this.setLookAhead = this.setLookAhead.bind(this);
        this.getLookAhead = this.getLookAhead.bind(this);
        this.resetFilter = this.resetFilter.bind(this);
        this.applyKalmanFilter = this.applyKalmanFilter.bind(this);
        this.applySmoothingFilter = this.applySmoothingFilter.bind(this);
        this.setFaceFilter = this.setFaceFilter.bind(this);
        this.setRegression = this.setRegression.bind(this);
        this.setRidgeAlpha = this.setRidgeAlpha.bind(this);
        this.getRidgeAlpha = this.getRidgeAlpha.bind(this);
        this.setLissajousSpeed = this.setLissajousSpeed.bind(this);
        this.getLissajousSpeed = this.getLissajousSpeed.bind(this);
    }

    /**
     * Get real-time pipeline performance statistics snapshot.
     * @returns {{ fps: number, totalMs: number, mediapipeMs: number, gazeMs: number, faceAlignMs: number, isFaceDetected: boolean }}
     */
    getPipelineStats() {
        return { ...this.pipelineStats };
    }

    get stats() {
        return this.pipelineStats;
    }

    /**
     * Register a callback to receive real-time performance metrics on each processed frame.
     * @param {Function} callback - ({ fps, totalMs, mediapipeMs, gazeMs, faceAlignMs, isFaceDetected }) => void
     * @returns {GazeFollower2}
     */
    setStatsListener(callback) {
        this.statsListener = typeof callback === 'function' ? callback : null;
        return this;
    }

    /**
     * Get the current look_ahead value of the HeuristicFilter (default: 2).
     * @returns {number}
     */
    get look_ahead() {
        return this.filter ? this.filter.look_ahead : 2;
    }

    /**
     * Set the look_ahead value of the HeuristicFilter.
     * @param {number} value
     */
    set look_ahead(value) {
        this.setLookAhead(value);
    }

    /**
     * CamelCase alias for look_ahead getter.
     * @returns {number}
     */
    get lookAhead() {
        return this.look_ahead;
    }

    /**
     * CamelCase alias for look_ahead setter.
     * @param {number} value
     */
    set lookAhead(value) {
        this.setLookAhead(value);
    }

    /**
     * Configure the look_ahead window size for the HeuristicFilter.
     * @param {number} [look_ahead=2] Number of look-ahead frames on each side (>= 1, default: 2)
     * @returns {GazeFollower2}
     */
    setLookAhead(look_ahead = 2) {
        if (this.filter) {
            this.filter.setLookAhead(look_ahead);
        } else {
            this.filter = new HeuristicFilter(look_ahead);
        }
        return this;
    }

    /**
     * Get the current look_ahead window size of the HeuristicFilter.
     * @returns {number}
     */
    getLookAhead() {
        return this.filter ? this.filter.getLookAhead() : 2;
    }

    /**
     * Reset internal smoothing filter buffers.
     * @returns {GazeFollower2}
     */
    resetFilter() {
        if (this.filter && typeof this.filter.reset === 'function') {
            this.filter.reset();
        }
        if (this.faceAlignment && typeof this.faceAlignment.resetFilter === 'function') {
            this.faceAlignment.resetFilter();
        }
        return this;
    }

    /**
     * WebGazer compatibility: check if SDK and camera are ready.
     * @returns {boolean}
     */
    isReady() {
        return !!(this._isReady && this.videoElement && (!this.videoElement.srcObject || this.videoElement.readyState >= 2));
    }

    /**
     * Set real-time gaze listener callback.
     * @param {Function} callback - (data, timestamp) => {} where data is { x, y } in pixels
     * @returns {GazeFollower2}
     */
    setGazeListener(callback) {
        this.listener = callback;
        return this;
    }

    /**
     * Clear current gaze listener callback.
     * @returns {GazeFollower2}
     */
    clearGazeListener() {
        this.listener = null;
        return this;
    }

    /**
     * WebGazer compatibility: get latest gaze prediction immediately.
     * @returns {{x: number, y: number}|null}
     */
    getCurrentPrediction() {
        if (this.targetX !== null && this.targetY !== null) {
            return { x: this.targetX, y: this.targetY };
        }
        return null;
    }

    /**
     * Initialize models, start webcam and begin gaze prediction.
     * @param {Function|Object|null} [progressCallback=null] Progress callback (0.0 - 1.0) or options object
     * @param {Object|null} [options=null] Optional configuration { look_ahead?: number, enableHeuristicFilter?: boolean }
     * @returns {Promise<GazeFollower2>}
     */
    async begin(progressCallback = null, options = null) {
        let cb = progressCallback;
        let opts = options;
        if (progressCallback && typeof progressCallback === 'object') {
            opts = progressCallback;
            cb = typeof opts.onProgress === 'function' ? opts.onProgress : (typeof opts.progressCallback === 'function' ? opts.progressCallback : null);
        }
        if (opts && typeof opts === 'object') {
            this._applyFilterOptions(opts);
        }
        if (!this._isReady) await this.init(cb, opts);
        this.isPaused = false;
        await this.startWebcam();
        return this;
    }

    _applyFilterOptions(opts) {
        if (!opts || typeof opts !== 'object') return;
        const enabled = opts.enableHeuristicFilter !== undefined
            ? opts.enableHeuristicFilter
            : (opts.enableGazeFilter !== undefined ? opts.enableGazeFilter : opts.enabled);
        const la = opts.look_ahead !== undefined ? opts.look_ahead : opts.lookAhead;
        if (enabled !== undefined) {
            this.enableGazeFilter = !!enabled;
        }
        if (la !== undefined) {
            this.setLookAhead(la);
        }
    }

    /**
     * Pause gaze prediction inference loop.
     * @returns {GazeFollower2}
     */
    pause() {
        this.isPaused = true;
        this.resetFilter();
        return this;
    }

    /**
     * Resume gaze prediction inference loop.
     * @returns {GazeFollower2}
     */
    resume() {
        this.isPaused = false;
        return this;
    }

    /**
     * WebGazer compatibility: stop webcam stream and release resources.
     * @returns {GazeFollower2}
     */
    end() {
        this.isPaused = true;
        if (this.stream) {
            try {
                this.stream.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.warn("Error stopping stream tracks:", e);
            }
            this.stream = null;
        }
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            try {
                this.videoElement.pause();
            } catch (e) {}
        }
        if (this.overlayCanvas) {
            const ctx = this.overlayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }
        this.resetFilter();
        this.rawX = null;
        this.rawY = null;
        this.targetX = null;
        this.targetY = null;
        this.smoothX = null;
        this.smoothY = null;
        return this;
    }

    /**
     * Alias for end()
     */
    stop() {
        return this.end();
    }

    /**
     * Toggle visibility of webcam video element.
     * @param {boolean} bool
     * @returns {GazeFollower2}
     */
    showVideo(bool) {
        this.showVid = !!bool;
        if (this.videoElement) this.videoElement.style.opacity = this.showVid ? '1' : '0';
        return this;
    }

    showVideoPreview(bool) {
        return this.showVideo(bool);
    }

    showVideoElement(bool) {
        return this.showVideo(bool);
    }

    /**
     * Toggle visibility of face mesh / bounding boxes overlay.
     * @param {boolean} bool
     * @returns {GazeFollower2}
     */
    showPredictionPoints(bool) {
        this.showFaceOverlay = !!bool;
        if (this.overlayCanvas) this.overlayCanvas.style.opacity = this.showFaceOverlay ? '1' : '0';
        return this;
    }

    getVideoElementCanvas() {
        return this.overlayCanvas;
    }

    /**
     * Clear all recorded calibration data and reset calibrator.
     * @returns {GazeFollower2}
     */
    clearData() {
        this.collectedFeatures = [];
        this.collectedX = [];
        this.collectedY = [];
        this.isCalibrated = false;
        this.ridgeCalibrator = new MultivariateRidgeCalibration(this.ridgeAlpha);
        this.svrCalibrator = new SVRCalibration(0.1);
        this.resetFilter();
        return this;
    }

    /**
     * WebGazer compatibility: record user calibration target screen coordinate.
     * @param {number} x Screen X coordinate
     * @param {number} y Screen Y coordinate
     * @param {string} eventType Event type ('click' or 'auto')
     * @returns {boolean}
     */
    recordScreenPosition(x, y, eventType = 'click') {
        if (this.lastFeatures) {
            this.addCalibrationPoint(this.lastFeatures, x, y);
            return true;
        }
        return false;
    }

    // Internal compatibility stub; Multivariate Ridge is the built-in default
    setRegression(type, alpha = undefined) {
        if (typeof type === 'string') {
            const norm = type.toLowerCase();
            if (norm === 'svr' || norm === 'ridge') {
                this.caliAlgorithm = norm;
            }
        }
        if (alpha !== undefined && alpha !== null) {
            this.setRidgeAlpha(alpha);
        }
        return this;
    }

    /**
     * Set Multivariate Ridge Regression regularization parameter alpha (default: 1.0).
     * @param {number} alpha
     * @returns {GazeFollower2}
     */
    setRidgeAlpha(alpha = 1.0) {
        const val = parseFloat(alpha);
        if (Number.isFinite(val) && val > 0) {
            this.ridgeAlpha = val;
            if (this.ridgeCalibrator) {
                this.ridgeCalibrator.lambda = val;
            }
        }
        return this;
    }

    /**
     * Get Multivariate Ridge Regression regularization parameter alpha.
     * @returns {number}
     */
    getRidgeAlpha() {
        return this.ridgeAlpha;
    }

    /**
     * Set Lissajous smooth pursuit calibration speed in pixels per second (default: 250 px/s).
     * @param {number} speedPxPerSec
     * @returns {GazeFollower2}
     */
    setLissajousSpeed(speedPxPerSec = 250) {
        if (this.caliManager) {
            this.caliManager.setLissajousSpeed(speedPxPerSec);
        }
        return this;
    }

    /**
     * Get Lissajous smooth pursuit calibration speed in pixels per second.
     * @returns {number}
     */
    getLissajousSpeed() {
        return this.caliManager ? this.caliManager.getLissajousSpeed() : 250;
    }

    /**
     * WebGazer compatibility: set tracker backend name.
     * @param {string} type
     * @returns {GazeFollower2}
     */
    setTracker(type) {
        return this;
    }

    /**
     * Enable or disable the default heuristic gaze smoothing filter and optionally configure look_ahead.
     * @param {boolean|Object} [bool=true] Enable flag or options object { enabled?: boolean, look_ahead?: number, lookAhead?: number }
     * @param {number|Object} [look_ahead] Number of look-ahead frames (default: 2 when initialized)
     * @returns {GazeFollower2}
     */
    setHeuristicFilter(bool = true, look_ahead = undefined) {
        if (bool && typeof bool === 'object') {
            this._applyFilterOptions(bool);
            if (!this.enableGazeFilter) this.resetFilter();
            return this;
        }
        this.enableGazeFilter = !!bool;
        if (look_ahead && typeof look_ahead === 'object') {
            this._applyFilterOptions(look_ahead);
        } else if (look_ahead !== undefined && look_ahead !== null) {
            this.setLookAhead(look_ahead);
        }
        if (!this.enableGazeFilter) {
            this.resetFilter();
        }
        return this;
    }

    /**
     * WebGazer compatibility alias: toggle gaze smoothing filter (default: HeuristicFilter) and optionally set look_ahead.
     * @param {boolean} bool
     * @param {number} [look_ahead]
     * @returns {GazeFollower2}
     */
    applyKalmanFilter(bool, look_ahead = undefined) {
        return this.setHeuristicFilter(bool, look_ahead);
    }

    applySmoothingFilter(bool, look_ahead = undefined) {
        return this.setHeuristicFilter(bool, look_ahead);
    }

    /**
     * @deprecated Face landmark filter has been removed; kept for backward compatibility.
     * @param {boolean} bool
     * @returns {GazeFollower2}
     */
    setFaceFilter(bool) {
        return this;
    }

    /**
     * Start interactive calibration sequence using built-in Multivariate Ridge regression.
     * @param {'5-point'|'9-point'|'13-point'|'random'|'lissajous'|Object} [mode='13-point']
     * @param {'click'|'auto'} [method='click']
     * @param {number|string} [latency=4] Frame latency (<=20 frames) or ms (>20), or legacy algorithm string
     * @param {'random'|'sequential'|number} [order='random']
     * @param {'random'|'sequential'} [extraOrder]
     * @returns {GazeFollower2}
     */
    startCalibration(mode = '13-point', method = 'click', latency = 4, order = 'random', extraOrder = undefined) {
        this.clearData();
        if (mode && typeof mode === 'object') {
            const cfg = mode;
            const m = cfg.mode || '13-point';
            const meth = cfg.method || 'click';
            const lat = cfg.latency !== undefined ? cfg.latency : 4;
            const ord = cfg.order || 'random';
            this.caliManager.start(m, meth, lat, ord);
            return this;
        }
        let effLatency = 4;
        let effOrder = 'random';
        // Support 5-argument call: startCalibration(mode, method, algorithm, latency, order)
        if (typeof latency === 'string' && (latency === 'ridge' || latency === 'svr')) {
            this.setRegression(latency);
            effLatency = typeof order === 'number' ? order : 4;
            effOrder = typeof extraOrder === 'string' ? extraOrder : 'random';
        } else if (typeof latency === 'string') {
            effOrder = latency;
            effLatency = 4;
        } else {
            effLatency = typeof latency === 'number' ? latency : 4;
            effOrder = typeof order === 'string' ? order : 'random';
        }
        this.caliManager.start(mode, method, effLatency, effOrder);
        return this;
    }

    async loadModel(modelPath = 'models/GazeNet_Next.onnx', progressCallback = null) {
        const newEstimator = new GazeEstimator(modelPath);
        await newEstimator.init(progressCallback);
        this.estimator = newEstimator;
        return this;
    }

    async init(progressCallback = null, options = null) {
        if (options && typeof options === 'object') {
            this._applyFilterOptions(options);
        }
        console.log("Loading GazeFollower2 SDK...");
        if (!this.estimator.session) {
            await this.estimator.init(progressCallback);
        }
        
        const visionResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                         (navigator.userAgent.includes("Mac") && "ontouchend" in document);
        
        let primaryDelegate = isSafari ? "CPU" : "GPU";
        try {
            this.faceLandmarker = await FaceLandmarker.createFromOptions(visionResolver, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: primaryDelegate
                },
                runningMode: "VIDEO",
                numFaces: 1,
                outputFaceBlendshapes: false
            });
        } catch (e) {
            console.warn(`FaceLandmarker failed with delegate ${primaryDelegate}, falling back to CPU...`, e);
            this.faceLandmarker = await FaceLandmarker.createFromOptions(visionResolver, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "CPU"
                },
                runningMode: "VIDEO",
                numFaces: 1,
                outputFaceBlendshapes: false
            });
        }
        
        this.initDOM();
        this._isReady = true;
        console.log("GazeFollower2 SDK ready!");
        return this;
    }
    
    initDOM() {
        if (this.videoElement && this.overlayCanvas) return;

        // Create fixed video and overlay centered on screen
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.muted = true;
        this.videoElement.defaultMuted = true;
        this.videoElement.playsInline = true;
        this.videoElement.setAttribute('playsinline', '');
        this.videoElement.setAttribute('webkit-playsinline', '');
        Object.assign(this.videoElement.style, {
            position: 'fixed', top: '50%', left: '50%',
            maxWidth: '100vw', maxHeight: '100vh',
            transform: 'translate(-50%, -50%) scaleX(-1)', 
            zIndex: '-2', opacity: this.showVid ? '1' : '0'
        });
        
        this.overlayCanvas = document.createElement('canvas');
        Object.assign(this.overlayCanvas.style, {
            position: 'fixed', top: '50%', left: '50%',
            maxWidth: '100vw', maxHeight: '100vh',
            transform: 'translate(-50%, -50%) scaleX(-1)', 
            zIndex: '-1', opacity: this.showFaceOverlay ? '1' : '0', pointerEvents: 'none'
        });
        
        document.body.appendChild(this.videoElement);
        document.body.appendChild(this.overlayCanvas);
        
        this.renderLoop();
    }

    async startWebcam() {
        return new Promise(async (resolve, reject) => {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: "user"
                    }
                });
                this.videoElement.srcObject = this.stream;
                
                let started = false;
                const onReady = async () => {
                    if (started) return;
                    if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
                        started = true;
                        this.overlayCanvas.width = this.videoElement.videoWidth;
                        this.overlayCanvas.height = this.videoElement.videoHeight;
                        try {
                            await this.videoElement.play();
                        } catch (e) {
                            console.warn("Video play failed:", e);
                        }
                        this.inferenceLoop();
                        resolve();
                    }
                };

                this.videoElement.onloadedmetadata = onReady;
                this.videoElement.onloadeddata = onReady;
                this.videoElement.oncanplay = onReady;
                
                try {
                    await this.videoElement.play();
                } catch (e) {}

                if (this.videoElement.readyState >= 2) {
                    onReady();
                }
            } catch (err) {
                console.error("Camera access failed:", err);
                reject(err);
            }
        });
    }

    async inferenceLoop() {
        if (this.isPaused) {
            setTimeout(() => this.inferenceLoop(), 100);
            return;
        }
        
        const tStart = performance.now();
        let mediapipeMs = 0;
        let faceAlignMs = 0;
        let gazeMs = 0;

        const tMediaStart = performance.now();
        const faceResults = this.faceLandmarker.detectForVideo(this.videoElement, tStart);
        mediapipeMs = performance.now() - tMediaStart;
        
        if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
            this.isFaceDetected = true;
            const tAlignStart = performance.now();
            const { faceTensor, leftTensor, rightTensor, rectTensor, rawRects } = this.faceAlignment.process(
                this.videoElement, faceResults.faceLandmarks[0], tStart
            );
            faceAlignMs = performance.now() - tAlignStart;
            
            this.drawOverlay(rawRects);
            
            const tGazeStart = performance.now();
            const features = await this.estimator.detect(faceTensor, leftTensor, rightTensor, rectTensor);
            gazeMs = performance.now() - tGazeStart;

            if (features) {
                this.lastFeatures = features;
                this.caliManager.feedFeatures(features, tStart);
                
                if (this.isCalibrated) {
                    const calibrator = this.caliAlgorithm === 'svr' ? this.svrCalibrator : this.ridgeCalibrator;
                    const [caliX, caliY] = calibrator.predict(features);
                    this.rawX = caliX;
                    this.rawY = caliY;
                    let finalX = caliX;
                    let finalY = caliY;

                    if (this.enableGazeFilter && this.filter) {
                        const [filteredX, filteredY] = this.filter.filterValues(caliX, caliY);
                        finalX = filteredX;
                        finalY = filteredY;
                    }
                    
                    this.targetX = finalX;
                    this.targetY = finalY;
                    
                    if (this.listener) {
                        this.listener({ x: finalX, y: finalY }, tStart);
                    }
                }
            }
        } else {
            this.isFaceDetected = false;
            this.resetFilter();
            this.drawOverlay(null);
            this.lastFeatures = null;
            this.rawX = null;
            this.rawY = null;
            this.targetX = null;
            this.targetY = null;
        }

        const totalMs = performance.now() - tStart;

        // Rolling FPS and Exponential Moving Averages for performance telemetry
        this._fpsFrameCount = (this._fpsFrameCount || 0) + 1;
        if (!this._fpsLastTime) this._fpsLastTime = tStart;
        const elapsedFps = tStart - this._fpsLastTime;
        if (elapsedFps >= 350) {
            this._currentFps = (this._fpsFrameCount * 1000) / elapsedFps;
            this._fpsFrameCount = 0;
            this._fpsLastTime = tStart;
        }

        const alpha = 0.2;
        this._smoothTotalMs = this._smoothTotalMs ? (1 - alpha) * this._smoothTotalMs + alpha * totalMs : totalMs;
        this._smoothMediaMs = this._smoothMediaMs ? (1 - alpha) * this._smoothMediaMs + alpha * mediapipeMs : mediapipeMs;
        this._smoothGazeMs = this._smoothGazeMs ? (1 - alpha) * this._smoothGazeMs + alpha * gazeMs : gazeMs;
        this._smoothAlignMs = this._smoothAlignMs ? (1 - alpha) * this._smoothAlignMs + alpha * faceAlignMs : faceAlignMs;

        this.pipelineStats = {
            fps: Number((this._currentFps || 0).toFixed(1)),
            totalMs: Number(this._smoothTotalMs.toFixed(1)),
            mediapipeMs: Number(this._smoothMediaMs.toFixed(1)),
            gazeMs: Number(this._smoothGazeMs.toFixed(1)),
            faceAlignMs: Number(this._smoothAlignMs.toFixed(1)),
            isFaceDetected: this.isFaceDetected
        };

        if (this.statsListener && typeof this.statsListener === 'function') {
            try {
                this.statsListener(this.pipelineStats);
            } catch (e) {
                console.warn("statsListener callback error:", e);
            }
        }
        
        if (!this.isPaused && this.videoElement && !this.videoElement.paused && typeof this.videoElement.requestVideoFrameCallback === 'function') {
            let fired = false;
            this.videoElement.requestVideoFrameCallback(() => {
                if (fired) return;
                fired = true;
                clearTimeout(watchdog);
                this.inferenceLoop();
            });
            const watchdog = setTimeout(() => {
                if (fired) return;
                fired = true;
                this.inferenceLoop();
            }, 60);
        } else {
            setTimeout(() => this.inferenceLoop(), this.isPaused ? 100 : 16);
        }
    }
    
    drawOverlay(rawRects) {
        if (!this.showFaceOverlay) {
            if (this._overlayDrawn) {
                const ctx = this.overlayCanvas.getContext('2d');
                ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                this._overlayDrawn = false;
            }
            return;
        }
        const ctx = this.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this._overlayDrawn = true;
        if (!rawRects) return;
        
        ctx.strokeStyle = 'green'; ctx.lineWidth = 2;
        ctx.strokeRect(...rawRects.face);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(...rawRects.left);
        ctx.strokeRect(...rawRects.right);
    }
    
    renderLoop() {
        if (this.targetX !== null && this.targetY !== null) {
            if (this.smoothX === null) this.smoothX = this.targetX;
            if (this.smoothY === null) this.smoothY = this.targetY;
            this.smoothX += (this.targetX - this.smoothX) * 0.2;
            this.smoothY += (this.targetY - this.smoothY) * 0.2;
        }
        requestAnimationFrame(() => this.renderLoop());
    }

    addCalibrationPoint(features, screenX, screenY) {
        this.collectedFeatures.push(features);
        this.collectedX.push(screenX);
        this.collectedY.push(screenY);
        return this;
    }

    trainCalibration() {
        if (this.collectedFeatures.length === 0) return false;
        if (this.caliAlgorithm === 'svr') {
            this.svrCalibrator = new SVRCalibration(0.1);
            this.svrCalibrator.train(this.collectedFeatures, this.collectedX, this.collectedY);
        } else {
            this.ridgeCalibrator = new MultivariateRidgeCalibration(this.ridgeAlpha);
            this.ridgeCalibrator.train(this.collectedFeatures, this.collectedX, this.collectedY);
        }
        this.isCalibrated = true;
        return true;
    }
}

// Global singleton instance
const instance = new GazeFollower2();

// Expose GazeFollower2 to window
if (typeof window !== 'undefined') {
    window.GazeFollower2 = instance;
    // WebGazer drop-in backward compatibility alias
    window.webgazer = instance;
}

export const GazeFollower = GazeFollower2;
export {
    HeuristicFilter,
    CalibrationManager,
    GazeEstimator,
    MGazeNetGazeEstimator,
    FaceAlignment,
    MultivariateRidgeCalibration,
    SVRCalibration,
    OneEuroFilter,
    LowPassFilter,
    instance as default
};

