import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci15.txt','w',encoding='utf-8')
for pat,a,b in [(r'fetchModelWithRetry\(',200,350),(r'(?:const|let)\s+(?:LIGHT_MODEL|HEAVY_MODEL|FALLBACK_MODEL)\b',50,300),(r'async function classifyIntent',0,2600)]:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:8]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-a):m.start()+b].replace('\n',' | ')))
out.close()
