import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
i=s.index('function renderProgress() {')
j=s.index('const weekProgressLabel = entry =>')
out=['### renderProgress len=%d'%(j-i), s[i+1800:j]]
open('ctx2.txt','w',encoding='utf-8').write('\n'.join(out))
