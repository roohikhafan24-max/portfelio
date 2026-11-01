// Intro timeline (~6.6s). DOM state is a pure function of t; the particle field is stepped on a fixed 60 Hz clock.
const POOL = 'ROOHOLAH', WORD = 'PORTFOLIO', T_END = 6.6, DT = 1 / 60;
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const eOC = x => 1 - Math.pow(1 - cl(x), 3);
const eOB = x => { x = cl(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const eBounce = x => { x = cl(x); const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
const rnd = (i, f) => { const s = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453; return s - Math.floor(s); };

export function createIntro({ word, dot, bang, glow, sub, nav, hint, skip, field, onDone }) {
  const letters = [...WORD].map((ch, i) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; word.appendChild(s); return s; });
  const rot = letters.map((_, i) => [(rnd(i, 1) - 0.5) * 900, (rnd(i, 2) - 0.5) * 900, (rnd(i, 3) - 0.5) * 540]);
  let G = {}, simT = 0, fired = { burst: false, conv: false }, done = false;
  function measure() {
    const r = word.getBoundingClientRect(), D = Math.max(12, innerWidth * 0.016);
    G = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height, D, base: r.top + r.height * 0.82 };
    dot.style.width = dot.style.height = D + 'px'; bang.style.width = D * 0.9 + 'px';
  }
  function events(t) {
    if (!fired.burst && t >= 3.9) { fired.burst = true; field.burst(G.cx, G.cy); }
    if (!fired.conv && t >= 4.5) { fired.conv = true; field.converge(); }
  }
  function tick(t) {
    const { cx, cy, h, D, base } = G;
    // dot falls, then grows into "!"
    const u = cl(t / 0.9), y = lerp(-D * 2, base - D, eBounce(u)), out = 1 - cl((t - 1.3) / 0.25);
    dot.style.opacity = t > 0 ? out : 0; dot.style.transform = `translate(${cx - D / 2}px,${y}px) scale(${lerp(1, 0.2, 1 - out)})`;
    const sh = h * 0.5 * eOB((t - 0.95) / 0.35);
    bang.style.opacity = out * (t > 0.95 ? 1 : 0); bang.style.height = Math.max(0, sh) + 'px';
    bang.style.transform = `translate(${cx - D * 0.45}px,${base - D * 1.6 - Math.max(0, sh)}px)`;
    glow.style.opacity = cl(0.25 + t / 2);
    // letters tumble in, then the name-letters resolve into PORTFOLIO
    letters.forEach((el, i) => {
      const s = 1.35 + i * 0.07, k = (t - s) / 1.0, e = eOB(k), r = 1 - eOC(k);
      el.style.opacity = cl(k * 8);
      el.style.transform = k >= 1 ? 'none' : `translate3d(0,${-(1 - e) * innerHeight * 0.8}px,0) rotateX(${rot[i][0] * r}deg) rotateY(${rot[i][1] * r}deg) rotateZ(${rot[i][2] * r}deg)`;
      const res = 2.4 + i * 0.13;
      el.textContent = t >= res ? WORD[i] : POOL[Math.floor(rnd(i, Math.floor(t * 14)) * POOL.length)];
    });
    const sa = cl((t - 3.7) / 0.5); sub.style.opacity = sa; sub.style.transform = `translateY(${(1 - sa) * 12}px)`;
    nav.style.opacity = cl((t - 4.0) / 0.5); hint.style.opacity = cl((t - 6.2) / 0.4); skip.style.opacity = 1 - cl((t - 5.8) / 0.4);
  }
  function advance(t) {
    while (simT + DT <= t) { simT += DT; events(simT); field.step(DT); }
    tick(Math.min(t, T_END));
    if (t >= T_END && !done) finish();
  }
  function finish() {
    if (done) return; done = true;
    if (!fired.burst) { field.settle(); } else { field.mode = 2; field.modeStart = -10; }
    tick(T_END); letters.forEach(el => { el.style.transform = 'none'; el.style.opacity = 1; });
    dot.style.display = bang.style.display = 'none'; skip.style.display = 'none'; onDone();
  }
  function seek(t) { field.reset(); simT = 0; fired = { burst: false, conv: false }; done = false; dot.style.display = bang.style.display = ''; advance(t); }
  measure();
  return { advance, finish, seek, measure, T_END };
}
