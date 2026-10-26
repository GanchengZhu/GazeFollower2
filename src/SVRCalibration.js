// SVRCalibration.js - Fits a regression model from ONNX 258-D features to Screen Coordinates
// Implements Ridge Regression to map features since OpenCV.js lacks SVM by default.

export class SVRCalibration {
    constructor(lambda = 0.1) {
        this.lambda = lambda;
        this.weightsX = [];
        this.weightsY = [];
    }

    train(featuresArray, labelsX, labelsY) {
        this.weightsX = this._trainRidge(featuresArray, labelsX);
        this.weightsY = this._trainRidge(featuresArray, labelsY);
    }

    predict(features) {
        if (!this.weightsX || !this.weightsX.length) return [0, 0];
        const x_b = [1.0, ...features];
        const predX = x_b.reduce((sum, val, i) => sum + val * this.weightsX[i], 0);
        const predY = x_b.reduce((sum, val, i) => sum + val * this.weightsY[i], 0);
        return [predX, predY];
    }

    _trainRidge(X, y) {
        const X_b = X.map(row => [1.0, ...row]); // Add bias
        const n = X_b.length;
        const d = X_b[0].length;

        const X_T = Array.from({length: d}, (_, i) => X_b.map(row => row[i]));
        
        let XtX = Array.from({length: d}, () => new Float64Array(d).fill(0));
        for (let i = 0; i < d; i++) {
            for (let j = 0; j < d; j++) {
                for (let k = 0; k < n; k++) XtX[i][j] += X_T[i][k] * X_b[k][j];
            }
            XtX[i][i] += this.lambda; // Ridge penalty
        }

        let Xty = new Float64Array(d).fill(0);
        for (let i = 0; i < d; i++) {
            for (let k = 0; k < n; k++) Xty[i] += X_T[i][k] * y[k];
        }

        return this._gaussianElimination(XtX, Xty);
    }

    _gaussianElimination(A, b) {
        const n = A.length;
        for (let i = 0; i < n; i++) {
            let maxEl = Math.abs(A[i][i]), maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
            }
            let tmp = A[maxRow]; A[maxRow] = A[i]; A[i] = tmp;
            let tmpB = b[maxRow]; b[maxRow] = b[i]; b[i] = tmpB;

            if (A[i][i] === 0) continue;
            for (let k = i + 1; k < n; k++) {
                let c = -A[k][i] / A[i][i];
                for (let j = i; j < n; j++) {
                    if (i === j) A[k][j] = 0;
                    else A[k][j] += c * A[i][j];
                }
                b[k] += c * b[i];
            }
        }
        let x = new Float64Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            if (A[i][i] === 0) { x[i] = 0; continue; }
            x[i] = b[i] / A[i][i];
            for (let k = i - 1; k >= 0; k--) b[k] -= A[k][i] * x[i];
        }
        return x;
    }
}
