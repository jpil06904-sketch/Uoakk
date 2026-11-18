const assert = require('assert');
const calls = [];
let routerMode = 'FAST';
global.fetch = async (url, init) => {
  const body = JSON.parse(init.body.slice(init.body.indexOf('{')));
  calls.push({ url, body });
  if (url.includes(':generateContent') || url.includes('a=ai&')) { // router / class_state
    if (routerMode === 'SLOW') await new Promise((res, rej) => { const t = setTimeout(res, 5000); init.signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
    const txt = routerMode === 'BAD' ? 'hmm' : JSON.stringify({ route: routerMode });
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ candidates: [{ content: { parts: [{ text: txt }] } }] }) };
  }
  const chunks = ['data: {"candidates":[{"content":{"parts":[{"text":"سلام "}]}}]}\n\n', 'data: {"candidates":[{"content":{"parts":[{"text":"علی غایب ثبت شد.<act"}]}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"text":"ions>[{\\"tool\\":\\"attendance\\",\\"student\\":\\"زهرا\\",\\"status\\":\\"absent\\"}]</actions>"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":1200}}\n\n'];
  const enc = new TextEncoder(); let i = 0;
  return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: async () => i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { done: true } }) } };
};
const { V5 } = require('./test_env.cjs')();
(async () => {
  const auth = { key: 'K', panel: null }, deltas = [];
  // FAST route
  let r = await V5.ask({ text: 'زهرا امروز غایب بود', history: [{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }, { role: 'user', text: 'c' }, { role: 'model', text: 'd' }], auth, onDelta: d => deltas.push(d) });
  const router = calls[0], main = calls[1];
  assert.ok(router.url.includes('gemini-3-flash-preview:generateContent'));
  assert.strictEqual(router.body.generationConfig.maxOutputTokens, 15);
  assert.strictEqual(router.body.contents[0].parts[0].text.split('\n').filter(l => /^(معلم|مهریار):/.test(l)).length, 2, 'router gets only 2 last msgs');
  assert.ok(!JSON.stringify(router.body).includes('بودجه‌بندیِ کلِ سال'), 'router gets no class DB');
  assert.ok(main.url.includes('gemini-3-flash-preview:streamGenerateContent?alt=sse'));
  assert.strictEqual(main.body.generationConfig.maxOutputTokens, 400);
  assert.strictEqual(r.route, 'FAST'); assert.strictEqual(r.text, 'سلام علی غایب ثبت شد.'); assert.strictEqual(r.actions.length, 1);
  assert.ok(deltas.every(d => !d.includes('<act')), 'partial tag never shown: ' + JSON.stringify(deltas));
  // DEEP route config: 3.8-flash HIGH, no thinkingBudget, 900 tokens
  routerMode = 'DEEP'; calls.length = 0;
  r = await V5.ask({ text: 'بچه‌ها حواسشان پرت است', history: [], auth });
  assert.ok(calls[1].url.includes('gemini-3.8-flash:streamGenerateContent'));
  assert.deepStrictEqual(calls[1].body.generationConfig, { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'HIGH' } });
  // invalid JSON → FAST
  routerMode = 'BAD'; calls.length = 0;
  r = await V5.ask({ text: 'x', history: [], auth }); assert.strictEqual(r.route, 'FAST'); assert.ok(r.routerFallback);
  // Bounded classifier wait; ambiguous teaching questions fall back to DEEP.
  routerMode = 'SLOW'; calls.length = 0; const t0 = Date.now();
  r = await V5.ask({ text: 'x', history: [], auth }); const el = Date.now() - t0;
  assert.strictEqual(r.route, 'FAST'); assert.ok(el >= 1000 && el < 2200, 'router timeout ~1.2s: ' + el);
  calls.length = 0; r = await V5.ask({text:'حالا چه کنیم؟',history:[],auth});
  assert.strictEqual(r.route, 'DEEP'); assert.ok(r.routerFallback);
  routerMode = 'BAD';
  for (const text of ['میشه کمکم کنی', 'راهنمایی می‌خواهم', 'این یعنی چی؟', 'برای کلاس چطور عمل کنم']) {
    const routed = await V5.route(text, [], auth);
    assert.strictEqual(routed.route, 'DEEP', `advice or question must use DEEP on router failure: ${text}`);
    assert.ok(routed.fallback);
  }
  routerMode = 'SLOW';
  const cancel = new AbortController(); const pending = V5.route('سؤال غیرساده',[],auth,cancel.signal);
  setTimeout(()=>cancel.abort(),30); await assert.rejects(pending,e=>e.name==='AbortError');
  const originalFetch = global.fetch;
  global.fetch = async (url,init) => ({ok:true,json:()=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})) ))});
  const bodyCancel = new AbortController(), pendingBody = V5.route('سؤال غیرساده',[],auth,bodyCancel.signal);
  setTimeout(()=>bodyCancel.abort(),30); await assert.rejects(pendingBody,e=>e.name==='AbortError','cancellation during JSON body reading must propagate');
  global.fetch = originalFetch;
  // Simple messages bypass the router, including a slow/broken router.
  for (const text of ['سلام','مرسی','چرا سرعتت کمه']) {
    calls.length = 0; r = await V5.ask({text,history:[],auth});
    assert.strictEqual(calls.length,1); assert.strictEqual(r.route,'FAST');
    assert.ok(calls[0].url.includes(':streamGenerateContent')); assert.strictEqual(r.routerMs,0);
  }
  // history cap: only 12 last messages
  routerMode = 'DEEP'; calls.length = 0;
  const hist = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: 'm' + i }));
  await V5.ask({ text: 'سوال', history: hist, auth });
  assert.strictEqual(calls[1].body.contents.length, 12 + 1 - 0 /* 12 history + current */ - 0, 'contents=' + calls[1].body.contents.length);
  // briefing/growth skip the router and go DEEP
  calls.length = 0; await V5.ask({ mode: 'briefing', auth });
  assert.strictEqual(calls.length, 1); assert.ok(calls[0].url.includes('gemini-3.8-flash'));
  assert.ok(!V5.briefingDue());
  calls.length = 0; await V5.ask({ mode: 'growth', studentId: 's4', auth });
  assert.ok(calls[0].body.systemInstruction.parts[0].text.includes('کل سوابق رشد از روز اول'));
  // panel proxy uses a=ais for streaming
  calls.length = 0; await V5.ask({ mode: 'briefing', auth: { key: 'MH-AAAA-BBBB', panel: { base: 'https://p.x/panel', id: 'dev12345' } } });
  assert.ok(calls[0].url.startsWith('https://p.x/panel/api.php?a=ais&m=gemini-3.8-flash'));
  console.log('ALL NETWORK TESTS PASSED (router timeout ms:', el + ')');
})().catch(e => { console.error(e); process.exit(1); });
