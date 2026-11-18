// تست منطق «مسابقهٔ مدل‌ها» با پاسخ‌های ساختگی؛ کد را مستقیم از فایل اصلی برمی‌دارد.
const fs = require('fs');
const src = fs.readFileSync('/workspaces/Uoakk/mehryar-v4-final-fixed.html', 'utf8');
const start = src.indexOf('  async function fetchModelWithRetry(');
const end = src.indexOf('  async function fetchModelOnce(');
const code = src.slice(start, end);
const HEAVY_MODEL = 'heavy', LIGHT_MODEL = 'light';
let calls = [], plan = {};
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('x', 'AbortError')); }); });
async function fetchModelOnce(model, body, signal) {
  calls.push(model + ':' + (body.generationConfig?.thinkingConfig?.thinkingBudget ?? '-'));
  const p = plan[model];
  await sleep(p.ms, signal);
  if (p.throw) { const e = new Error(p.throw); e.code = 'MODEL_TIMEOUT'; throw e; }
  return { response: { ok: p.status === 200, status: p.status }, data: { who: model } };
}
const factory = new Function('HEAVY_MODEL', 'LIGHT_MODEL', 'fetchModelOnce', 'HEAVY_HEDGE_MS', 'HEAVY_SLOW_COOLDOWN_MS', 'hedgeSticky', 'state',
  'let heavyDownUntil = 0;' + code + '; return {fetchModelWithRetry, get down(){return heavyDownUntil;}};');
async function scenario(name, p, expect, abortAt) {
  calls = []; plan = p;
  const api = factory(HEAVY_MODEL, LIGHT_MODEL, fetchModelOnce, 100, 1000, new WeakSet(), {});
  const ctl = new AbortController(); if (abortAt) setTimeout(() => ctl.abort(), abortAt);
  const body = { generationConfig: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 2048 } } };
  const t0 = Date.now(); let out;
  try { const r = await api.fetchModelWithRetry('heavy', body, ctl.signal, 60000, 0); out = r.data.who + '/' + r.response.status; }
  catch (e) { out = 'throw:' + (e.name === 'AbortError' ? 'abort' : e.message); }
  let second = '';
  if (name.includes('sticky')) { const r2 = await api.fetchModelWithRetry('heavy', body, ctl.signal, 60000, 0).catch(e => ({data:{who:'err'}})); second = ' round2=' + r2.data.who; }
  const ok = out === expect;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' -> ' + out + ' in ' + (Date.now() - t0) + 'ms calls=' + calls.join(',') + second + ' down=' + (api.down > 0));
  if (!ok) process.exitCode = 1;
}
(async () => {
  await scenario('heavy fast OK (no light call)', { heavy: { ms: 30, status: 200 }, light: { ms: 10, status: 200 } }, 'heavy/200');
  await scenario('heavy stuck -> light wins + sticky', { heavy: { ms: 2000, status: 200 }, light: { ms: 50, status: 200 } }, 'light/200');
  await scenario('heavy fast 503 -> old fallback path', { heavy: { ms: 20, status: 503 }, light: { ms: 10, status: 200 } }, 'heavy/503');
  await scenario('heavy slow but beats light', { heavy: { ms: 150, status: 200 }, light: { ms: 500, status: 200 } }, 'heavy/200');
  await scenario('both fail -> heavy result', { heavy: { ms: 300, status: 504 }, light: { ms: 50, status: 429 } }, 'heavy/504');
  await scenario('heavy throws late, light ok', { heavy: { ms: 300, throw: 'timeout' }, light: { ms: 400, status: 200 } }, 'light/200');
  await scenario('user cancel', { heavy: { ms: 2000, status: 200 }, light: { ms: 2000, status: 200 } }, 'throw:abort', 150);
})();
