// Direct timing of the panel AI proxy with a tiny request (no app code), to separate server latency from app latency.
const fs = require('fs');
const DID = fs.readFileSync('/workspaces/Uoakk/.mh/live_did.txt', 'utf8').trim();
const BASE = 'https://billowing-feather-ba20.ssioojiu63.workers.dev/panel';
const OUT = process.argv[2] || '/workspaces/Uoakk/.mh/ping_ai.txt';
const N = Number(process.argv[3] || 4);
const o = [];
const models = (process.env.MODELS || 'gemini-3-flash-preview').split(',');
(async () => {
  for (const m of models) for (let i = 0; i < N; i++) {
    const body = { contents: [{ role: 'user', parts: [{ text: 'فقط بنویس: سلام' }] }], generationConfig: { maxOutputTokens: 20, thinkingConfig: { thinkingBudget: 0 } } };
    const t0 = Date.now(); let st = '-', txt = '';
    try {
      const r = await fetch(BASE + '/api.php?a=ai&m=' + encodeURIComponent(m), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'MH-FSGZ-AQSY|' + DID + '\n' + JSON.stringify(body), signal: AbortSignal.timeout(90000) });
      st = r.status; txt = (await r.text()).replace(/\s+/g, ' ').slice(0, 160);
    } catch (e) { txt = 'FAIL ' + e; }
    o.push(`${m} #${i} st=${st} ${Date.now() - t0}ms ${txt}`);
    fs.writeFileSync(OUT, o.join('\n'));
    await new Promise(r => setTimeout(r, 1500));
  }
  // cfg endpoint (no Gemini) = pure proxy round-trip
  for (let i = 0; i < 3; i++) { const t0 = Date.now(); let st; try { st = (await fetch(BASE + '/api.php?a=cfg')).status; } catch (e) { st = 'FAIL'; } o.push(`cfg #${i} st=${st} ${Date.now() - t0}ms`); }
  o.push('DONE'); fs.writeFileSync(OUT, o.join('\n'));
})();
