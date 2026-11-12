import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
r=open('/workspaces/Uoakk/.mh/res2_t1.txt',encoding='utf-8').read().split('\n')
out=open('/workspaces/Uoakk/.mh/ci13.txt','w',encoding='utf-8')
out.write('#### res2_t1 lines 30-48\n'+'\n'.join(x[:900] for x in r[29:48])+'\n\n')
for pat,a,b in [(r'گزارش «ضعیف است» کافی نیست',1500,300),(r'async function reserveRequestSlot',0,1500),(r'backoffUntilByModel\[model\]\s*>',300,600)]:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:3]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-a):m.start()+b]))
out.close()
