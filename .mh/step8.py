import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci8.txt','w',encoding='utf-8')
def ctx(i,a=600,b=900): return s[max(0,i-a):i+b].replace('\n',' | ')
for pat,a,b in [(r'function isTransientModelFailure',0,700),(r'classifyPrompt\(',300,500),(r'async function request\(',0,2500),
 (r'options\.model',300,300),(r'HEAVY_MODEL',120,120)]:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:40]: out.write('@%d: %s\n\n'%(m.start(),ctx(m.start(),a,b)))
out.close()
