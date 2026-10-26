// FaceAlignment.js - Extracts face and eye patches based on MediaPipe landmarks
export class FaceAlignment {
    constructor() {
        // Offscreen canvas for cropping (guarded for non-browser/test environments)
        this.canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        this.ctx = this.canvas ? this.canvas.getContext('2d', { willReadFrequently: true }) : null;
        
        // Reusable temporary canvas for resizing
        this.tmpCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        this.tmpCtx = this.tmpCanvas ? this.tmpCanvas.getContext('2d', { willReadFrequently: true }) : null;
        
        this.lip_vertices = [61, 91, 14, 178, 402, 324, 95];
        this.left_vertices = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7, 33];
        this.right_vertices = [362, 388, 384, 385, 386, 387, 388, 466, 263, 249, 380, 373, 374, 380, 381, 382, 362];
    }

    setFilterEnabled(enabled) {}

    resetFilter() {}

    calculateArea(pts) {
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
            let j = (i + 1) % pts.length;
            area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        }
        return Math.abs(area / 2);
    }

    // Process a video frame and return normalized NCHW tensors
    process(video, faceLandmarks, timestamp = null) {
        const imgW = video.videoWidth;
        const imgH = video.videoHeight;
        
        // Ensure canvas size matches video
        if (this.canvas.width !== imgW) {
            this.canvas.width = imgW;
            this.canvas.height = imgH;
        }
        
        // Draw video frame to canvas
        this.ctx.drawImage(video, 0, 0, imgW, imgH);
        
        // Scale landmarks to pixel coordinates
        const pts = faceLandmarks.map(lm => ({ x: lm.x * imgW, y: lm.y * imgH, z: lm.z * imgW }));

        const min_x = Math.min(...pts.map(p => p.x));
        const max_x = Math.max(...pts.map(p => p.x));
        const min_y = Math.min(...pts.map(p => p.y));
        const max_y = Math.max(...pts.map(p => p.y));

        const face_width = Math.abs(min_x - max_x);
        const face_height = Math.abs(min_y - max_y);
        const delta = (face_width - face_height) / 4;

        let f_x = Math.max(0, min_x + delta);
        let f_y = Math.max(0, min_y - delta);
        let f_w = Math.min(imgW - 1, max_x - delta) - f_x;
        let f_h = Math.min(imgH - 1, max_y + delta) - f_y;

        const scale = Math.abs(pts[362].x - pts[133].x) / 100;
        const x_padding = 20;

        // Left eye box
        const l_x0 = pts[33].x - x_padding * scale;
        const l_x1 = pts[133].x + x_padding * scale;
        const l_w = l_x1 - l_x0;
        const l_h = l_w * 0.75;
        const l_cy = (pts[33].y + pts[133].y) / 2;
        const l_x = l_x0;
        const l_y = l_cy - l_h * 0.6;

        // Right eye box
        const r_x0 = pts[362].x - x_padding * scale;
        const r_x1 = pts[263].x + x_padding * scale;
        const r_w = r_x1 - r_x0;
        const r_h = r_w * 0.75;
        const r_cy = (pts[362].y + pts[263].y) / 2;
        const r_x = r_x0;
        const r_y = r_cy - r_h * 0.6;

        const faceRect = [f_x, f_y, f_w, f_h];
        const leftRect = [l_x, l_y, l_w, l_h];
        const rightRect = [r_x, r_y, r_w, r_h];

        const clampRect = (r) => {
            let rx = Math.max(0, Math.min(Math.round(r[0]), imgW - 1));
            let ry = Math.max(0, Math.min(Math.round(r[1]), imgH - 1));
            let rw = Math.max(5, Math.min(Math.round(r[2]), imgW - rx));
            let rh = Math.max(5, Math.min(Math.round(r[3]), imgH - ry));
            return [rx, ry, rw, rh];
        };

        const [cf_x, cf_y, cf_w, cf_h] = clampRect(faceRect);
        const [cl_x, cl_y, cl_w, cl_h] = clampRect(leftRect);
        const [cr_x, cr_y, cr_w, cr_h] = clampRect(rightRect);

        // Rect tensor (normalized)
        const rect = new Float32Array([
            cf_w / imgW, cf_h / imgH, cf_x / imgW, cf_y / imgH,
            cl_w / imgW, cl_h / imgH, cl_x / imgW, cl_y / imgH,
            cr_w / imgW, cr_h / imgH, cr_x / imgW, cr_y / imgH
        ]);

        // Crop and convert to NCHW Float32Array (normalized 0-1)
        const faceTensor = this.cropAndResize(cf_x, cf_y, cf_w, cf_h, 224, 224, false);
        const leftTensor = this.cropAndResize(cl_x, cl_y, cl_w, cl_h, 112, 112, false);
        const rightTensor = this.cropAndResize(cr_x, cr_y, cr_w, cr_h, 112, 112, true); // Flipped horizontally

        return { 
            faceTensor, leftTensor, rightTensor, rectTensor: rect,
            landmarks: pts,
            rawRects: {
                face: [cf_x, cf_y, cf_w, cf_h],
                left: [cl_x, cl_y, cl_w, cl_h],
                right: [cr_x, cr_y, cr_w, cr_h]
            }
        };
    }

    cropAndResize(x, y, w, h, outW, outH, flipH) {
        // Reuse temporary canvas for resizing
        if (this.tmpCanvas.width !== outW) this.tmpCanvas.width = outW;
        if (this.tmpCanvas.height !== outH) this.tmpCanvas.height = outH;
        
        this.tmpCtx.save();
        this.tmpCtx.clearRect(0, 0, outW, outH);
        
        if (flipH) {
            this.tmpCtx.translate(outW, 0);
            this.tmpCtx.scale(-1, 1);
        }
        
        // Draw cropped and resized image
        this.tmpCtx.drawImage(this.canvas, x, y, w, h, 0, 0, outW, outH);
        this.tmpCtx.restore();
        
        const imgData = this.tmpCtx.getImageData(0, 0, outW, outH).data;
        const tensor = new Float32Array(3 * outW * outH);
        
        // Convert NHWC (RGBA bytes) to NCHW (RGB floats [0-1])
        const stride = outW * outH;
        for (let i = 0; i < stride; i++) {
            tensor[i] = imgData[i * 4] / 255.0;            // R
            tensor[stride + i] = imgData[i * 4 + 1] / 255.0; // G
            tensor[stride * 2 + i] = imgData[i * 4 + 2] / 255.0; // B
        }
        
        return tensor;
    }
}
