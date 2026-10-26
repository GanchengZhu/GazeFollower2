import test from 'node:test';
import assert from 'node:assert/strict';
import { HeuristicFilter } from '../src/HeuristicFilter.js';
import { LowPassFilter, OneEuroFilter } from '../src/OneEuroFilter.js';

test('HeuristicFilter - Initialization & lookAhead parameter', () => {
    const filter = new HeuristicFilter(2);
    assert.equal(filter.lookAhead, 2);
    assert.equal(filter.look_ahead, 2);
    assert.equal(filter.getLookAhead(), 2);

    // Setting new lookAhead resets buffers
    filter.filterValues(100, 200);
    assert.ok(filter.rawX.length > 0);
    filter.setLookAhead(3);
    assert.equal(filter.lookAhead, 3);
    assert.equal(filter.rawX.length, 0);

    // Setting invalid lookAhead (< 1) preserves current lookAhead
    filter.setLookAhead(0);
    assert.equal(filter.lookAhead, 3);

    filter.setLookAhead(-5);
    assert.equal(filter.lookAhead, 3);

    filter.setLookAhead(1);
    assert.equal(filter.lookAhead, 1);
});

test('HeuristicFilter - Steady-state coordinate smoothing', () => {
    const filter = new HeuristicFilter(2); // 5-frame window

    // Feed stationary coordinates with micro-jitter (+- 2px)
    let lastOut = [500, 500];
    for (let i = 0; i < 20; i++) {
        const jitterX = (Math.sin(i) * 2);
        const jitterY = (Math.cos(i) * 2);
        lastOut = filter.filterValues(500 + jitterX, 500 + jitterY);
        assert.ok(Number.isFinite(lastOut[0]) && Number.isFinite(lastOut[1]));
    }

    // Filtered coordinates should be very close to the true center (500, 500)
    assert.ok(Math.abs(lastOut[0] - 500) < 3.0);
    assert.ok(Math.abs(lastOut[1] - 500) < 3.0);
});

test('HeuristicFilter - Spike rejection (Single-frame blink/glance spike)', () => {
    const filter = new HeuristicFilter(2);

    // Warm up filter at (400, 300)
    for (let i = 0; i < 6; i++) {
        filter.filterValues(400, 300);
    }

    // Inject sudden 800px aberrant spike on a single frame
    const spikeOutput = filter.filterValues(1200, 300);

    // The filter buffer should attenuate or clamp the instantaneous outlier
    assert.ok(Number.isFinite(spikeOutput[0]) && Number.isFinite(spikeOutput[1]));
    assert.ok(spikeOutput[0] < 1100, `Expected spike to be attenuated, got ${spikeOutput[0]}`);
});

test('HeuristicFilter - Array and object input formats', () => {
    const filter = new HeuristicFilter(2);
    const res1 = filter.filterValues([350, 450]);
    assert.equal(res1.length, 2);

    const res2 = filter.filter_values([360, 460]);
    assert.equal(res2.length, 2);

    assert.throws(() => filter.filter_values([100]));
});

test('HeuristicFilter - Reset clears internal buffers completely', () => {
    const filter = new HeuristicFilter(2);
    for (let i = 0; i < 10; i++) filter.filterValues(100, 100);
    assert.ok(filter.rawX.length > 0);

    filter.reset();
    assert.equal(filter.rawX.length, 0);
    assert.equal(filter.rawY.length, 0);
});

test('LowPassFilter - Scalar and Array smoothing', () => {
    const lpf = new LowPassFilter(0.5);
    const v1 = lpf.filter(100);
    assert.equal(v1, 100); // First value initializes

    const v2 = lpf.filter(200);
    assert.equal(v2, 150); // 0.5 * 200 + 0.5 * 100 = 150

    // Array filtering
    const lpfArr = new LowPassFilter(0.5);
    const arr1 = lpfArr.filter([10, 20]);
    assert.deepEqual(arr1, [10, 20]);

    const arr2 = lpfArr.filter([20, 40]);
    assert.deepEqual(arr2, [15, 30]);
});

test('OneEuroFilter - Speed-adaptive smoothing', () => {
    const euro = new OneEuroFilter(30, 1.0, 0.007, 1.0);

    // Slow movement: low cutoff -> high filtering
    let t = 0;
    const slow1 = euro.filter(100, t);
    t += 1 / 30;
    const slow2 = euro.filter(102, t);
    assert.ok(Math.abs(slow2 - 100.5) < 1.0, `Slow movement should be heavily filtered`);

    // Fast saccade jump: high speed -> low latency
    t += 1 / 30;
    const fast = euro.filter(800, t);
    assert.ok(fast > 300, `Fast saccade should have low lag, got ${fast}`);
});
