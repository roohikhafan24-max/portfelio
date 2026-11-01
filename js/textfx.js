// Particle text.
//  1) Every registered heading turns into dust under the cursor (like dragging a hand through paint) and settles back.
//  2) The Intro/Projects pair morphs on scroll: Intro -> glowing orb -> travels along ROUTE -> Projects.
// One fixed canvas (#tx). Crisp DOM text is shown whenever nothing is happening; particles only exist while needed.
const CAP = 12000;                       // max particles per heading
const STOPS = [[0.06, '#ffffff'], [0.52, '#c3c8d4'], [1, '#5c6371']]; // same silver as --silver
// Orb route as fractions of the pinned stage (left-to-right layout; mirrored automatically in RTL).
// Start/end are not listed: they are the centre of the Intro and Projects headings.
const ROUTE = [[.46, .20], [.70, .22], [.86, .44], [.76, .70], [.56, .70], [.51, .52], [.65, .47], [.70, .64], [.62, .82], [.44, .89]];
// Scroll timeline (0..1 over the pinned scene): text->orb, travel, orb->text.
const PH = { a0: 0.10, a1: 0.34, t1: 0.72, b1: 0.92 };

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (a, b, x) => { x = cl((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const eio = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eoc = x => 1 - Math.pow(1 - x, 3);
const F = Float32Array;

export class TextFx {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.items = []; this.scene = null; this.route = null;
    this.mx = this.my = -9999; this.pdx = this.pdy = 0; this.pvx = this.pvy = 0;
    this.running = false; this.last = 0; this.t = 0; this._ca = -1;
    this._frame = this._frame.bind(this); this.resize();
  }
  resize() { const d = this.dpr = Math.min(window.devicePixelRatio || 1, 2); this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; this.invalidate(); }
  add(el, o = {}) {
    const it = { el, align: o.align || 'start', enabled: o.enabled || (() => true), dirty: true, n: 0, vis: 0, hid: false, energy: 0 };
    this.items.push(it); return it;
  }
  setScene(s) { this.scene = s; this.route = null; }
  invalidate() { for (const it of this.items) { it.dirty = true; it.n = 0; it.vis = 0; it.energy = 0; this._dom(it, false, true); } this.kick(); }
  pointer(x, y) { if (this.mx > -9000) { this.pdx += x - this.mx; this.pdy += y - this.my; } this.mx = x; this.my = y; this.kick(); }
  leave() { this.mx = this.my = -9999; this.kick(); }
  kick() { if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(this._frame); } }

  _dom(it, hide, instant) {
    if (!instant && it.hid === hide) return; it.hid = hide;
    const s = it.el.style; clearTimeout(it.tm);
    if (hide) { s.transition = 'none'; s.opacity = '0'; }
    else if (instant) { s.transition = ''; s.opacity = ''; }
    else { s.transition = 'opacity .22s'; s.opacity = ''; it.tm = setTimeout(() => { s.transition = ''; }, 320); }
  }

  // Rasterise the heading with the same font/wrapping as the DOM, then turn the pixels into particles.
  _build(it) {
    it.dirty = false; it.n = 0;
    const el = it.el, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const w = Math.ceil(r.width), h = Math.ceil(r.height); if (w < 4 || h < 4) return;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const c = o.getContext('2d', { willReadFrequently: true }), fs = parseFloat(cs.fontSize), rtl = cs.direction === 'rtl';
    c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; c.direction = cs.direction; c.fillStyle = '#fff'; c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    c.textAlign = it.align === 'center' ? 'center' : rtl ? 'right' : 'left';
    const x0 = it.align === 'center' ? w / 2 : rtl ? w : 0, LH = parseFloat(cs.lineHeight) || fs * 1.2;
    const m = c.measureText('Hg'), fa = m.fontBoundingBoxAscent ?? fs * 0.9, fd = m.fontBoundingBoxDescent ?? fs * 0.3;
    const lines = []; let cur = '';
    for (const wd of el.textContent.trim().split(/\s+/)) { const t = cur ? cur + ' ' + wd : wd; if (cur && c.measureText(t).width > w + 2) { lines.push(cur); cur = wd; } else cur = t; }
    lines.push(cur);
    let tw = 0; lines.forEach((ln, i) => { tw = Math.max(tw, c.measureText(ln).width); c.fillText(ln, x0, i * LH + (LH - (fa + fd)) / 2 + fa); });
    const d = c.getImageData(0, 0, w, h).data;
    const count = s => { let k = 0; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (d[((y | 0) * w + (x | 0)) * 4 + 3] > 100) k++; return k; };
    let s = 2, k = count(s); if (k > CAP) { s *= Math.sqrt(k / CAP); k = count(s); }
    const rx = new F(k), ry = new F(k); let n = 0;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (n < k && d[((y | 0) * w + (x | 0)) * 4 + 3] > 100) { rx[n] = x + (Math.random() - 0.5) * s * 0.5; ry[n] = y + (Math.random() - 0.5) * s * 0.5; n++; }
    Object.assign(it, { n, rx, ry, ox: new F(n), oy: new F(n), vx: new F(n), vy: new F(n), rb: new F(n).map(Math.random), rc: new F(n).map(() => Math.random() * 2 - 1),
      size: s * 1.14, R: cl(fs * 0.6, 70, 120), cxo: it.align === 'center' ? w / 2 : rtl ? w - tw / 2 : tw / 2, cyo: h / 2, energy: 0 });
  }

  // Cursor pushes dust away and drags it along its motion; a loose spring brings it home.
  _sim(it, f, px, py, hot) {
    const { n, ox, oy, vx, vy, rx, ry, R } = it, R2 = R * R, damp = Math.pow(0.88, f), K = 0.018 * f;
    const pvx = cl(this.pvx, -40, 40), pvy = cl(this.pvy, -40, 40); let mx = 0;
    for (let i = 0; i < n; i++) {
      let x = ox[i], y = oy[i], a = vx[i] - x * K, b = vy[i] - y * K;
      if (hot) {
        const dx = rx[i] + x - px, dy = ry[i] + y - py, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) { const dd = Math.sqrt(d2), q = 1 - dd / R; a += (dx / dd * q * q * 3 + pvx * q * 0.13) * f; b += (dy / dd * q * q * 3 + pvy * q * 0.13) * f; }
      }
      a *= damp; b *= damp; x += a * f; y += b * f; vx[i] = a; vy[i] = b; ox[i] = x; oy[i] = y;
      const e = Math.abs(x) + Math.abs(y) + Math.abs(a) + Math.abs(b); if (e > mx) mx = e;
    }
    it.energy = mx;
    if (!hot && mx < 0.25) { ox.fill(0); oy.fill(0); vx.fill(0); vy.fill(0); it.energy = 0; }
  }

  _scene() {
    const sc = this.scene, sr = sc.root.getBoundingClientRect(), st = sc.stage.getBoundingClientRect(), vh = innerHeight;
    const p = cl(-sr.top / Math.max(1, sr.height - st.height));
    const S = { p, st, inView: sr.bottom > -vh && sr.top < vh * 2, live: p > 0.0005 && p < 0.9995 && sr.top < vh && sr.bottom > 0,
      m: eio(cl((p - PH.a0) / (PH.a1 - PH.a0))), u: eio(cl((p - PH.a1) / (PH.t1 - PH.a1))), mb: eoc(cl((p - PH.t1) / (PH.b1 - PH.t1))) };
    const ca = 1 - sm(0.06, 0.26, p);
    if (Math.abs(ca - this._ca) > 0.002) { this._ca = ca; const s = sc.card.style; s.opacity = ca.toFixed(3); s.transform = `translateY(${(-24 * (1 - ca)).toFixed(1)}px)`; s.pointerEvents = ca < 0.2 ? 'none' : ''; }
    const rA = sc.A.el.getBoundingClientRect(), rB = sc.B.el.getBoundingClientRect();
    S.sx = rA.left + (sc.A.cxo ?? rA.width / 2); S.sy = rA.top + (sc.A.cyo ?? rA.height / 2);
    S.ex = rB.left + (sc.B.cxo ?? rB.width / 2); S.ey = rB.top + (sc.B.cyo ?? rB.height / 2);
    if (S.live || S.inView) this._buildRoute(S);
    if (this.route) {
      const R = this.route; let dx = S.sx, dy = S.sy;
      if (p >= PH.t1) { dx = S.ex; dy = S.ey; }
      else if (p > PH.a1) { const s = S.u * R.total; let lo = 0, hi = R.cum.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (R.cum[mid] <= s) lo = mid; else hi = mid; }
        const t = (s - R.cum[lo]) / Math.max(1e-6, R.cum[hi] - R.cum[lo]); dx = R.pts[lo].x + (R.pts[hi].x - R.pts[lo].x) * t; dy = R.pts[lo].y + (R.pts[hi].y - R.pts[lo].y) * t; }
      S.dx = dx; S.dy = dy;
    } else { S.dx = S.sx; S.dy = S.sy; }
    S.di = sm(0.55, 1, S.m) * (1 - sm(0, 0.55, S.mb));
    S.ta = sm(0, 0.06, S.u) * (1 - sm(0.1, 0.8, S.mb)) * (p > PH.a1 ? 1 : 0);
    return S;
  }

  _buildRoute(S) {
    const st = S.st, rtl = document.documentElement.dir === 'rtl', key = [S.sx | 0, S.sy | 0, S.ex | 0, S.ey | 0, st.left | 0, st.top | 0, st.width | 0, st.height | 0, rtl].join();
    if (this.route && this.route.key === key) return;
    const P = [{ x: S.sx, y: S.sy }, ...ROUTE.map(([x, y]) => ({ x: st.left + (rtl ? 1 - x : x) * st.width, y: st.top + y * st.height })), { x: S.ex, y: S.ey }], out = [], N = 18;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[Math.max(i - 1, 0)], b = P[i], c = P[i + 1], d = P[Math.min(i + 2, P.length - 1)];
      for (let k = 0; k < N; k++) { const t = k / N, t2 = t * t, t3 = t2 * t, q = (u0, u1, u2, u3) => 0.5 * (2 * u1 + (-u0 + u2) * t + (2 * u0 - 5 * u1 + 4 * u2 - u3) * t2 + (-u0 + 3 * u1 - 3 * u2 + u3) * t3); out.push({ x: q(a.x, b.x, c.x, d.x), y: q(a.y, b.y, c.y, d.y) }); }
    }
    out.push(P[P.length - 1]);
    const cum = new F(out.length); for (let i = 1; i < out.length; i++) cum[i] = cum[i - 1] + Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
    this.route = { key, pts: out, cum, total: cum[cum.length - 1] };
  }

  _draw(it, r, mode, mp, S) {
    const c = this.ctx, { n, rx, ry, ox, oy, rb, rc, size: sz } = it, L = r.left, T = r.top;
    const g = c.createLinearGradient(0, T, 0, T + r.height); for (const [o, col] of STOPS) g.addColorStop(o, col);
    c.globalAlpha = it.vis; c.fillStyle = g; c.beginPath();
    if (mode === 0) { for (let i = 0; i < n; i++) c.rect(L + rx[i] + ox[i], T + ry[i] + oy[i], sz, sz); }
    else {
      const tx = mode === 1 ? S.sx : S.ex, ty = mode === 1 ? S.sy : S.ey;
      for (let i = 0; i < n; i++) {
        const k = cl((mp - rb[i] * 0.5) / 0.5), wx = L + rx[i] + ox[i], wy = T + ry[i] + oy[i]; let e, s2;
        if (mode === 1) { if (k >= 1) continue; e = eio(k); s2 = sz * (1 - 0.8 * k * k); } else { if (k <= 0) continue; e = 1 - eoc(k); s2 = sz * cl(k * 5); }
        const sw = Math.sin(k * Math.PI) * rc[i] * 0.4;
        c.rect(wx + (tx - wx) * e - (ty - wy) * sw, wy + (ty - wy) * e + (tx - wx) * sw, s2, s2);
      }
    }
    c.fill(); c.globalAlpha = 1;
  }

  _trail(S) {
    const c = this.ctx, P = this.route.pts, last = Math.floor(S.u * (P.length - 1)); if (S.ta < 0.01 || last < 2) return;
    c.save(); c.lineCap = 'round'; c.lineWidth = 1.6;
    for (let j = 2; j <= last; j += 2) { const f = j / last; c.strokeStyle = `rgba(255,255,255,${(S.ta * 0.6 * f * f).toFixed(3)})`; c.beginPath(); c.moveTo(P[j - 2].x, P[j - 2].y); c.lineTo(P[j].x, P[j].y); c.stroke(); }
    c.restore();
  }

  _orb(x, y, di) {
    const c = this.ctx, r = (11 + 2.2 * Math.sin(this.t * 4)) * (0.35 + 0.65 * di); c.save();
    c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(x, y, 0, x, y, r * 6); g.addColorStop(0, `rgba(255,226,150,${0.55 * di})`); g.addColorStop(0.35, `rgba(242,169,0,${0.18 * di})`); g.addColorStop(1, 'rgba(242,169,0,0)');
    c.fillStyle = g; c.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    c.globalCompositeOperation = 'source-over';
    g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,255,255,${di})`); g.addColorStop(0.65, `rgba(255,255,255,${0.95 * di})`); g.addColorStop(1, 'rgba(255,246,220,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
    c.strokeStyle = `rgba(242,169,0,${0.7 * di})`; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * 1.9, 0, 6.2832); c.stroke();
    c.restore();
  }

  _frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016), f = dt * 60; this.last = now; this.t += dt;
    const c = this.ctx, d = this.dpr, sc = this.scene, vh = innerHeight, vw = innerWidth;
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, vw, vh);
    this.pvx = this.pvx * 0.7 + this.pdx * 0.3; this.pvy = this.pvy * 0.7 + this.pdy * 0.3; this.pdx = this.pdy = 0;
    let busy = false, S = null;
    if (sc) { S = this._scene(); if (S.live) busy = true; if (this.route && S.live) this._trail(S); }
    for (const it of this.items) {
      const r = it.el.getBoundingClientRect();
      const onScreen = r.width > 0 && r.bottom > -50 && r.top < vh + 50 && r.right > 0 && r.left < vw;
      let ok = onScreen && it.enabled();
      if (S && it === sc.A) ok = ok && S.p < PH.a0; else if (S && it === sc.B) ok = ok && S.p >= PH.b1;
      const hot = ok && this.mx > r.left - 40 && this.mx < r.right + 40 && this.my > r.top - 40 && this.my < r.bottom + 40;
      let mode = 0, mp = 0;
      if (S && it === sc.A) { mp = S.m; if (mp > 0.0005) mode = 1; } else if (S && it === sc.B) { mp = S.mb; if (mp < 0.9995) mode = 2; }
      if (it.dirty && (hot || mode || (S && (it === sc.A || it === sc.B) && S.inView))) this._build(it);
      if (!it.n) continue;
      if (hot || it.energy > 0.25) this._sim(it, f, this.mx - r.left, this.my - r.top, hot);
      const engaged = hot || mode !== 0 || it.energy > 0.25;
      if (engaged) { it.vis = 1; this._dom(it, true); busy = true; }
      else if (it.vis > 0) { it.vis = Math.max(0, it.vis - 0.12 * f); this._dom(it, false); busy = true; }
      if (it.vis > 0.001 && !(mode === 1 && mp >= 1) && !(mode === 2 && mp <= 0)) this._draw(it, r, mode, mp, S);
    }
    if (S && S.di > 0.003) this._orb(S.dx, S.dy, S.di);
    if (busy) requestAnimationFrame(this._frame); else this.running = false;
  }
}
