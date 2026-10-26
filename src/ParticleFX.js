// ParticleFX.js - Particle burst & circle shattering animation

export class ParticleFX {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.rings = [];
        this.animId = null;
        this.initCanvas();
    }

    initCanvas() {
        if (typeof document === 'undefined') return;
        this.canvas = document.getElementById('gf-fx-canvas');
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'gf-fx-canvas';
            Object.assign(this.canvas.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: '9999999'
            });
            document.body.appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(dpr, dpr);
        }
    }

    /**
     * Trigger a cute, bouncy particle explosion and shockwave at (x, y)
     * @param {number} x - Target center X (px)
     * @param {number} y - Target center Y (px)
     * @param {object} options - Configuration options
     */
    burst(x, y, options = {}) {
        if (!this.canvas || !this.ctx) this.initCanvas();

        const count = options.count || 18;
        const baseColor = options.color || '#165dff';
        const colors = options.colors || [
            '#165dff', '#4080ff', '#69b1ff', '#00b42a', '#14c9c9', '#ffffff'
        ];

        // 1. Dual subtle ripple rings (tactile enterprise feedback)
        this.rings.push({
            x, y,
            radius: options.initialRadius || 8,
            maxRadius: options.ringMax || 54,
            width: 3.0,
            color: baseColor,
            alpha: 0.85,
            growth: 3.2
        });
        this.rings.push({
            x, y,
            radius: (options.initialRadius || 8) * 0.5,
            maxRadius: (options.ringMax || 54) * 0.75,
            width: 1.8,
            color: '#4080ff',
            alpha: 0.6,
            growth: 2.2
        });

        // 2. Subtle, elegant micro-dots
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
            const speed = 3.0 + Math.random() * 6.0;
            const size = 2.5 + Math.random() * 3.0;
            const color = baseColor ? (Math.random() > 0.4 ? baseColor : (Math.random() > 0.5 ? '#4080ff' : '#ffffff')) : colors[Math.floor(Math.random() * colors.length)];
            
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                drag: 0.92 + Math.random() * 0.03,
                gravity: 0.15 + Math.random() * 0.08,
                size,
                initialSize: size,
                color,
                alpha: 0.95,
                decay: 0.022 + Math.random() * 0.015,
                rotation: 0,
                rotSpeed: 0,
                shape: 'circle'
            });
        }

        if (!this.animId) {
            this.loop();
        }
    }

    loop() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // Update & draw shockwave rings
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.radius += r.growth;
            r.alpha -= 0.045;
            r.width *= 0.94;

            if (r.alpha <= 0 || r.radius >= r.maxRadius) {
                this.rings.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = r.color;
            this.ctx.globalAlpha = Math.max(0, r.alpha);
            this.ctx.lineWidth = Math.max(0.5, r.width);
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = r.color;
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Update & draw cute bouncy particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= p.drag;
            p.vy *= p.drag;
            p.vy += p.gravity;
            p.alpha -= p.decay;
            p.size = Math.max(0, p.initialSize * (p.alpha));
            p.rotation += p.rotSpeed;

            if (p.alpha <= 0 || p.size <= 0.3) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.globalAlpha = Math.max(0, p.alpha);
            this.ctx.fillStyle = p.color;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = p.color;

            if (p.shape === 'circle') {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            } else if (p.shape === 'spark') {
                // Diamond sparkle
                this.ctx.beginPath();
                this.ctx.moveTo(0, -p.size * 1.5);
                this.ctx.lineTo(p.size * 0.6, 0);
                this.ctx.lineTo(0, p.size * 1.5);
                this.ctx.lineTo(-p.size * 0.6, 0);
                this.ctx.closePath();
                this.ctx.fill();
            } else if (p.shape === 'star') {
                // 4-point cute star
                this.ctx.beginPath();
                const outer = p.size * 1.4;
                const inner = p.size * 0.45;
                for (let s = 0; s < 8; s++) {
                    const r = s % 2 === 0 ? outer : inner;
                    const a = (s * Math.PI) / 4;
                    const sx = Math.cos(a) * r;
                    const sy = Math.sin(a) * r;
                    if (s === 0) this.ctx.moveTo(sx, sy);
                    else this.ctx.lineTo(sx, sy);
                }
                this.ctx.closePath();
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        if (this.particles.length > 0 || this.rings.length > 0) {
            this.animId = requestAnimationFrame(() => this.loop());
        } else {
            this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            this.animId = null;
        }
    }
}

export const particleFX = new ParticleFX();
if (typeof window !== 'undefined') {
    window.particleFX = particleFX;
}
