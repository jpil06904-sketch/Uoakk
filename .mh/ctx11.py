import re
s=open('/workspaces/Uoakk/mehryar-v4-final (10).html',encoding='utf-8').read()
out=[]
for pat in [r'جدا نگه',r'کلاس قبلی',r'هر کلاس',r'سال قبل',r'بایگانی کلاس',r'تغییر کلاس',r'تغییر پایه',r'contexts\[',r'curriculum\.contexts|\.contexts\b']:
    ms=list(re.finditer(pat,s))
    out.append(f'=== {pat} count={len(ms)}')
    for m in ms[:6]:
        ln=s.count('\n',0,m.start())+1
        out.append(f'L{ln}: '+s[max(0,m.start()-220):m.start()+220].replace('\n','⏎'))
# class page full render function
i=s.find('function renderClass() {')
j=s.find('\nfunction ',i+20)
out.append('=== renderClass len=%d'%(j-i))
out.append(s[i:min(j,i+5000)])
open('ctx11.txt','w',encoding='utf-8').write('\n'.join(out))
