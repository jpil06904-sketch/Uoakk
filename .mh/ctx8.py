import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
def ctx(pat,before=150,after=900,maxn=8):
    for m in list(re.finditer(pat,s))[:maxn]:
        ln=s.count('\n',0,m.start())+1
        out.append(f'### {pat} L{ln} @{m.start()}\n'+s[max(0,m.start()-before):m.start()+after].replace('\n','⏎')+'\n')
ctx(r'function curriculumScopeKey|curriculumScopeKey\s*=',100,900,3)
ctx(r'unassigned',200,300,12)
ctx(r'ensureClassScope\(',200,250,20)
ctx(r'classScopeKey',150,250,25)
open('ctx8.txt','w',encoding='utf-8').write('\n'.join(out))
print('ok',len(out))
