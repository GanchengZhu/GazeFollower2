// OneEuroFilter.js - 1-Euro Filter for landmark coordinates and bounding box smoothing

export class LowPassFilter {
    constructor(alpha = 1.0) {
        this.a = alpha;
        this.y = null;
        this.s = null;
        this.initialized = false;
    }

    filter(value, alpha = null) {
        const a = (alpha === null || alpha === undefined) ? this.a : alpha;
        let result;

        // Scalar number
        if (typeof value === 'number') {
            if (this.initialized) {
                result = a * value + (1.0 - a) * this.s;
            } else {
                result = value;
                this.initialized = true;
            }
            this.y = value;
            this.s = result;
            return result;
        }

        // Array (numbers or objects)
        if (Array.isArray(value)) {
            if (!this.initialized) {
                this.initialized = true;
                this.y = JSON.parse(JSON.stringify(value));
                this.s = JSON.parse(JSON.stringify(value));
                return JSON.parse(JSON.stringify(value));
            }

            result = new Array(value.length);
            for (let i = 0; i < value.length; i++) {
                const v = value[i];
                const prev = this.s[i];
                if (typeof v === 'number') {
                    const ai = (typeof a === 'number') ? a : (Array.isArray(a) ? a[i] : 1.0);
                    result[i] = ai * v + (1.0 - ai) * prev;
                } else if (v && typeof v === 'object') {
                    const obj = {};
                    const alphaObj = (Array.isArray(a) && a[i] && typeof a[i] === 'object') ? a[i] : null;
                    const alphaNum = (typeof a === 'number') ? a : (Array.isArray(a) && typeof a[i] === 'number' ? a[i] : 1.0);
                    for (const k of Object.keys(v)) {
                        const ak = (alphaObj && typeof alphaObj[k] === 'number') ? alphaObj[k] : alphaNum;
                        obj[k] = ak * v[k] + (1.0 - ak) * prev[k];
                    }
                    result[i] = obj;
                } else {
                    result[i] = v;
                }
            }
            this.y = JSON.parse(JSON.stringify(value));
            this.s = JSON.parse(JSON.stringify(result));
            return result;
        }

        // Single Object (e.g. { x, y, z })
        if (value && typeof value === 'object') {
            if (!this.initialized) {
                this.initialized = true;
                this.y = { ...value };
                this.s = { ...value };
                return { ...value };
            }
            result = {};
            for (const k of Object.keys(value)) {
                const ak = (a && typeof a === 'object' && typeof a[k] === 'number') ? a[k] : (typeof a === 'number' ? a : 1.0);
                result[k] = ak * value[k] + (1.0 - ak) * this.s[k];
            }
            this.y = { ...value };
            this.s = { ...result };
            return result;
        }

        return value;
    }

    reset() {
        this.initialized = false;
        this.y = null;
        this.s = null;
    }
}

export class OneEuroFilter {
    constructor(freq = 30.0, minCutoff = 1.0, beta = 0.01, dCutoff = 1.0) {
        this.freq = freq;
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;

        this.xFilter = new LowPassFilter();
        this.dxFilter = new LowPassFilter();
        this.lastTime = null;
    }

    _alpha(cutoff) {
        const te = 1.0 / Math.max(this.freq, 1e-5);
        if (typeof cutoff === 'number') {
            const tau = 1.0 / (2.0 * Math.PI * Math.max(cutoff, 1e-5));
            return 1.0 / (1.0 + tau / te);
        }
        if (Array.isArray(cutoff)) {
            return cutoff.map(c => this._alpha(c));
        }
        if (cutoff && typeof cutoff === 'object') {
            const res = {};
            for (const k of Object.keys(cutoff)) {
                res[k] = this._alpha(cutoff[k]);
            }
            return res;
        }
        return 1.0;
    }

    _zerosLike(v) {
        if (typeof v === 'number') return 0;
        if (Array.isArray(v)) {
            return v.map(item => this._zerosLike(item));
        }
        if (v && typeof v === 'object') {
            const res = {};
            for (const k of Object.keys(v)) {
                res[k] = 0;
            }
            return res;
        }
        return 0;
    }

    _diff(current, prev, freq) {
        if (typeof current === 'number') {
            return (current - prev) * freq;
        }
        if (Array.isArray(current)) {
            return current.map((c, i) => this._diff(c, prev ? prev[i] : c, freq));
        }
        if (current && typeof current === 'object') {
            const res = {};
            for (const k of Object.keys(current)) {
                const prevVal = (prev && prev[k] !== undefined) ? prev[k] : current[k];
                res[k] = (current[k] - prevVal) * freq;
            }
            return res;
        }
        return 0;
    }

    _calcCutoff(edx) {
        if (typeof edx === 'number') {
            return this.minCutoff + this.beta * Math.abs(edx);
        }
        if (Array.isArray(edx)) {
            return edx.map(item => this._calcCutoff(item));
        }
        if (edx && typeof edx === 'object') {
            const res = {};
            for (const k of Object.keys(edx)) {
                res[k] = this.minCutoff + this.beta * Math.abs(edx[k]);
            }
            return res;
        }
        return this.minCutoff;
    }

    filter(x, timestamp = null) {
        if (timestamp !== null && this.lastTime !== null) {
            let dt = (timestamp - this.lastTime);
            // Detect timestamp scale: if > 1e11 ns, > 1e5 us, > 50 ms
            if (dt > 1e11) {
                dt /= 1e9;
            } else if (dt > 1e5) {
                dt /= 1e6;
            } else if (dt > 50) {
                dt /= 1000.0;
            }
            if (dt > 0 && dt < 10) {
                this.freq = 1.0 / dt;
            }
        }
        this.lastTime = timestamp;

        let dx;
        if (!this.xFilter.initialized) {
            dx = this._zerosLike(x);
        } else {
            dx = this._diff(x, this.xFilter.y, this.freq);
        }

        const alphaD = this._alpha(this.dCutoff);
        const edx = this.dxFilter.filter(dx, alphaD);

        const cutoff = this._calcCutoff(edx);
        const alpha = this._alpha(cutoff);

        return this.xFilter.filter(x, alpha);
    }

    reset() {
        this.xFilter.reset();
        this.dxFilter.reset();
        this.lastTime = null;
    }
}
