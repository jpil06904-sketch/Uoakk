import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
s=re.sub(r'data:[a-z/+-]+;base64,[A-Za-z0-9+/=]{200,}','data:B64',s)
out=[]
def ln(i): return s.count('\n',0,i)+1
def show(label,pat,before=0,after=600,maxn=1):
    n=0
    for m in re.finditer(pat,s):
        out.append('=== %s L%d'%(label,ln(m.start())))
        out.append(s[max(0,m.start()-before):m.start()+after].replace('\n',' ⏎ '))
        n+=1
        if n>=maxn: break
    if not n: out.append('=== %s NOT FOUND'%label)
show('models',r'(?:LIGHT_MODEL|HEAVY_MODEL|MAIN_MODEL|PRO_MODEL)\s*=',0,400,3)
show('declarations',r'declarations\s*[:=]\s*\[',0,200,2)
names=sorted(set(re.findall(r"\{\s*name\s*:\s*'([a-z_]+)'\s*,\s*description",s)))
out.append('=== TOOL NAMES (%d): %s'%(len(names),', '.join(names)))
show('workerFallback',r'function workerFallback',0,1300)
show('key dialog html',r'ai-key-form',600,700)
show('system prompt const',r'(?:const|let)\s+system\s*=',0,1500)
show('quota daily',r'(?:DAILY|daily)[A-Z_]*LIMIT\w*\s*=',0,300,3)
open('chat5.txt','w',encoding='utf-8').write('\n'.join(out))
