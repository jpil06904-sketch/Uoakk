import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
out=open('/workspaces/Uoakk/.mh/ci11.txt','w',encoding='utf-8')
i=s.find('maxOutputTokens:12')
j=s.rfind('function ',0,i)
out.write('#### intent fn\n'+s[j-200:i+300]+'\n\n')
name=re.match(r'function\s+(\w+)',s[j:]).group(1)
out.write('NAME='+name+'\n')
for m in re.finditer(re.escape(name)+r'\(',s):
    out.write('@%d: %s\n\n'%(m.start(),s[max(0,m.start()-600):m.start()+300]))
out.close()
