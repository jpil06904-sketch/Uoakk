import re
P = '/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s = open(P, encoding='utf-8').read()
out = []
def show(label, pat, before=100, after=1500, maxn=3):
    ms = list(re.finditer(pat, s))
    out.append('### %s %d' % (label, len(ms)))
    for m in ms[:maxn]:
        st = max(0, m.start() - before)
        out.append('  @%d :: %s' % (m.start(), s[st:m.start() + after].replace('\n', ' \u23ce ')))
        out.append('---')
show('profile def', r"function profile\(\)", 0, 1200, 1)
show('openKey def', r"function openKey\(", 0, 1400, 1)
show('isGreetingOnly def', r"function isGreetingOnly", 0, 400, 1)
show('toast def', r"toast\s*\(\s*msg|toast:\s*\(?\w*\)?\s*=>|function toast", 0, 500, 2)
show('demoMode in assistant', r"demoMode\s*&&|if\s*\(demoMode\)", 100, 250, 12)
show('ui.sheet def', r"sheet\s*\(\s*\{|sheet:\s*\(", 0, 600, 2)
open('/workspaces/Uoakk/.mh/ai9.txt', 'w', encoding='utf-8').write('\n'.join(out))
