import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci14.txt','w',encoding='utf-8')
for pat,a,b in [(r'intentOf\(',250,200),(r'function isTransientModelFailure',0,500),(r'async function workerFallback',0,300),(r'WORKER_FALLBACK_ENABLED\s*=',50,80)]:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:12]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-a):m.start()+b].replace('\n',' | ')))
try: out.write('#### ping_heavy\n'+open('/workspaces/Uoakk/.mh/ping_heavy.txt',encoding='utf-8').read()[:2500])
except Exception as e: out.write(str(e))
out.close()
