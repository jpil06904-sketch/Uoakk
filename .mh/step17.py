import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci17.txt','w',encoding='utf-8')
i=s.find('if(response.status===429){const seconds=retrySeconds(response,data),rate=rateState();rate.backoffUntilByModel[model]')
out.write('#### after 429\n'+s[i+600:i+3200]+'\n\n')
for pat in [r'\.getReader\(\)', r'response\.body', r'instanceof SyntaxError']:
    ms=list(re.finditer(pat,s)); out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:6]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-200):m.start()+200].replace('\n',' | ')))
out.close()
