import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
def ctx(pat,before=150,after=600,maxn=8):
    ms=list(re.finditer(pat,s))
    out.append(f'=== {pat} count={len(ms)}')
    for m in ms[:maxn]:
        ln=s.count('\n',0,m.start())+1
        out.append(f'### L{ln} @{m.start()}\n'+s[max(0,m.start()-before):m.start()+after].replace('\n','⏎')+'\n')
ctx(r'classContexts',120,300,12)
ctx(r'setState\(\{\s*klass',200,400,6)
ctx(r'function setState|setState\s*=\s*function',50,500,4)
ctx(r'function addStudents|const addStudents|function parseNames|function importNames',50,500,4)
open('ctx9.txt','w',encoding='utf-8').write('\n'.join(out))
print('ok')
