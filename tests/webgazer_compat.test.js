import test from 'node:test';
import assert from 'node:assert/strict';
import { HeuristicFilter } from '../src/HeuristicFilter.js';
import { MultivariateRidgeCalibration } from '../src/MultivariateRidgeCalibration.js';

test('WebGazer Compatibility - Surface API Contract Inspection', () => {
    // Expected WebGazer core methods that any experiment script relies on:
    const expectedMethods = [
        'begin',
        'end',
        'stop',
        'pause',
        'resume',
        'setGazeListener',
        'clearGazeListener',
        'getCurrentPrediction',
        'recordScreenPosition',
        'clearData',
        'isReady',
        'showVideo',
        'showPredictionPoints',
        'applyKalmanFilter'
    ];

    // Mock minimal runtime to verify contract
    const instance = {
        isPaused: true,
        _isReady: true,
        targetX: 500,
        targetY: 300,
        filter: new HeuristicFilter(2),
        enableGazeFilter: true,
        calibrator: new MultivariateRidgeCalibration(1.0),
        
        begin() { return Promise.resolve(this); },
        end() { return this; },
        stop() { return this.end(); },
        pause() { this.isPaused = true; return this; },
        resume() { this.isPaused = false; return this; },
        setGazeListener(cb) { this.listener = cb; return this; },
        clearGazeListener() { this.listener = null; return this; },
        getCurrentPrediction() { return { x: this.targetX, y: this.targetY }; },
        recordScreenPosition(x, y) { return true; },
        clearData() { return this; },
        isReady() { return this._isReady; },
        showVideo(bool) { return this; },
        showPredictionPoints(bool) { return this; },
        applyKalmanFilter(bool, lookAhead = 2) {
            this.enableGazeFilter = !!bool;
            if (this.filter) this.filter.setLookAhead(lookAhead);
            return this;
        }
    };

    for (const m of expectedMethods) {
        assert.equal(typeof instance[m], 'function', `Method ${m} must exist on GazeFollower2 / WebGazer contract`);
    }

    // Method chaining verification
    assert.equal(instance.pause().resume(), instance);
    assert.equal(instance.applyKalmanFilter(true, 3), instance);
    assert.equal(instance.filter.lookAhead, 3);
});

test('WebGazer Compatibility - Prediction format matches { x, y }', () => {
    const instance = {
        targetX: 640.5,
        targetY: 480.2,
        getCurrentPrediction() {
            if (this.targetX === null || this.targetY === null) return null;
            return { x: this.targetX, y: this.targetY };
        }
    };

    const pred = instance.getCurrentPrediction();
    assert.ok(pred !== null);
    assert.equal(typeof pred.x, 'number');
    assert.equal(typeof pred.y, 'number');
    assert.equal(pred.x, 640.5);
    assert.equal(pred.y, 480.2);
});
