import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
s=re.sub(r'data:[a-z/+-]+;base64,[A-Za-z0-9+/=]{200,}','data:B64',s)
L=s.split('\n')
out=[]
def seg(a,b,w=260):
    for i in range(a-1,b):
        if i<len(L): out.append('%d| %s'%(i+1,L[i][:w]))
# function names defined between MehryarTools (5582) and end of chat module (~8300)
out.append('=== FUNCS 5582-8300')
for i in range(5581,min(8300,len(L))):
    m=re.search(r'(?:async\s+)?function\s+(\w+)\s*\(|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(?[\w,\s{}=]*\)?\s*=>',L[i])
    if m: out.append('%d %s'%(i+1,m.group(1) or m.group(2)))
out.append('=== WORKERS / ENDPOINTS')
for m in re.finditer(r"https://[a-z0-9.-]+(?:workers\.dev|googleapis\.com)[^'\"`\s]*",s):
    out.append('L%d %s'%(s.count('\n',0,m.start())+1,m.group(0)))
out.append('=== around 6930-6990'); seg(6925,6995)
open('chat3.txt','w',encoding='utf-8').write('\n'.join(out))
