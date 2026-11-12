import re, subprocess, os
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
out=[]
scripts=re.findall(r'<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>',s,re.S)
bad=0
for n,(attrs,code) in enumerate(scripts):
    if 'json' in attrs or 'template' in attrs: continue
    fn=f'/tmp/mh_chk_{n}.js'; open(fn,'w',encoding='utf-8').write(code)
    r=subprocess.run(['node','--check',fn],capture_output=True,text=True)
    if r.returncode: bad+=1; out.append(f'SYNTAX ERR script {n}: '+r.stderr[:600])
out.append(f'scripts={len(scripts)} syntaxErrors={bad}')
i=s.index('function renderProgress() {'); out.append('NEW HEAD: '+s[i:i+820])
i=s.index('const bookProgressSummary = book =>'); out.append('SUMMARY: '+s[i:i+130])
for pat in [r'const link\s*=|function link\(', r"\bbook\s*:\s*['\"`]<|['\"]book['\"]\s*:"]:
    for m in list(re.finditer(pat,s))[:2]: out.append(f'{pat}: '+s[m.start():m.start()+260].replace(chr(10),' '))
open('verify.txt','w',encoding='utf-8').write('\n'.join(out))
