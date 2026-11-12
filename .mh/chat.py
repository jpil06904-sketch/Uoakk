import re, collections
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
def ln(i): return s.count('\n',0,i)+1
out=[];w=out.append
def show(pat,n=2,size=1800,before=0):
    for m in list(re.finditer(pat,s))[:n]:
        w(f'=== {pat} L{ln(m.start())}'); w(s[max(0,m.start()-before):m.start()+size].replace('\n','⏎'))
show(r'(const|let|var)\s+MehryarTools\s*=',1,4000)
show(r'MehryarTools\s*=\s*\(',1,3000)
w('=== tool names (name:\'...\')')
w(', '.join(sorted(set(re.findall(r"\bname\s*:\s*'([a-z_A-Z0-9]+)'",s)))))
w('=== functionDeclarations'); show(r'functionDeclarations',3,2500,200)
show(r'generativelanguage\.googleapis\.com',1,1200,600)
show(r'red-heart-c9c0',2,600,300)
show(r'billowing-feather',1,600,300)
show(r'DAILY_MESSAGE_WORKER\s*=',1,300)
show(r'function\s+dailyMessagePrompt',1,2500)
show(r'#/pulse',2,600,200)
open('chat.txt','w',encoding='utf-8').write('\n'.join(out))
