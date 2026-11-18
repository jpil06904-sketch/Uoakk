#!/usr/bin/env python3
"""Inject Mehryar V5 core + bridge into v5/mehryar-v5.html (idempotent: refuses if already injected)."""
import sys, pathlib
ROOT = pathlib.Path('/workspaces/Uoakk')
F = ROOT / 'v5/mehryar-v5.html'
D = ROOT / '.mh/v5core'
html = F.read_text(encoding='utf-8')
if 'window.MehryarV5' in html:
    sys.exit('already injected')
core = (D / 'core.js').read_text(encoding='utf-8')
bridge = (D / 'bridge.js').read_text(encoding='utf-8') + (D / 'bridge2.js').read_text(encoding='utf-8')
css = (D / 'css.css').read_text(encoding='utf-8')

def rep(old, new, count=1):
    global html
    n = html.count(old)
    if n != count:
        sys.exit(f'anchor count {n} != {count}: {old[:70]!r}')
    html = html.replace(old, new)

# 1) bridge functions: defined right before runInner (same assistant scope)
rep('  async function runInner() {\n', bridge + '  async function runInner() {\n')
# 2) every normal chat message goes through V5 (router → FAST/DEEP). Budget / annual-budget / tool-approval flows keep the old path.
rep('''    const p = profile(), prompt = draft.trim();
    if (isGreetingOnly(prompt) && !pendingAnnualBudget) { postBudgetExchange(prompt, p, greetingReply(p)); return; }''',
'''    const p = profile(), prompt = draft.trim();
    if (window.MehryarV5) window.MehryarV5.voiceStop(true);
    if (window.MehryarV5 && !pendingAnnualBudget && !MehryarTools.proposal && prompt.length <= 6000 && !isAnnualBudgetPrompt(prompt) && !(isBudgetInputPrompt(prompt) && hasBudgetPayload(prompt)) && !isCurriculumBudgetPrompt(prompt) && !MehryarTools.localAnswer(prompt)) { await runV5(prompt); return; }
    if (isGreetingOnly(prompt) && !pendingAnnualBudget) { postBudgetExchange(prompt, p, greetingReply(p)); return; }''')
# 3) receipt chip + route tag under each model message
rep("} کپی پاسخ</button>` : ''}</article>`;", "} کپی پاسخ</button>` : ''}${v5MsgExtra(m,i)}</article>`;")
# 4) live staged loading / streaming bubble replaces the static spinner while V5 runs
rep("${pending ? messageHtml(pending,-1) + '<div class=\"ai-pending\"",
    "${pending && v5live ? messageHtml(pending,-1) + v5LiveHtml() : ''}${pending && !v5live ? messageHtml(pending,-1) + '<div class=\"ai-pending\"")
# 5) briefing / growth / settings strip under the tool strip
rep('<a href="#/outputs">ابزارها</a></div>', '<a href="#/outputs">ابزارها</a></div>${v5StripHtml()}')
# 6) mic button before textarea + interim line after the input row
rep('<div class="ai-input-row"><textarea id="ai-message"', '<div class="ai-input-row">${window.MehryarV5 ? MehryarV5.micHtml(busy||!!pendingAnnualBudget) : \'\'}<textarea id="ai-message"')
rep('</div><div class="ai-compose-meta">', '</div><div id="v5-interim" class="v5-interim" hidden></div><div class="ai-compose-meta">')
# 7) wire V5 controls after render
rep("const get = id => document.getElementById(id), input = get('ai-message');",
    "const get = id => document.getElementById(id), input = get('ai-message');\n     v5Wire(get);")
# 8) keep receipts + route tags when history is reloaded
rep("return {role:m.role, text:m.role==='model'?hideComputedEvidence(m.text):m.text, profile:m.profile,tools:m.tools!==false};",
    "return {role:m.role, text:m.role==='model'?hideComputedEvidence(m.text):m.text, profile:m.profile,tools:m.tools!==false,...(m.v5&&typeof m.v5==='object'?{v5:{route:m.v5.route==='FAST'?'FAST':'DEEP',ms:Number(m.v5.ms)||0}}:{}),...(m.v5r&&Array.isArray(m.v5r.items)?{v5r:{id:'',undone:!!m.v5r.undone,items:m.v5r.items.slice(0,12).map(x=>({ok:!!x.ok,label:String(x.label||'').slice(0,200),fix:'',action:null}))}}:{})};")
# 9) cancel stops the live stream view
rep('requestId++; controller?.abort(); controller = null; MehryarTools.clear(); receipt = [];',
    'requestId++; controller?.abort(); controller = null; MehryarTools.clear(); receipt = []; v5live = null;')
# 10) core module + CSS + pulse card, as a separate script before </body>
pulse = '''
(() => {
  if (typeof renderPulse !== 'function' || !window.MehryarV5) return;
  const prev = renderPulse;
  renderPulse = function () {
    const out = prev.apply(this, arguments);
    try {
      const host = document.querySelector('.pd-dashboard') || document.getElementById('content');
      if (host && !host.querySelector('.v5-pulse')) {
        const box = document.createElement('div'); box.innerHTML = MehryarV5.pulseCardHtml();
        const card = box.firstElementChild, hero = host.querySelector('.pd-hero');
        if (card) { if (hero && hero.nextSibling) hero.parentNode.insertBefore(card, hero.nextSibling); else host.prepend(card); }
      }
    } catch (_) {}
    return out;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.v5-pulse [data-v5-done]'); if (!b) return;
    MehryarV5.reminderDone(b.dataset.v5Done);
    const card = b.closest('.v5-pulse'); if (card) card.outerHTML = MehryarV5.pulseCardHtml();
  });
  for (const entry of (typeof ROUTES !== 'undefined' ? ROUTES : [])) if (entry[0] && entry[0].test && entry[0].test('#/pulse')) entry[1] = () => renderPulse();
})();
'''
block = '<style id="v5-style">' + css + '</style>\n<script>\n' + core + pulse + '</script>\n'
rep('</script>\n</body>', '</script>\n' + block + '</body>')
F.write_text(html, encoding='utf-8')
print('injected OK', len(html))
