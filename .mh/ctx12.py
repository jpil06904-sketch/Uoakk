import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
def ln(i): return s.count('\n',0,i)+1
for name in ['function ensureClassScope','function classScopeSnapshot','const classScopedKeys','function classScopeKey','function curriculumScopeKey','function scopeKey','function academicYearKey']:
    i=s.find(name)
    out.append(f'=== {name} at L{ln(i) if i>=0 else -1}')
    if i>=0:
        j=s.find('\n  function ',i+10); k=s.find('\nfunction ',i+10)
        cands=[x for x in (j,k) if x>0]
        e=min(cands) if cands else i+3000
        out.append(s[i:min(e,i+4000)])
for pat in [r'ensureClassScope\(',r'classScopeKey',r'classScopeKlass',r'classContexts']:
    ms=list(re.finditer(pat,s))
    out.append(f'=== uses {pat}: {len(ms)}')
    for m in ms:
        out.append(f'L{ln(m.start())}: '+s[max(0,m.start()-160):m.start()+160].replace('\n','⏎'))
open('ctx12.txt','w',encoding='utf-8').write('\n'.join(out))
