// 1) Small talk must bypass the router and stay FAST.
const assert = require('assert');
const { V5 } = require('./test_env.cjs')();
const DELTA_CHUNKS = [
  'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'سلام ' }] }, finishReason: 'STOP' }] }) + '\n\n',
  'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'علی غایب ثبت شد.' }] }, finishReason: 'STOP' }] }) + '\n\n',
];
const auth = { key: 'K', panel: null };
const calls = [];
let routerReply = () => JSON.stringify({ route: 'DEEP' });
let routerHangs = false;
const json = o => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => o });
const sse = chunks => {
  const enc = new TextEncoder(); let i = 0;
  return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: async () => i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { done: true } }) } };
};
global.fetch = async (url, init) => {
  const body = JSON.parse(init.body.slice(init.body.indexOf('{')));
  calls.push({ url, body });
  if (url.includes(':generateContent')) {
    if (routerHangs) return new Promise((res, rej) => { const t = setTimeout(() => res(json({ candidates: [] })), 5000); init.signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
    return json({ candidates: [{ content: { parts: [{ text: routerReply() }] } }] });
  }
  return sse(DELTA_CHUNKS);
};
const reset = () => { calls.length = 0; routerHangs = false; routerReply = () => JSON.stringify({ route: 'DEEP' }); };

(async () => {
  // ---- A. small talk: bypass, no router call, FAST ----
  for (const text of ['سلام', 'سلام علیکم', 'شما؟', 'چطوری', 'حالت چطوره؟', 'چه خبری؟', 'مرسی', 'ممنون', 'تشکر', 'خداحافظ', 'چرا سرعتت کمه']) {
    reset();
    const r = await V5.route(text, [], auth);
    assert.strictEqual(calls.length, 0, `${text} must not call the router`);
    assert.strictEqual(r.route, 'FAST', `${text} → FAST`);
    assert.strictEqual(r.bypass, true, `${text} is bypassed, not classified`);
  }

  // ---- B. real teacher work: router is consulted and returns DEEP ----
  for (const text of [
    'بچه‌ها حواسشان پرت است و تمرین جمع را جلو نمی‌برم',
    'چطور می‌توانم تمرین جمع را برای کلاس سوم جذاب‌تر کنم؟',
    'برنامهٔ جبران برای بودجهٔ ریاضی را بچین',
    'تحلیل عملکرد مریم در خواندن را می‌خواهم',
    'سطح کلاس پایین آمده؛ چه تصمیمی بگیرم؟',
    'فردا چه برنامه‌ای برای نمرهٔ علوم داشته باشم؟',
    'زهرا این هفته دیر آمد؛ برای والد‌ها چه بنویسم؟',
  ]) {
    reset();
    const r = await V5.route(text, [], auth);
    assert.strictEqual(calls.length, 1, `${text} must call the router`);
    assert.strictEqual(r.route, 'DEEP', `${text} → DEEP`);
    assert.ok(calls[0].url.includes('gemini-3-flash-preview:generateContent'), `${text} classified by the light model`);
  }
  // A real record message is classified too, never pushed straight to FAST.
  reset();
  let r = await V5.route('زهرا کریمی امروز غایب بود ثبت کن', [], auth);
  assert.strictEqual(calls.length, 1, 'a record request still uses the router');
  assert.strictEqual(r.route, 'DEEP');

  // ---- C. router answers FAST when it says so ----
  reset(); routerReply = () => JSON.stringify({ route: 'FAST' });
  r = await V5.route('زهرا امروز غایب بود ثبت کن', [], auth);
  assert.strictEqual(r.route, 'FAST'); assert.strictEqual(r.fallback, false);

  // ---- D. router silent/broken → work words win, greetings do not ----
  reset(); routerReply = () => 'hmm';                       // invalid JSON
  r = await V5.route('چطور برنامهٔ جبران بودجه را بنویسم؟', [], auth);
  assert.strictEqual(r.route, 'DEEP'); assert.ok(r.fallback);
  r = await V5.route('سلام، امروز چطور؟', [], auth);
  assert.strictEqual(r.route, 'FAST', 'a greeting plus «چطور» is still small talk');
  r = await V5.route('سلام. زهرا امروز غایب بود', [], auth);
  assert.strictEqual(r.route, 'DEEP', 'a greeting carrying a record still goes DEEP');
  r = await V5.route('میشه کمکم کنی', [], auth);
  assert.strictEqual(r.route, 'DEEP');
  r = await V5.route('این یعنی چی؟', [], auth);
  assert.strictEqual(r.route, 'DEEP', 'a bare question is not small talk');
  r = await V5.route('برای کلاس چطور عمل کنم', [], auth);
  assert.strictEqual(r.route, 'DEEP');

  // ---- E. router slow → the 1200ms budget, then a safe answer ----
  reset(); routerHangs = true;
  const t0 = Date.now();
  r = await V5.route('چطور برنامهٔ جبران بودجه را بنویسم؟', [], auth);
  const el = Date.now() - t0;
  assert.strictEqual(r.route, 'DEEP', 'analytical text survives the router timeout');
  assert.ok(el >= 1000 && el < 2200, 'router budget ~1.2s: ' + el);
  reset(); routerHangs = true;
  r = await V5.route('سلام، امروز چطور؟', [], auth);
  assert.strictEqual(r.route, 'FAST', 'small talk survives the router timeout at FAST');

  // ---- F. the router really runs in ask(): a real message reaches the strong model ----
  reset(); routerReply = () => JSON.stringify({ route: 'DEEP' });
  const out = await V5.ask({ text: 'چطور برنامهٔ جبران بودجه را بنویسم؟', history: [], auth });
  assert.strictEqual(calls.length, 2, 'router + main model, not straight to FAST');
  assert.strictEqual(out.route, 'DEEP');
  assert.ok(calls[1].url.includes('gemini-3.8-flash:streamGenerateContent'), 'DEEP reaches the strong model: ' + calls[1].url);
  assert.deepStrictEqual(calls[1].body.generationConfig, { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'HIGH' } });
  // Small talk still short-circuits to a single streaming request.
  reset();
  const fast = await V5.ask({ text: 'سلام', history: [], auth });
  assert.strictEqual(calls.length, 1, 'bypass means no classifier request');
  assert.strictEqual(fast.route, 'FAST');
  assert.ok(calls[0].url.includes('gemini-3-flash-preview:streamGenerateContent'));

  console.log('ROUTER CLASSIFICATION TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });