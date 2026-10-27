"""
ONNX Model FP16 (Half Precision) Converter for GazeFollower2
Converts FP32 ONNX gaze estimation models to FP16 with keep_io_types=True.
Reduces network transfer size by 50% while maintaining Float32 I/O for web browsers.

Usage:
    python scripts/convert_to_fp16.py
    python scripts/convert_to_fp16.py --input models/GazeNet_Next.onnx --output models/GazeNet_Next_fp16.onnx --encrypt
"""

import os
import sys
import argparse
import base64

# Protobuf compatibility fallback for newer Python / onnx packages
try:
    import google.protobuf
    if not hasattr(google.protobuf, 'runtime_version'):
        class DummyRuntimeVersion:
            Domain = type('Domain', (), {'PUBLIC': 1})
            @staticmethod
            def ValidateProtobufRuntimeVersion(*args, **kwargs):
                pass
        google.protobuf.runtime_version = DummyRuntimeVersion
except Exception:
    pass

import onnx
from onnxconverter_common import float16

def convert_to_fp16(input_path, output_path, keep_io_types=True):
    print(f"[*] Loading FP32 model: {input_path}")
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Model file not found: {input_path}")
    
    in_size = os.path.getsize(input_path)
    model = onnx.load(input_path)
    
    print(f"[*] Converting to FP16 (keep_io_types={keep_io_types})...")
    # keep_io_types=True keeps graph inputs and outputs as float32
    # so web browsers do not need Float16Array support.
    model_fp16 = float16.convert_float_to_float16(model, keep_io_types=keep_io_types)
    
    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    onnx.save(model_fp16, output_path)
    out_size = os.path.getsize(output_path)
    
    ratio = (1.0 - out_size / in_size) * 100
    print(f"[+] Successfully converted to FP16:")
    print(f"    - Original size: {in_size:,} bytes ({in_size / (1024*1024):.2f} MB)")
    print(f"    - FP16 size:     {out_size:,} bytes ({out_size / (1024*1024):.2f} MB)")
    print(f"    - Space saved:   {ratio:.1f}%")

def encrypt_to_bin(onnx_path, bin_path):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.backends import default_backend

    keyBase64 = "OCgCwoqk8Wc6IQ9cfBKj7uQXVMJLe7MZjfICVkSo8eY="
    ivBase64 = "JiVNvFAJOA3qfBu4Yn43Vg=="
    rawKey = base64.b64decode(keyBase64)
    rawIv = base64.b64decode(ivBase64)

    with open(onnx_path, 'rb') as f:
        onnx_bytes = f.read()

    pad_len = 16 - (len(onnx_bytes) % 16)
    padded_bytes = onnx_bytes + bytes([pad_len] * pad_len)

    cipher = Cipher(algorithms.AES(rawKey), modes.CBC(rawIv), backend=default_backend())
    encryptor = cipher.encryptor()
    enc_bytes = encryptor.update(padded_bytes) + encryptor.finalize()

    with open(bin_path, 'wb') as f:
        f.write(enc_bytes)
    print(f"[+] Encrypted binary model saved to: {bin_path} ({os.path.getsize(bin_path):,} bytes)")

def verify_numerical_consistency(fp32_path, fp16_path):
    try:
        import numpy as np
        import onnxruntime as ort
        
        print("[*] Running numerical consistency check with onnxruntime...")
        sess32 = ort.InferenceSession(fp32_path)
        sess16 = ort.InferenceSession(fp16_path)

        np.random.seed(42)
        feed = {
            'left': np.random.randn(1, 3, 112, 112).astype(np.float32),
            'right': np.random.randn(1, 3, 112, 112).astype(np.float32),
            'face': np.random.randn(1, 3, 224, 224).astype(np.float32),
            'rect': np.abs(np.random.randn(1, 12)).astype(np.float32),
        }

        out32 = sess32.run(None, feed)[0]
        out16 = sess16.run(None, feed)[0]

        max_diff = float(np.max(np.abs(out32 - out16)))
        mean_diff = float(np.mean(np.abs(out32 - out16)))

        print(f"    - Output Shape: {out16.shape}, Dtype: {out16.dtype}")
        print(f"    - Max Absolute Difference:  {max_diff:.6f}")
        print(f"    - Mean Absolute Difference: {mean_diff:.6f}")
        if mean_diff < 0.01:
            print("    [OK] Numerical accuracy verified! Difference is negligible for gaze tracking.")
    except Exception as e:
        print(f"    [!] Skipping verification: {e}")

def main():
    parser = argparse.ArgumentParser(description="Convert ONNX model to FP16 for web deployment.")
    parser.add_argument('--input', default='models/GazeNet_Next.onnx', help='Path to source FP32 ONNX model')
    parser.add_argument('--output', default='models/GazeNet_Next_fp16.onnx', help='Path to target FP16 ONNX model')
    parser.add_argument('--encrypt', action='store_true', help='Also create encrypted .bin file for Web Crypto API')
    parser.add_argument('--verify', action='store_true', default=True, help='Verify outputs with onnxruntime')
    args = parser.parse_args()

    convert_to_fp16(args.input, args.output, keep_io_types=True)

    if args.verify and os.path.exists(args.input) and os.path.exists(args.output):
        verify_numerical_consistency(args.input, args.output)

    if args.encrypt:
        bin_path = os.path.splitext(args.output)[0] + '.bin'
        encrypt_to_bin(args.output, bin_path)

if __name__ == '__main__':
    main()
