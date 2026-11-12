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
show('speed verdict', r"const bad = st", 0, 1500, 1)
show('run def', r"async function run\(", 0, 2500, 1)
show('friendlyError', r"function friendlyError", 0, 1500, 1)
show('panel err map', r"(notact|unbound|d\.err|data\.err)", 200, 400, 6)
show('pulse assistant route', r"pulse\\/assistant", 100, 400, 3)
open('/workspaces/Uoakk/.mh/ai7.txt', 'w', encoding='utf-8').write('\n'.join(out))
