// Runtime smoke test for mehryar HTML: loads the app in jsdom (network blocked),
// visits every route, and reports uncaught errors / console.error per route.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');

const FILE = process.argv[2] || '/workspaces/Uoakk/mehryar-v4-final (10).html';
const html = fs.readFileSync(FILE, 'utf8');
const errors = [];
let currentRoute = '(boot)';
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push({ route: currentRoute, type: 'jsdomError', msg: String(e && (e.detail && e.detail.stack || e.stack || e.message) || e).slice(0, 700) }));
vc.on('error', (...a) => errors.push({ route: currentRoute, type: 'console.error', msg: a.map(x => (x && x.stack) || String(x)).join(' ').slice(0, 700) }));

const seed = process.argv[3] === 'seed';
const dom = new JSDOM(html, {
  url: 'https://mehryar.local/index.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    const blocked = [];
    w.__blocked = blocked;
    w.fetch = (u) => { blocked.push(String(u)); return Promise.reject(new TypeError('network blocked in test')); };
    w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, onchange: null, dispatchEvent() { return false; } });
    w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {}; w.Element.prototype.scrollTo = function () {};
    w.print = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
    w.navigator.vibrate = () => true;
    if (seed) {
      // Use the app's own demo loader after boot instead of fabricating storage.
    }
  }
});
const w = dom.window;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => { if (w.document.readyState === 'complete') r(); else w.addEventListener('load', r); });
  await sleep(400);
  const report = { file: path.basename(FILE), bootErrors: errors.length, routes: [] };
  if (seed) {
    currentRoute = '(loadSample)';
    try {
      const fn = w.eval('typeof loadSample==="function"?loadSample:null');
      if (fn) { await fn(); report.seed = 'loadSample() called'; } else report.seed = 'loadSample not found';
    } catch (e) { errors.push({ route: currentRoute, type: 'throw', msg: String(e.stack || e).slice(0, 700) }); }
    await sleep(300);
  }
  // gather routes: from source + dynamic student ids
  const src = html;
  const routeSet = new Set();
  for (const m of src.matchAll(/#\/[a-zA-Z0-9_\-\/]+/g)) routeSet.add(m[0]);
  let st = null;
  try { st = w.eval('typeof state!=="undefined"?state:null'); } catch (_) {}
  const studentId = st && st.students && st.students[0] && st.students[0].id;
  const extra = [];
  for (const r of [...routeSet]) {
    if (r.endsWith('/')) {
      if (studentId && /(students|pulse\/student|pulse\/report|pulse\/report-card)\/$/.test(r)) extra.push(r + studentId);
      continue; // incomplete templates
    }
    extra.push(r);
  }
  for (const r of ['#/output/infoForm', '#/output/labels', '#/output/deskCards', '#/pulse/color/red', '#/settings/list/books', '#/settings/messages/welcome', '#/guide/home']) extra.push(r);
  const list = [...new Set(extra)].filter(r => r !== '#/output/KEY').sort();
  for (const r of list) {
    currentRoute = r;
    const before = errors.length;
    try { w.location.hash = r; } catch (e) { errors.push({ route: r, type: 'throw', msg: String(e) }); }
    await sleep(120);
    const app = w.document.getElementById('app');
    const content = w.document.getElementById('content') || app;
    const finalHash = w.location.hash;
    const text = (content && content.textContent || '').replace(/\s+/g, ' ').trim();
    report.routes.push({ route: r, final: finalHash, textLen: text.length, errors: errors.length - before, title: (w.document.querySelector('.nav-title') || {}).textContent || '' });
  }
  report.totalErrors = errors.length;
  report.blockedRequests = [...new Set(w.__blocked)];
  report.errors = errors;
  const out = process.argv[4] || '/workspaces/Uoakk/.mh/smoke_report.json';
  fs.writeFileSync(out, JSON.stringify(report, null, 1));
  console.log('routes', report.routes.length, 'errors', errors.length);
  process.exit(0);
})().catch(e => { fs.writeFileSync('/workspaces/Uoakk/.mh/smoke_fatal.txt', String(e.stack || e)); process.exit(1); });
setTimeout(() => { fs.writeFileSync('/workspaces/Uoakk/.mh/smoke_fatal.txt', 'TIMEOUT; errors so far:\n' + JSON.stringify(errors, null, 1)); process.exit(2); }, 240000);
