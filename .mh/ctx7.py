import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
i=s.index('function sampleState(){'); out.append('### sampleState line %d\n'%(s.count('\n',0,i)+1)+s[i:i+3200])
k=s.index('classScopeKey=activeKey;data.classScopeKlass=clone(data.klass);return data;}')
st=s.rfind('\n',0,k-1800)
out.append('### scope fn around line %d\n'%(s.count('\n',0,k)+1)+s[st:k+1200])
for pat in [r'curriculumScopeKey\s*=|function curriculumScopeKey',r'const classScopeKeyOf|function classScopeKeyOf|classScopeKeyFor|const scopeKeyFor|function classKey\(|const classKey\s*=',r'ensureClassScope|syncClassScope|applyClassScope']:
    idxs=[m.start() for m in re.finditer(pat,s)]
    out.append(f'### {pat} count={len(idxs)}')
    for i in idxs[:8]:
        out.append(f'-- line {s.count(chr(10),0,i)+1}: '+s[max(0,i-120):i+380].replace(chr(10),' '))
open('ctx7.txt','w',encoding='utf-8').write('\n'.join(out))
