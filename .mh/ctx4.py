import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
out=[]
for pat in [r'progressPreview\s*=\s*\(|function progressPreview',r'teachingProgress\s*:',r'const flattenNodes']:
    idxs=[m.start() for m in re.finditer(pat,s)]
    out.append(f'### {pat} count={len(idxs)}')
    for i in idxs[:3]:
        out.append(f'-- line {s.count(chr(10),0,i)+1}: '+s[i:i+900])
open('ctx4.txt','w',encoding='utf-8').write('\n'.join(out))
