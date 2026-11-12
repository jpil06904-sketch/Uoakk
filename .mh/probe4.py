import re
s = open('/workspaces/Uoakk/mehryar-v4-final-fixed.html', encoding='utf-8').read()
out = []
for pat in [r'function modelForPrompt', r'3\.8', r'LIGHT_FETCH_TIMEOUT_MS|HEAVY_FETCH_TIMEOUT_MS', r'function isClarificationPrompt', r'const send=async\(\)=>fetchModelWithRetry']:
    for m in list(re.finditer(pat, s))[:6]:
        out.append(f'{pat} {m.start()} ' + s[max(0, m.start()-200):m.start()+700].replace('\n', ' | '))
        out.append('..')
open('/workspaces/Uoakk/.mh/ci4.txt', 'w', encoding='utf-8').write('\n'.join(out))
