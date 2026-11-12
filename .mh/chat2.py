import re, collections
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
s=re.sub(r'data:[a-z/+-]+;base64,[A-Za-z0-9+/=]{200,}','data:B64',s)
out=[]
def ln(i): return s.count('\n',0,i)+1
def show(label,pat,before=0,after=900,maxn=2):
    n=0
    for m in re.finditer(pat,s):
        a=max(0,m.start()-before); out.append('=== %s L%d'%(label,ln(m.start())))
        out.append(s[a:m.start()+after].replace('\n',' ⏎ '))
        n+=1
        if n>=maxn: break
    if n==0: out.append('=== %s NOT FOUND'%label)
# all pulse sub routes
r=collections.Counter(re.findall(r"#/pulse/[a-zA-Z0-9_-]+",s))
out.append('=== PULSE SUBROUTES: '+', '.join('%s:%d'%kv for kv in r.most_common()))
r=collections.Counter(re.findall(r"#/(?:curriculum|pro|class|outputs?|guide|about)(?:/[a-zA-Z0-9_-]+)?",s))
out.append('=== OTHER ROUTES: '+', '.join('%s:%d'%kv for kv in r.most_common()))
show('MehryarTools routes',r"const routes = \[\['#/students'",0,1800,1)
show('pulse/assistant handler',r"assistant\$/",200,500,3)
show('worker url',r"workers\.dev",300,200,4)
show('gemini',r"generativelanguage",400,300,2)
show('system prompt-ish',r"(تو دستیار|تو مهریار|شما دستیار|You are)",100,1500,3)
open('chat2.txt','w',encoding='utf-8').write('\n'.join(out))
