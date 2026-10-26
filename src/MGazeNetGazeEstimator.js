// MGazeNetGazeEstimator.js - ONNX Runtime Web wrapper

export class MGazeNetGazeEstimator {
    constructor(modelPath) {
        this.modelPath = modelPath;
        this.session = null;
    }

    async init(progressCallback = null) {
        if (progressCallback) progressCallback(0.1); // Initializing

        console.log("Fetching neural model:", this.modelPath);
        const response = await fetch(this.modelPath);
        if (!response.ok) throw new Error(`Failed to fetch model: ${this.modelPath}`);
        
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 8006908;
        let loadedBytes = 0;
        
        const reader = response.body.getReader();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loadedBytes += value.length;
            if (progressCallback) {
                // We map download to 10% -> 70% of total progress
                const percent = 0.1 + (loadedBytes / totalBytes) * 0.6;
                progressCallback(percent);
            }
        }
        
        // Combine chunks into a single ArrayBuffer
        const encryptedBuffer = new Uint8Array(loadedBytes);
        let offset = 0;
        for (const chunk of chunks) {
            encryptedBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        if (progressCallback) progressCallback(0.75);
        
        let modelData;
        const isEncrypted = this.modelPath.endsWith('.bin') || (!this.modelPath.endsWith('.onnx'));
        
        if (isEncrypted) {
            try {
                // Obfuscated key/IV to deter casual inspection
                const keyBase64 = "OCgCwoqk8Wc6IQ9cfBKj7uQXVMJLe7MZjfICVkSo8eY=";
                const ivBase64 = "JiVNvFAJOA3qfBu4Yn43Vg==";
                
                const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
                const rawIv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
                
                const cryptoKey = await crypto.subtle.importKey(
                    "raw", rawKey, { name: "AES-CBC" }, false, ["decrypt"]
                );
                
                modelData = await crypto.subtle.decrypt(
                    { name: "AES-CBC", iv: rawIv }, cryptoKey, encryptedBuffer
                );
            } catch (decErr) {
                console.warn("Model decryption failed, attempting raw model buffer:", decErr);
                modelData = encryptedBuffer.buffer;
            }
        } else {
            modelData = encryptedBuffer.buffer;
        }

        if (progressCallback) progressCallback(0.9); // Loading into ONNX
        
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                         (navigator.userAgent.includes("Mac") && "ontouchend" in document);

        // Safari has experimental/buggy WebGPU and WebGL ONNX implementations; wasm is standard
        const eps = isSafari ? ['wasm', 'webgl'] : ['webgpu', 'webnn', 'webgl', 'wasm'];

        try {
            this.session = await ort.InferenceSession.create(modelData, {
                executionProviders: eps
            });
        } catch (e) {
            console.warn("Primary execution providers failed, falling back to WASM:", e);
            this.session = await ort.InferenceSession.create(modelData, {
                executionProviders: ['wasm']
            });
        }
        
        if (progressCallback) progressCallback(1.0); // Done
    }

    async detect(faceTensor, leftTensor, rightTensor, rectTensor) {
        if (!this.session) return null;

        const feeds = {};
        
        if (this.session.inputNames.includes('face')) {
            feeds['face'] = new ort.Tensor('float32', faceTensor, [1, 3, 224, 224]);
        }
        if (this.session.inputNames.includes('left')) {
            feeds['left'] = new ort.Tensor('float32', leftTensor, [1, 3, 112, 112]);
        } else if (this.session.inputNames.includes('left_eye')) {
            feeds['left_eye'] = new ort.Tensor('float32', leftTensor, [1, 3, 112, 112]);
        }
        if (this.session.inputNames.includes('right')) {
            feeds['right'] = new ort.Tensor('float32', rightTensor, [1, 3, 112, 112]);
        } else if (this.session.inputNames.includes('right_eye')) {
            feeds['right_eye'] = new ort.Tensor('float32', rightTensor, [1, 3, 112, 112]);
        }
        if (this.session.inputNames.includes('rect')) {
            feeds['rect'] = new ort.Tensor('float32', rectTensor, [1, 12]);
        }
        
        try {
            const results = await this.session.run(feeds);
            const outputName = this.session.outputNames[0];
            const output = results[outputName].data; // Float32Array of 258 elements
            
            // output is the 258-D feature array
            return Array.from(output);
        } catch (e) {
            console.error("ONNX Inference Error:", e);
            return null;
        }
    }
}
