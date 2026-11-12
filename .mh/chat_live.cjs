// LIVE chatbot test: real app code in jsdom + REAL network (panel + Gemini via api.php?a=ai).
// Uses the device id activated once with the teacher's code (live_did.txt); a=act is blocked so the code is not re-bound.
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const FILE = process.argv[2] || '/workspaces/Uoakk/mehryar-v4-final-fixed.html';
const OUT = process.argv[3] || '/workspaces/Uoakk/.mh/live_run.txt';
const QSET = process.env.QSET || 'teacher';
const CODE = 'MH-FSGZ-AQSY';
const DID = fs.readFileSync('/workspaces/Uoakk/.mh/live_did.txt', 'utf8').trim();
const html = fs.readFileSync(FILE, 'utf8');
const errs = [], reqs = [], o = [];
const flush = () => fs.writeFileSync(OUT, o.join('\n'));
const vc = new VirtualConsole();
vc.on('jsdomError', e => errs.push('JE ' + String(e && (e.stack || e.message) || e).slice(0, 400)));
vc.on('error', (...a) => errs.push('CE ' + a.map(x => (x && x.stack) || String(x)).join(' ').slice(0, 400)));
const realFetch = globalThis.fetch;
function liveFetch(url, opts = {}) {
  const u = String(url), body = typeof opts.body === 'string' ? opts.body : '';
  const rec = { a: (u.match(/[?&]a=(\w+)/) || [, u.slice(0, 60)])[1], t0: Date.now() };
  if (rec.a === 'act') { rec.note = 'ACT-BLOCKED'; reqs.push(rec); return Promise.resolve(new Response('{"ok":true}', { status: 200 })); }
  if (rec.a === 'ai') {
    const nl = body.indexOf('\n'); let j = {}; try { j = JSON.parse(body.slice(nl + 1)); } catch (_) {}
    const b = j.body || j;
    rec.model = j.model || j.m || ((u.match(/[?&](?:m|model)=([^&]+)/) || [])[1]) || ('hdr:' + body.slice(0, nl).replace(/^[^|]*\|[^|]*\|?/, '').slice(0, 40) || '?'); rec.size = body.length; rec.tools = Array.isArray(b.tools) ? b.tools.length : 0;
    rec.contents = (b.contents || []).length;
    const gc = b.generationConfig || {};
    rec.maxOut = gc.maxOutputTokens; rec.think = JSON.stringify(gc.thinkingConfig || null);
    rec.keys = Object.keys(j).join(',');
  }
  reqs.push(rec);
  // Bridge jsdom AbortSignal -> Node AbortSignal (Node fetch rejects foreign signals).
  const nopts = { ...opts }; const js = opts.signal;
  if (js) {
    const nc = new AbortController(); nopts.signal = nc.signal;
    if (js.aborted) nc.abort(); else js.addEventListener('abort', () => { rec.aborted = Date.now() - rec.t0; nc.abort(); }, { once: true });
  }
  return realFetch(u, nopts).catch(e => {
    rec.ms = Date.now() - rec.t0; rec.fail = String(e).slice(0, 120);
    // Re-throw as page-realm errors so the app's instanceof / name checks behave like a real browser.
    if (e && e.name === 'AbortError') throw new w.DOMException('The operation was aborted.', 'AbortError');
    throw new w.TypeError('Failed to fetch');
  }).then(async r => {
    rec.status = r.status; rec.ms = Date.now() - rec.t0;
    if (rec.a === 'ai') {
      try { const t = await r.clone().text(); rec.respLen = t.length; const dd = JSON.parse(t); const um = dd.usageMetadata || {}; rec.usage = [um.promptTokenCount, um.candidatesTokenCount, um.thoughtsTokenCount].join('/'); rec.finish = dd.candidates?.[0]?.finishReason; if (!r.ok) rec.err = t.slice(0, 200); } catch (e) { rec.parseErr = String(e).slice(0, 80); try { const t = await r.clone().text(); const fs2 = require('fs'); fs2.appendFileSync('/workspaces/Uoakk/.mh/err_html.txt', `\n#### ${new Date().toISOString()} st=${r.status} cf-ray=${r.headers.get('cf-ray')} server=${r.headers.get('server')}\n` + t.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500)); fs2.writeFileSync('/workspaces/Uoakk/.mh/fail_body_' + reqs.indexOf(rec) + '.txt', body); } catch (_) {} }
    }
    return pageResponse(r);
  });
}
// Wrap a Node Response so body-parse errors are page-realm SyntaxErrors (as in a real browser),
// otherwise the app's `error instanceof SyntaxError` check fails across jsdom/Node realms.
function pageResponse(r) {
  const textP = r.clone().text();
  const wrap = {
    ok: r.ok, status: r.status, statusText: r.statusText, headers: r.headers, url: r.url, redirected: r.redirected, type: r.type,
    get body() { return r.body; }, bodyUsed: false,
    text: () => textP,
    json: () => textP.then(t => { try { return JSON.parse(t); } catch (e) { throw new w.SyntaxError(e.message); } }),
    clone: () => pageResponse(r.clone()),
    arrayBuffer: () => r.clone().arrayBuffer(), blob: () => r.clone().blob()
  };
  return wrap;
}
const dom = new JSDOM(html, {
  url: 'https://mehryar.local/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.fetch = liveFetch;
    try { w.localStorage.setItem('mehryar_ai_code', CODE); w.localStorage.setItem('mehryar_did', DID); } catch (_) {}
    w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, onchange: null, dispatchEvent() { return false; } });
    w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {}; w.Element.prototype.scrollTo = function () {};
    w.HTMLCanvasElement.prototype.getContext = () => null; w.print = () => {};
    w.confirm = () => true; w.navigator.vibrate = () => true;
  }
});
const w = dom.window, d = w.document, sleep = ms => new Promise(r => setTimeout(r, ms));
const T = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const msgs = () => [...d.querySelectorAll('#ai-log article.ai-message')];
const fmt = r => `${r.a}${r.model ? ' ' + r.model : ''} st=${r.status ?? '-'} ${r.ms ?? '?'}ms` + (r.size ? ` req=${r.size}B keys=${r.keys} tools=${r.tools} cont=${r.contents} maxOut=${r.maxOut} think=${r.think}` : '') + (r.usage ? ` usage(in/out/think)=${r.usage} finish=${r.finish}` : '') + (r.err ? ' ERR=' + r.err : '') + (r.parseErr ? ' PARSE=' + r.parseErr : '') + (r.fail ? ' FAIL=' + r.fail : '') + (r.aborted ? ' ABORTED@' + r.aborted + 'ms' : '') + (r.note ? ' ' + r.note : '');
async function ask(text, label, maxWait = 150000) {
  const before = msgs().length, r0 = reqs.length;
  const ta = d.getElementById('ai-message');
  if (!ta) { o.push(label + ': NO TEXTAREA'); return; }
  ta.value = text; ta.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(100);
  const t0 = Date.now(); let firstText = 0;
  d.getElementById('ai-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  while (Date.now() - t0 < maxWait) {
    await sleep(250);
    const all = msgs(), last = all[all.length - 1];
    if (!firstText && all.length >= before + 2 && T(last).length > 20) firstText = Date.now() - t0;
    const busy = d.getElementById('ai-log')?.getAttribute('aria-busy');
    if (all.length >= before + 2 && busy !== 'true') break;
    if (d.querySelector('#ai-retry')) break;
  }
  const total = Date.now() - t0, all = msgs();
  o.push(`\n=== ${label}  TOTAL ${(total / 1000).toFixed(1)}s  firstVisible ${(firstText / 1000).toFixed(1)}s`);
  o.push('Q: ' + text);
  all.slice(before + 1).forEach((m, i) => o.push(`A[${i}] (${m.className}): ` + T(m).slice(0, 1800)));
  if (d.querySelector('#ai-retry')) o.push('RETRY BUTTON SHOWN');
  o.push('REQS:'); reqs.slice(r0).forEach(r => o.push('   ' + fmt(r)));
  flush();
  await sleep(1500);
}
const SETS = {
  teacher: [
    ['سلام', 'Q1 greeting'],
    ['اسم دانش‌آموزهای کلاسم رو بگو', 'Q2 list students'],
    ['امیر تو جمع با انتقال مشکل داره، چیکار کنم؟', 'Q3 heavy advice'],
    ['امروز سارا و کیان غایب بودند، ثبت کن', 'Q4 record attendance'],
    ['یه پیام کوتاه و محترمانه برای اولیای امیر بنویس که بیشتر تمرین کنه', 'Q5 parent message'],
    ['کوتاه‌ترش کن', 'Q6 follow-up'],
  ],
  speed: [
    ['جمع با انتقال رو تو یک جمله برای بچه‌ها توضیح بده', 'S1 short explain'],
    ['یک بازی پنج دقیقه‌ای برای ضرب پیشنهاد بده', 'S2 idea'],
  ],
};
(async () => {
  await new Promise(r => d.readyState === 'complete' ? r() : w.addEventListener('load', r));
  await sleep(800);
  o.push('DATE ' + new Date().toISOString() + '  FILE=' + FILE + '  panel.id match=' + (w.__mehryarPanel && w.__mehryarPanel.id === DID));
  try {
    w.eval(`setState({klass:{...state.klass,teacher:'خانم رضایی',school:'دبستان شهید باهنر',grade:'دوم',className:'الف'},students:['امیر','سارا','مینا','کیان','پارسا','رها'].map((name,i)=>({id:'st'+i,no:i+1,name,data:{},shortage:{},assess:emptyAssess()}))})`);
  } catch (e) { o.push('setState ERR ' + e.message); }
  w.location.hash = '#/pulse/assistant'; await sleep(1200);
  const cb = d.querySelector('input[type=checkbox][id^="ai-"]');
  o.push('tools checkbox default: ' + (cb ? cb.id + '=' + cb.checked : 'none'));
  if (process.env.TOOLS === '1' && cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(500); o.push('tools turned ON'); }
  o.push('welcome: ' + T(d.querySelector('#ai-log')).slice(0, 200));
  flush();
  for (const [q, l] of SETS[QSET]) await ask(q, l);
  o.push('\nhistory saved=' + (w.localStorage.getItem('mehryar_assistant_v1') || '').length + ' chars');
  o.push('ERRS ' + errs.length + '\n' + errs.join('\n'));
  o.push('DONE'); flush(); process.exit(0);
})().catch(e => { o.push('FATAL ' + (e.stack || e)); flush(); process.exit(1); });
setTimeout(() => { o.push('GLOBAL TIMEOUT'); flush(); process.exit(2); }, 1000000);
