// تست منطق «کیفیت اول»: قوی ← دوباره قوی ← سریع. پاسخ‌ها ساختگی‌اند؛ کد مستقیم از فایل اصلی خوانده می‌شود.
const fs = require('fs');
const src = fs.readFileSync('/workspaces/Uoakk/mehryar-v4-final-fixed.html', 'utf8');
const code = src.slice(src.indexOf('  async function fetchModelWithRetry('), src.indexOf('  async function fetchModelOnce('));
const HEAVY_MODEL = 'heavy', LIGHT_MODEL = 'light', RETRYABLE_MODEL_STATUSES = new Set([408,500,502,503,504]);
const isTransientModelFailure = e => ['MODEL_TIMEOUT','MODEL_NETWORK','MODEL_UNAVAILABLE','MODEL_RATE_LIMIT'].includes(e?.code);
let calls = [], plan = [];
const sleep = (ms, signal) => new Promise((res, rej) => { const t = setTimeout(res, ms); signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('x', 'AbortError')); }); });
async function fetchModelOnce(model, body, signal) {
  const p = plan[calls.length] || {ms: 10, status: 200};
  calls.push(model + ':' + body.generationConfig.thinkingConfig.thinkingBudget);
  await sleep(p.ms, signal);
  if (p.throw) { const e = new Error(p.throw); e.code = p.code || 'MODEL_TIMEOUT'; throw e; }
  return { response: { ok: p.status === 200, status: p.status }, data: { who: model } };
}
const make = () => new Function('HEAVY_MODEL','LIGHT_MODEL','fetchModelOnce','HEAVY_HEDGE_MS','LIGHT_HEDGE_MS','hedgeSticky','RETRYABLE_MODEL_STATUSES','isTransientModelFailure',
  code + '; return {fetchModelWithRetry};')(HEAVY_MODEL, LIGHT_MODEL, fetchModelOnce, 100, 200, new WeakSet(), RETRYABLE_MODEL_STATUSES, isTransientModelFailure);
async function scenario(name, p, expectOut, expectCalls, abortAt) {
  calls = []; plan = p; const api = make();
  const ctl = new AbortController(); if (abortAt) setTimeout(() => ctl.abort(), abortAt);
  const body = { generationConfig: { maxOutputTokens: 3072, thinkingConfig: { thinkingBudget: 2048 } } };
  const t0 = Date.now(); let out;
  try { const r = await api.fetchModelWithRetry('heavy', body, ctl.signal, 60000, 0); out = r.data.who + '/' + r.response.status; }
  catch (e) { out = 'throw:' + (e.name === 'AbortError' ? 'abort' : e.message); }
  const ok = out === expectOut && calls.join(',') === expectCalls;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' -> ' + out + ' ' + (Date.now() - t0) + 'ms calls=' + calls.join(','));
  if (!ok) process.exitCode = 1;
}
(async () => {
  await scenario('heavy OK fast: only 1 call', [{ms:30,status:200}], 'heavy/200', 'heavy:2048');
  await scenario('heavy stuck -> 2nd heavy wins', [{ms:2000,status:200},{ms:30,status:200}], 'heavy/200', 'heavy:2048,heavy:2048');
  await scenario('both heavy stuck -> light (full thinking)', [{ms:2000,status:200},{ms:2000,status:200},{ms:20,status:200}], 'light/200', 'heavy:2048,heavy:2048,light:2048');
  await scenario('heavy fast 503 -> immediate 2nd heavy', [{ms:10,status:503},{ms:30,status:200}], 'heavy/200', 'heavy:2048,heavy:2048');
  await scenario('heavy fast 400 -> old path (no extra calls)', [{ms:10,status:400}], 'heavy/400', 'heavy:2048');
  await scenario('heavy 429 rate-limit -> old path', [{ms:10,throw:'quota',code:'MODEL_RATE_LIMIT'}], 'throw:quota', 'heavy:2048');
  await scenario('all fail -> first error returned', [{ms:10,status:503},{ms:10,status:504},{ms:10,status:503}], 'heavy/503', 'heavy:2048,heavy:2048,light:2048');
  await scenario('first heavy slow but wins', [{ms:150,status:200},{ms:500,status:200}], 'heavy/200', 'heavy:2048,heavy:2048');
  await scenario('user cancel', [{ms:2000,status:200},{ms:2000,status:200},{ms:2000,status:200}], 'throw:abort', 'heavy:2048,heavy:2048', 150);
})();
