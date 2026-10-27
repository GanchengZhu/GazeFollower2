import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GazeEstimator } from '../src/GazeEstimator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Model Directory Structure - Files Exist and Sizes are Valid', () => {
    const modelsDir = path.join(rootDir, 'models');
    assert.ok(fs.existsSync(modelsDir), 'models/ directory should exist');

    const fp32Onnx = path.join(modelsDir, 'GazeNet_Next.onnx');
    const fp16Onnx = path.join(modelsDir, 'GazeNet_Next_fp16.onnx');

    assert.ok(fs.existsSync(fp32Onnx), 'models/GazeNet_Next.onnx should exist');
    assert.ok(fs.existsSync(fp16Onnx), 'models/GazeNet_Next_fp16.onnx should exist');

    const fp32OnnxStat = fs.statSync(fp32Onnx);
    const fp16OnnxStat = fs.statSync(fp16Onnx);

    assert.ok(fp32OnnxStat.size > 7_000_000, 'FP32 ONNX model should be ~8 MB');
    assert.ok(fp16OnnxStat.size > 3_500_000 && fp16OnnxStat.size < 5_000_000, 'FP16 ONNX model should be ~4 MB (50% reduction)');
});

test('GazeEstimator and GazeFollower2 Default Model Path Points to models/GazeNet_Next.onnx', () => {
    const estimator = new GazeEstimator('models/GazeNet_Next.onnx');
    assert.equal(estimator.modelPath, 'models/GazeNet_Next.onnx', 'GazeEstimator model path should be models/GazeNet_Next.onnx');

    const srcCode = fs.readFileSync(path.join(rootDir, 'src', 'GazeFollower.js'), 'utf-8');
    assert.match(srcCode, /onnxModelPath\s*=\s*['"]models\/GazeNet_Next\.onnx['"]/, 'GazeFollower.js constructor default parameter must point to models/GazeNet_Next.onnx');
    assert.match(srcCode, /loadModel\(modelPath\s*=\s*['"]models\/GazeNet_Next\.onnx['"]/, 'GazeFollower.js loadModel default parameter must point to models/GazeNet_Next.onnx');
    assert.match(srcCode, /setStatsListener/, 'GazeFollower.js must export setStatsListener method');
    assert.match(srcCode, /getPipelineStats/, 'GazeFollower.js must export getPipelineStats method');
    assert.match(srcCode, /pipelineStats/, 'GazeFollower.js must maintain pipelineStats object');
});

test('Pipeline Performance Telemetry Contract Inspection', () => {
    const srcCode = fs.readFileSync(path.join(rootDir, 'src', 'GazeFollower.js'), 'utf-8');
    assert.ok(srcCode.includes('mediapipeMs'), 'pipelineStats must track MediaPipe inference latency');
    assert.ok(srcCode.includes('gazeMs'), 'pipelineStats must track GazeNet inference latency');
    assert.ok(srcCode.includes('totalMs'), 'pipelineStats must track total pipeline latency');
    assert.ok(srcCode.includes('fps'), 'pipelineStats must track processed FPS');
});
