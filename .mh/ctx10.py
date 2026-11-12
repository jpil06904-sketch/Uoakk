import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
i=s.find('function sampleState(){')
j=s.find('return s;}',i)
body=s[i:j+10]
out.append('SAMPLE LEN %d'%len(body))
for k in ['curriculum','classScope','classContexts','s.klass','s.students','s.learning=','s.progress']:
    out.append(k+' -> '+str([m.start() for m in re.finditer(re.escape(k),body)]))
out.append('HEAD: '+body[:1200])
for pat in [r'کلاس جدید',r'کلاس دیگر',r'سال تحصیلی جدید',r'جابه‌جایی کلاس',r'switchClass',r'classScopeKlass']:
    ms=list(re.finditer(pat,s))
    out.append(f'=== {pat} count={len(ms)}')
    for m in ms[:5]:
        ln=s.count('\n',0,m.start())+1
        out.append(f'L{ln}: '+s[max(0,m.start()-200):m.start()+200].replace('\n','⏎'))
open('ctx10.txt','w',encoding='utf-8').write('\n'.join(out))
