import test from 'node:test';
import assert from 'node:assert/strict';
import { FaceAlignment } from '../src/FaceAlignment.js';

test('FaceAlignment - Safe instantiation without browser DOM', () => {
    // In Node.js, document is undefined. FaceAlignment should not throw ReferenceError.
    assert.doesNotThrow(() => {
        const fa = new FaceAlignment();
        assert.ok(fa);
        assert.equal(fa.canvas, null);
    });
});

test('FaceAlignment - Polygon area calculation (Shoelace formula)', () => {
    const fa = new FaceAlignment();
    // 100x100 square
    const square = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
    ];
    const area = fa.calculateArea(square);
    assert.equal(area, 10000);

    // Triangle of base 50, height 40 -> area 1000
    const triangle = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 25, y: 40 }
    ];
    assert.equal(fa.calculateArea(triangle), 1000);
});

test('FaceAlignment - Landmark vertex indices defined', () => {
    const fa = new FaceAlignment();
    assert.ok(Array.isArray(fa.lip_vertices) && fa.lip_vertices.length > 0);
    assert.ok(Array.isArray(fa.left_vertices) && fa.left_vertices.length > 0);
    assert.ok(Array.isArray(fa.right_vertices) && fa.right_vertices.length > 0);

    // Common MediaPipe landmark indices
    assert.ok(fa.left_vertices.includes(33));  // Outer corner of left eye
    assert.ok(fa.right_vertices.includes(362)); // Outer corner of right eye
});
