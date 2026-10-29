import test from 'node:test';
import assert from 'node:assert/strict';
import { MultivariateRidgeCalibration } from '../src/MultivariateRidgeCalibration.js';

test('MultivariateRidgeCalibration - Instantiation and Parameter Accessors', () => {
    const defaultCalibrator = new MultivariateRidgeCalibration();
    assert.equal(defaultCalibrator.lambda, 3.0);
    assert.equal(defaultCalibrator.alpha, 3.0);

    const calibrator = new MultivariateRidgeCalibration(1.0);
    assert.equal(calibrator.lambda, 1.0);
    assert.equal(calibrator.alpha, 1.0);

    calibrator.alpha = 2.5;
    assert.equal(calibrator.lambda, 2.5);
    assert.equal(calibrator.alpha, 2.5);

    calibrator.lambda = 3.0;
    assert.equal(calibrator.alpha, 3.0);

    // Negative or invalid values should not overwrite valid lambda
    calibrator.alpha = -1.0;
    assert.equal(calibrator.lambda, 3.0);
});

test('MultivariateRidgeCalibration - Predict before training returns [0, 0]', () => {
    const calibrator = new MultivariateRidgeCalibration(1.0);
    const pred = calibrator.predict(new Array(258).fill(0.5));
    assert.deepEqual(pred, [0, 0]);
});

test('MultivariateRidgeCalibration - Zero samples edge case does not crash', () => {
    const calibrator = new MultivariateRidgeCalibration(1.0);
    assert.doesNotThrow(() => calibrator.train([], [], []));
    assert.deepEqual(calibrator.predict([1, 2, 3]), [0, 0]);
});

test('MultivariateRidgeCalibration - Analytical 1D linear mapping recovery', () => {
    // 4 samples in 2D feature space: target Y = 2 * f0 + 3 * f1 + 10
    const calibrator = new MultivariateRidgeCalibration(0.0001); // minimal lambda for near-exact linear solve
    const features = [
        [1.0, 2.0],
        [3.0, 1.0],
        [5.0, 4.0],
        [2.0, 6.0],
    ];
    const targetsX = features.map(([f0, f1]) => 2 * f0 + 3 * f1 + 10);
    const targetsY = features.map(([f0, f1]) => -1 * f0 + 4 * f1 + 5);

    calibrator.train(features, targetsX, targetsY);

    const testPoint = [4.0, 3.0];
    const expectedX = 2 * 4.0 + 3 * 3.0 + 10; // 27
    const expectedY = -1 * 4.0 + 4 * 3.0 + 5; // 13

    const [predX, predY] = calibrator.predict(testPoint);
    assert.ok(Math.abs(predX - expectedX) < 0.1, `Expected predX ~ ${expectedX}, got ${predX}`);
    assert.ok(Math.abs(predY - expectedY) < 0.1, `Expected predY ~ ${expectedY}, got ${predY}`);
});

test('MultivariateRidgeCalibration - 13-Point Calibration with default λ = 1.0', () => {
    const calibrator = new MultivariateRidgeCalibration(1.0);
    assert.equal(calibrator.lambda, 1.0);

    const points = 13;
    const D = 258;
    const features = [];
    const labelsX = [];
    const labelsY = [];

    // Realistic normalized gaze features
    for (let i = 0; i < points; i++) {
        const x = 160 + (i % 4) * 450;
        const y = 120 + Math.floor(i / 4) * 260;
        labelsX.push(x);
        labelsY.push(y);

        // Feature vector where features are scaled appropriately
        const feat = new Array(D).fill(0).map((_, idx) => (idx === 0 ? x / 1920 : idx === 1 ? y / 1080 : 0.05 * Math.sin(idx)));
        features.push(feat);
    }

    calibrator.train(features, labelsX, labelsY);

    // Predict on points: verify predictions are finite and positively correlated
    let sumErrX = 0;
    for (let i = 0; i < points; i++) {
        const [px, py] = calibrator.predict(features[i]);
        assert.ok(Number.isFinite(px), `Predicted X must be finite: ${px}`);
        assert.ok(Number.isFinite(py), `Predicted Y must be finite: ${py}`);
        assert.ok(px >= 0 && px <= 2500, `Predicted X within reasonable bounds: ${px}`);
        assert.ok(py >= 0 && py <= 1600, `Predicted Y within reasonable bounds: ${py}`);
        sumErrX += Math.abs(px - labelsX[i]);
    }
    const meanErrX = sumErrX / points;
    assert.ok(meanErrX < 300, `Mean training error should be bounded, got ${meanErrX}`);
});

test('MultivariateRidgeCalibration - 9-Point Calibration with recommended λ = 2.0', () => {
    const calibrator = new MultivariateRidgeCalibration(2.0);
    assert.equal(calibrator.lambda, 2.0);

    const D = 258;
    const features = [];
    const labelsX = [];
    const labelsY = [];

    // Standard 3x3 grid
    const xs = [200, 960, 1720];
    const ys = [150, 540, 930];
    for (const x of xs) {
        for (const y of ys) {
            labelsX.push(x);
            labelsY.push(y);
            const feat = new Array(D).fill(0).map((_, idx) => (idx === 0 ? x / 1920 : idx === 1 ? y / 1080 : 0.02 * Math.cos(idx)));
            features.push(feat);
        }
    }

    calibrator.train(features, labelsX, labelsY);
    const [px, py] = calibrator.predict(features[4]); // Center point
    assert.ok(Number.isFinite(px) && Number.isFinite(py));
    assert.ok(px >= 0 && px <= 1920);
    assert.ok(py >= 0 && py <= 1080);
});

test('MultivariateRidgeCalibration - 5-Point Calibration with recommended λ = 3.0 (Anti-Divergence)', () => {
    const calibrator = new MultivariateRidgeCalibration(3.0);
    assert.equal(calibrator.lambda, 3.0);

    const D = 258;
    const corners = [
        [200, 150], [1720, 150], [960, 540], [200, 930], [1720, 930]
    ];
    const features = corners.map(([x, y]) => {
        return new Array(D).fill(0).map((_, idx) => (idx === 0 ? x / 1920 : idx === 1 ? y / 1080 : 0.01));
    });
    const labelsX = corners.map(c => c[0]);
    const labelsY = corners.map(c => c[1]);

    calibrator.train(features, labelsX, labelsY);

    // Test intermediate point
    const midPoint = new Array(D).fill(0).map((_, idx) => (idx === 0 ? 580 / 1920 : idx === 1 ? 345 / 1080 : 0.01));
    const [px, py] = calibrator.predict(midPoint);
    assert.ok(Number.isFinite(px) && Number.isFinite(py));
    // Check that stronger regularization prevents wild extrapolation
    assert.ok(px >= 0 && px <= 2000, `Predicted X within reasonable viewport bounds: ${px}`);
    assert.ok(py >= 0 && py <= 1200, `Predicted Y within reasonable viewport bounds: ${py}`);
});

test('MultivariateRidgeCalibration - Collinear and Degenerate Inputs Stability', () => {
    // Exactly collinear / identical inputs with noise: Ridge penalty λ*I must prevent singular matrix crash
    const calibrator = new MultivariateRidgeCalibration(1.0);
    const D = 10;
    const identicalFeatures = [
        new Array(D).fill(0.5),
        new Array(D).fill(0.5),
        new Array(D).fill(0.5),
    ];
    const labelsX = [100, 100, 100];
    const labelsY = [200, 200, 200];

    assert.doesNotThrow(() => calibrator.train(identicalFeatures, labelsX, labelsY));
    const [px, py] = calibrator.predict(new Array(D).fill(0.5));
    assert.ok(Number.isFinite(px));
    assert.ok(Number.isFinite(py));
});
