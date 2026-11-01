import { C, LINKS } from './content.js';
import { Field } from './particles.js';
import { createIntro } from './intro.js';
import { TextFx } from './textfx.js';
const $ = id => document.getElementById(id), root = document.documentElement;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
let lang = localStorage.getItem('lang') || ((navigator.language || '').startsWith('en') ? 'en' : 'fa');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches; // real mouse: cursor magnet + paint-like text
if (reduce) root.classList.add('calm');

const tx = reduce ? null : new TextFx($('tx'));
function render() {
  const t = C[lang]; root.lang = lang; root.dir = lang === 'fa' ? 'rtl' : 'ltr'; document.title = `${t.brand} · ${t.name}`;
  $('brand').textContent = t.name; $('lang').textContent = t.lang; $('skip').textContent = t.skip; $('hint').textContent = t.scroll;
  $('sub').innerHTML = `<b>${t.name}</b> ${t.sub}`;
  for (const k in t.nav) $('n-' + k).textContent = t.nav[k];
  $('aboutH').textContent = t.aboutH; $('aboutP').textContent = t.about; $('aboutNote').textContent = t.aboutNote;
  $('resume').firstChild.textContent = t.resume + ' ';
  $('projectsH').textContent = t.projectsH; $('skillsH').textContent = t.skillsH; $('contactH').textContent = t.contactH; $('contactP').textContent = t.contactP;
  $('projectsList').innerHTML = t.projects.map(p => `<article class="pc rv"><h3>${p.t}</h3><p>${p.d}</p><ul class="tags">${p.tags.map(x => `<li>${x}</li>`).join('')}</ul></article>`).join('');
  $('skillsList').innerHTML = t.skills.map(g => `<div class="sk rv"><h3>${g.g}</h3><ul>${g.i.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('');
  $('contactList').innerHTML = ['email', 'instagram', 'telegram', 'github'].map(k => `<a class="rv" href="${LINKS[k].href}" target="_blank" rel="noopener"><span>${LINKS[k].text}</span><i aria-hidden="true">↗</i></a>`).join('');
  $('foot').textContent = t.foot; $('resume').href = LINKS.resume;
  observe();
  if (tx) tx.invalidate(); // headings changed: rebuild their particles
}
let io;
function observe() {
  io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.rv:not(.in)').forEach(el => io.observe(el));
}
render();
$('lang').onclick = () => { lang = lang === 'fa' ? 'en' : 'fa'; localStorage.setItem('lang', lang); render(); };
document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.pc'); if (c) { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', e.clientX - r.left + 'px'); c.style.setProperty('--my', e.clientY - r.top + 'px'); } });

// ---- particles + intro ----
const field = new Field($('fx'), innerWidth < 700 ? 4200 : 9000);
let intro, introActive = true, running = false, last = 0, acc = 0, startT = 0, activeUntil = 0;
const wake = () => { activeUntil = performance.now() + 2500; };
function frame(now) {
  if (document.hidden) { running = false; return; }
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (introActive) intro.advance((now - startT) / 1000);
  else if (field.p < 1 || field.ringActive) { acc += dt; while (acc >= 1 / 60) { field.step(1 / 60); acc -= 1 / 60; } }
  $('fx').classList.toggle('top', field.magAmt > 0.05); // ring floats above the page while it follows the cursor
  field.draw();
  if (!introActive && !field.ringActive && (field.p >= 1 || now > activeUntil)) { running = false; return; }
  requestAnimationFrame(frame);
}
function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
function onScroll() {
  const p = clamp(scrollY / (innerHeight * 0.9)); field.p = p; root.style.setProperty('--p', p.toFixed(3));
  $('nav').classList.toggle('solid', scrollY > 40);
  if (fine) { if (!field.magOn && field.hasPtr && p > 0.22) field.setMagnet(true); else if (field.magOn && p < 0.12) field.setMagnet(false); }
  if (!introActive && (p < 1 || field.ringActive)) { wake(); kick(); }
  if (tx) tx.kick();
}
function done() {
  introActive = false; root.classList.remove('lock'); onScroll();
  try { sessionStorage.setItem('seen', '1'); } catch (e) {}
  wake(); field.draw(); kick();
}
function fallback(e) {
  console.error('Portfolio intro failed:', e);
  root.classList.remove('lock'); root.classList.add('fail');
  const w = $('word'); if (w && !w.children.length) w.innerHTML = [...'PORTFOLIO'].map(c => `<span class="ch">${c}</span>`).join('');
}
async function boot() {
  try { await start(); } catch (e) { fallback(e); }
}
async function start() {
  const img = new Image(); img.src = 'assets/avatar.webp';
  await Promise.race([Promise.all([document.fonts.load('900 100px Kalameh'), img.decode().catch(() => {})]), new Promise(r => setTimeout(r, 2500))]);
  field.load(img);
  if (tx) {
    const A = tx.add($('aboutH')), B = tx.add($('projectsH'));
    tx.setScene({ root: $('about'), stage: $('stage'), card: $('aboutCard'), A, B });
    tx.add($('skillsH')); tx.add($('contactH'));
    tx.add($('word'), { align: 'center', enabled: () => !introActive && scrollY < 40 });
    tx.kick();
  }
  intro = createIntro({ word: $('word'), dot: $('dot'), bang: $('bang'), glow: $('glow'), sub: $('sub'), nav: $('nav'), hint: $('hint'), skip: $('skip'), field, onDone: done });
  addEventListener('resize', () => { if (tx) tx.resize(); field.resize(); intro.measure(); onScroll(); if (!introActive) { field.draw(); } });
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    field.mx = e.clientX; field.my = e.clientY;
    if (fine) { field.setPointer(e.clientX, e.clientY); if (!field.magOn && field.p > 0.22 && !introActive) field.setMagnet(true); }
    if (!introActive && (field.p < 1 || field.ringActive)) { wake(); kick(); }
    if (tx) tx.pointer(e.clientX, e.clientY);
  });
  document.addEventListener('pointerleave', () => { field.mx = field.my = -9999; if (tx) tx.leave(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { wake(); kick(); } });
  addEventListener('scroll', onScroll, { passive: true });
  $('skip').onclick = () => intro.finish();
  root.classList.add('ready');
  const q = new URLSearchParams(location.search), seek = q.get('t');
  if (seek !== null) { introActive = true; intro.seek(parseFloat(seek)); field.draw(); window.__intro = intro; return; } // debug: freeze at time t
  let seen = false; try { seen = sessionStorage.getItem('seen') === '1'; } catch (e) {}
  if (reduce || seen) { intro.finish(); return; }
  startT = performance.now(); kick();
}
boot();
