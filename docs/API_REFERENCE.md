# GazeFollower2 Web SDK (JS) — 完整 API 参考与集成规范 (API Reference)

本文档提供 **GazeFollower2 Web SDK** (`gazefollower2` v2.0.0) 的全部公开与底层模块 API 说明，包含全局导出、核心类 `GazeFollower2` 生命周期、启发式滤波 (`HeuristicFilter`)、空间标定 (`CalibrationManager` / `MultivariateRidgeCalibration`)、神经网络特征提取 (`GazeEstimator`)、人脸关键点对齐 (`FaceAlignment`)、一欧元低通滤波 (`OneEuroFilter`)、WebGazer 兼容层、**jsPsych / PsychoJS 实验范式接入规范**以及 **iOS 原生 App (WKWebView / JSBridge) 接口兼容协议**。

---

## 📑 目录 (Table of Contents)

1. [模块导出与全局单例 (Exports & Global Singletons)](#1-模块导出与全局单例-exports--global-singletons)
2. [核心类 `GazeFollower2` — 构造函数与实例属性](#2-核心类-gazefollower2--构造函数与实例属性)
3. [生命周期与视频流控制 (Lifecycle & Stream Control)](#3-生命周期与视频流控制-lifecycle--stream-control)
4. [神经网络模型管理 (Neural Model Management)](#4-神经网络模型管理-neural-model-management)
5. [实时视线预测与事件监听 (Gaze Prediction & Callbacks)](#5-实时视线预测与事件监听-gaze-prediction--callbacks)
6. [启发式防抖滤波与 `look_ahead` 配置 (Heuristic Filtering)](#6-启发式防抖滤波与-look_ahead-配置-heuristic-filtering)
7. [空间标定与回归映射 (Calibration & Spatial Mapping)](#7-空间标定与回归映射-calibration--spatial-mapping)
8. [画面预览与视觉调试层 (Visual Displays & Overlays)](#8-画面预览与视觉调试层-visual-displays--overlays)
9. [底层核心算法类权威参考 (Sub-Module Classes)](#9-底层核心算法类权威参考-sub-module-classes)
   - 9.1 [`GazeEstimator` (ONNX 视线特征提取器)](#91-gazeestimator-onnx-视线特征提取器)
   - 9.2 [`FaceAlignment` (MediaPipe 人脸对齐与眼部裁剪)](#92-facealignment-mediapipe-人脸对齐与眼部裁剪)
   - 9.3 [`CalibrationManager` (标定流程与交互管理器)](#93-calibrationmanager-标定流程与交互管理器)
   - 9.4 [`MultivariateRidgeCalibration` (多元岭回归校准器)](#94-multivariateridgecalibration-多元岭回归校准器)
   - 9.5 [`SVRCalibration` (独立通道岭回归/SVR校准器)](#95-svrcalibration-独立通道岭回归svr校准器)
   - 9.6 [`HeuristicFilter` (启发式去尖峰滤波器)](#96-heuristicfilter-启发式去尖峰滤波器)
   - 9.7 [`OneEuroFilter` & `LowPassFilter` (1-Euro 自适应滤波)](#97-oneeurofilter--lowpassfilter-1-euro-自适应滤波)
   - 9.8 [`ParticleFX` / `particleFX` (标定粒子反馈引擎)](#98-particlefx--particlefx-标定粒子反馈引擎)
10. [WebGazer API 无缝平替对照表 (WebGazer Compatibility Matrix)](#10-webgazer-api-无缝平替对照表-webgazer-compatibility-matrix)
11. [jsPsych 心理学实验接入指南 (jsPsych Integration Guide)](#11-jspsych-心理学实验接入指南-jspsych-integration-guide)
12. [PsychoJS / PsychoPy 线上实验接入指南 (PsychoJS Integration Guide)](#12-psychojs--psychopy-线上实验接入指南-psychojs-integration-guide)
13. [iOS 原生 App / WKWebView 桥接与兼容规范 (iOS Native Bridge Specification)](#13-ios-原生-app--wkwebview-桥接与兼容规范-ios-native-bridge-specification)
14. [完整 TypeScript / JSDoc 类型定义 (Type Definitions)](#14-完整-typescript--jsdoc-类型定义-type-definitions)

---

## 1. 模块导出与全局单例 (Exports & Global Singletons)

### 全局变量 (Browser `window`)
当通过 `<script type="module" src="dist/gazefollower2.min.js"></script>` 加载时，SDK 会自动构建一个全局单例实例并注入：
- **`window.GazeFollower2`**：核心单例实例。
- **`window.webgazer`**：指向同一个单例的兼容别名，现有的 WebGazer 代码零修改直接运行。

### ES 模块导出 (`dist/gazefollower2.min.js` / `src/GazeFollower.js`)
```javascript
import GazeFollower2, {
  GazeFollower2 as GazeFollower2Class,
  GazeFollower,                  // GazeFollower2 类的别名
  GazeEstimator,                 // ONNX Runtime 深度特征提取引擎
  MGazeNetGazeEstimator,         // GazeEstimator 的向后兼容别名
  FaceAlignment,                 // 人脸关键点检测、人脸/眼部裁剪与张量对齐
  CalibrationManager,            // 交互式标定管理器
  MultivariateRidgeCalibration,  // 默认多元岭回归映射算法
  SVRCalibration,                // SVR / 独立通道回归算法
  HeuristicFilter,               // 启发式去尖峰防抖滤波器
  OneEuroFilter,                 // 1-Euro 自适应低通滤波器
  LowPassFilter                  // 一阶指数低通平滑滤波器
} from './dist/gazefollower2.min.js';
```

---

## 2. 核心类 `GazeFollower2` — 构造函数与实例属性

### `new GazeFollower2(onnxModelPath?, options?)`
创建一个新的 `GazeFollower2` 实例（若使用全局单例 `window.GazeFollower2` 则无需手动 `new`）。

- **默认行为**：
  - 默认模型：`'GazeNet_Next.onnx'`（开源标准全精度 ONNX 权重）
  - 默认启用启发式滤波：`enableGazeFilter = true`
  - 默认滤波前瞻窗口：`look_ahead = 2`（滑动窗口总长 $2 \times 2 + 1 = 5$ 帧）
  - 默认标定算法：多元岭回归 (`MultivariateRidgeCalibration`，基准 $\lambda = 1.0$)
    - **校准点数自适应正则化系数 $\lambda$（`ridgeAlpha`）推荐规则**：
      - **5 点标定 (`'5-point'`)**：推荐默认 $\lambda = 3.0$（快速标定点数较少，需更强 L2 正则化以防过拟合与外推失真）
      - **9 点标定 (`'9-point'`)**：推荐默认 $\lambda = 2.0$（标准 3×3 网格平滑过渡）
      - **13 点标定 (`'13-point'`)**：推荐默认 $\lambda = 1.0$（密集网格空间完备，高拟合精度）
- **参数说明**：
  - `onnxModelPath` (`string | GazeFollower2Options`, 可选, 默认: `'GazeNet_Next.onnx'`)：
    - 传入字符串：模型文件的绝对或相对 URL。
    - 传入配置对象：支持 `{ modelPath, onnxModelPath, look_ahead, lookAhead, enableHeuristicFilter, enableGazeFilter, ridgeAlpha, alpha }`。
  - `options` (`number | GazeFollower2Options`, 可选, 默认: `{}`)：
    - 传入数字：直接设置 `look_ahead` 窗口（如 `new GazeFollower2('GazeNet_Next.onnx', 3)`）。
    - 传入配置对象：可单独覆盖滤波或正则化超参数。

### 实例属性速查表 (Instance Properties)

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `enableGazeFilter` | `boolean` | `true` | 是否开启启发式防抖滤波 (`HeuristicFilter`) |
| `look_ahead` / `lookAhead` | `number` | `2` | 启发式滤波前瞻帧数 (Getter / Setter，设新值自动清空窗口) |
| `filter` | `HeuristicFilter` | 实例 | 当前注视点坐标启发式滤波器实例 |
| `isFaceDetected` | `boolean` | `false` | 当前帧是否成功检测到人脸 |
| `isCalibrated` | `boolean` | `false` | 当前是否已成功训练/拟合完成标定模型 |
| `isPaused` | `boolean` | `true` | 推理循环是否处于暂停状态 |
| `_isReady` | `boolean` | `false` | ONNX 模型与 MediaPipe 运行环境是否已就绪 |
| `rawX` / `rawY` | `number \| null` | `null` | 当前帧经标定映射直接输出的**原始像素坐标**（未滤波） |
| `targetX` / `targetY` | `number \| null` | `null` | 当前帧输出的**最终视线像素坐标**（滤波开启时已防抖） |
| `smoothX` / `smoothY` | `number \| null` | `null` | 经 `renderLoop` 插值渲染后的平滑动效坐标 |
| `lastFeatures` | `number[] \| null` | `null` | 最新一帧提取出的 258 维深度特征向量 |
| `videoElement` | `HTMLVideoElement \| null` | `null` | 摄像头画面 `<video>` DOM 元素 |
| `overlayCanvas` | `HTMLCanvasElement \| null` | `null` | 人脸框绘制层 `<canvas>` DOM 元素 |
| `stream` | `MediaStream \| null` | `null` | WebRTC 摄像头流对象 |
| `showVid` | `boolean` | `true` | 摄像头画面显示状态开关 |
| `showFaceOverlay` | `boolean` | `true` | 人脸/眼部跟踪框显示状态开关 |
| `listener` | `Function \| null` | `null` | 当前活跃的视线回调监听函数 |
| `caliAlgorithm` | `'ridge' \| 'svr'` | `'ridge'` | 当前使用的标定映射算法模式 |
| `ridgeAlpha` | `number` | `1.0` | 多元岭回归正则化系数 $\lambda$ (Getter / Setter；5点标定默认为3，9点标定默认为2，13点标定默认为1) |
| `ridgeCalibrator` | `MultivariateRidgeCalibration` | 实例 | 多元岭回归算法器实例 |
| `svrCalibrator` | `SVRCalibration` | 实例 | SVR / 单通道回归算法器实例 |
| `caliManager` | `CalibrationManager` | 实例 | 全屏标定流程管理器实例 |
| `estimator` | `GazeEstimator` | 实例 | ONNX Runtime Web 推理引擎实例 |
| `faceAlignment` | `FaceAlignment` | 实例 | 人脸关键点对齐与多区域裁剪提取器 |
| `collectedFeatures` | `number[][]` | `[]` | 当前会话已采集的 258 维特征矩阵 ($N \times 258$) |
| `collectedX` / `collectedY`| `number[]` | `[]` | 当前会话已采集的目标点坐标数组 ($N$) |

---

## 3. 生命周期与视频流控制 (Lifecycle & Stream Control)

### `begin(progressCallback?, options?): Promise<GazeFollower2>`
一键初始化并启动追踪：按需下载模型、初始化 MediaPipe、创建固定 DOM 节点、申请摄像头权限并启动实时视频推理循环。
- **参数**：
  - `progressCallback` (`((ratio: number) => void) | GazeFollower2Options | null`)：模型加载进度回调（`0.0` ~ `1.0`）。
  - `options` (`GazeFollower2Options | null`)：可选配置对象 `{ look_ahead?: number, enableHeuristicFilter?: boolean }`。
- **返回值**：`Promise<GazeFollower2>`
- **示例**：
  ```javascript
  await GazeFollower2.begin((p) => {
    console.log(`加载进度: ${Math.round(p * 100)}%`);
  });
  ```

### `init(progressCallback?, options?): Promise<GazeFollower2>`
仅预加载模型与 DOM 结构，**不启动摄像头硬件**。适合在实验指导语页面提前加载资源。
- **返回值**：`Promise<GazeFollower2>`

### `startWebcam(): Promise<void>`
申请摄像头流（默认 `640x480` `facingMode: "user"`），就绪后触发视频播放并启动 `inferenceLoop()`。

### `pause(): GazeFollower2`
暂停视线计算循环（进入 100ms 间隔空转），保持摄像头不关闭，自动调用 `resetFilter()`。

### `resume(): GazeFollower2`
从暂停状态恢复实时视线预测循环。

### `end(): GazeFollower2` (别名: `stop()`)
完全终止眼动追踪：关闭并释放摄像头硬件轨道 (`track.stop()`)，清空 DOM 画面，重置所有内部坐标缓存与滤波器。

### `isReady(): boolean`
检查 SDK 模型与摄像头视频帧流是否均已就绪（`readyState >= 2`）。

---

## 4. 神经网络模型管理 (Neural Model Management)

### `loadModel(modelPath?, progressCallback?): Promise<GazeFollower2>`
动态加载或热切换视线估计神经网络模型（支持在 `begin()` 前后随时调用）。
- **参数**：
  - `modelPath` (`string`, 默认: `'GazeNet_Next.onnx'`): 模型 URL。支持原生 `.onnx` 模型或 AES-CBC 内存解密的 `.bin` 加密模型。
  - `progressCallback` (`((ratio: number) => void) | null`): 下载/解密进度回调 (`0.10` 开始下载，`0.70` 下载完成，`0.75` 内存解密，`0.90` 创建 ONNX 会话，`1.00` 完成)。
- **默认模型规格**：
  - **`GazeNet_Next.onnx`**：8,006,908 字节 (~8.0 MB)，全精度 FP32，输入包含人脸 (`224x224`)、左眼 (`112x112`)、右眼 (`112x112`) 与 12 维几何框，输出 258 维特征向量。

---

## 5. 实时视线预测与事件监听 (Gaze Prediction & Callbacks)

### `setGazeListener(callback): GazeFollower2`
注册每帧视线注视点回调。
- **参数**：`callback(data, timestamp)`
  - **正常预测输出**：
    - `data`: `{ x: number, y: number }`，屏幕视口物理像素坐标（以当前浏览器窗口左上角为 `(0, 0)`）。
    - `timestamp`: `number`，由 `performance.now()` 产生的 DOM 高精度时间戳。
  - **人脸丢失帧**：
    - 当画面中未检测到完整面部时：`data = null`, `timestamp = performance.now()`。
  - **标定完成通知**：
    - 当交互式标定 (`startCalibration`) 采集结束并完成回归训练时：`data = null`, `timestamp = null`。
- **代码示例**：
  ```javascript
  GazeFollower2.setGazeListener((data, clock) => {
    if (data === null && clock === null) {
      console.log("标定训练成功！");
      return;
    }
    if (data) {
      console.log(`注视坐标: (${data.x.toFixed(1)}, ${data.y.toFixed(1)}) 时间戳: ${clock}`);
    } else {
      console.warn("人脸脱离视线区域");
    }
  });
  ```

### `clearGazeListener(): GazeFollower2`
解绑注视点回调。

### `getCurrentPrediction(): { x: number, y: number } | null`
同步即时读取最新一帧视线坐标。若未标定或人脸丢失则返回 `null`。

---

## 6. 启发式防抖滤波与 `look_ahead` 配置 (Heuristic Filtering)

SDK 默认开启 **启发式防抖滤波器 (`HeuristicFilter`)**，在保持零物理感知延迟的同时消除眨眼或微扫视引起的单帧突变尖峰。

### `setHeuristicFilter(bool?, look_ahead?): GazeFollower2`
*(兼容别名: `applyKalmanFilter(bool, look_ahead?)`, `applySmoothingFilter(bool, look_ahead?)`)*
- `bool` (`boolean | HeuristicFilterOptions`, 默认 `true`): 开关标志或配置对象。
- `look_ahead` (`number`, 默认 `2`): 单侧前瞻帧数（窗口长度 $W = 2 \times \text{look\_ahead} + 1$）。
  - `look_ahead = 1`：3 帧窗口，响应最灵敏（适合快速扫视任务）。
  - `look_ahead = 2`：5 帧窗口（**默认推荐**，兼顾平滑度与反应时）。
  - `look_ahead = 3~4`：7~9 帧窗口，强力防抖（适合注视点稳定性分析）。

### `setLookAhead(look_ahead?): GazeFollower2` / `getLookAhead(): number`
配置或读取 `look_ahead` 参数，亦可直接访问属性 `GazeFollower2.look_ahead` / `GazeFollower2.lookAhead`。

### `resetFilter(): GazeFollower2`
清空内部滑动窗口缓存。**在实验试次 (Trial) 切换或视觉刺激呈现瞬间建议调用**，消除上一试次的坐标惯性。

---

## 7. 空间标定与回归映射 (Calibration & Spatial Mapping)

### `startCalibration(mode?, method?, latency?, order?): GazeFollower2`
调起全屏交互式标定遮罩层（自动调用 `clearData()`）。
- **参数说明**：
  - `mode` (`'13-point' | '9-point' | '5-point' | 'random' | 'lissajous' | CalibrationOptions`，默认 `'13-point'`):
    - `'13-point'`：13 点增强网格（四角、中央、四边中点与内层网格点，精度最高）。
    - `'9-point'`：标准 3x3 离散网格。
    - `'5-point'`：快速 5 点网格（四角 + 中央）。
    - `'random'`：在屏幕有效安全区内随机生成 13 个点。
    - `'lissajous'`：利萨如光滑追随轨迹连续动态标定。
  - `method` (`'click' | 'auto'`，默认 `'click'`):
    - `'click'`：手动点击模式。点击时提取该点注视窗口内的多个特征帧加入回归集，并迸发粒子反馈。
    - `'auto'`：自动驻留模式。移动 500ms，在点上驻留注视 1500ms（最后 500ms 自动连续采样）。
  - `latency` (`number`，默认 `4`):
    - `<= 20`：按 30 FPS 摄像头物理帧延迟处理（默认 4 帧 $\approx 133\text{ ms}$）。
    - `> 20`：直接按毫秒数处理。
  - `order` (`'random' | 'sequential'`，默认 `'random'`): 离散点呈现顺序随机或顺序。

#### 标定点分布与岭回归正则化系数 $\lambda$（`ridgeAlpha`）推荐默认值规范

在多元岭回归空间映射求解中，矩阵方程为 $\mathbf{W} = (\mathbf{X}_b^\top \mathbf{X}_b + \lambda \mathbf{I}_0)^{-1} \mathbf{X}_b^\top \mathbf{Y}$。由于视线特征空间高达 258 维，当标定点数较少时，样本矩阵 $\mathbf{X}_b$ 的空间覆盖稀疏，若正则化惩罚过小极易导致过拟合与非标定区域的外推失真。因此，不同标定点数对应不同的推荐默认 $\lambda$ 系数：

| 标定模式 (`mode`) | 点数规模 | 推荐默认正则化系数 $\lambda$ (`ridgeAlpha`) | 理论依据与调优说明 |
| :--- | :---: | :---: | :--- |
| **`'5-point'`** | 5 点 | **`3.0`**（默认为 3） | 极简快速标定。样本点少，需更强的 L2 惩罚（$\lambda = 3.0$）强约束权重，防止边缘外推发散。 |
| **`'9-point'`** | 9 点 | **`2.0`**（默认为 2） | 标准 3×3 离散网格。在保持拟合灵敏度的同时施加适度平滑（$\lambda = 2.0$），兼顾全屏过渡。 |
| **`'13-point'`** *(默认)* | 13 点 | **`1.0`**（默认为 1） | 科学级高精度网格。样本充分且覆盖完备，基准 $\lambda = 1.0$ 可达最优空间分辨率与准确度。 |
| **`'random'`** | 13 点 | **`1.0`** | 随机 13 点全屏安全区分布，样本数同 13 点。 |
| **`'lissajous'`** | 连续轨迹 | **`1.0`** | 连续平滑追随动态采样，样本量丰富。 |

> 📌 **调用规范**：
> 在调用 `startCalibration` 切换到不同点数时，应同步设置对应的正则化参数：
> ```javascript
> // 5 点标定时：λ 默认为 3
> GazeFollower2.setRidgeAlpha(3.0).startCalibration('5-point', 'click');
>
> // 9 点标定时：λ 默认为 2
> GazeFollower2.setRidgeAlpha(2.0).startCalibration('9-point', 'click');
>
> // 13 点标定时：λ 默认为 1
> GazeFollower2.setRidgeAlpha(1.0).startCalibration('13-point', 'click');
> ```

### `recordScreenPosition(x, y, eventType?): boolean`
*(WebGazer 兼容)* 手动将当前帧提取的 258 维特征与指定屏幕点 `(x, y)` 绑定推入校准数据集。

### `trainCalibration(): boolean`
使用已收集的样本集训练回归器，训练成功后 `this.isCalibrated = true`。

### `clearData(): GazeFollower2`
清空所有校准点数据集，回归器重置，`this.isCalibrated = false`。

### `setRidgeAlpha(alpha): GazeFollower2` / `getRidgeAlpha(): number`
设置或读取多元岭回归的 L2 正则化惩罚参数 $\lambda$。
- **参数**：`alpha` (`number`，大于 0 的浮点数)。
- **点数规范默认值**：
  - **5 点标定**：$\lambda$ 默认为 **`3.0`**
  - **9 点标定**：$\lambda$ 默认为 **`2.0`**
  - **13 点标定**：$\lambda$ 默认为 **`1.0`**（SDK 全局初始基准）
```javascript
GazeFollower2.setRidgeAlpha(3.0); // 适用于 5 点标定
console.log(GazeFollower2.getRidgeAlpha()); // 3
```

### `setLissajousSpeed(speedPxPerSec): GazeFollower2` / `getLissajousSpeed(): number`
设置或读取利萨如连续追随轨迹的移动速度（默认 `250 px/s`）。

---

## 8. 画面预览与视觉调试层 (Visual Displays & Overlays)

### `showVideo(bool): GazeFollower2`
*(别名: `showVideoPreview(bool)`, `showVideoElement(bool)`)*
显示或隐藏摄像头 `<video>` 元素画面。

### `showPredictionPoints(bool): GazeFollower2`
显示或隐藏人脸绿框与左右眼红框叠加画布。

### `getVideoElementCanvas(): HTMLCanvasElement | null`
获取人脸框叠加画布对象。

---

## 9. 底层核心算法类权威参考 (Sub-Module Classes)

### 9.1 `GazeEstimator` (ONNX 视线特征提取器)
- **文件**：[`src/GazeEstimator.js`](file:///D:/python_projects/GazeFollower2/src/GazeEstimator.js)（别名: `MGazeNetGazeEstimator`）
- **构造**：`new GazeEstimator(modelPath)`
- **`init(progressCallback?): Promise<void>`**：
  自动探测环境执行提供商（桌面优先 `['webgpu', 'webnn', 'webgl', 'wasm']`，Safari 优先 `['wasm', 'webgl']`，异常降级至 `['wasm']`）。
- **`detect(faceTensor, leftTensor, rightTensor, rectTensor): Promise<number[] | null>`**：
  执行推理并返回 **258 维 Float32 特征向量**。

### 9.2 `FaceAlignment` (MediaPipe 人脸对齐与眼部裁剪)
- **文件**：[`src/FaceAlignment.js`](file:///D:/python_projects/GazeFollower2/src/FaceAlignment.js)
- **`process(video, faceLandmarks, timestamp): AlignmentResult`**：
  - `faceTensor`: `Float32Array(3*224*224)`，RGB 归一化至 `[0, 1]`。
  - `leftTensor`: `Float32Array(3*112*112)`，RGB 归一化至 `[0, 1]`。
  - `rightTensor`: `Float32Array(3*112*112)`，水平镜像翻转 RGB `[0, 1]`。
  - `rectTensor`: `Float32Array(12)`，归一化几何边界 `[w/W, h/H, x/W, y/H]`。
  - `rawRects`: `{ face, left, right }` 像素坐标框。

### 9.3 `CalibrationManager` (标定流程与交互管理器)
- **文件**：[`src/CalibrationManager.js`](file:///D:/python_projects/GazeFollower2/src/CalibrationManager.js)
- 负责挂载全屏 `#gf-calibration-container` 遮罩、执行点阵移动动画、利萨如参数轨迹插值、时间戳对齐与样本聚合。

### 9.4 `MultivariateRidgeCalibration` (多元岭回归校准器)
- **文件**：[`src/MultivariateRidgeCalibration.js`](file:///D:/python_projects/GazeFollower2/src/MultivariateRidgeCalibration.js)
- **构造**：`new MultivariateRidgeCalibration(lambda = 1.0)`
- **算法模型**：
  求解矩阵方程 $(\mathbf{X}_b^\top \mathbf{X}_b + \lambda \mathbf{I}_0)\mathbf{W} = \mathbf{X}_b^\top \mathbf{Y}$。偏置项 $\mathbf{X}_b = [1.0, f_1, \dots, f_{258}]$ 不施加惩罚（$\mathbf{I}_0 = \operatorname{diag}(0, 1, 1, \dots, 1)$）。
- **标定点数与正则化系数 $\lambda$ 默认规范**：
  - **5 点标定**：$\lambda = 3.0$（默认为 3）
  - **9 点标定**：$\lambda = 2.0$（默认为 2）
  - **13 点标定**：$\lambda = 1.0$（默认为 1）
- **`train(featuresArray, labelsX, labelsY): void`**：拟合生成 $259 \times 2$ 权重矩阵。
- **`predict(features): [number, number]`**：即时预测屏幕 $(X, Y)$ 像素。

### 9.5 `SVRCalibration` (独立通道岭回归/SVR校准器)
- **文件**：[`src/SVRCalibration.js`](file:///D:/python_projects/GazeFollower2/src/SVRCalibration.js)
- 分别对 X 与 Y 轴独立求解带 L2 正则化的回归参数。

### 9.6 `HeuristicFilter` (启发式去尖峰滤波器)
- **文件**：[`src/HeuristicFilter.js`](file:///D:/python_projects/GazeFollower2/src/HeuristicFilter.js)
- **`filterValues(x, y): [number, number]`**：对传入坐标进行突变尖峰检验与滑动滤波。
- **`reset(): HeuristicFilter`**：重置队列。

### 9.7 `OneEuroFilter` & `LowPassFilter` (1-Euro 自适应滤波)
- **文件**：[`src/OneEuroFilter.js`](file:///D:/python_projects/GazeFollower2/src/OneEuroFilter.js)
- 用于人脸关键点与眼框的平滑防抖，支持标量、数组或 `{x, y, z}` 结构。

### 9.8 `ParticleFX` / `particleFX` (标定粒子反馈引擎)
- **文件**：[`src/ParticleFX.js`](file:///D:/python_projects/GazeFollower2/src/ParticleFX.js)
- **`particleFX.burst(x, y, options): void`**：在指定坐标迸发高帧率扩散粒子动效。

---

## 10. WebGazer API 无缝平替对照表 (WebGazer Compatibility Matrix)

GazeFollower2 与 WebGazer 的 API 保持 100% 签名兼容，且自动挂载 `window.webgazer`：

| WebGazer 方法 | GazeFollower2 对应实现 | 说明 |
| :--- | :--- | :--- |
| `webgazer.begin(cb)` | `GazeFollower2.begin(cb)` | 返回 `Promise<GazeFollower2>` |
| `webgazer.end()` / `stop()` | `GazeFollower2.end()` / `stop()` | 完全停止并释放摄像头 |
| `webgazer.pause()` | `GazeFollower2.pause()` | 暂停推断 |
| `webgazer.resume()` | `GazeFollower2.resume()` | 恢复推断 |
| `webgazer.isReady()` | `GazeFollower2.isReady()` | 检查就绪状态 |
| `webgazer.setGazeListener(cb)` | `GazeFollower2.setGazeListener(cb)` | 回调签名 `(data, clock)` 完全一致 |
| `webgazer.clearGazeListener()` | `GazeFollower2.clearGazeListener()` | 解除回调 |
| `webgazer.getCurrentPrediction()` | `GazeFollower2.getCurrentPrediction()` | 返回 `{ x, y }` 或 `null` |
| `webgazer.recordScreenPosition(x, y)` | `GazeFollower2.recordScreenPosition(x, y)` | 记录校准样本点 |
| `webgazer.clearData()` | `GazeFollower2.clearData()` | 清空校准数据 |
| `webgazer.showVideo(bool)` | `GazeFollower2.showVideo(bool)` | 控制视频画面可见性 |
| `webgazer.showPredictionPoints(bool)`| `GazeFollower2.showPredictionPoints(bool)`| 控制跟踪框可见性 |
| `webgazer.applyKalmanFilter(bool)` | `GazeFollower2.setHeuristicFilter(bool)` | 自动映射至启发式滤波器 |
| `webgazer.setRegression(type)` | `GazeFollower2.setRegression(type)` | 支持 `'ridge'` 与 `'svr'` |

---

## 11. jsPsych 心理学实验接入指南 (jsPsych Integration Guide)

GazeFollower2 原生适配 jsPsych 的眼动扩展插件。

### 标准集成示例
```html
<!DOCTYPE html>
<html>
<head>
    <title>jsPsych + GazeFollower2 Experiment</title>
    <!-- 1. 加载 ONNX Runtime Web -->
    <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
    <!-- 2. 加载 jsPsych -->
    <script src="https://unpkg.com/jspsych@7.3.3"></script>
    <script src="https://unpkg.com/@jspsych/plugin-html-keyboard-response@1.1.2"></script>
    <link href="https://unpkg.com/jspsych@7.3.3/css/jspsych.css" rel="stylesheet" />
    <!-- 3. 加载 GazeFollower2 SDK -->
    <script type="module" src="dist/gazefollower2.min.js"></script>
</head>
<body>
    <div id="jspsych-target"></div>
    <script>
        const jsPsych = initJsPsych({
            display_element: 'jspsych-target'
        });

        const timeline = [];

        // 1. 初始化并校准
        timeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: '<p>按空格键启动眼动仪初始化并开始 13 点标定...</p>',
            choices: [' '],
            on_finish: async () => {
                await window.GazeFollower2.begin();
                window.GazeFollower2.startCalibration('13-point', 'click');
            }
        });

        // 2. 刺激呈现 Trial
        timeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: '<div style="font-size: 40px; color: red;">+</div>',
            choices: ['NO_KEYS'],
            trial_duration: 3000,
            on_start: () => {
                // 每个 Trial 开始前清空滤波窗口，消除上一个 Trial 的惯性
                window.GazeFollower2.resetFilter();
                
                // 注册实时注视点记录
                window.GazeFollower2.setGazeListener((data, clock) => {
                    if (data) {
                        jsPsych.data.write({
                            gaze_x: data.x,
                            gaze_y: data.y,
                            timestamp: clock
                        });
                    }
                });
            },
            on_finish: () => {
                window.GazeFollower2.clearGazeListener();
            }
        });

        // 3. 结束实验
        timeline.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: '<p>实验结束，按任意键下载数据。</p>',
            on_start: () => {
                window.GazeFollower2.end();
            }
        });

        jsPsych.run(timeline);
    </script>
</body>
</html>
```

---

## 12. PsychoJS / PsychoPy 线上实验接入指南 (PsychoJS Integration Guide)

在 PsychoPy 导出为 PsychoJS（或 Pavlovia 线上实验）时，可在实验的 `Code Component` 中直接调用 GazeFollower2。

### 1. `Before Experiment` 选项卡
```javascript
// 全局单例别名
window.webgazer = window.GazeFollower2;

// 异步启动 SDK 并设置启发式防抖
window.GazeFollower2.begin().then(() => {
    window.GazeFollower2.setHeuristicFilter(true, 2);
    console.log("PsychoJS: GazeFollower2 Ready");
});
```

### 2. `Begin Routine` 选项卡
```javascript
// 每个 Routine（试次）开始时清空滤波队列
window.GazeFollower2.resetFilter();
currentRoutineGazeData = [];

window.GazeFollower2.setGazeListener((data, clock) => {
    if (data) {
        currentRoutineGazeData.push({
            t: clock,
            x: data.x,
            y: data.y
        });
    }
});
```

### 3. `End Routine` 选项卡
```javascript
window.GazeFollower2.clearGazeListener();
// 将注视轨迹存入 PsychoJS 数据集
psychoJS.experiment.addData('gaze_trajectory', JSON.stringify(currentRoutineGazeData));
```

### 4. `End Experiment` 选项卡
```javascript
window.GazeFollower2.end();
```

---

## 13. iOS 原生 App / WKWebView 桥接与兼容规范 (iOS Native Bridge Specification)

如果你开发了一个 **原生 iOS App**（使用 ARKit / TrueDepth 或 AVFoundation 硬件相机进行高帧率、低延迟眼动追踪），并通过 `WKWebView` 承载前端 jsPsych / PsychoJS 实验页面，**iOS App 只需对接以下三种桥接机制之一即可完全接管 GazeFollower2**。

### 桥接交互架构图
```text
┌────────────────────────────────────────────────────────┐
│                   iOS Native App                       │
│  (ARKit TrueDepth Camera / AVFoundation @ 60 FPS)      │
└───────────────────────────┬────────────────────────────┘
                            │
               JavaScript Evaluation / MessageHandler
                            ▼
┌────────────────────────────────────────────────────────┐
│                   WKWebView Context                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                GazeFollower2 (JS)                │  │
│  │                                                  │  │
│  │  window.GazeFollower2.targetX = screenX;         │  │
│  │  window.GazeFollower2.targetY = screenY;         │  │
│  │  window.GazeFollower2.listener({x, y}, time);    │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │            jsPsych / PsychoJS Trials             │  │
│  │  (Transparently receives gaze data as usual)     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 方案 A（最简直接注入）：iOS App 直接向 WebView 注入坐标
iOS App 原生检测到注视点后，直接调用 `WKWebView.evaluateJavaScript(...)`：
```swift
// Swift 端代码示例
let js = """
if (window.GazeFollower2) {
    window.GazeFollower2.targetX = \(screenX);
    window.GazeFollower2.targetY = \(screenY);
    if (typeof window.GazeFollower2.listener === 'function') {
        window.GazeFollower2.listener({ x: \(screenX), y: \(screenY) }, performance.now());
    }
}
"""
webView.evaluateJavaScript(js, completionHandler: nil)
```
- **兼容性**：前端页面无需任何改动，原本通过 `GazeFollower2.setGazeListener()` 或 `GazeFollower2.getCurrentPrediction()` 获取数据的代码立刻收到来自 iOS 原生的精准坐标。

### 方案 B（双向生命周期拦截）：WKScriptMessageHandler
若 iOS 原生 App 希望拦截前端的生命周期（如前端调用 `begin()` 时启动 iOS 原生相机，前端调用 `end()` 时关闭原生相机）：
1. **iOS 端注入原生标记**：
   在加载网页前注入：
   ```swift
   webView.configuration.userContentController.addUserScript(
       WKUserScript(source: "window.__GAZEFOLLOWER2_IOS_NATIVE__ = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true)
   )
   ```
2. **iOS 端注册消息通道**：
   注册名为 `"GazeFollowerBridge"` 的 ScriptMessageHandler：
   - 前端发送动作：`window.webkit.messageHandlers.GazeFollowerBridge.postMessage({ action: 'begin' })`
   - 支持的 `action` 枚举：
     - `'begin'`：请求启动原生眼动追踪
     - `'end'` / `'stop'`：请求释放原生摄像头
     - `'pause'`：请求暂停计算
     - `'resume'`：请求恢复计算
     - `'calibrate'`：请求调起原生校准界面

### 方案 C（校准结果同步）：
若 iOS 端执行了原生的高精度校准，可通过以下调用将校准后的有效状态直接同步给前端：
```swift
// Swift 端：标记前端已标定
let jsSync = "window.GazeFollower2.isCalibrated = true;"
webView.evaluateJavaScript(jsSync, completionHandler: nil)
```

---

## 14. 完整 TypeScript / JSDoc 类型定义 (Type Definitions)

```typescript
/** 屏幕视口像素坐标结构 */
export interface GazePoint {
  /** 视口 X 像素坐标 (0 ~ window.innerWidth) */
  x: number;
  /** 视口 Y 像素坐标 (0 ~ window.innerHeight) */
  y: number;
}

/** 视线监听器回调函数签名 */
export type GazeListenerCallback = (
  /** 坐标对象。正常帧为 {x, y}；人脸丢失为 null；标定完成通知为 null */
  data: GazePoint | null,
  /** 高精度时间戳 (ms)。正常帧为 DOMHighResTimeStamp；标定完成通知为 null */
  timestamp: number | null
) => void;

/** GazeFollower2 初始化与构造选项 */
export interface GazeFollower2Options {
  /** 模型文件 URL，默认 'GazeNet_Next.onnx' */
  modelPath?: string;
  onnxModelPath?: string;
  /** 是否启用启发式防抖滤波，默认 true */
  enableHeuristicFilter?: boolean;
  enableGazeFilter?: boolean;
  /** 启发式滤波前瞻帧数，默认 2 (即 5 帧滑动窗口) */
  look_ahead?: number;
  lookAhead?: number;
  /** 多元岭回归正则化系数 alpha/lambda (基准默认 1.0；5点标定默认为 3.0，9点标定默认为 2.0，13点标定默认为 1.0) */
  ridgeAlpha?: number;
  alpha?: number;
  /** 模型加载进度回调 (0.0 ~ 1.0) */
  onProgress?: (ratio: number) => void;
  progressCallback?: (ratio: number) => void;
}

/** 启发式滤波器配置选项 */
export interface HeuristicFilterOptions {
  enabled?: boolean;
  enableHeuristicFilter?: boolean;
  enableGazeFilter?: boolean;
  look_ahead?: number;
  lookAhead?: number;
}

/** 全屏空间标定配置项 */
export interface CalibrationOptions {
  /** 标定点分布模式，默认 '13-point' (5-point 推荐 λ=3.0, 9-point 推荐 λ=2.0, 13-point 推荐 λ=1.0) */
  mode?: '13-point' | '9-point' | '5-point' | 'random' | 'lissajous';
  /** 标定交互方式，默认 'click' */
  method?: 'click' | 'auto';
  /** 延迟补偿：<= 20 表示帧数 (默认 4 帧 ≈ 133ms)，> 20 表示毫秒数 */
  latency?: number;
  /** 标定点呈现顺序，默认 'random' */
  order?: 'random' | 'sequential';
  /** 针对本次标定特别指定的岭回归惩罚系数 λ (若未指定则按点数推荐默认) */
  ridgeAlpha?: number;
  alpha?: number;
}

/** 人脸对齐与裁剪结果数据结构 */
export interface AlignmentResult {
  /** 人脸区域张量 [1, 3, 224, 224] Float32Array */
  faceTensor: Float32Array;
  /** 左眼区域张量 [1, 3, 112, 112] Float32Array */
  leftTensor: Float32Array;
  /** 右眼区域张量（水平镜像翻转） [1, 3, 112, 112] Float32Array */
  rightTensor: Float32Array;
  /** 几何矩形归一化张量 [1, 12] Float32Array */
  rectTensor: Float32Array;
  /** 478 个 3D 人脸关键点像素坐标 */
  landmarks: Array<{ x: number; y: number; z: number }>;
  /** 裁剪区域未归一化像素坐标矩形 [x, y, w, h] */
  rawRects: {
    face: [number, number, number, number];
    left: [number, number, number, number];
    right: [number, number, number, number];
  };
}
```
