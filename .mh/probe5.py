import re
s = open('/workspaces/Uoakk/mehryar-v4-final-fixed.html', encoding='utf-8').read()
out = []
i = s.find('const send=async()=>fetchModelWithRetry')
out.append('SEND LOOP @%d\n' % i + s[i:i+9000])
j = s.find('async function classifyPrompt')
out.append('\n\nCLASSIFYPROMPT @%d\n' % j + s[j:j+1800])
for pat in [r'intentChecking', r'aria-busy']:
    for m in re.finditer(pat, s):
        out.append(f'\n{pat} @{m.start()}: ' + s[max(0, m.start()-250):m.start()+250].replace('\n', ' | '))
open('/workspaces/Uoakk/.mh/ci5.txt', 'w', encoding='utf-8').write('\n'.join(out))
