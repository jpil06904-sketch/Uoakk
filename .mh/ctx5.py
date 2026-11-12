import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
out=[]
for pat in [r'classCurriculumNotice\(\)',r'ui\.empty\(',r'empty\s*:\s*\(?\{?|empty\(\{']:
    idxs=[m.start() for m in re.finditer(pat,s)]
    out.append(f'### {pat} count={len(idxs)}')
    for i in idxs[:6]:
        out.append(f'-- line {s.count(chr(10),0,i)+1}: '+s[max(0,i-250):i+350].replace(chr(10),' '))
i=s.index('function renderCurriculumHome() {')
out.append('### home: '+s[i:i+1600])
open('ctx5.txt','w',encoding='utf-8').write('\n'.join(out))
