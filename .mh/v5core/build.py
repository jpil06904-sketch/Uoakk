#!/usr/bin/env python3
"""Rebuild only the embedded V5 module/bridge/CSS; never restore an old HTML backup."""
from pathlib import Path
import re
D = Path(__file__).resolve().parent
F = D.parent.parent / 'v5/mehryar-v5.html'
parts = ['p1.js','p2.js','budget.js','pulse.js','memory.js','p3.js','p3b.js','p4.js','p5.js','p5b.js','p6.js','p7.js','p7b.js']
core = ''.join((D/p).read_text() for p in parts)
html = F.read_text()
start = html.index('/* ===== Mehryar V5 core:')
end = html.index('\n(() => {', start)
html = html[:start] + core + html[end:]
start = html.index('  /* ===== V5 bridge (inside assistant scope)')
end = html.index('  async function runInner() {',start)
html = html[:start] + (D/'bridge.js').read_text() + (D/'bridge2.js').read_text() + html[end:]
# Empty class summaries should not add a blank card above the dashboard.
old = 'if (hero && hero.nextSibling) hero.parentNode.insertBefore(card, hero.nextSibling); else host.prepend(card);'
new = 'if (card) { if (hero && hero.nextSibling) hero.parentNode.insertBefore(card, hero.nextSibling); else host.prepend(card); }'
if old in html and new not in html:
    html = html.replace(old, new, 1)
# Keep storage failures visible, but remove the distracting model quota numbers
# from the space-constrained chat composer. Quota status remains available elsewhere.
old_storage = "(historyWarning || '۱۰۰ نوبت آخر، فقط در همین مرورگر') + ' · ' + quotaStatus()"
new_storage = "(historyWarning || 'گفت‌وگو روی همین دستگاه ذخیره می‌شود')"
if old_storage in html:
    assert html.count(old_storage) == 1
    html = html.replace(old_storage, new_storage, 1)
html = html.replace(' / حداکثر ۶۰۰۰ نویسه برای پیام عادی', ' / ۶۰۰۰')
html,n = re.subn(r'(<style id="v5-style">)[\s\S]*?(</style>)',lambda m:m[1]+(D/'css.css').read_text()+m[2],html)
assert n == 1, 'V5 CSS anchor missing'
# ---- compact chat: the chat-options bar and the V5 extras bar move into one
# ---- toolbar popover so the message log starts right under the slim top bar.
anchor = "<button type=\"button\" id=\"ai-clear\""
if 'id="ai-tools-pop"' not in html:
    m = re.search(r'<details id="ai-options".*?</details>\$\{v5StripHtml\(\)\}', html, re.S)
    assert m, 'chat tool bars anchor missing'
    bars = m.group(0)
    assert html.count(anchor) == 1, 'chat toolbar anchor missing'
    pop = ('<details id="ai-tools-pop" class="ai-tools-pop"><summary class="icon-btn" title="ابزار و امکانات" aria-label="ابزار و امکانات">'
           '<span class="ai-tools-pop-label">ابزار و امکانات</span></summary><div class="ai-tools-pop-body">' + bars + '</div></details>')
    html = html.replace(bars, '', 1)          # stop stacking the bars above the log
    html = html.replace(anchor, pop + anchor, 1)
else:
    # Keep the popover and the clear button as siblings inside .ai-toolbar.
    # An earlier broken build could shred the clear button's opening tag, leaving
    # stray fragments between the popover close and the toolbar close. If that
    # happened (no intact <button id="ai-clear">), rebuild a proper button so
    # #ai-clear exists again and the sibling popover rule applies. Otherwise do
    # nothing, so repeated builds stay idempotent.
    if '<button type="button" id="ai-clear" class="icon-btn"' not in html:
        frag = "${icon('trash')}</button> title=\"پاک کردن گفت‌وگو\" aria-label=\"پاک کردن گفت‌وگو\" ${busy || (!messages.length && !draft && !historyBlocked) ? 'disabled' : ''}></button>"
        if frag in html:
            html = html.replace(
                frag,
                "<button type=\"button\" id=\"ai-clear\" class=\"icon-btn\" title=\"پاک کردن گفت‌وگو\" aria-label=\"پاک کردن گفت‌وگو\" ${busy || (!messages.length && !draft && !historyBlocked) ? 'disabled' : ''}>${icon('trash')}</button>",
                1,
            )
# Repair both existing and newly created toolbar templates on every build.
tools_icon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--card2)"/><circle cx="15" cy="17" r="3" fill="var(--card2)"/></svg>'
html, icon_count = re.subn(r'(<details id="ai-tools-pop"[^>]*><summary[^>]*>).*?(<span class="ai-tools-pop-label">)', lambda m: m[1] + tools_icon + m[2], html, flags=re.S)
assert icon_count == 1, 'tools summary icon anchor missing'
(D/'core.js').write_text(core)
F.write_text(html)
print('V5 core, bridge, CSS and compact chat toolbar rebuilt')