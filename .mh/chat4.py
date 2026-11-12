import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
s=re.sub(r'data:[a-z/+-]+;base64,[A-Za-z0-9+/=]{200,}','data:B64',s)
L=s.split('\n')
out=[]
def seg(t,a,b,w=330):
    out.append('=== '+t)
    for i in range(a-1,b):
        if i<len(L): out.append('%d| %s'%(i+1,L[i][:w]))
seg('labels/actions types',5590,5596)
seg('prepare',5984,5992)
seg('commit/undo',6220,6262)
seg('offline/ preflight',7421,7430)
seg('workerFallback/request',7541,7580)
seg('send',7637,7660)
seg('openKey',7904,7937)
out.append('=== systemInstruction hits')
for m in re.finditer(r'systemInstruction|system_instruction|functionDeclarations|function_declarations',s):
    out.append('L%d %s'%(s.count('\n',0,m.start())+1,s[max(0,m.start()-80):m.start()+260].replace('\n',' ⏎ ')))
open('chat4.txt','w',encoding='utf-8').write('\n'.join(out))
