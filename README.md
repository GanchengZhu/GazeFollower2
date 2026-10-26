# GazeFollower2 Web SDK (v2.0)

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC_BY--NC--SA_4.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](package.json)
[![WebGazer Compatible](https://img.shields.io/badge/API-WebGazer%20Compatible-brightgreen.svg)](#-webgazer-migration-guide)
[![Live Demo](https://img.shields.io/badge/Demo-Live_Interactive_Demo-blueviolet?logo=github)](https://ganchengzhu.github.io/GazeFollower2/)

**GazeFollower2** is a high-precision, webcam-based eye tracking JavaScript SDK for modern web browsers & iOS. Designed with a **WebGazer-compatible API**, it provides a modern drop-in solution for online behavioral experiments, usability studies, and gaze-reactive web applications.

👉 **[Try the Live Web Demo](https://ganchengzhu.github.io/GazeFollower2/)** (Zero setup, runs entirely in browser with your webcam)

---

## 🚀 Key Features

- **WebGazer-Compatible API**: Familiar methods (`begin`, `end`, `pause`, `resume`, `setGazeListener`, `getCurrentPrediction`, `recordScreenPosition`, `clearData`, etc.) for seamless adoption and migration.
- **Package & Namespace**: Official package name is **`gazefollower2`** (`window.GazeFollower2`), with `window.webgazer` maintained as an automatic backward-compatibility alias.
- **Built-in Multivariate Ridge Calibration**: Fast, robust spatial mapping enabled by default without requiring manual algorithm configuration.
- **Flexible Calibration Routines**:
  - **Discrete Grid**: 5-point, 9-point, and 13-point spatial grids.
  - **Continuous Tracking**: Lissajous smooth pursuit trajectory.
  - **Interaction Modes**: Auto-dwell (stare at target) or Click-to-calibrate.
- **Default Heuristic Anti-Jitter Filtering**: Applies a specialized Heuristic Filter (`lookAhead = 2`) by default on predicted gaze coordinates to eliminate sudden trajectory spikes and micro-jitter without adding latency.
- **Zero-Hardware Dependency**: Runs entirely in the client's browser with any standard webcam.
- **jsPsych & PsychoJS Ready**: Drop-in compatibility for online psychology and behavioral experiments.
- **iOS Native Bridge Compatible**: Seamless integration with native iOS eye tracking apps (e.g. WKWebView + ARKit/TrueDepth) using standard JS callbacks (`window.GazeFollower2.listener`) without altering web experiment task logic.

---

## 🏃 Quick Start

### 1. Running the Local Demo

Modern browsers require HTTPS or `localhost` to access webcam streams:

```bash
cd GazeFollower2

# Install lightweight server dependencies
pip install fastapi uvicorn

# Start the server
python server.py
```

Open your browser and visit:
- **Public Demo**: `http://localhost:8000/index.html` (or `http://localhost:8000/`) — Streamlined out-of-the-box experience powered exclusively by the SOTA `GazeNet_Next` model.
- **Internal Dev Demo**: `http://localhost:8000/index_dev.html` (Local development only, ignored in Git) — Full evaluation panel with model comparison dropdown.

---

## 📦 Installation & Basic Usage

### Option 1: HTML Script Tags

Load ONNX Runtime Web, then import `dist/gazefollower2.min.js`:

```html
<!-- 1. Load ONNX Runtime Web -->
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>

<!-- 2. Load GazeFollower2 SDK (ES Module) -->
<script type="module" src="dist/gazefollower2.min.js"></script>

<script>
  // window.GazeFollower2 is globally available upon import
  GazeFollower2
    .setGazeListener((data, timestamp) => {
      if (!data) return; // No gaze or face out of view
      console.log(`Gaze coordinates: (${data.x}, ${data.y})`);
    })
    .begin();
</script>
```

### Option 2: ES Module Import

```javascript
import GazeFollower2 from './dist/gazefollower2.min.js';

// Start eye tracking
await GazeFollower2.begin();

// Read instantaneous prediction on demand
const prediction = GazeFollower2.getCurrentPrediction();
if (prediction) {
  console.log(`Current fixation: X=${prediction.x}, Y=${prediction.y}`);
}
```

---

## ⚙️ API Reference

### Lifecycle & Stream Control

#### `GazeFollower2.begin(progressCallback?: (progress: number) => void): Promise<GazeFollower2>`
Initializes the detector, loads the model, requests camera permissions, and starts the real-time tracking loop.
```javascript
await GazeFollower2.begin((progress) => {
  console.log(`Loading: ${Math.round(progress * 100)}%`);
});
```

#### `GazeFollower2.end(): GazeFollower2` (Alias: `GazeFollower2.stop()`)
Stops tracking, closes webcam media stream tracks, and releases video resources.
```javascript
GazeFollower2.end();
```

#### `GazeFollower2.pause(): GazeFollower2`
Pauses prediction calculations while keeping the webcam active.
```javascript
GazeFollower2.pause();
```

#### `GazeFollower2.resume(): GazeFollower2`
Resumes prediction calculations after being paused.
```javascript
GazeFollower2.resume();
```

#### `GazeFollower2.isReady(): boolean`
Returns `true` if the SDK is initialized and ready.
```javascript
if (GazeFollower2.isReady()) {
  console.log("Ready for calibration and tracking.");
}
```

#### `GazeFollower2.loadModel(modelPath?: string, progressCallback?: (progress: number) => void): Promise<GazeFollower2>`
Dynamically switches or reloads the ONNX gaze estimation neural model. Defaults to `'GazeNet_Next.onnx'`.
- `'GazeNet_Next.onnx'`: Standard full-precision SOTA neural model (~8.0 MB, default).
- `'GazeNet_Next.bin'`: Encrypted binary neural model (~8.0 MB, decoded in-memory with Web Crypto API).

```javascript
// Load the GazeNet_Next model
await GazeFollower2.loadModel('GazeNet_Next.onnx', (progress) => {
  console.log(`Downloading: ${Math.round(progress * 100)}%`);
});
```

---

### Prediction & Event Listeners

#### `GazeFollower2.setGazeListener(callback: (data: { x: number, y: number } | null, timestamp: number | null) => void): GazeFollower2`
Sets the callback executed on every predicted frame.
- `data`: Screen coordinate object `{ x: number, y: number }` in pixels, or `null` if face is undetected.
- `timestamp`: DOM high-resolution timestamp (`performance.now()`), or `null` when signaling calibration completion (`data === null && timestamp === null`).
```javascript
GazeFollower2.setGazeListener((data, timestamp) => {
  if (data) {
    console.log(`Fixation at (${data.x}, ${data.y})`);
  }
});
```

#### `GazeFollower2.clearGazeListener(): GazeFollower2`
Removes the currently active gaze listener.
```javascript
GazeFollower2.clearGazeListener();
```

#### `GazeFollower2.getCurrentPrediction(): { x: number, y: number } | null`
Returns the latest predicted gaze coordinates immediately, or `null` if not calibrated / face not detected.
```javascript
const point = GazeFollower2.getCurrentPrediction();
```

---

### Calibration & Data

Calibration uses **Multivariate Ridge Regression** ($W = (X^T X + \lambda I)^{-1} X^T Y$) as the built-in default engine.

#### Recommended Regularization ($\lambda$ / `ridgeAlpha`) by Calibration Points

Because the neural feature vector is 258-dimensional, sparser calibration patterns require stronger regularization penalties to avoid overfitting and peripheral distortion:

| Calibration Mode (`mode`) | Point Count | Recommended Default $\lambda$ (`ridgeAlpha`) | Rationale |
| :--- | :---: | :---: | :--- |
| **`'5-point'`** | 5 points | **`3.0`** (default 3) | Sparser coverage; strong regularization prevents over-rotation and boundary distortion. |
| **`'9-point'`** | 9 points | **`2.0`** (default 2) | Standard 3×3 grid; balanced spatial smoothness and local sensitivity. |
| **`'13-point'`** *(Default)* | 13 points | **`1.0`** (default 1) | Dense grid with complete coverage; baseline penalty yields optimal resolution. |

```javascript
// Example: set corresponding lambda before starting calibration
GazeFollower2.setRidgeAlpha(3.0).startCalibration('5-point', 'click');
```

#### `GazeFollower2.startCalibration(mode?, method?, latency?, order?): GazeFollower2`
Launches the full-screen interactive calibration UI.
- **`mode`**: `'5-point'`, `'9-point'`, `'13-point'` *(default)*, `'random'`, or `'lissajous'`.
- **`method`**: `'click'` *(default)* or `'auto'`.
- **`latency`**: Frame buffer offset (default: `4` frames; values `<= 20` are frames @ 30 FPS, values `> 20` are milliseconds).
- **`order`**: `'random'` *(default)* or `'sequential'`.

```javascript
// Start standard 13-point click calibration
GazeFollower2.startCalibration('13-point', 'click');

// Listen for calibration completion:
GazeFollower2.setGazeListener((data, timestamp) => {
  if (data === null && timestamp === null) {
    console.log("Calibration finished and model fitted successfully!");
  }
});
```

#### `GazeFollower2.setRidgeAlpha(alpha: number): GazeFollower2` & `GazeFollower2.getRidgeAlpha(): number`
Sets or gets the Ridge regression regularization penalty $\lambda$ (defaults: 3.0 for 5-point, 2.0 for 9-point, 1.0 for 13-point).
```javascript
GazeFollower2.setRidgeAlpha(3.0);
console.log(GazeFollower2.getRidgeAlpha()); // 3
```

#### `GazeFollower2.recordScreenPosition(x: number, y: number, eventType?: string): boolean`
Manually records a screen position target for calibration.
```javascript
window.addEventListener('click', (e) => {
  GazeFollower2.recordScreenPosition(e.clientX, e.clientY);
});
```

#### `GazeFollower2.addCalibrationPoint(features: number[], screenX: number, screenY: number): GazeFollower2`
Appends a 258-D gaze feature vector and target screen coordinate to the calibration dataset.

#### `GazeFollower2.trainCalibration(): boolean`
Fits the regression model on collected calibration points and marks `isCalibrated = true`.

#### `GazeFollower2.clearData(): GazeFollower2`
Clears recorded calibration data and resets the mapping model.
```javascript
GazeFollower2.clearData();
```

---

### Display & Visual Overlays

#### `GazeFollower2.showVideo(bool: boolean): GazeFollower2`
*(Aliases: `showVideoPreview(bool)`, `showVideoElement(bool)`)*
Shows or hides the webcam video preview on screen.
```javascript
GazeFollower2.showVideo(true);  // Show video preview
GazeFollower2.showVideo(false); // Hide video preview
```

#### `GazeFollower2.showPredictionPoints(bool: boolean): GazeFollower2`
Shows or hides the facial landmark and eye bounding box overlay.
```javascript
GazeFollower2.showPredictionPoints(true);
```

#### `GazeFollower2.getVideoElementCanvas(): HTMLCanvasElement | null`
Returns the overlay canvas element.

---

### Filtering & Jitter Reduction (`HeuristicFilter`)

#### `GazeFollower2.setHeuristicFilter(bool?: boolean | Object, look_ahead?: number): GazeFollower2`
Enables or disables the built-in **Heuristic Filter** on predicted screen coordinates and configures its `look_ahead` window parameter. **Enabled by default (`true`)** with **`look_ahead = 2`** (sliding window of $2 \times \text{look\_ahead} + 1 = 5$ frames).
```javascript
GazeFollower2.setHeuristicFilter(true);    // Default: active with look_ahead = 2
GazeFollower2.setHeuristicFilter(true, 3); // Enable and set look_ahead = 3
GazeFollower2.setHeuristicFilter({ enabled: true, look_ahead: 2 }); // Object config
GazeFollower2.setHeuristicFilter(false);   // Disable filter (raw coordinates)
```

#### `GazeFollower2.setLookAhead(look_ahead?: number): GazeFollower2` & `GazeFollower2.getLookAhead(): number`
*(Properties: `GazeFollower2.look_ahead` / `GazeFollower2.lookAhead`)*
Directly get or set the `look_ahead` parameter (default: `2`).
```javascript
GazeFollower2.setLookAhead(3);
GazeFollower2.look_ahead = 2; // Property setter (also resets sliding window if changed)
console.log(GazeFollower2.getLookAhead()); // 2
```

#### `GazeFollower2.resetFilter(): GazeFollower2`
Clears the internal sliding window buffers of the Heuristic Filter.

#### `GazeFollower2.applyKalmanFilter(bool: boolean, look_ahead?: number): GazeFollower2`
*(Alias: `applySmoothingFilter(bool, look_ahead?)`)*
WebGazer backward-compatibility alias that toggles the default Heuristic Filter and optionally sets `look_ahead`.
```javascript
GazeFollower2.applyKalmanFilter(true, 2); // Controls default Heuristic Filter
```

> 📖 For the complete, exhaustive API reference (including all instance properties and sub-module classes), see [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md).

---

## 🔄 WebGazer Migration Guide

GazeFollower2 implements standard WebGazer method signatures for seamless migration:

| WebGazer.js Method | GazeFollower2 Method | Notes |
| :--- | :--- | :--- |
| `webgazer.begin(cb)` | `GazeFollower2.begin(cb)` | Identical usage (returns Promise) |
| `webgazer.end()` | `GazeFollower2.end()` / `stop()` | Identical usage (releases camera) |
| `webgazer.pause()` | `GazeFollower2.pause()` | Identical usage |
| `webgazer.resume()` | `GazeFollower2.resume()` | Identical usage |
| `webgazer.setGazeListener(cb)` | `GazeFollower2.setGazeListener(cb)` | Identical `(data, timestamp)` callback |
| `webgazer.clearGazeListener()` | `GazeFollower2.clearGazeListener()` | Identical usage |
| `webgazer.getCurrentPrediction()` | `GazeFollower2.getCurrentPrediction()` | Identical usage |
| `webgazer.recordScreenPosition(x, y)` | `GazeFollower2.recordScreenPosition(x, y)` | Identical usage |
| `webgazer.showVideo(bool)` | `GazeFollower2.showVideo(bool)` | Identical usage |
| `webgazer.showPredictionPoints(bool)`| `GazeFollower2.showPredictionPoints(bool)`| Identical usage |
| `webgazer.clearData()` | `GazeFollower2.clearData()` | Identical usage |
| `webgazer.isReady()` | `GazeFollower2.isReady()` | Identical usage |
| `webgazer.applyKalmanFilter(bool)` | `GazeFollower2.applyKalmanFilter(bool)` | Identical usage |

### Backward Compatibility
If existing scripts reference `window.webgazer`, GazeFollower2 automatically aliases itself so existing code works without modification:
```javascript
webgazer.setGazeListener((data, clock) => { ... }).begin();
```

---

## 🧠 jsPsych Integration

When using GazeFollower2 with jsPsych:

1. **DOM Sandboxing**: Set `display_element` so jsPsych does not remove SDK video/canvas elements between trials:
   ```javascript
   const jsPsych = initJsPsych({
     display_element: 'jspsych-container'
   });
   ```
2. **Fullscreen Mode**: Always switch to fullscreen before running calibration to ensure pixel coordinates match the full display area:
   ```javascript
   const fullscreen_trial = {
     type: jsPsychFullscreen,
     fullscreen_mode: true
   };
   ```

---

## 🔬 PsychoJS Integration

For PsychoPy / PsychoJS online experiments:

```javascript
// In 'Begin Experiment' tab:
GazeFollower2.setGazeListener((data, timestamp) => {
  if (data) {
    psychoJS.experiment.addData('gaze_x', data.x);
    psychoJS.experiment.addData('gaze_y', data.y);
    psychoJS.experiment.addData('gaze_time', timestamp);
  }
}).begin();
```

---

## 📱 iOS Native App Integration (WKWebView Bridge)

If you are developing a native iOS App (or running jsPsych / PsychoJS experiments inside an iOS `WKWebView`), the app can inject high-precision native ARKit / TrueDepth tracking data directly into GazeFollower2 without altering web application logic:

- **Coordinate Injection**: Native app calls `window.GazeFollower2.listener({ x: screenX, y: screenY }, performance.now())` to drive web gaze events.
- **Polling Cache**: Native app updates `window.GazeFollower2.targetX` and `window.GazeFollower2.targetY` for instantaneous synchronous `getCurrentPrediction()` reads.
- **Message Handlers**: Register `GazeFollowerBridge` to receive lifecycle requests (`begin`, `end`, `pause`, `resume`, `calibrate`) from JavaScript.

> Detailed integration patterns and full Swift/JS code examples are documented in [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md#13-ios-native-app-bridge-wkwebview-对接规范).

---

## 💻 System Requirements & Browser Compatibility

Because client-side eye tracking relies on WebRTC camera streams, WebAssembly (WASM), and hardware-accelerated graphics (WebGL / WebGPU), browser compatibility is **not 100% uniform across all environments**.

### 🌐 Browser Compatibility Matrix

| Browser | Support Level | Minimum Version | Recommended Version | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Google Chrome** | 🟢 **Tier 1 (Best)** | v90+ | Latest stable | Best performance; full WebAssembly SIMD and WebGPU/WebGL acceleration. |
| **Microsoft Edge** | 🟢 **Tier 1 (Best)** | v90+ | Latest stable | Chromium-based; identical performance and reliability to Chrome. |
| **Brave / Opera** | 🟢 **Tier 1 (Best)** | Chromium 90+ | Latest stable | Chromium engine; ensure shields do not block camera access. |
| **Mozilla Firefox** | 🟡 **Tier 2 (Supported)** | v95+ | Latest stable | Supported via WebAssembly. High performance, but WebGPU may require manual browser flags. |
| **Apple Safari** (macOS) | 🟡 **Tier 2 (Supported)** | v15.4+ | Latest stable | Supported. MediaPipe automatically uses CPU fallback for stability. Requires user gesture before playing camera video. |
| **Mobile Browsers** (iOS / Android) | 🟠 **Tier 3 (Experimental)** | iOS 16+, Chrome Android | Not recommended | Technically functions, but not recommended for precision research due to handheld shake, steep viewing angles, and battery throttling. |
| **Internet Explorer** | 🔴 **Unsupported** | Any | None | Does not support WebAssembly, WebRTC, or ES6 modules. |

---

### 🖥️ Recommended Hardware & Environment

For optimal tracking accuracy (mean spatial error $\le 1.5^\circ$ visual angle):

| Factor | Recommended | Minimum Requirement |
| :--- | :--- | :--- |
| **Webcam** | 720p or 1080p @ 30–60 FPS, top-center mounted | 480p @ 30 FPS |
| **User Distance** | 50 cm – 70 cm (~arm's length) directly facing monitor | 40 cm – 80 cm |
| **Lighting** | Even, diffuse front/ambient light; face clearly illuminated | No direct glare or backlighting (avoid windows behind user) |
| **Display** | 1080p (1920×1080) or higher; OS scaling at 100% | 1280×720 |
| **Processor** | Multi-core CPU (Intel i5/Ryzen 5 / Apple Silicon M-series) | Dual-core CPU with WebAssembly support |
| **Network Protocol** | **HTTPS** or **`http://localhost`** | Unencrypted remote HTTP is strictly blocked by browsers |

---

## 🛠 Building the Bundle

To recompile the distribution bundle:

```bash
cd js_port
npm install
npm run build
```
Outputs:
- `dist/gazefollower2.min.js`
- `dist/gazefollower-sdk.min.js` (backward compatibility)

---

## 📄 License & Commercial Inquiries

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License ([CC BY-NC-SA 4.0](LICENSE))**.

- **Academic & Non-Commercial Research**: Free to use, study, modify, and build upon for non-commercial, educational, and academic research purposes, provided appropriate attribution is given and any derivative works are shared under the same license terms.
- **Commercial Licensing**: Commercial use, integration into commercial applications, or proprietary enterprise deployment is strictly prohibited without an explicit commercial license. Please contact the project maintainers for commercial inquiries.


