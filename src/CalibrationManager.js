// CalibrationManager.js - Handles 5/9/13 point, random, and Lissajous auto/click calibrations
import { particleFX } from './ParticleFX.js';

export class CalibrationManager {
    constructor(gazeFollower) {
        this.gf = gazeFollower;
        this.mode = '13-point'; // '5-point', '9-point', '13-point', 'random', 'lissajous'
        this.method = 'click'; // 'click', 'auto'
        this.order = 'random'; // 'random', 'sequential'
        this.frameLatency = 4;
        this.latencyOffsetMs = 133; // Default 4 frames (~133ms at 30fps)
        this.setLatency(4);

        this.isActive = false;
        this.points = [];
        this.currentIndex = 0;
        
        // Auto dwell calibration mode data collection rules (referencing GazeFollower python v1.0.2):
        // - Prepare time: 1.5s (1500ms) waiting for subject to look at the dot (showing '+')
        // - Recording phase: collect 45 valid frames (showing '1' to '99')
        // - Wait time: 0.5s (500ms) after 45 frames collected before advancing to next point
        this.autoPrepareMs = 1500;
        this.autoWaitMs = 500;
        this.nFramesNeedCollect = 45;
        this.nFramesAdded = 0;
        this.pointOnsetTimestamp = 0;
        this.featureFullTime = 0;
        this.isWaitingWaitTime = false;

        // Click calibration mode parameters:
        // - Collect data from 200ms before click to 500ms after click
        this.isWaitingPostClick = false;
        this.clickTime = 0;
        this.clickTargetX = 0;
        this.clickTargetY = 0;

        // Lissajous state
        this.lissajousSpeed = 250; // pixels per second (smooth pursuit comfortable speed, default: 250 px/s)
        this.lissajousDuration = 25000; // ms
        this.lissajousPrepareMs = 1500; // 1.5s fixation at center before moving
        this.lissajousT = 0;
        this.lissajousStartTime = 0;
        
        // Feature queue for latency and window matching: { timestamp, features }
        this.featureQueue = [];
        this._rafId = null;
        this._lastProgress = -1;
        this.currentScale = 1.0;
        this.currentX = 0;
        this.currentY = 0;
        
        this.initDOM();
    }

    setLatency(val) {
        if (typeof val === 'number') {
            if (val <= 20) {
                // Treated as frame count (assuming ~30fps: ~33.3ms per frame)
                this.frameLatency = val;
                this.latencyOffsetMs = Math.round(val * (1000 / 30));
            } else {
                // Treated as milliseconds directly
                this.latencyOffsetMs = val;
                this.frameLatency = Math.round(val / (1000 / 30));
            }
        }
    }

    computeLissajousLength(w = (typeof window !== 'undefined' ? window.innerWidth : 1920), 
                           h = (typeof window !== 'undefined' ? window.innerHeight : 1080), 
                           a = 3, b = 2) {
        const steps = 1000;
        const dTheta = (2 * Math.PI) / steps;
        let len = 0;
        const ampX = w * 0.4;
        const ampY = h * 0.4;
        for (let i = 0; i < steps; i++) {
            const theta = i * dTheta;
            const dx = ampX * a * Math.cos(a * theta);
            const dy = ampY * b * Math.cos(b * theta);
            len += Math.hypot(dx, dy) * dTheta;
        }
        return len;
    }

    setLissajousSpeed(speedPxPerSec = 250) {
        const speed = parseFloat(speedPxPerSec);
        if (Number.isFinite(speed) && speed > 0) {
            this.lissajousSpeed = speed;
            const len = this.computeLissajousLength();
            this.lissajousDuration = Math.round((len / speed) * 1000);
        }
        return this.lissajousDuration;
    }

    getLissajousSpeed() {
        return this.lissajousSpeed;
    }

    setLissajousDuration(durationMs = 25000) {
        const dur = parseFloat(durationMs);
        if (Number.isFinite(dur) && dur > 0) {
            this.lissajousDuration = dur;
            const len = this.computeLissajousLength();
            this.lissajousSpeed = Math.round(len / (dur / 1000));
        }
        return this.lissajousSpeed;
    }

    initDOM() {
        this.container = document.createElement('div');
        this.container.id = 'gf-calibration-container';
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            zIndex: '999999',
            pointerEvents: 'none',
            display: 'none',
            background: 'rgba(244, 246, 249, 0.98)'
        });
        
        // Calibration dot (red solid circle, matching GazeFollower python v1.0.2)
        // Positioned using GPU composited translate3d for silky-smooth 60Hz/120Hz animation with zero layout reflows
        this.dot = document.createElement('div');
        Object.assign(this.dot.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '50px',
            height: '50px',
            background: '#ff0000',
            borderRadius: '50%',
            willChange: 'transform',
            contain: 'layout style size',
            transform: 'translate3d(-100px, -100px, 0) scale(1)',
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxShadow: '0 3px 14px rgba(255, 0, 0, 0.45)',
            transition: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none'
        });

        // Center label: displays '+' initially, then '1' to '99' during auto recording
        this.dotLabel = document.createElement('span');
        Object.assign(this.dotLabel.style, {
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: '700',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            userSelect: 'none',
            pointerEvents: 'none',
            lineHeight: '1',
            textAlign: 'center'
        });
        this.dotLabel.textContent = '+';
        this.dot.appendChild(this.dotLabel);

        // Hover scale effect (active in click calibration mode)
        this.dot.addEventListener('mouseenter', () => {
            if (!this.isWaitingPostClick && this.mode !== 'lissajous') {
                this.updateTransform(1.1);
            }
        });
        this.dot.addEventListener('mouseleave', () => {
            if (!this.isWaitingPostClick && this.mode !== 'lissajous') {
                this.updateTransform(1.0);
            }
        });
        
        // Click action: collect data from 200ms before click to 500ms after click
        // with inward shrinking/breathing feedback (~0.88 scale, 0.85 opacity) for 500ms
        this.dot.addEventListener('click', () => {
            if (this.isActive && this.method === 'click' && this.mode !== 'lissajous') {
                if (this.isWaitingPostClick) return;
                this.isWaitingPostClick = true;
                const clickTime = performance.now();
                const clickX = this.currentX;
                const clickY = this.currentY;

                // Inward shrinking and subtle opacity feedback to anchor gaze
                this.dot.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease';
                this.updateTransform(0.88);
                this.dot.style.opacity = '0.85';
                particleFX.burst(clickX, clickY, {
                    color: '#ff3b30',
                    count: 18
                });

                // Wait 500ms after click to capture post-click data while user holds fixation
                setTimeout(() => {
                    this.updateTransform(1.0);
                    this.dot.style.opacity = '1.0';
                    const tMin = clickTime - 200;
                    const tMax = clickTime + 500;
                    const targetFrames = this.featureQueue.filter(f => f.timestamp >= tMin && f.timestamp <= tMax);
                    if (targetFrames.length > 0) {
                        targetFrames.forEach(f => this.gf.addCalibrationPoint(f.features, clickX, clickY));
                    } else if (this.gf.lastFeatures) {
                        this.gf.addCalibrationPoint(this.gf.lastFeatures, clickX, clickY);
                    }
                    this.isWaitingPostClick = false;
                    this.nextPoint();
                }, 500);
            }
        });
        
        this.container.appendChild(this.dot);
        document.body.appendChild(this.container);
    }

    updateTransform(scale = this.currentScale) {
        this.currentScale = scale;
        this.dot.style.transform = `translate3d(${this.currentX - 25}px, ${this.currentY - 25}px, 0) scale(${scale})`;
    }

    updateDotPos(x, y) {
        this.currentX = x;
        this.currentY = y;
        this.dot.style.transform = `translate3d(${x - 25}px, ${y - 25}px, 0) scale(${this.currentScale})`;
    }

    start(mode = '13-point', method = 'click', latency = null, order = 'random') {
        if (latency !== null && latency !== undefined) {
            this.setLatency(latency);
        }
        this.mode = mode;
        this.method = method;
        this.order = order;
        this.isActive = true;
        this.container.style.display = 'block';
        this.gf.isCalibrated = false; // Reset
        this.gf.clearData();
        
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        let basePoints = [];
        if (mode === '5-point') {
            basePoints = [[w*0.15, h*0.15], [w*0.85, h*0.15], [w*0.5, h*0.5], [w*0.15, h*0.85], [w*0.85, h*0.85]];
        } else if (mode === '9-point') {
            basePoints = [
                [w*0.15, h*0.15], [w*0.5, h*0.15], [w*0.85, h*0.15],
                [w*0.15, h*0.5], [w*0.5, h*0.5], [w*0.85, h*0.5],
                [w*0.15, h*0.85], [w*0.5, h*0.85], [w*0.85, h*0.85]
            ];
        } else if (mode === '13-point') {
            basePoints = [
                [w*0.12, h*0.12], [w*0.5, h*0.12], [w*0.88, h*0.12],
                [w*0.28, h*0.28], [w*0.72, h*0.28],
                [w*0.12, h*0.5], [w*0.5, h*0.5], [w*0.88, h*0.5],
                [w*0.28, h*0.72], [w*0.72, h*0.72],
                [w*0.12, h*0.88], [w*0.5, h*0.88], [w*0.88, h*0.88]
            ];
        } else if (mode === 'random') {
            const count = 13;
            const padX = w * 0.12;
            const padY = h * 0.12;
            for (let i = 0; i < count; i++) {
                basePoints.push([
                    padX + Math.random() * (w - padX * 2),
                    padY + Math.random() * (h - padY * 2)
                ]);
            }
        }
        
        // Randomize order if requested
        if (this.order === 'random' && mode !== 'lissajous' && mode !== 'random') {
            this.points = [...basePoints];
            for (let i = this.points.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [this.points[i], this.points[j]] = [this.points[j], this.points[i]];
            }
        } else {
            this.points = basePoints;
        }
        
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        this.currentIndex = 0;
        this.nFramesAdded = 0;
        this.isWaitingWaitTime = false;
        this.featureFullTime = 0;
        this.isWaitingPostClick = false;
        this.lissajousT = 0;
        this.lissajousStartTime = 0;
        this.pointOnsetTimestamp = performance.now();
        this.featureQueue = [];
        this._lastProgress = -1;
        this.currentScale = 1.0;
        
        // Setup dot appearance according to method
        if (this.method === 'auto') {
            this.dotLabel.textContent = '+';
            this.dotLabel.style.fontSize = '24px';
            this.dotLabel.style.display = 'block';
        } else {
            this.dotLabel.textContent = '';
        }

        if (this.mode === 'lissajous') {
            this.dot.style.transition = 'none';
            this.dot.style.pointerEvents = 'none';
            this.setLissajousSpeed(this.lissajousSpeed || 250);
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.updateDotPos(w / 2, h / 2);
            this.dotLabel.textContent = '+';
            this.dotLabel.style.fontSize = '24px';
            this.dotLabel.style.display = 'block';
        } else if (this.points.length > 0) {
            this.dot.style.pointerEvents = 'auto';
            this.dot.style.transition = 'none';
            this.updateDotPos(this.points[0][0], this.points[0][1]);
        }
        
        if (this.method === 'auto' || this.mode === 'lissajous') {
            this.autoLoop();
        }
    }

    recordCurrentPoint(features = null) {
        let feats = features || this.gf.lastFeatures;
        if (feats) {
            this.gf.addCalibrationPoint(feats, this.currentX, this.currentY);
        }
    }

    nextPoint() {
        this.currentIndex++;
        if (this.currentIndex >= this.points.length) {
            this.finish();
        } else {
            if (this.method === 'click') {
                this.dot.style.transition = 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)';
            } else {
                this.dot.style.transition = 'none';
            }
            this.updateDotPos(this.points[this.currentIndex][0], this.points[this.currentIndex][1]);
            this.pointOnsetTimestamp = performance.now();
            this.nFramesAdded = 0;
            this.isWaitingWaitTime = false;
            this.featureFullTime = 0;
            this.isWaitingPostClick = false;
            this._lastProgress = -1;
            if (this.method === 'auto') {
                this.dotLabel.textContent = '+';
                this.dotLabel.style.fontSize = '24px';
            }
        }
    }
    
    // Call this from inference loop to push features with timestamps
    feedFeatures(features, timestamp) {
        if (!this.isActive) return;
        
        this.featureQueue.push({ timestamp, features });
        if (this.featureQueue.length > 100) this.featureQueue.shift();
        
        if (this.mode === 'lissajous') {
            if (this.lissajousStartTime) {
                const elapsed = timestamp - this.lissajousStartTime;
                if (elapsed >= this.lissajousPrepareMs) {
                    const targetTime = timestamp - this.latencyOffsetMs;
                    const tMove = targetTime - (this.lissajousStartTime + this.lissajousPrepareMs);
                    if (tMove > 0 && tMove <= this.lissajousDuration) {
                        const pos = this.getLissajousPos(tMove);
                        this.gf.addCalibrationPoint(features, pos.x, pos.y);
                    }
                }
            }
        } else if (this.method === 'auto') {
            // Auto dwell mode matching GazeFollower python v1.0.2:
            // 1. Wait autoPrepareMs (1500ms) for subject gaze to fixate on the dot (dot shows '+')
            // 2. Collect 45 valid frames (dot shows '1' to '99')
            // 3. After 45 frames collected, wait autoWaitMs (500ms) before advancing to next point
            if (this.isWaitingWaitTime) return;
            
            const now = performance.now();
            if (now - this.pointOnsetTimestamp >= this.autoPrepareMs) {
                if (this.nFramesAdded < this.nFramesNeedCollect) {
                    this.gf.addCalibrationPoint(features, this.currentX, this.currentY);
                    this.nFramesAdded++;
                    
                    const progress = Math.min(99, Math.max(1, Math.round((this.nFramesAdded / this.nFramesNeedCollect) * 100)));
                    if (this._lastProgress !== progress) {
                        this.dotLabel.style.fontSize = '17px';
                        this.dotLabel.textContent = progress.toString();
                        this._lastProgress = progress;
                    }
                    
                    if (this.nFramesAdded === this.nFramesNeedCollect) {
                        this.featureFullTime = performance.now();
                        this.isWaitingWaitTime = true;
                    }
                }
            }
        }
    }
    
    getLissajousPos(t) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (t <= 0) return { x: w / 2, y: h / 2 };
        // Smooth parametric Lissajous: starting continuously from center
        const a = 3, b = 2;
        const normT = (t / this.lissajousDuration) * Math.PI * 2;
        const x = (w / 2) + (w * 0.4) * Math.sin(a * normT);
        const y = (h / 2) + (h * 0.4) * Math.sin(b * normT);
        return { x, y };
    }

    autoLoop(rafTimestamp) {
        if (!this.isActive) return;
        
        const now = (typeof rafTimestamp === 'number' && rafTimestamp > 0) ? rafTimestamp : performance.now();
        
        if (this.mode === 'lissajous') {
            this.dot.style.transition = 'none'; // continuous 60Hz/120Hz without CSS transition fighting
            if (!this.lissajousStartTime) {
                this.lissajousStartTime = now;
                this.dotLabel.textContent = '+';
                this.dotLabel.style.fontSize = '24px';
                this.dotLabel.style.display = 'block';
                this._lastProgress = -1;
            }
            
            const elapsed = now - this.lissajousStartTime;
            if (elapsed < this.lissajousPrepareMs) {
                // Prepare phase: hold steady at screen center
                const w = window.innerWidth;
                const h = window.innerHeight;
                this.updateDotPos(w / 2, h / 2);
                if (this._lastProgress !== 0) {
                    this.dotLabel.textContent = '+';
                    this.dotLabel.style.fontSize = '24px';
                    this.dotLabel.style.display = 'block';
                    this._lastProgress = 0;
                }
            } else {
                const tMove = elapsed - this.lissajousPrepareMs;
                if (tMove >= this.lissajousDuration) {
                    this.finish();
                    return;
                }
                
                const pos = this.getLissajousPos(tMove);
                this.updateDotPos(pos.x, pos.y);
                
                const progress = Math.min(99, Math.max(1, Math.round((tMove / this.lissajousDuration) * 100)));
                if (this._lastProgress !== progress) {
                    if (this._lastProgress <= 0) {
                        this.dotLabel.style.fontSize = '14px';
                    }
                    this.dotLabel.textContent = progress.toString();
                    this._lastProgress = progress;
                }
            }
        } else if (this.method === 'auto') {
            // Check if post-collection 500ms wait period has completed
            if (this.isWaitingWaitTime) {
                if (now - this.featureFullTime >= this.autoWaitMs) {
                    particleFX.burst(this.currentX, this.currentY, {
                        color: '#ff3b30',
                        count: 20
                    });
                    this.isWaitingWaitTime = false;
                    this.nextPoint();
                }
            }
        }
        
        this._rafId = requestAnimationFrame((ts) => this.autoLoop(ts));
    }

    finish() {
        this.isActive = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this.container.style.display = 'none';
        this.gf.trainCalibration();
        if (this.gf.listener) {
            this.gf.listener(null, null); // Trigger end of cali
        }
    }
}
