// Safe chatbot test: real app code in jsdom, ALL network mocked (nothing leaves this machine).
// Activation code is placed in localStorage as if already activated; a=act is never sent to the real server.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const FILE = process.argv[2] || '/workspaces/Uoakk/mehryar-v4-final-fixed.html';
const OUT = process.argv[3] || '/workspaces/Uoakk/.mh/chat_mock.txt';
const CODE = 'MH-FSGZ-AQSY';
const MODE = process.env.MODE || 'ok';
const html = fs.readFileSync(FILE, 'utf8');
const errs = [], reqs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('JE ' + String(e && (e.stack || e.message) || e).slice(0, 400)));
vc.on('error', (...a) => errs.push('CE ' + a.map(x => (x && x.stack) || String(x)).join(' ').slice(0, 400)));
const ANSWER = 'پاسخ آزمایشی مهریار: برای تمرین جمع دو رقمی، بازی کارت‌های عدد را در گروه‌های دونفره اجرا کن.';
const gem = text => ({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 } });
function mockFetch(url, opts = {}) {
  const u = String(url), body = typeof opts.body === 'string' ? opts.body : '';
  const rec = { url: u.slice(0, 160), method: opts.method || 'GET' };
  reqs.push(rec);
  let data = {}, raw = null;
  if (/api\.php\?a=ai/.test(u) || /googleapis\.com/.test(u)) {
    if (MODE !== 'ok') {
      rec.kind = 'forced-' + MODE;
      if (MODE === 'net') return Promise.reject(new dom.window.TypeError('Failed to fetch'));
      if (MODE === '429') return Promise.resolve(new Response(JSON.stringify({ error: { code: 429, message: 'Resource exhausted. Please retry in 6s.', status: 'RESOURCE_EXHAUSTED' } }), { status: 429, headers: { 'Content-Type': 'application/json' } }));
      if (MODE === '403') return Promise.resolve(new Response(JSON.stringify({ ok: false, err: 'used', error: { code: 403, message: 'code bound to another device' } }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      if (MODE === '500') { const W = dom.window; return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error', headers: new Headers({ 'Content-Type': 'text/html' }), json: () => Promise.reject(new W.SyntaxError("Unexpected token '<', \"<html>error</html>\" is not valid JSON")), text: () => Promise.resolve('<html>error</html>'), clone() { return this; } }); }
    }
    const nl = body.indexOf('\n');
    rec.authPart = nl > 0 ? body.slice(0, nl).replace(/\|.*/, '|<deviceId>') : '(none)';
    let j = {}; try { j = JSON.parse(nl > 0 ? body.slice(nl + 1) : body); } catch (_) {}
    const all = JSON.stringify(j);
    rec.hasSystem = !!j.systemInstruction; rec.tools = Array.isArray(j.tools) ? j.tools.length : 0; rec.contents = (j.contents || []).length; rec.size = all.length;
    if (/NEXT/.test(all) && /IDEA/.test(all) && /STUDENT/.test(all)) { data = gem('OTHER'); rec.kind = 'intent'; }
    else if (/HARD/.test(all) && all.length < 8000) { data = gem('EASY'); rec.kind = 'route'; }
    else { data = gem(ANSWER); rec.kind = 'answer'; }
  } else if (/api\.php\?a=p\b/.test(u)) { raw = '1'; }
  else if (/api\.php\?a=act/.test(u)) { rec.note = 'ACT-CALLED'; data = { ok: true }; }
  else if (/api\.php/.test(u)) { data = { ok: true }; }
  const txt = raw !== null ? raw : JSON.stringify(data);
  return Promise.resolve(new Response(txt, { status: 200, headers: { 'Content-Type': raw !== null ? 'text/plain' : 'application/json' } }));
}
const dom = new JSDOM(html, {
  url: 'https://mehryar.local/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.fetch = mockFetch;
    try { w.localStorage.setItem('mehryar_ai_code', CODE); } catch (_) {}
    w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, onchange: null, dispatchEvent() { return false; } });
    w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {}; w.Element.prototype.scrollTo = function () {};
    w.HTMLCanvasElement.prototype.getContext = () => null; w.print = () => {};
    w.confirm = () => true; w.navigator.vibrate = () => true;
  }
});
const w = dom.window, d = w.document, sleep = ms => new Promise(r => setTimeout(r, ms));
const o = [];
const T = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const toolbar = () => T(d.querySelector('.ai-toolbar')).slice(0, 160);
const msgs = () => [...d.querySelectorAll('#ai-log article.ai-message')];
async function ask(text, label, maxWait = 45000) {
  const before = msgs().length, r0 = reqs.length;
  const ta = d.getElementById('ai-message');
  if (!ta) { o.push(label + ': NO TEXTAREA'); return; }
  ta.value = text; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(150);
  const form = d.getElementById('ai-form');
  form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const t0 = Date.now();
  while (Date.now() - t0 < maxWait) {
    await sleep(500);
    const busy = d.getElementById('ai-log')?.getAttribute('aria-busy');
    if (msgs().length >= before + 2 && busy !== 'true') break;
    if (d.querySelector('#ai-retry') || d.querySelector('.ai-error')) break;
  }
  const all = msgs();
  const err = T(d.querySelector('.ai-error')) || '';
  o.push(`--- ${label} (${Math.round((Date.now() - t0) / 100) / 10}s) msgs ${before} -> ${all.length}`);
  o.push('  Q: ' + text);
  o.push('  LAST: ' + T(all[all.length - 1]).slice(0, 300));
  all.slice(before).forEach((m, i) => o.push('  NEW[' + i + '] ' + m.className + ': ' + T(m).slice(0, 400)));
  o.push('  STATUS/ERR area: ' + T(d.querySelector('.ai-status, .ai-error, [role=alert]')).slice(0, 300));
  if (err) o.push('  ERROR BOX: ' + err.slice(0, 300));
  o.push('  REQS: ' + JSON.stringify(reqs.slice(r0)));
  o.push('  toolbar: ' + toolbar());
}
(async () => {
  await new Promise(r => d.readyState === 'complete' ? r() : w.addEventListener('load', r));
  await sleep(600);
  o.push('panel=' + JSON.stringify(w.__mehryarPanel ? { base: w.__mehryarPanel.base, hasId: !!w.__mehryarPanel.id } : null));
  o.push('storedCode=' + w.localStorage.getItem('mehryar_ai_code'));
  // Scenario 1: real (non-demo) class info, tools OFF
  try { w.eval("setState({klass:{...state.klass,teacher:'معلم آزمایشی',school:'دبستان آزمایشی',grade:'دوم',className:'الف'}})"); } catch (e) { o.push('setState ERR ' + e.message); }
  w.location.hash = '#/pulse/assistant'; await sleep(800);
  o.push('assistant page: ' + T(d.querySelector('.ai-welcome, #ai-log')).slice(0, 250));
  o.push('toolbar: ' + toolbar());
  await ask('سلام مهریار', 'S1 greeting (local, no network expected)', 8000);
  
  // Scenario 2: tools ON
  const cb = d.querySelector('input[type=checkbox][id^="ai-"]');
  o.push('tools checkbox: ' + (cb ? cb.id + ' checked=' + cb.checked : 'NOT FOUND'));
  if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(600); }
  const cb2 = d.querySelector('input[type=checkbox][id^="ai-"]');
  o.push('tools now: ' + (cb2 ? cb2.checked : '?'));
  await ask('یک ایده برای مرور ارزش مکانی با بازی بده', 'S2 MODE='+MODE, 70000);
  o.push('draft kept in textarea: ' + JSON.stringify((d.getElementById('ai-message')||{}).value||''));
  o.push('retry button: ' + !!d.getElementById('ai-retry'));
  // persistence check
  o.push('history saved=' + ((w.localStorage.getItem('mehryar_assistant_v1') || '').length) + ' chars');
  o.push('ACT called? ' + reqs.some(r => r.note === 'ACT-CALLED'));
  o.push('non-mocked hosts: none (fetch fully replaced)');
  o.push('ERRS ' + errs.length + '\n' + errs.join('\n'));
  fs.writeFileSync(OUT, o.join('\n'));
  process.exit(0);
})().catch(e => { o.push('FATAL ' + (e.stack || e)); fs.writeFileSync(OUT, o.join('\n')); process.exit(1); });
setTimeout(() => { o.push('TIMEOUT'); fs.writeFileSync(OUT, o.join('\n')); process.exit(2); }, 170000);
