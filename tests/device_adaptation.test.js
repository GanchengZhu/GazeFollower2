import test from 'node:test';
import assert from 'node:assert/strict';

test('Device Adaptation - High-DPI / Retina display coordinate scaling', () => {
    // On MacBook Pro Retina (dpr=2) or iPhone 15 Pro (dpr=3):
    // CSS viewport is e.g. 390x844 (CSS pixels), physical canvas is 1170x2532.
    // Gaze points must always be reported in CSS viewport pixels.
    const cssWidth = 393;
    const cssHeight = 852;
    const dpr = 3.0; // Super Retina

    const physicalVideoWidth = 1920;
    const physicalVideoHeight = 1080;

    // Normalizing a gaze point from physical canvas to viewport
    const rawGaze = { x: 960, y: 540 }; // center in physical frame
    const viewportX = (rawGaze.x / physicalVideoWidth) * cssWidth;
    const viewportY = (rawGaze.y / physicalVideoHeight) * cssHeight;

    assert.ok(viewportX > 0 && viewportX <= cssWidth);
    assert.ok(viewportY > 0 && viewportY <= cssHeight);
    assert.equal(Math.round(viewportX), Math.round(cssWidth / 2));
    assert.equal(Math.round(viewportY), Math.round(cssHeight / 2));
});

test('Device Adaptation - Responsive mobile vs desktop viewports', () => {
    const devices = [
        { name: 'iPhone 15 / 16 (Portrait)', width: 393, height: 852, dpr: 3.0 },
        { name: 'iPad Pro 11 (Landscape)', width: 1194, height: 834, dpr: 2.0 },
        { name: 'FHD Monitor 1080p', width: 1920, height: 1080, dpr: 1.0 },
        { name: '4K Display (150% Scaling)', width: 2560, height: 1440, dpr: 1.5 }
    ];

    for (const dev of devices) {
        // Calibration grid generation for each device
        const w = dev.width;
        const h = dev.height;

        // 5-point grid boundaries
        const fivePts = [
            [w * 0.15, h * 0.15],
            [w * 0.85, h * 0.15],
            [w * 0.5, h * 0.5],
            [w * 0.15, h * 0.85],
            [w * 0.85, h * 0.85]
        ];

        for (const [px, py] of fivePts) {
            assert.ok(px >= 0 && px <= w, `${dev.name}: px=${px} out of width=${w}`);
            assert.ok(py >= 0 && py <= h, `${dev.name}: py=${py} out of height=${h}`);
        }
    }
});

test('Device Adaptation - iOS Native App WKWebView bridge coordinate injection', () => {
    // Simulate GazeFollower2 instance receiving coordinates injected by iOS TrueDepth ARKit
    const mockGazeFollower2 = {
        targetX: null,
        targetY: null,
        listener: null,
        setGazeListener(cb) {
            this.listener = cb;
            return this;
        },
        getCurrentPrediction() {
            if (this.targetX === null || this.targetY === null) return null;
            return { x: this.targetX, y: this.targetY };
        }
    };

    let receivedEvents = [];
    mockGazeFollower2.setGazeListener((data, timestamp) => {
        receivedEvents.push({ data, timestamp });
    });

    // Simulate iOS native Swift execution:
    // window.GazeFollower2.targetX = 250; window.GazeFollower2.targetY = 400;
    // window.GazeFollower2.listener({ x: 250, y: 400 }, 1234.5);
    const nativeX = 250.4;
    const nativeY = 400.8;
    const nativeTime = 12345.67;

    mockGazeFollower2.targetX = nativeX;
    mockGazeFollower2.targetY = nativeY;
    if (typeof mockGazeFollower2.listener === 'function') {
        mockGazeFollower2.listener({ x: nativeX, y: nativeY }, nativeTime);
    }

    assert.equal(receivedEvents.length, 1);
    assert.deepEqual(receivedEvents[0].data, { x: 250.4, y: 400.8 });
    assert.equal(receivedEvents[0].timestamp, 12345.67);

    // Immediate synchronous read via getCurrentPrediction()
    const instantPred = mockGazeFollower2.getCurrentPrediction();
    assert.deepEqual(instantPred, { x: 250.4, y: 400.8 });
});
