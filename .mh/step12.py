import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci12.txt','w',encoding='utf-8')
for pat,a,b in [(r'async function fetchModelWithRetry',0,1800),(r'function fetchJsonWithTimeout|async function fetchJsonWithTimeout',0,1200),(r'intentCache\.get',400,300),(r'MIN_REQUEST_GAP\b',300,300),(r'function waitForSlot|async function throttle|PANEL_MIN_REQUEST_GAP\)',0,900)]:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:5]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-a):m.start()+b]))
out.close()
