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
show('ai-form bind', r"ai-form'\)\.on|ai-form'\)\?\.on|#ai-form", 80, 1200, 4)
show('ai-open-key bind', r"ai-open-key'\)\.on|ai-open-key'\)\?\.on|#ai-open-key", 80, 500, 3)
show('assistant hash', r"#/(assistant|ai|chat)\b", 80, 300, 6)
show('openAssistantWith def', r"function openAssistantWith", 0, 900, 2)
show('init def', r"function init\(\)\s*\{", 0, 1500, 3)
show('fetchJsonWithTimeout', r"async function fetchJsonWithTimeout", 0, 1500, 1)
open('/workspaces/Uoakk/.mh/ai6.txt', 'w', encoding='utf-8').write('\n'.join(out))
