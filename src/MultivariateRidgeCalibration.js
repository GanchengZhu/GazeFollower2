// MultivariateRidgeCalibration.js
// Solves W = (X^T X + lambda*I)^-1 X^T Y for simultaneous X and Y coordinate mapping

export class MultivariateRidgeCalibration {
    constructor(lambda = 1.0) {
        this.lambda = (typeof lambda === 'number' && Number.isFinite(lambda) && lambda > 0) ? lambda : 1.0;
        this.weights = []; // Will be a D x 2 matrix
    }

    get alpha() {
        return this.lambda;
    }

    set alpha(val) {
        const parsed = parseFloat(val);
        if (Number.isFinite(parsed) && parsed > 0) {
            this.lambda = parsed;
        }
    }

    train(featuresArray, labelsX, labelsY) {
        const n = featuresArray.length;
        if (n === 0) return;
        
        // Construct Y matrix (N x 2)
        const Y = Array.from({length: n}, (_, i) => [labelsX[i], labelsY[i]]);
        
        // Construct X_b matrix (N x D+1) with bias
        const X_b = featuresArray.map(row => [1.0, ...row]);
        const d = X_b[0].length; // D+1

        // X_T is (D+1 x N)
        const X_T = Array.from({length: d}, (_, i) => X_b.map(row => row[i]));
        
        // XtX = X_T * X_b (D+1 x D+1)
        let XtX = Array.from({length: d}, () => new Float64Array(d).fill(0));
        for (let i = 0; i < d; i++) {
            for (let j = 0; j < d; j++) {
                for (let k = 0; k < n; k++) XtX[i][j] += X_T[i][k] * X_b[k][j];
            }
            if (i > 0) XtX[i][i] += this.lambda; // Ridge penalty, don't penalize bias
        }

        // XtY = X_T * Y (D+1 x 2)
        let XtY = Array.from({length: d}, () => new Float64Array(2).fill(0));
        for (let i = 0; i < d; i++) {
            for (let k = 0; k < n; k++) {
                XtY[i][0] += X_T[i][k] * Y[k][0];
                XtY[i][1] += X_T[i][k] * Y[k][1];
            }
        }

        // Solve XtX * W = XtY for W
        this.weights = this._solve(XtX, XtY);
    }

    predict(features) {
        if (!this.weights || this.weights.length === 0) return [0, 0];
        
        const x_b = [1.0, ...features];
        let predX = 0;
        let predY = 0;
        
        for (let i = 0; i < x_b.length; i++) {
            predX += x_b[i] * this.weights[i][0];
            predY += x_b[i] * this.weights[i][1];
        }
        
        return [predX, predY];
    }

    _solve(A, B) {
        // Gaussian Elimination to solve A * W = B
        // A is (d x d), B is (d x 2)
        const n = A.length;
        const cols = B[0].length;
        
        for (let i = 0; i < n; i++) {
            // Pivot
            let maxEl = Math.abs(A[i][i]), maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
            }
            
            // Swap rows in A and B
            let tmpA = A[maxRow]; A[maxRow] = A[i]; A[i] = tmpA;
            let tmpB = B[maxRow]; B[maxRow] = B[i]; B[i] = tmpB;

            if (A[i][i] === 0) continue; // Singular matrix handling
            
            for (let k = i + 1; k < n; k++) {
                let c = -A[k][i] / A[i][i];
                for (let j = i; j < n; j++) {
                    if (i === j) A[k][j] = 0;
                    else A[k][j] += c * A[i][j];
                }
                for (let j = 0; j < cols; j++) {
                    B[k][j] += c * B[i][j];
                }
            }
        }
        
        let W = Array.from({length: n}, () => new Float64Array(cols).fill(0));
        for (let i = n - 1; i >= 0; i--) {
            if (A[i][i] === 0) continue;
            
            for (let j = 0; j < cols; j++) {
                W[i][j] = B[i][j] / A[i][i];
                for (let k = i - 1; k >= 0; k--) {
                    B[k][j] -= A[k][i] * W[i][j];
                }
            }
        }
        return W;
    }
}
