# GazeFollower2 Web SDK (JS) — 完整 API 参考文档 (API Reference)

本文档提供 **GazeFollower2 Web SDK** (`gazefollower2` v2.0.0) 的全部公开与底层模块 API 说明，涵盖全局导出、核心类 `GazeFollower2` 的生命周期、启发式滤波 (`HeuristicFilter` 与 `look_ahead`)、空间校准 (`CalibrationManager` / `MultivariateRidgeCalibration` / `SVRCalibration`)、神经网络视线估计 (`MGazeNetGazeEstimator`)、人脸对齐与裁剪 (`FaceAlignment`)、一欧元滤波器 (`OneEuroFilter`) 以及 WebGazer 无缝兼容层。

---

## 📑 目录 (Table of Contents)

1. [模块导出与全局单例 (Exports & Global Singletons)](#1-模块导出与全局单例-exports--global-singletons)
2. [核心类 `GazeFollower2` — 构造函数与初始化](#2-核心类-gazefollower2--构造函数与初始化)
3. [生命周期与摄像头流控制 (Lifecycle & Stream Control)](#3-生命周期与摄像头流控制-lifecycle--stream-control)
4. [神经网络模型管理 (Neural Model Management)](#4-神经网络模型管理-neural-model-management)
5. [实时视线预测与事件回调 (Gaze Prediction & Callbacks)](#5-实时视线预测与事件回调-gaze-prediction--callbacks)
6. [启发式防抖滤波与 `look_ahead` 配置 (Heuristic Filtering)](#6-启发式防抖滤波与-look_ahead-配置-heuristic-filtering)
7. [空间校准与回归训练 (Calibration & Spatial Mapping)](#7-空间校准与回归训练-calibration--spatial-mapping)
8. [视频预览与视觉叠加层 (Visual Displays & Overlays)](#8-视频预览与视觉叠加层-visual-displays--overlays)
9. [`GazeFollower2` 实例属性速查表 (Instance Properties)](#9-gazefollower2-实例属性速查表-instance-properties)
10. [子模块与底层算法类 API (Sub-Module Classes)](#10-子模块与底层算法类-api-sub-module-classes)
    - 10.1 [`HeuristicFilter` (启发式滤波器)](#101-heuristicfilter-启发式滤波器)
    - 10.2 [`CalibrationManager` (校准流程管理器)](#102-calibrationmanager-校准流程管理器)
    - 10.3 [`MGazeNetGazeEstimator` (ONNX 视线特征提取器)](#103-mgazenetgazeestimator-onnx-视线特征提取器)
    - 10.4 [`FaceAlignment` (MediaPipe 人脸对齐与眼部裁剪)](#104-facealignment-mediapipe-人脸对齐与眼部裁剪)
    - 10.5 [`MultivariateRidgeCalibration` (多元岭回归校准器)](#105-multivariateridgecalibration-多元岭回归校准器)
    - 10.6 [`SVRCalibration` (独立通道岭回归/SVR校准器)](#106-svrcalibration-独立通道岭回归svr校准器)
    - 10.7 [`OneEuroFilter` & `LowPassFilter` (一欧元低通滤波器)](#107-oneeurofilter--lowpassfilter-一欧元低通滤波器)
    - 10.8 [`ParticleFX` / `particleFX` (校准粒子动效引擎)](#108-particlefx--particlefx-校准粒子动效引擎)
11. [WebGazer 兼容性对照表 (WebGazer Compatibility Matrix)](#11-webgazer-兼容性对照表-webgazer-compatibility-matrix)
12. [数据结构与类型定义 (TypeScript Interfaces)](#12-数据结构与类型定义-typescript-interfaces)

---

## 1. 模块导出与全局单例 (Exports & Global Singletons)

当通过 `<script type="module" src="dist/gazefollower2.min.js"></script>` 或 ES Module `import` 引入 SDK 时，会自动实例化一个全局单例并挂载到 `window` 对象上，同时导出所有核心类：

### 全局对象 (Browser `window`)
- **`window.GazeFollower2`**：`GazeFollower2` 的默认全局单例实例。
- **`window.webgazer`**：指向同一个 `GazeFollower2` 单例的别名，实现现有 WebGazer / jsPsych 代码的零改动平替。

### ES Module 导出 (`src/GazeFollower.js` / `src/GazeFollower2.js` / `dist/gazefollower2.min.js`)
```javascript
import GazeFollower2, {
  GazeFollower2 as GazeFollower2Class,
  GazeFollower,                  // GazeFollower2 类的别名
  HeuristicFilter,               // 启发式滤波器类
  CalibrationManager,            // 交互式校准 UI 与采样管理器类
  MGazeNetGazeEstimator,         // ONNX Runtime 深度特征提取器类
  FaceAlignment,                 // 人脸关键点对齐与裁剪类
  MultivariateRidgeCalibration,  // 多元岭回归校准器类
  SVRCalibration,                // 单输出通道岭回归校准器类
  OneEuroFilter,                 // 1-Euro 自适应低通滤波器类
  LowPassFilter                  // 一阶指数平滑低通滤波器类
} from './dist/gazefollower2.min.js';
```

---

## 2. 核心类 `GazeFollower2` — 构造函数与初始化

### `new GazeFollower2(onnxModelPath?, options?)`
创建一个新的 `GazeFollower2` 实例（若使用默认全局单例 `window.GazeFollower2`，则无需手动调用 `new`）。

- **默认行为**：
  - 默认模型路径：`'GazeNet_Next.onnx'`
  - 默认开启启发式防抖滤波：`enableGazeFilter = true`（使用 `HeuristicFilter`）
  - 默认启发式滤波前瞻窗口参数：`look_ahead = 2`（对应滑动窗口长度 $2 \times \text{look\_ahead} + 1 = 5$ 帧）
  - 默认空间校准回归算法：`'ridge'` (`MultivariateRidgeCalibration`, $\lambda = 0.1$)

- **参数 (Parameters)**：
  - `onnxModelPath` (`string | GazeFollower2Options`, 可选, 默认: `'GazeNet_Next.onnx'`)：
    - 传入字符串时：ONNX 模型文件路径（支持标准 `.onnx` 或加密 `.bin`）。
    - 传入配置对象时：支持 `{ modelPath, onnxModelPath, look_ahead, lookAhead, enableHeuristicFilter, enableGazeFilter }`。
  - `options` (`number | GazeFollower2Options`, 可选, 默认: `{}`)：
    - 传入数字时：直接作为启发式滤波的 `look_ahead` 参数（例如 `new GazeFollower2('GazeNet_Next.onnx', 3)`）。
    - 传入配置对象时：
      - `look_ahead` / `lookAhead` (`number`, 默认: `2`)：启发式滤波的前瞻帧数（正整数 $\ge 1$）。
      - `enableHeuristicFilter` / `enableGazeFilter` (`boolean`, 默认: `true`)：是否默认开启启发式滤波。

- **调用示例**：
  ```javascript
  // 1. 默认构造（使用 GazeNet_Next.onnx，开启启发式滤波，look_ahead = 2）
  const gf1 = new GazeFollower2();

  // 2. 指定模型并直接传入 look_ahead 参数
  const gf2 = new GazeFollower2('GazeNet_Next.onnx', 3);

  // 3. 指定模型与配置对象
  const gf3 = new GazeFollower2('GazeNet_Next.bin', {
    look_ahead: 2,
    enableHeuristicFilter: true
  });

  // 4. 仅传入配置对象
  const gf4 = new GazeFollower2({
    modelPath: 'GazeNet_Next.onnx',
    look_ahead: 4,
    enableHeuristicFilter: true
  });
  ```

---

## 3. 生命周期与摄像头流控制 (Lifecycle & Stream Control)

### `begin(progressCallback?, options?): Promise<GazeFollower2>`
一键完成 SDK 初始化（若尚未调用 `init()`）、加载 ONNX 眼动模型与 MediaPipe FaceLandmarker、创建隐藏/预览 DOM 节点、请求用户摄像头权限并启动实时推理循环。

- **参数 (Parameters)**：
  - `progressCallback` (`((ratio: number) => void) | GazeFollower2Options | null`, 可选)：
    - 传入函数时：接收模型加载与解密进度回调，参数 `ratio` 范围为 `0.0` ~ `1.0`。
    - 传入配置对象时：支持 `{ onProgress, look_ahead, lookAhead, enableHeuristicFilter, enableGazeFilter }`。
  - `options` (`GazeFollower2Options | null`, 可选)：可选的滤波配置对象 `{ look_ahead?: number, enableHeuristicFilter?: boolean }`。
- **返回值 (Returns)**：`Promise<GazeFollower2>`（支持链式调用或 `await`）
- **示例**：
  ```javascript
  // 标准用法
  await GazeFollower2.begin((progress) => {
    console.log(`模型加载进度: ${Math.round(progress * 100)}%`);
  });

  // 在 begin 时同时配置启发式滤波 look_ahead 参数
  await GazeFollower2.begin(
    (progress) => console.log(`加载: ${Math.round(progress * 100)}%`),
    { enableHeuristicFilter: true, look_ahead: 2 }
  );
  ```

### `init(progressCallback?, options?): Promise<GazeFollower2>`
仅初始化神经网络模型（ONNX + MediaPipe FaceLandmarker）与 DOM 元素（`<video>` 和 `<canvas>`），但**不立即打开摄像头流**。适用于需要提前预加载模型、稍后再调用 `startWebcam()` 或 `begin()` 的场景。

- **参数 (Parameters)**：
  - `progressCallback` (`((ratio: number) => void) | null`, 可选)：进度回调 (`0.0` ~ `1.0`)。
  - `options` (`GazeFollower2Options | null`, 可选)：可选滤波配置 `{ look_ahead?: number, enableHeuristicFilter?: boolean }`。
- **返回值 (Returns)**：`Promise<GazeFollower2>`
- **内部执行流程**：
  1. 若 `this.estimator.session` 未创建，调用 `this.estimator.init(progressCallback)` 下载并解密模型。
  2. 加载 `@mediapipe/tasks-vision@0.10.3` WASM 运行时，创建 `FaceLandmarker`（桌面 Chrome/Edge 优先使用 `GPU` delegate，Safari 或失败时自动回退至 `CPU` delegate，`runningMode: "VIDEO"`, `numFaces: 1`）。
  3. 调用 `this.initDOM()` 挂载 `<video>` 与 `<canvas>`。
  4. 将 `this._isReady` 置为 `true`。

### `initDOM(): void`
在 `document.body` 下创建并挂载摄像头 `<video>` 元素 (`this.videoElement`) 和人脸/眼部框叠加层 `<canvas>` 元素 (`this.overlayCanvas`)，并启动 `renderLoop()`。若已创建则直接跳过。
- 默认样式：`position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scaleX(-1)`（水平镜像翻转），视频 `zIndex: -2`，画布 `zIndex: -1, pointerEvents: 'none'`。

### `startWebcam(): Promise<void>`
请求浏览器摄像头视频流 (`navigator.mediaDevices.getUserMedia`)，理想分辨率为 `640 × 480` (`facingMode: "user"`)。流就绪后自动同步 `overlayCanvas` 尺寸并启动 `inferenceLoop()`。
- **返回值 (Returns)**：`Promise<void>`（若用户拒绝摄像头权限或硬件不可用则 `reject(err)`）。

### `pause(): GazeFollower2`
暂停实时视线推理循环（将 `this.isPaused` 置为 `true`，并以 100ms 间隔待机轮询），同时保持摄像头视频流处于打开状态，并自动调用 `this.resetFilter()` 清空滤波滑动窗口。
- **返回值 (Returns)**：`GazeFollower2`

### `resume(): GazeFollower2`
从暂停状态恢复实时视线推理循环（将 `this.isPaused` 置为 `false`）。
- **返回值 (Returns)**：`GazeFollower2`

### `end(): GazeFollower2`
*(别名: `stop()`)*
完全停止视线追踪：将 `this.isPaused` 置为 `true`，停止并释放 `MediaStream` 的所有摄像头轨道 (`track.stop()`)，解除 `videoElement.srcObject` 绑定，清空 `overlayCanvas` 画布，重置滤波器缓存，并将 `rawX`, `rawY`, `targetX`, `targetY`, `smoothX`, `smoothY` 全部重置为 `null`。
- **返回值 (Returns)**：`GazeFollower2`

### `stop(): GazeFollower2`
`end()` 的完全等价别名。
- **返回值 (Returns)**：`GazeFollower2`

### `isReady(): boolean`
检查 SDK 模型、视频 DOM 元素以及视频流帧数据 (`readyState >= 2`) 是否均已就绪。
- **返回值 (Returns)**：`boolean`

---

## 4. 神经网络模型管理 (Neural Model Management)

### `loadModel(modelPath?, progressCallback?): Promise<GazeFollower2>`
动态加载或热切换底层 ONNX 视线估计神经网络模型。可在 `begin()` 之前或运行期间随时调用。

- **参数 (Parameters)**：
  - `modelPath` (`string`, 可选, 默认: `'GazeNet_Next.onnx'`)：ONNX 模型文件的相对或绝对 URL 路径。SDK 包含以下模型：
    | 模型文件名 | 格式 | 体积 | 说明 |
    | :--- | :---: | :---: | :--- |
    | `'GazeNet_Next.onnx'` | FP32 (ONNX) | ~8.0 MB | **默认开源模型**，标准 ONNX 格式，原生浏览器加载 |
    | `'GazeNet_Next.bin'` | FP32 (AES-CBC) | ~8.0 MB | 加密二进制版本，使用 Web Crypto API 内存解密运行 |
  - `progressCallback` (`((ratio: number) => void) | null`, 可选)：加载进度回调 (`0.0` ~ `1.0`)。
    - `0.10`：开始请求模型
    - `0.10 ~ 0.70`：流式分块下载 (`ReadableStream`)
    - `0.75`：Web Crypto API (`AES-CBC`) 内存解密（若是 .bin 文件）
    - `0.90`：创建 ONNX Runtime Web `InferenceSession`
    - `1.00`：模型加载完成
- **返回值 (Returns)**：`Promise<GazeFollower2>`
- **示例**：
  ```javascript
  await GazeFollower2.loadModel('GazeNet_Next.onnx', (p) => {
    console.log(`下载进度: ${Math.round(p * 100)}%`);
  });
  ```

---

## 5. 实时视线预测与事件回调 (Gaze Prediction & Callbacks)

### `setGazeListener(callback): GazeFollower2`
注册实时视线预测监听回调函数。校准完成后，每处理完一帧有效人脸视频帧即触发一次回调；此外在交互式校准 (`startCalibration`) 结束时也会触发一次完成通知。

- **参数 (Parameters)**：
  - `callback` (`(data: { x: number, y: number } | null, timestamp: number | null) => void`)：
    - **正常追踪帧**：
      - `data`：`{ x: number, y: number }`，表示当前预测的屏幕视口像素坐标（相对于浏览器可视区域 `window.innerWidth × window.innerHeight`）。若 `enableGazeFilter` 为 `true`（默认），返回经过 `HeuristicFilter` 滤波后的坐标；否则返回回归模型直接输出的原始校准坐标。
      - `timestamp`：`number`，由 `performance.now()` 生成的高精度毫秒时间戳。
    - **校准完成信号 (Calibration Completion Signal)**：
      - 当 `startCalibration()` 走完所有校准点并完成回归模型拟合后，会主动调用一次 `listener(null, null)`（即 `data === null && timestamp === null`）。
- **返回值 (Returns)**：`GazeFollower2`
- **示例**：
  ```javascript
  GazeFollower2.setGazeListener((data, timestamp) => {
    if (data === null && timestamp === null) {
      console.log("校准已完成，回归模型拟合成功！");
      return;
    }
    if (data) {
      console.log(`[${timestamp.toFixed(1)} ms] Gaze: X=${data.x.toFixed(1)}, Y=${data.y.toFixed(1)}`);
    }
  });
  ```

### `clearGazeListener(): GazeFollower2`
移除当前注册的视线监听回调函数（将 `this.listener` 置为 `null`）。
- **返回值 (Returns)**：`GazeFollower2`

### `getCurrentPrediction(): { x: number, y: number } | null`
同步获取最近一帧预测的视线屏幕坐标 `{ x, y }`。若尚未完成校准、已暂停或当前帧未检测到人脸，则返回 `null`。
- **返回值 (Returns)**：`{ x: number, y: number } | null`
- **示例**：
  ```javascript
  const pred = GazeFollower2.getCurrentPrediction();
  if (pred) {
    console.log(`当前注视点: (${pred.x}, ${pred.y})`);
  }
  ```

### `inferenceLoop(): Promise<void>`
*(内部核心循环方法)*
在 `startWebcam()` 成功后自动通过 `setTimeout(..., 1)` 持续调度：
1. 若 `this.isPaused === true`，延迟 `100ms` 后继续轮询。
2. 调用 `this.faceLandmarker.detectForVideo(this.videoElement, now)` 检测 478 个 3D 人脸关键点。
3. 若检测到人脸 (`this.isFaceDetected = true`)：
   - 调用 `this.faceAlignment.process(...)` 提取归一化 NCHW 张量：`faceTensor` (`[1,3,224,224]`)、`leftTensor` (`[1,3,112,112]`)、`rightTensor` (`[1,3,112,112]`)、`rectTensor` (`[1,12]`) 及原始像素框 `rawRects`。
   - 调用 `this.drawOverlay(rawRects)` 绘制绿/红检测框。
   - 调用 `this.estimator.detect(...)` 获取 258 维深度特征向量 `features`，存入 `this.lastFeatures` 并送入 `this.caliManager.feedFeatures(features, now)`。
   - 若已完成校准 (`this.isCalibrated === true`)：
     - 使用校准器预测原始屏幕坐标 `[caliX, caliY]` 并存入 `this.rawX`, `this.rawY`。
     - 若 `this.enableGazeFilter === true`（默认），通过 `this.filter.filterValues(caliX, caliY)` 进行启发式滤波。
     - 更新 `this.targetX`, `this.targetY` 并触发 `this.listener({ x: finalX, y: finalY }, now)`。
4. 若未检测到人脸 (`this.isFaceDetected = false`)：
   - 调用 `this.resetFilter()` 清空滤波窗口，清除叠加框，并将 `lastFeatures`, `rawX`, `rawY`, `targetX`, `targetY` 置为 `null`。

### `renderLoop(): void`
*(内部渲染插值循环)*
通过 `requestAnimationFrame` 运行，将 `this.targetX`, `this.targetY` 以 `0.2` 的阻尼系数指数平滑至 `this.smoothX`, `this.smoothY`。

---

## 6. 启发式防抖滤波与 `look_ahead` 配置 (Heuristic Filtering)

**GazeFollower2 默认启用启发式滤波 (`HeuristicFilter`)**，且默认参数 **`look_ahead = 2`**，支持通过多种方式动态配置。

### 算法原理
`HeuristicFilter` 维护长度为 $2 \times \text{look\_ahead} + 1$ 的滑动窗口（当默认 `look_ahead = 2` 时，窗口长度为 $5$ 帧）。对于窗口中心位置索引 $c = \text{look\_ahead}$，依次检查步长 $k = 1, 2, \dots, \text{look\_ahead}$：
- 若中心点相比两侧邻居同时为局部极大值（`raw[c - k] < raw[c] && raw[c] > raw[c + k]`）或同时为局部极小值（`raw[c - k] > raw[c] && raw[c] < raw[c + k]`），则判定为**突变尖峰噪声 (Spike)**，并将其替换为距离中心点更近的那一侧邻居值：
  $$\text{raw}[c] \leftarrow \begin{cases} \text{raw}[c - k], & |\text{raw}[c - k] - \text{raw}[c]| < |\text{raw}[c + k] - \text{raw}[c]| \\ \text{raw}[c + k], & \text{otherwise} \end{cases}$$

### `setHeuristicFilter(bool?, look_ahead?): GazeFollower2`
*(WebGazer 兼容别名: `applyKalmanFilter(bool, look_ahead?)`, `applySmoothingFilter(bool, look_ahead?)`)*

启用或禁用启发式视线滤波器，并可同时配置 `look_ahead` 参数。
- **默认值**：默认启用 (`bool = true`)，默认 `look_ahead = 2`。
- **参数 (Parameters)**：
  - `bool` (`boolean | HeuristicFilterOptions`, 可选, 默认: `true`)：
    - 传入布尔值：`true` 启用启发式滤波，`false` 禁用滤波（直接输出回归坐标并清空滤波缓存）。
    - 传入配置对象：支持 `{ enabled?: boolean, enableHeuristicFilter?: boolean, enableGazeFilter?: boolean, look_ahead?: number, lookAhead?: number }`。
  - `look_ahead` (`number | HeuristicFilterOptions`, 可选)：
    - 启发式滤波的前瞻帧数（正整数 $\ge 1$）。若不传则保持当前已配置的 `look_ahead` 值（初始默认为 `2`）。
- **返回值 (Returns)**：`GazeFollower2`（支持链式调用）
- **示例**：
  ```javascript
  // 1. 开启启发式滤波（保持默认 look_ahead = 2）
  GazeFollower2.setHeuristicFilter(true);

  // 2. 开启启发式滤波并将 look_ahead 设置为 3（窗口大小 = 2*3+1 = 7 帧，平滑更强）
  GazeFollower2.setHeuristicFilter(true, 3);

  // 3. 开启启发式滤波并将 look_ahead 设置为 1（窗口大小 = 2*1+1 = 3 帧，延迟最低）
  GazeFollower2.setHeuristicFilter(true, 1);

  // 4. 使用配置对象方式调用
  GazeFollower2.setHeuristicFilter({ enabled: true, look_ahead: 2 });

  // 5. 关闭启发式滤波，输出未滤波的原始校准坐标
  GazeFollower2.setHeuristicFilter(false);
  ```

### `setLookAhead(look_ahead?): GazeFollower2`
单独设置启发式滤波器的 `look_ahead` 参数。当新值与旧值不同时，会自动重置滑动窗口缓存以保证窗口长度一致。
- **参数 (Parameters)**：
  - `look_ahead` (`number`, 可选, 默认: `2`)：正整数 $\ge 1$（非整数会自动四舍五入并限制在 $\ge 1$）。
- **返回值 (Returns)**：`GazeFollower2`
- **示例**：
  ```javascript
  GazeFollower2.setLookAhead(3);
  ```

### `getLookAhead(): number`
获取当前启发式滤波器的 `look_ahead` 参数值。
- **返回值 (Returns)**：`number`（默认为 `2`）
- **示例**：
  ```javascript
  const la = GazeFollower2.getLookAhead(); // 2
  ```

### 属性 `GazeFollower2.look_ahead` / `GazeFollower2.lookAhead`
可直接通过属性读写 `look_ahead`（同时支持下划线命名 `look_ahead` 与驼峰命名 `lookAhead`）：
```javascript
console.log(GazeFollower2.look_ahead); // 默认输出: 2
GazeFollower2.look_ahead = 3;          // 直接修改 look_ahead 为 3并重置窗口
console.log(GazeFollower2.lookAhead);  // 输出: 3
```

### `resetFilter(): GazeFollower2`
手动清空启发式滤波器的历史滑动窗口缓存 (`rawX`, `rawY`, `dummyX`, `dummyY`)。在场景切换或实验试次 (Trial) 切换时调用可消除上一试次残留的坐标历史。
- **返回值 (Returns)**：`GazeFollower2`

### `applyKalmanFilter(bool, look_ahead?): GazeFollower2`
WebGazer 兼容方法，内部直接转发至 `this.setHeuristicFilter(bool, look_ahead)`。

### `applySmoothingFilter(bool, look_ahead?): GazeFollower2`
平滑滤波兼容别名，内部直接转发至 `this.setHeuristicFilter(bool, look_ahead)`。

### `setFaceFilter(bool): GazeFollower2`
*(已弃用 / 兼容空操作)* 为保持向后兼容保留的方法签名，直接返回 `this`。

---

## 7. 空间校准与回归训练 (Calibration & Spatial Mapping)

GazeFollower2 默认内置 **多元岭回归 (`MultivariateRidgeCalibration`, $\lambda = 0.1$)**，将 258 维深度特征向量直接映射为屏幕像素坐标 $(X, Y)$。

### `startCalibration(mode?, method?, latency?, order?): GazeFollower2`
启动全屏交互式校准 UI 流程。调用时会自动先执行 `clearData()` 清空旧校准数据。

- **参数 (Parameters)**：
  - `mode` (`'13-point' | '9-point' | '5-point' | 'random' | 'lissajous' | CalibrationOptions`, 可选, 默认: `'13-point'`)：
    - `'13-point'` *(默认推荐)*：13 点增强网格（覆盖四角 `12%/88%`、中轴 `50%` 及内圈 `28%/72%`）。
    - `'9-point'`：标准 3×3 九点网格（坐标比例 `15%`, `50%`, `85%`）。
    - `'5-point'`：快速五点网格（四角 `15%/85%` + 中心 `50%`）。
    - `'random'`：在屏幕 `12% ~ 88%` 安全边距内随机生成 13 个校准点。
    - `'lissajous'`：利萨如曲线 (Lissajous Curve) 连续平滑追随校准（默认持续 `10000 ms`，参数方程 $x(t) = 0.5W + 0.4W\sin(3\omega t + \pi/2)$, $y(t) = 0.5H + 0.4H\sin(2\omega t)$）。
    - *对象入参重载*：也可直接传入 `{ mode, method, latency, order }` 配置对象。
  - `method` (`'click' | 'auto'`, 可选, 默认: `'click'`)：
    - `'click'`：用户注视目标点并手动点击鼠标左键确认，每次点击采集特征队列最近 **10 帧**（约 300ms）特征以提升回归鲁棒性，并触发粒子散射反馈。
    - `'auto'`：自动驻留模式（目标移动耗时 `500 ms`，随后放大驻留 `1500 ms`，在驻留最后 `500 ms` 窗口内自动连续采集特征样本）。注：当 `mode === 'lissajous'` 时固定使用自动连续采样。
  - `latency` (`number`, 可选, 默认: `4`)：摄像头与推理管线延迟补偿参数（主要用于 `'lissajous'` 模式对齐历史目标坐标）：
    - 当 `latency <= 20` 时，自动按 **帧数 (Frames @ 30 FPS)** 解析，换算公式为 $\text{latencyOffsetMs} = \text{round}(\text{latency} \times 1000 / 30)$（默认 `4` 帧 $\approx 133\text{ ms}$）。
    - 当 `latency > 20` 时，直接按 **毫秒 (Milliseconds)** 解析（即 $\text{latencyOffsetMs} = \text{latency}$）。
    - *向后兼容 5 参数签名*：亦兼容 `startCalibration(mode, method, algorithm, latency, order)`，其中第 3 个参数可传 `'ridge'` 或 `'svr'`。
  - `order` (`'random' | 'sequential'`, 可选, 默认: `'random'`)：
    - `'random'` *(默认)*：使用 Fisher-Yates 洗牌算法打乱离散校准点的出现顺序，防止被试预判扫视。
    - `'sequential'`：按预设从上到下、从左到右的顺序依次呈现校准点。
- **返回值 (Returns)**：`GazeFollower2`
- **示例**：
  ```javascript
  // 方式 1：位置参数调用
  GazeFollower2.startCalibration('13-point', 'click', 4, 'random');

  // 方式 2：配置对象调用
  GazeFollower2.startCalibration({
    mode: '9-point',
    method: 'auto',
    latency: 4,
    order: 'random'
  });

  // 监听校准结束通知
  GazeFollower2.setGazeListener((data, timestamp) => {
    if (data === null && timestamp === null) {
      console.log("校准完成！");
    }
  });
  ```

### `recordScreenPosition(x, y, eventType?): boolean`
*(WebGazer 兼容方法)*
手动将当前最新提取到的 258 维视线特征向量 (`this.lastFeatures`) 与指定的屏幕像素坐标 `(x, y)` 配对加入校准训练集。注意：通过此方法手动收集完数据后，需调用 `trainCalibration()` 拟合模型。
- **参数 (Parameters)**：
  - `x` (`number`)：屏幕目标点 X 坐标（像素）。
  - `y` (`number`)：屏幕目标点 Y 坐标（像素）。
  - `eventType` (`string`, 可选, 默认: `'click'`)：事件类型标识。
- **返回值 (Returns)**：`boolean`（若当前存在有效 `lastFeatures` 并记录成功则返回 `true`，否则返回 `false`）。

### `addCalibrationPoint(features, screenX, screenY): GazeFollower2`
底层校准样本添加方法，将指定的 258 维特征数组 `features` 与屏幕坐标 `(screenX, screenY)` 推入 `this.collectedFeatures`、`this.collectedX`、`this.collectedY`。
- **参数 (Parameters)**：
  - `features` (`number[]`)：长度为 258 的特征向量。
  - `screenX` (`number`)：屏幕 X 像素坐标。
  - `screenY` (`number`)：屏幕 Y 像素坐标。
- **返回值 (Returns)**：`GazeFollower2`

### `trainCalibration(): boolean`
使用当前已收集的所有校准样本 (`collectedFeatures`, `collectedX`, `collectedY`) 训练回归校准模型（默认 `MultivariateRidgeCalibration(0.1)`；若通过 `setRegression('svr')` 切换则训练 `SVRCalibration(0.1)`），训练成功后将 `this.isCalibrated` 置为 `true`。
- **返回值 (Returns)**：`boolean`（样本数 $> 0$ 且训练成功返回 `true`，无样本返回 `false`）。
- **示例（自定义校准界面流程）**：
  ```javascript
  GazeFollower2.clearData();
  // 在自定义校准点点击时记录特征：
  GazeFollower2.recordScreenPosition(targetX, targetY);
  // 收集完所有点后拟合模型：
  const ok = GazeFollower2.trainCalibration();
  ```

### `clearData(): GazeFollower2`
清空所有已收集的校准样本数据 (`collectedFeatures`, `collectedX`, `collectedY`)，将 `this.isCalibrated` 重置为 `false`，重新初始化回归校准器，并调用 `this.resetFilter()` 清空滤波历史。
- **返回值 (Returns)**：`GazeFollower2`

### `setRegression(type): GazeFollower2`
设置空间校准回归算法类型。
- **参数 (Parameters)**：
  - `type` (`'ridge' | 'svr' | string`)：默认为 `'ridge'` (`MultivariateRidgeCalibration`)，也可设为 `'svr'` (`SVRCalibration`)。传入其他 WebGazer 名称（如 `'weightedRidge'`）时保持默认 `'ridge'` 不报错。
- **返回值 (Returns)**：`GazeFollower2`

### `setTracker(type): GazeFollower2`
*(WebGazer 兼容空操作)* MediaPipe `FaceLandmarker` 为固定内置人脸追踪后端，调用此方法直接返回 `this`。

---

## 8. 视频预览与视觉叠加层 (Visual Displays & Overlays)

### `showVideo(bool): GazeFollower2`
*(别名: `showVideoPreview(bool)`, `showVideoElement(bool)`)*
控制摄像头 `<video>` 预览画面是否可见（通过设置 `this.videoElement.style.opacity` 为 `'1'` 或 `'0'`）。
- **参数 (Parameters)**：
  - `bool` (`boolean`)：`true` 显示摄像头画面，`false` 隐藏画面。
- **返回值 (Returns)**：`GazeFollower2`

### `showVideoPreview(bool): GazeFollower2`
`showVideo(bool)` 的等价别名。

### `showVideoElement(bool): GazeFollower2`
`showVideo(bool)` 的等价别名。

### `showPredictionPoints(bool): GazeFollower2`
控制人脸检测框（绿色）与左右眼裁剪框（红色）叠加层 `<canvas>` (`this.overlayCanvas`) 是否可见（设置 `opacity` 为 `'1'` 或 `'0'`）。
- **参数 (Parameters)**：
  - `bool` (`boolean`)：`true` 显示人脸与眼部检测框，`false` 隐藏。
- **返回值 (Returns)**：`GazeFollower2`

### `getVideoElementCanvas(): HTMLCanvasElement | null`
获取用于绘制人脸和左右眼边界框的 `<canvas>` DOM 元素 (`this.overlayCanvas`)。
- **返回值 (Returns)**：`HTMLCanvasElement | null`

### `drawOverlay(rawRects): void`
在 `overlayCanvas` 上绘制当前帧的人脸框（绿色，`lineWidth = 2`）和左右眼边界框（红色，`lineWidth = 2`）。传入 `null` 时仅清空画布。

---

## 9. `GazeFollower2` 实例属性速查表 (Instance Properties)

开发者可直接读取（或按需挂载）`GazeFollower2` 实例上的以下属性：

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `enableGazeFilter` | `boolean` | `true` | 是否启用启发式视线平滑滤波 (`HeuristicFilter`) |
| `look_ahead` | `number` | `2` | 启发式滤波器的前瞻帧数（Getter / Setter，修改时自动重置窗口） |
| `lookAhead` | `number` | `2` | `look_ahead` 的驼峰命名别名（Getter / Setter） |
| `filter` | `HeuristicFilter` | `new HeuristicFilter(2)` | 启发式滤波器实例 |
| `isFaceDetected` | `boolean` | `false` | 当前最新视频帧是否成功检测到人脸 |
| `isCalibrated` | `boolean` | `false` | 当前是否已完成校准模型拟合 |
| `isPaused` | `boolean` | `true` | 推理循环是否处于暂停状态（调用 `begin()` / `resume()` 后为 `false`） |
| `_isReady` | `boolean` | `false` | ONNX 模型、MediaPipe 与 DOM 是否已完成初始化 |
| `rawX` / `rawY` | `number \| null` | `null` | 当前帧未经启发式滤波的原始回归预测屏幕坐标（像素） |
| `targetX` / `targetY` | `number \| null` | `null` | 当前帧最终输出的屏幕坐标（开启滤波时为滤波后坐标，供 `getCurrentPrediction()` 和 `listener` 使用） |
| `smoothX` / `smoothY` | `number \| null` | `null` | 由 `renderLoop` 计算的阻尼插值坐标 ($\alpha = 0.2$) |
| `lastFeatures` | `number[] \| null` | `null` | 最近一帧由 ONNX 模型提取的 258 维视线特征向量 |
| `videoElement` | `HTMLVideoElement \| null` | `null` | 摄像头视频流 `<video>` DOM 节点（可在自定义 UI 中重新挂载） |
| `overlayCanvas` | `HTMLCanvasElement \| null` | `null` | 人脸/眼部检测框叠加层 `<canvas>` DOM 节点 |
| `stream` | `MediaStream \| null` | `null` | 当前活动的 WebRTC 摄像头媒体流 |
| `showVid` | `boolean` | `true` | 摄像头视频画面可见状态标志 |
| `showFaceOverlay` | `boolean` | `true` | 人脸与眼部检测框叠加层可见状态标志 |
| `listener` | `Function \| null` | `null` | 当前通过 `setGazeListener` 注册的回调函数 |
| `caliAlgorithm` | `'ridge' \| 'svr'` | `'ridge'` | 当前使用的校准回归算法标识 |
| `ridgeCalibrator` | `MultivariateRidgeCalibration` | `λ = 0.1` | 多元岭回归校准器实例 |
| `svrCalibrator` | `SVRCalibration` | `λ = 0.1` | 独立通道岭回归校准器实例 |
| `caliManager` | `CalibrationManager` | 实例 | 全屏校准 UI 与采样队列管理器实例 |
| `estimator` | `MGazeNetGazeEstimator` | 实例 | ONNX Runtime Web 神经网络推理器实例 |
| `faceAlignment` | `FaceAlignment` | 实例 | 人脸特征点对齐与图像裁剪器实例 |
| `faceLandmarker` | `FaceLandmarker \| null` | `null` | MediaPipe Vision `FaceLandmarker` 实例 |
| `collectedFeatures` | `number[][]` | `[]` | 当前校准会话已采集的 258 维特征矩阵 ($N \times 258$) |
| `collectedX` | `number[]` | `[]` | 当前校准会话已采集的目标屏幕 X 坐标数组 ($N$) |
| `collectedY` | `number[]` | `[]` | 当前校准会话已采集的目标屏幕 Y 坐标数组 ($N$) |

---

## 10. 子模块与底层算法类 API (Sub-Module Classes)

除了直接操作 `GazeFollower2` 主类外，所有底层模块类均可单独导入使用或通过 `GazeFollower2` 实例属性访问。

### 10.1 `HeuristicFilter` (启发式滤波器)
文件路径：`src/HeuristicFilter.js`

- **构造函数**：`new HeuristicFilter(look_ahead = 2)`
  - `look_ahead` (`number`, 默认: `2`)：中心样本两侧的前瞻/回溯帧数，滑动窗口总长度为 `2 * look_ahead + 1`。
- **属性**：
  - `look_ahead: number` (Getter / Setter)：读取或修改前瞻帧数（修改时若值发生变化会自动调用 `reset()`）。
  - `lookAhead: number` (Getter / Setter)：`look_ahead` 的驼峰别名。
  - `rawX: number[]` / `rawY: number[]`：当前窗口内的 X / Y 历史样本队列。
  - `dummyX: number` / `dummyY: number`：最近一次计算得到的平滑输出值（初始为 `NaN`）。
- **方法**：
  - `setLookAhead(look_ahead = 2): HeuristicFilter`：设置 `look_ahead`（正整数 $\ge 1$），返回 `this`。
  - `getLookAhead(): number`：返回当前 `look_ahead` 值。
  - `filterValues(x, y): [number, number]`：输入当前帧坐标 `(x, y)`（或单参数数组 `[x, y]`），返回滤波后的 `[filteredX, filteredY]`。
  - `filter_values(values): [number, number]`：Python 风格兼容方法，接收 `[x, y]` 数组并返回 `[filteredX, filteredY]`。
  - `reset(): HeuristicFilter`：清空 `rawX`, `rawY` 并将 `dummyX`, `dummyY` 重置为 `NaN`，返回 `this`。
  - `doFilter(isX, element): number[]`：对单个坐标轴执行入队、尖峰检测替换与滑动移位。

---

### 10.2 `CalibrationManager` (校准流程管理器)
文件路径：`src/CalibrationManager.js`（可通过 `GazeFollower2.caliManager` 访问）

- **构造函数**：`new CalibrationManager(gazeFollower)`
- **关键属性**：
  - `mode`: `'13-point' | '9-point' | '5-point' | 'random' | 'lissajous'`（默认 `'13-point'`）
  - `method`: `'click' | 'auto'`（默认 `'click'`）
  - `order`: `'random' | 'sequential'`（默认 `'random'`）
  - `frameLatency`: `number`（默认 `4` 帧）
  - `latencyOffsetMs`: `number`（默认 `133` ms）
  - `autoMoveMs`: `number`（自动模式下靶点移动动画时长，默认 `500` ms）
  - `autoDwellMs`: `number`（自动模式下靶点注视驻留时长，默认 `1500` ms，在最后 `500` ms 采集样本）
  - `lissajousDuration`: `number`（利萨如连续校准总时长，默认 `10000` ms）
  - `container`: `HTMLDivElement`（全屏校准遮罩容器 `#gf-calibration-container`）
- **方法**：
  - `setLatency(val: number): void`：`val <= 20` 时按 30 FPS 帧数换算毫秒延迟，`val > 20` 时直接作为毫秒延迟。
  - `start(mode = '13-point', method = 'click', latency = null, order = 'random'): void`：启动全屏校准界面与采样流程。
  - `feedFeatures(features: number[], timestamp: number): void`：由 `GazeFollower2.inferenceLoop()` 在每帧推入特征与时间戳（队列上限 30 帧）。
  - `recordCurrentPoint(features = null): void`：记录当前校准点样本（`'click'` 模式下取队列最近 10 帧特征）。
  - `nextPoint(): void`：切换至下一个校准点，若全部完成则调用 `finish()`。
  - `getLissajousPos(t: number): { x: number, y: number }`：计算利萨如轨迹在时刻 `t` (ms) 的屏幕像素坐标。
  - `finish(): void`：隐藏校准 UI，调用 `this.gf.trainCalibration()`，并触发 `this.gf.listener(null, null)`。

---

### 10.3 `MGazeNetGazeEstimator` (ONNX 视线特征提取器)
文件路径：`src/MGazeNetGazeEstimator.js`（可通过 `GazeFollower2.estimator` 访问）

- **构造函数**：`new MGazeNetGazeEstimator(modelPath)`
- **属性**：
  - `modelPath: string`：当前加密模型文件路径。
  - `session: ort.InferenceSession | null`：ONNX Runtime Web 推理会话实例。
- **方法**：
  - `init(progressCallback = null): Promise<void>`：流式下载加密模型，使用 Web Crypto API (`AES-CBC`) 内存解密，并按浏览器平台选择最佳执行后端（桌面端优先 `['webgpu', 'webnn', 'webgl', 'wasm']`，Safari 优先 `['wasm', 'webgl']`，异常时自动兜底至 `['wasm']`）。
  - `detect(faceTensor, leftTensor, rightTensor, rectTensor): Promise<number[] | null>`：
    - 输入张量：
      - `face`: `Float32Array` `[1, 3, 224, 224]`
      - `left` (或 `left_eye`): `Float32Array` `[1, 3, 112, 112]`
      - `right` (或 `right_eye`): `Float32Array` `[1, 3, 112, 112]`
      - `rect`: `Float32Array` `[1, 12]`
    - 输出：长度为 **258** 的浮点数特征数组 `number[]`（推理失败或会话未就绪时返回 `null`）。

---

### 10.4 `FaceAlignment` (MediaPipe 人脸对齐与眼部裁剪)
文件路径：`src/FaceAlignment.js`（可通过 `GazeFollower2.faceAlignment` 访问）

- **构造函数**：`new FaceAlignment()`
- **方法**：
  - `process(video: HTMLVideoElement, faceLandmarks: NormalizedLandmark[], timestamp = null)`：
    - 将 MediaPipe 输出的归一化关键点映射至视频像素坐标系，计算人脸框 (`faceRect`)、左眼框 (`leftRect`)、右眼框 (`rightRect`，并做水平翻转归一化)。
    - 返回对象：
      ```javascript
      {
        faceTensor: Float32Array,  // 3 * 224 * 224, NCHW, RGB 归一化至 [0, 1]
        leftTensor: Float32Array,  // 3 * 112 * 112, NCHW, RGB 归一化至 [0, 1]
        rightTensor: Float32Array, // 3 * 112 * 112, NCHW, 水平镜像翻转, RGB [0, 1]
        rectTensor: Float32Array,  // 12 维归一化几何位置特征 [w, h, x, y] × (face, left, right)
        landmarks: Array<{x: number, y: number, z: number}>,
        rawRects: {
          face: [x, y, w, h],
          left: [x, y, w, h],
          right: [x, y, w, h]
        }
      }
      ```
  - `cropAndResize(x, y, w, h, outW, outH, flipH): Float32Array`：离屏 Canvas 裁剪缩放并由 NHWC RGBA 字节流转换为 NCHW RGB `[0.0, 1.0]` `Float32Array`。
  - `calculateArea(pts): number`：利用鞋带公式 (Shoelace Formula) 计算多边形像素面积。

---

### 10.5 `MultivariateRidgeCalibration` (多元岭回归校准器)
文件路径：`src/MultivariateRidgeCalibration.js`（可通过 `GazeFollower2.ridgeCalibrator` 访问）

- **数学模型**：
  在 258 维特征前拼接偏置项 $1.0$ 构成设计矩阵 $\mathbf{X}_b \in \mathbb{R}^{N \times 259}$，目标矩阵 $\mathbf{Y} \in \mathbb{R}^{N \times 2}$，通过列主元高斯消元法求解线性方程组（不对偏置项 $i=0$ 施加正则化惩罚）：
  $$(\mathbf{X}_b^\top \mathbf{X}_b + \lambda \mathbf{I}_0)\mathbf{W} = \mathbf{X}_b^\top \mathbf{Y}$$
- **构造函数**：`new MultivariateRidgeCalibration(lambda = 0.1)`
- **方法**：
  - `train(featuresArray: number[][], labelsX: number[], labelsY: number[]): void`：拟合并更新权重矩阵 `this.weights` ($259 \times 2$)。
  - `predict(features: number[]): [number, number]`：输入 258 维特征，返回预测屏幕坐标 `[predX, predY]`（未训练时返回 `[0, 0]`）。

---

### 10.6 `SVRCalibration` (独立通道岭回归/SVR校准器)
文件路径：`src/SVRCalibration.js`（可通过 `GazeFollower2.svrCalibrator` 访问）

- **构造函数**：`new SVRCalibration(lambda = 0.1)`
- **方法**：
  - `train(featuresArray: number[][], labelsX: number[], labelsY: number[]): void`：分别为 X 轴和 Y 轴独立求解带 L2 正则化的线性回归权重 `this.weightsX` 与 `this.weightsY`。
  - `predict(features: number[]): [number, number]`：返回 `[predX, predY]`。

---

### 10.7 `OneEuroFilter` & `LowPassFilter` (一欧元低通滤波器)
文件路径：`src/OneEuroFilter.js`

- **`OneEuroFilter`**：
  - **构造函数**：`new OneEuroFilter(freq = 30.0, minCutoff = 1.0, beta = 0.01, dCutoff = 1.0)`
  - **方法**：
    - `filter(x, timestamp = null)`：支持对标量数字 (`number`)、数组 (`Array`) 或坐标对象 (`{ x, y, z }`) 进行自适应截止频率平滑滤波；传入 `timestamp` 时会自动估算采样频率 `freq`。
    - `reset(): void`：重置内部状态。
- **`LowPassFilter`**：
  - **构造函数**：`new LowPassFilter(alpha = 1.0)`
  - **方法**：`filter(value, alpha = null)`、`reset()`。

---

### 10.8 `ParticleFX` / `particleFX` (校准粒子动效引擎)
文件路径：`src/ParticleFX.js`

- **方法**：
  - `particleFX.burst(x: number, y: number, options?: { color?: string, count?: number }): void`
    在屏幕坐标 `(x, y)` 处触发高帧率 Canvas 粒子迸发与扩散波纹动效（用于校准点击与驻留完成反馈）。

---

## 11. WebGazer 兼容性对照表 (WebGazer Compatibility Matrix)

GazeFollower2 完整实现了 WebGazer.js 的核心方法签名，并自动挂载 `window.webgazer = window.GazeFollower2`：

| WebGazer 方法 | GazeFollower2 对应方法 | 兼容性说明 |
| :--- | :--- | :--- |
| `webgazer.begin(cb)` | `GazeFollower2.begin(cb, opts)` | 完全兼容（返回 `Promise<GazeFollower2>`） |
| `webgazer.end()` / `stop()` | `GazeFollower2.end()` / `stop()` | 完全兼容（停止推理并关闭摄像头硬件流） |
| `webgazer.pause()` | `GazeFollower2.pause()` | 完全兼容 |
| `webgazer.resume()` | `GazeFollower2.resume()` | 完全兼容 |
| `webgazer.isReady()` | `GazeFollower2.isReady()` | 完全兼容 |
| `webgazer.setGazeListener(cb)` | `GazeFollower2.setGazeListener(cb)` | 完全兼容（回调签名为 `(data, timestamp)`） |
| `webgazer.clearGazeListener()` | `GazeFollower2.clearGazeListener()` | 完全兼容 |
| `webgazer.getCurrentPrediction()` | `GazeFollower2.getCurrentPrediction()` | 完全兼容（返回 `{ x, y }` 或 `null`） |
| `webgazer.recordScreenPosition(x, y, type)` | `GazeFollower2.recordScreenPosition(x, y, type)` | 完全兼容 |
| `webgazer.clearData()` | `GazeFollower2.clearData()` | 完全兼容 |
| `webgazer.showVideo(bool)` | `GazeFollower2.showVideo(bool)` | 完全兼容（含 `showVideoPreview` / `showVideoElement`） |
| `webgazer.showPredictionPoints(bool)` | `GazeFollower2.showPredictionPoints(bool)` | 完全兼容 |
| `webgazer.getVideoElementCanvas()` | `GazeFollower2.getVideoElementCanvas()` | 完全兼容 |
| `webgazer.applyKalmanFilter(bool)` | `GazeFollower2.setHeuristicFilter(bool, look_ahead)` | 自动映射至内置启发式滤波器 (`HeuristicFilter`) |
| `webgazer.setRegression(type)` | `GazeFollower2.setRegression(type)` | 兼容（默认 `'ridge'`，可选 `'svr'`） |
| `webgazer.setTracker(type)` | `GazeFollower2.setTracker(type)` | 兼容空操作（内置 MediaPipe FaceLandmarker） |

---

## 12. 数据结构与类型定义 (TypeScript Interfaces)

```typescript
/** 实时视线预测坐标对象 */
export interface GazeData {
  /** 屏幕视口水平像素坐标 (0 ~ window.innerWidth) */
  x: number;
  /** 屏幕视口垂直像素坐标 (0 ~ window.innerHeight) */
  y: number;
}

/** GazeFollower2 初始化与构造配置项 */
export interface GazeFollower2Options {
  /** ONNX 模型路径，默认 'GazeNet_Next.onnx' */
  modelPath?: string;
  onnxModelPath?: string;
  /** 是否默认开启启发式滤波，默认 true */
  enableHeuristicFilter?: boolean;
  enableGazeFilter?: boolean;
  /** 启发式滤波前瞻窗口参数，默认 2（即 5 帧滑动窗口） */
  look_ahead?: number;
  lookAhead?: number;
  /** 模型加载进度回调 (0.0 ~ 1.0) */
  onProgress?: (ratio: number) => void;
  progressCallback?: (ratio: number) => void;
}

/** 启发式滤波器配置项 */
export interface HeuristicFilterOptions {
  enabled?: boolean;
  enableHeuristicFilter?: boolean;
  enableGazeFilter?: boolean;
  /** 前瞻窗口帧数 (正整数 >= 1)，默认 2 */
  look_ahead?: number;
  lookAhead?: number;
}

/** 交互式校准配置项 */
export interface CalibrationOptions {
  /** 校准靶点分布模式，默认 '13-point' */
  mode?: '5-point' | '9-point' | '13-point' | 'random' | 'lissajous';
  /** 校准交互方式，默认 'click' */
  method?: 'click' | 'auto';
  /** 延迟补偿：<= 20 表示帧数 (默认 4 帧 ≈ 133ms)，> 20 表示毫秒数 */
  latency?: number;
  /** 校准点呈现顺序，默认 'random' */
  order?: 'random' | 'sequential';
}
```
