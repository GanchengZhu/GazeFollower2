// HeuristicFilter.js - Removes sudden spikes from tracking

export class HeuristicFilter {
    /**
     * @param {number} [look_ahead=2] Number of look-ahead frames on each side of the center sample (window size = 2 * look_ahead + 1)
     */
    constructor(look_ahead = 2) {
        this.rawX = [];
        this.rawY = [];
        this.dummyX = NaN;
        this.dummyY = NaN;
        this._lookAhead = 2;
        this.setLookAhead(look_ahead);
    }

    get look_ahead() {
        return this._lookAhead;
    }

    set look_ahead(value) {
        this.setLookAhead(value);
    }

    get lookAhead() {
        return this._lookAhead;
    }

    set lookAhead(value) {
        this.setLookAhead(value);
    }

    /**
     * Dynamically configure the look_ahead parameter.
     * @param {number} [look_ahead=2] Positive integer >= 1
     * @returns {HeuristicFilter}
     */
    setLookAhead(look_ahead = 2) {
        const parsed = Number(look_ahead);
        if (Number.isFinite(parsed) && parsed >= 1) {
            const nextLookAhead = Math.max(1, Math.round(parsed));
            if (nextLookAhead !== this._lookAhead) {
                this._lookAhead = nextLookAhead;
                this.reset();
            }
        }
        return this;
    }

    /**
     * Get current look_ahead parameter value.
     * @returns {number}
     */
    getLookAhead() {
        return this._lookAhead;
    }

    /**
     * Reset internal sliding window buffers.
     * @returns {HeuristicFilter}
     */
    reset() {
        this.rawX = [];
        this.rawY = [];
        this.dummyX = NaN;
        this.dummyY = NaN;
        return this;
    }

    /**
     * Filter 2D gaze coordinates (x, y).
     * @param {number|number[]} x X coordinate, or [x, y] array
     * @param {number} [y] Y coordinate
     * @returns {[number, number]} Filtered [x, y] coordinates
     */
    filterValues(x, y) {
        if (Array.isArray(x) && y === undefined) {
            [x, y] = x;
        }
        this.rawX = this.doFilter(true, x);
        this.rawY = this.doFilter(false, y);
        if (this.rawX.length >= this._lookAhead * 2) {
            return (Number.isNaN(this.dummyX) && Number.isNaN(this.dummyY)) ? [x, y] : [this.dummyX, this.dummyY];
        }
        return [x, y];
    }

    /**
     * Python-compatible alias for filtering [x, y] array.
     * @param {[number, number]} values
     * @returns {[number, number]}
     */
    filter_values(values) {
        if (!Array.isArray(values) || values.length < 2) {
            throw new Error("HeuristicFilter.filter_values requires an array of two values [x, y]");
        }
        return this.filterValues(values[0], values[1]);
    }

    doFilter(isX, element) {
        let raw = isX ? this.rawX : this.rawY;
        raw.push(element);
        const windowSize = this._lookAhead * 2 + 1;
        while (raw.length > windowSize) {
            raw.shift();
        }
        if (raw.length === windowSize) {
            for (let nextVal = 1; nextVal <= this._lookAhead; nextVal++) {
                const c1 = raw[this._lookAhead - nextVal] < raw[this._lookAhead] && raw[this._lookAhead] > raw[this._lookAhead + nextVal];
                const c2 = raw[this._lookAhead - nextVal] > raw[this._lookAhead] && raw[this._lookAhead] < raw[this._lookAhead + nextVal];
                if (c1 || c2) {
                    const prevDist = Math.abs(raw[this._lookAhead - nextVal] - raw[this._lookAhead]);
                    const nextDist = Math.abs(raw[this._lookAhead + nextVal] - raw[this._lookAhead]);
                    raw[this._lookAhead] = (prevDist < nextDist) ? raw[this._lookAhead - nextVal] : raw[this._lookAhead + nextVal];
                }
            }
            if (isX) this.dummyX = raw[this._lookAhead];
            else this.dummyY = raw[this._lookAhead];
            raw.shift();
        }
        return raw;
    }
}

