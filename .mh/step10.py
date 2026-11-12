import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci10.txt','w',encoding='utf-8')
i=s.find('async function classifyPrompt(prompt, signal)')
out.write('#### classifyPrompt full\n'+s[i:i+3500]+'\n\n')
for pat in [r'maxOutputTokens:12',r'classifyPrompt\(',r'function modelForPrompt']:
    ms=list(re.finditer(pat,s))
    out.write('#### %s count=%d\n'%(pat,len(ms)))
    for m in ms[:6]: out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-900):m.start()+500]))
out.close()
