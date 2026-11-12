import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci9.txt','w',encoding='utf-8')
for pat,a,b in [(r'function adviceOnly',0,1200),(r'teachingPreflight\(',200,400),(r'let heavyDownUntil',200,200)]:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:4]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-a):m.start()+b].replace('\n',' | ')))
t=open('/workspaces/Uoakk/.mh/res_t1.txt',encoding='utf-8').read()
out.write('\n#### RES_T1 tail\n'+t[3000:12000])
out.close()
