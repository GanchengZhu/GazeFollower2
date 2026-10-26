const { rollup } = require('rollup');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const { minify } = require('terser');
const fs = require('fs');

async function build() {
    console.log("Bundling SDK with Rollup...");
    const bundle = await rollup({
        input: 'src/GazeFollower.js',
        plugins: [nodeResolve()]
    });
    
    const { output } = await bundle.generate({
        format: 'es',
        sourcemap: true
    });
    
    let code = output[0].code;
    
    const publicApiNames = [
        'GazeFollower2',
        'webgazer',
        'GazeFollower',
        'HeuristicFilter',
        'CalibrationManager',
        'MGazeNetGazeEstimator',
        'FaceAlignment',
        'MultivariateRidgeCalibration',
        'SVRCalibration',
        'OneEuroFilter',
        'LowPassFilter',
        'ParticleFX',
        'particleFX',
        'burst',
        'begin',
        'end',
        'stop',
        'pause',
        'resume',
        'isReady',
        'setGazeListener',
        'clearGazeListener',
        'getCurrentPrediction',
        'setRegression',
        'setRidgeAlpha',
        'getRidgeAlpha',
        'ridgeAlpha',
        'lambda',
        'alpha',
        'setLissajousSpeed',
        'getLissajousSpeed',
        'lissajousSpeed',
        'lissajousDuration',
        'computeLissajousLength',
        'setTracker',
        'setHeuristicFilter',
        'setLookAhead',
        'getLookAhead',
        'look_ahead',
        'lookAhead',
        'resetFilter',
        'applyKalmanFilter',
        'applySmoothingFilter',
        'setFaceFilter',
        'startCalibration',
        'recordScreenPosition',
        'addCalibrationPoint',
        'clearData',
        'showVideo',
        'showPredictionPoints',
        'getVideoElementCanvas',
        'showVideoElement',
        'showVideoPreview',
        'loadModel',
        'init',
        'initDOM',
        'startWebcam',
        'trainCalibration',
        'filterValues',
        'filter_values',
        'reset',
        'enableGazeFilter',
        'filter',
        'isFaceDetected',
        'isCalibrated',
        'isPaused',
        'videoElement',
        'overlayCanvas',
        'caliManager',
        'estimator',
        'faceAlignment',
        'ridgeCalibrator',
        'svrCalibrator',
        'lastFeatures',
        'rawX',
        'rawY',
        'targetX',
        'targetY',
        'smoothX',
        'smoothY'
    ];

    console.log("Minifying with Terser (Standard Open-Source Build)...");
    const minified = await minify(code, {
        sourceMap: {
            filename: 'gazefollower2.min.js',
            url: 'gazefollower2.min.js.map'
        },
        compress: {
            passes: 2,
            keep_classnames: true,
            keep_fnames: true
        },
        mangle: {
            reserved: publicApiNames
        }
    });
    
    fs.writeFileSync('dist/gazefollower2.min.js', minified.code);
    fs.writeFileSync('dist/gazefollower-sdk.min.js', minified.code);
    if (minified.map) {
        fs.writeFileSync('dist/gazefollower2.min.js.map', minified.map);
        fs.writeFileSync('dist/gazefollower-sdk.min.js.map', minified.map);
    }
    console.log("Build complete: dist/gazefollower2.min.js and dist/gazefollower-sdk.min.js (with source maps)");
}

fs.mkdirSync('dist', { recursive: true });
build().catch(console.error);
