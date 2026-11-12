import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci16.txt','w',encoding='utf-8')
i=s.find('const send=async()=>fetchModelWithRetry(model,')
j=s.find('signal,',i+200)
out.write('#### send tail\n'+s[j-200:j+2600]+'\n\n')
k=s.find('async function fetchModelWithRetry')
out.write('#### fmr body\n'+s[k+1500:k+3800]+'\n')
out.close()
