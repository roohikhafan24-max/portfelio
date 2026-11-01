// Particle portrait: samples a transparent image, springs particles to it. ~1 canvas, typed arrays, no deps.
// Magnet ring that follows the cursor once the portrait has scrolled away.
const RING_R = 56, RING_W = 13; // radius and thickness (px)
const BUCKET_COLORS = ['#5a6ea3', '#b4c6f5', '#ffffff', '#F2A900']; // shadow, mid, light, gold (RB logo)
export class Field {
  constructor(canvas, count) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.n = count;
    const n = count, F = Float32Array;
    this.x = new F(n); this.y = new F(n); this.vx = new F(n); this.vy = new F(n);
    this.tx = new F(n); this.ty = new F(n); this.sx = new F(n); this.sy = new F(n);
    this.delay = new F(n); this.fall = new F(n); this.ph = new F(n);
    this.su = new F(n); this.sv = new F(n);
    this.ranges = [0, 0, 0, 0, 0];
    this.mode = 0; this.modeStart = 0; this.time = 0; this.p = 0; this.show = 0;
    this.mx = -9999; this.my = -9999; this.ready = false;
    this.px = 0; this.py = 0; this.cx = 0; this.cy = 0; this.hasPtr = false; // last real cursor + smoothed ring centre
    this.magOn = false; this.magT = -10; this.magAmt = 0;
    this.ang = new F(n); this.rad = new F(n); this.rdel = new F(n);
  }
  load(img) {
    if (!img.naturalWidth) return; // image missing: skip the portrait instead of crashing
    const w = 260, h = Math.round(img.naturalHeight * w / img.naturalWidth);
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const c = o.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h).data; this.aspect = w / h;
    const px = []; for (let i = 0; i < w * h; i++) { if (d[i * 4 + 3] > 140) px.push(i); }
    const buckets = [[], [], [], []];
    let guard = 0;
    while (buckets[0].length + buckets[1].length + buckets[2].length + buckets[3].length < this.n && guard++ < this.n * 40) {
      const i = px[(Math.random() * px.length) | 0], r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const gold = r > 170 && g > 110 && b < 110 && r - b > 90;
      if (Math.random() > (gold ? 1 : 0.4 + L * 0.7)) continue;
      buckets[gold ? 3 : L < 0.3 ? 0 : L < 0.7 ? 1 : 2].push([((i % w) + Math.random()) / w, (Math.floor(i / w) + Math.random()) / h]);
    }
    let k = 0, total = 0; this.ranges[0] = 0;
    buckets.forEach((arr, bi) => { for (const [u, v] of arr) { this.su[k] = u; this.sv[k] = v; k++; } this.ranges[bi + 1] = k; });
    this.n = k; total = k;
    for (let i = 0; i < total; i++) { this.delay[i] = Math.random() * 0.9; this.fall[i] = 0.25 + Math.random() * 0.9; this.ph[i] = Math.random() * 6.28;
      this.ang[i] = Math.random() * 6.2832; this.rad[i] = RING_R + (Math.random() + Math.random() + Math.random() - 1.5) * RING_W; this.rdel[i] = Math.random() * 0.7; }
    this.ready = true; this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); this.dpr = dpr;
    this.w = innerWidth; this.h = innerHeight; this.cv.width = this.w * dpr; this.cv.height = this.h * dpr;
    if (!this.ready) return;
    const m = this.w < 760, H = Math.min(this.h * (m ? 0.6 : 0.8), this.w / this.aspect * 1.04), W = H * this.aspect, cx = this.w / 2, top = m ? 108 : this.h * 0.07;
    for (let i = 0; i < this.n; i++) {
      this.tx[i] = cx + (this.su[i] - 0.5) * W; this.ty[i] = top + this.sv[i] * H;
      this.sx[i] = Math.random() * this.w; this.sy[i] = Math.random() * this.h;
    }
  }
  reset() { this.mode = 0; this.time = 0; this.show = 0; this.x.fill(0); this.y.fill(0); this.vx.fill(0); this.vy.fill(0); }
  burst(cx, cy) {
    if (!this.ready) return;
    this.mode = 1; this.modeStart = this.time; this.show = 1;
    for (let i = 0; i < this.n; i++) { this.x[i] = cx + (Math.random() - 0.5) * 120; this.y[i] = cy + (Math.random() - 0.5) * 40; this.vx[i] = (Math.random() - 0.5) * 70; this.vy[i] = (Math.random() - 0.5) * 50; }
  }
  converge() {
    if (!this.ready) return; this.mode = 2; this.modeStart = this.time; }
  settle() { // jump straight to the finished portrait
    if (!this.ready) return;
    this.show = 1; this.mode = 2; this.modeStart = -10;
    for (let i = 0; i < this.n; i++) { this.x[i] = this.tx[i]; this.y[i] = this.ty[i]; this.vx[i] = this.vy[i] = 0; }
  }
  setPointer(x, y) { // remember the real cursor even when repulsion coords are reset
    if (!this.hasPtr) { this.cx = x; this.cy = y; this.hasPtr = true; }
    this.px = x; this.py = y;
  }
  setMagnet(on) { if (on === this.magOn) return; this.magOn = on; this.magT = this.time; }
  get ringActive() { return this.magOn || this.magAmt > 0.002; }
  step(dt) {
    this.time += dt; if (!this.mode || !this.ready) return;
    const t = this.time - this.modeStart, R = 110, R2 = R * R, mx = this.mx, my = this.my, T = this.time;
    const k0 = this.mode === 2 ? 0.045 : 0.012, d0 = this.mode === 2 ? 0.84 : 0.93;
    this.cx += (this.px - this.cx) * 0.2; this.cy += (this.py - this.cy) * 0.2; // ring centre trails the cursor a little
    this.magAmt += ((this.magOn ? 1 : 0) - this.magAmt) * 0.06;
    const cx = this.cx, cy = this.cy, mt = this.magT, on = this.magOn;
    for (let i = 0; i < this.n; i++) {
      // pulled into the ring (each dust grain with its own delay), released the same way when the magnet turns off
      const ring = this.mode === 2 && (on ? T - mt >= this.rdel[i] : T - mt < this.rdel[i]);
      let gx = this.sx[i], gy = this.sy[i], k = k0, damp = d0;
      if (ring) {
        const a = this.ang[i] + T * (0.45 + this.ph[i] * 0.03), r = this.rad[i] * (1 + 0.05 * Math.sin(T * 2 + this.ph[i]));
        gx = cx + Math.cos(a) * r; gy = cy + Math.sin(a) * r; k = 0.03; damp = 0.88;
      } else if (this.mode === 2 && t >= this.delay[i]) { gx = this.tx[i]; gy = this.ty[i]; }
      let vx = this.vx[i] + (gx - this.x[i]) * k, vy = this.vy[i] + (gy - this.y[i]) * k;
      if (!ring) {
        const dx = this.x[i] - mx, dy = this.y[i] - my, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1) { const d = Math.sqrt(d2), f = (1 - d / R) * 2.2; vx += dx / d * f; vy += dy / d * f; }
      }
      vx *= damp; vy *= damp; this.vx[i] = vx; this.vy[i] = vy; this.x[i] += vx; this.y[i] += vy;
    }
  }
  draw() {
    const c = this.ctx, dpr = this.dpr, ma = this.magAmt, a = this.show * (1 - this.p * (1 - ma)) * (1 - 0.3 * ma);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    if (a <= 0.01 || !this.mode || !this.ready) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = a;
    const q = this.p * this.p * this.h * (1 - ma), s = [1.6, 1.8, 2.1, 2.3].map(v => v * (1 - 0.25 * ma));
    for (let b = 0; b < 4; b++) {
      c.fillStyle = BUCKET_COLORS[b]; const z = s[b];
      for (let i = this.ranges[b]; i < this.ranges[b + 1]; i++) c.fillRect(this.x[i], this.y[i] + q * this.fall[i], z, z);
    }
    c.globalAlpha = 1;
  }
}
