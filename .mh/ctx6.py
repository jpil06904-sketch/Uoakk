import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
for pat in [r'function sampleState\(|sampleState\s*=\s*(function|\()',r'function enterDemoBeforeStorage|enterDemoBeforeStorage\s*=',r'classScopeKey\s*[:=]']:
    idxs=[m.start() for m in re.finditer(pat,s)]
    out.append(f'### {pat} count={len(idxs)}')
    for i in idxs[:5]:
        out.append(f'-- line {s.count(chr(10),0,i)+1}: '+s[i:i+700].replace(chr(10),' '))
open('ctx6.txt','w',encoding='utf-8').write('\n'.join(out))
