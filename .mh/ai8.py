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
show('submit bind', r"addEventListener\('submit',e => \{ e\.preventDefault\(\); void run\(\); \}\)", 1500, 300, 1)
show('ai-message input', r"ai-message'\)\.(oninput|addEventListener)", 100, 600, 3)
show('classifyIntent def', r"async function classifyIntent", 0, 1800, 1)
show('classifyPrompt def', r"async function classifyPrompt", 0, 1500, 1)
show('profile def', r"function profile\(\)", 0, 900, 1)
show('need class info', r"اطلاعات کلاس را", 300, 300, 4)
show('verified usage', r"verified\s*=\s*true", 300, 300, 4)
show('ai-log render', r'id="ai-log"', 1200, 800, 1)
open('/workspaces/Uoakk/.mh/ai8.txt', 'w', encoding='utf-8').write('\n'.join(out))
