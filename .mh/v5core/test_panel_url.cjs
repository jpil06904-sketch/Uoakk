// Requests from a content:// APK or a file:// download must still leave for an
// absolute host; a relative base must fail fast instead of hanging until timeout.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { V5 } = require('./test_env.cjs')();

const HTML = path.join(__dirname, '..', '..', 'v5', 'mehryar-v5.html');
const lines = fs.readFileSync(HTML, 'utf8').split('\n');
const start = lines.findIndex(l => l.startsWith('const APP_VERSION='));
assert.ok(start >= 0, 'panel bootstrap block exists');
const panelUrl = /PANEL_URL='([^']+)'/.exec(lines[start])[1];
const openAt = lines.slice(start + 1).findIndex(l => l.trim() === '(()=>{');
assert.ok(openAt >= 0, 'panel bootstrap is an IIFE');
const openIndex = start + 1 + openAt;
const closeAt = lines.slice(openIndex).findIndex(l => l.trim() === '})();');
assert.ok(closeAt >= 0, 'panel bootstrap IIFE closes');
const block = lines.slice(start, openIndex + closeAt + 1).join('\n');
assert.ok(block.includes("PANEL_URL='") && block.trim().endsWith('})();'), 'extracted the panel bootstrap with its constants');
const expected = panelUrl.replace(/\/+$/, '');

function panelBaseFor(href) {
  const store = new Map(), ctx = {};
  const store2 = new Map();
  const doc = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, addEventListener() {}, append() {}, remove() {}, querySelector: () => null, isConnected: true }),
    createTextNode: () => ({}), body: { append() {} }
  };
  const sandbox = {
    location: { href, protocol: href.split(':')[0] + ':', hash: '#/home', startsWith: () => false },
    document: doc, window: ctx,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    navigator: { onLine: true },
    crypto: { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = 1; return a; } },
    fetch: async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}), text: async () => '{}' }),
    Image: function () {}, AbortController, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, console, URL,
    renderHome: function () {}, renderSettings: undefined
  };
  sandbox.window.addEventListener = () => {};
  vm.runInNewContext(block + '\n', sandbox);
  return ctx.__mehryarPanel;
}
const sse = chunks => {
  const enc = new TextEncoder(); let i = 0;
  return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: async () => i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { done: true } }) } };
};

(async () => {
  for (const href of ['https://example.com/app/v5.html', 'content://ir.mehryar.app/files/v5.html', 'file:///storage/emulated/0/mehryar/v5.html', 'http://localhost:8080/v5.html', 'android-app://ir.mehryar']) {
    const panel = panelBaseFor(href);
    assert.ok(panel && panel.id && panel.id.length >= 16, 'a device id is generated for ' + href);
    assert.strictEqual(panel.base, expected, href + ' must resolve to the absolute host, got ' + panel.base);
    assert.ok(/^https:\/\//.test(panel.base), 'absolute https for ' + href);
  }

  // The V5 core must also send every panel request to an absolute URL.
  const seen = [];
  global.fetch = async (url, init) => {
    seen.push(url);
    assert.ok(!url.includes('/panel/panel/'), 'the base must not be doubled: ' + url);
    if (url.includes('/api.php?a=ais')) return sse(['data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'سلام' }] }, finishReason: 'STOP' }] }) + '\n\n']);
    if (url.includes('/api.php?a=ai')) return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ route: 'DEEP' }) }] } }] }) };
    throw new Error('unexpected request: ' + url);
  };
  const good = { key: 'MH-AAAA-BBBB', panel: { base: 'https://p.example/panel/', id: 'dev12345' } };
  await V5.ask({ text: 'چطور بودجهٔ جبران را بنویسم؟', history: [], auth: good });
  assert.strictEqual(seen.length, 2, 'router + stream: ' + seen.join(', '));
  assert.ok(seen.every(u => /^https:\/\//.test(u)), 'no relative request may be sent: ' + seen.join(', '));
  assert.ok(seen[0].startsWith('https://p.example/panel/api.php?a=ai&m='), 'the router uses the panel: ' + seen[0]);
  assert.ok(seen[1].startsWith('https://p.example/panel/api.php?a=ais&m='), 'the stream uses the panel: ' + seen[1]);

  // A non-absolute base must raise a clear network error, never a silent timeout.
  const bad = { key: 'K', panel: { base: '/panel', id: 'dev12345' } };
  await assert.rejects(V5.ask({ text: 'چطور بودجهٔ جبران را بنویسم؟', history: [], auth: bad }), e => e.code === 'MODEL_NETWORK');
  console.log('PANEL URL / ABSOLUTE HOST TESTS PASSED');
})().catch(e => { console.error(e); process.exit(1); });