// Probe: does the panel proxy fail on large request bodies? Sends same tiny question padded to different sizes.
const fs = require('fs');
const DID = fs.readFileSync('/workspaces/Uoakk/.mh/live_did.txt', 'utf8').trim();
const BASE = 'https://billowing-feather-ba20.ssioojiu63.workers.dev/panel';
const OUT = '/workspaces/Uoakk/.mh/ping_big.txt';
const o = [];
(async () => {
  for (const kb of [2, 20, 40, 60, 60, 20]) {
    const pad = 'داده کلاس. '.repeat(Math.ceil(kb * 1024 / 20));
    const body = { systemInstruction: { parts: [{ text: pad.slice(0, kb * 1024 / 2) }] }, contents: [{ role: 'user', parts: [{ text: 'فقط بنویس: سلام' }] }], generationConfig: { maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } } };
    const payload = 'MH-FSGZ-AQSY|' + DID + '\n' + JSON.stringify(body);
    const t0 = Date.now(); let st = '-', txt = '', hdr = '';
    try {
      const r = await fetch(BASE + '/api.php?a=ai&m=gemini-3-flash-preview', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: payload, signal: AbortSignal.timeout(60000) });
      st = r.status; hdr = 'server=' + r.headers.get('server') + ' cf-ray=' + r.headers.get('cf-ray') + ' ct=' + r.headers.get('content-type');
      txt = (await r.text()).replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400);
    } catch (e) { txt = 'FAIL ' + e; }
    o.push(`size=${Buffer.byteLength(payload)}B st=${st} ${Date.now() - t0}ms ${hdr}\n   ${txt}`);
    fs.writeFileSync(OUT, o.join('\n'));
    await new Promise(r => setTimeout(r, 2500));
  }
  o.push('DONE'); fs.writeFileSync(OUT, o.join('\n'));
})();
