import re, subprocess
D='/workspaces/Uoakk/.mh/'
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
src=open(P,encoding='utf-8').read()
stripped=re.sub(r'(data:[a-z]+/[a-z0-9.+-]+;base64,)[A-Za-z0-9+/=]{200,}', lambda m: m.group(1)+'<<B64:%d>>'%len(m.group(0)), src)
open(D+'stripped.html','w',encoding='utf-8').write(stripped)
L=stripped.split('\n')
out=[f'stripped chars={len(stripped)} lines={len(L)} (line numbers identical to original)']
routes=sorted(set(re.findall(r"#/[a-zA-Z0-9_\-/]+", stripped)))
out.append(f'\nROUTES ({len(routes)}): '+' '.join(routes))
for i,l in enumerate(L):
    if re.search(r'(ROUTES\s*=|routes\s*=|function\s+router|function\s+route\b|hashchange)', l):
        out.append(f'ROUTER L{i+1}: {l.strip()[:250]}')
keys=sorted(set(re.findall(r"localStorage\.(?:getItem|setItem|removeItem)\(\s*['\"`]([^'\"`]+)", stripped)))
out.append(f'\nLS KEYS: {keys}')
for i,l in enumerate(L):
    if re.search(r'(indexedDB|STORAGE_KEY|STORE_KEY|APP_VERSION|VERSION\s*=)', l):
        out.append(f'STORE L{i+1}: {l.strip()[:220]}')
ext=sorted(set(re.findall(r'(?:src|href)=["\'](https?://[^"\']+)', stripped)))+sorted(set(re.findall(r"fetch\(\s*['\"`]([^'\"`]+)", stripped)))
out.append(f'\nEXTERNAL: {ext}')
fns=[(i+1,m) for i,l in enumerate(L) for m in re.findall(r'function\s+([A-Za-z_$][\w$]*)\s*\(', l)]
out.append(f'\nFUNCTIONS: {len(fns)}')
open(D+'functions.txt','w',encoding='utf-8').write('\n'.join(f'L{ln}\t{n}' for ln,n in fns))
# script blocks syntax check
blocks=[];pos=0
while True:
    m=re.compile(r'<script\b([^>]*)>',re.I).search(src,pos)
    if not m: break
    e=src.find('</script>',m.end()); blocks.append((m.start(),m.end(),e)); pos=e+9
for k,(s,cs,e) in enumerate(blocks):
    fn=D+f'script_{k:02d}.js'; open(fn,'w',encoding='utf-8').write(src[cs:e])
    r=subprocess.run(['node','--check',fn],capture_output=True,text=True)
    out.append(f'SCRIPT #{k:02d} L{src.count(chr(10),0,s)+1}-L{src.count(chr(10),0,e)+1} len={e-cs} -> '+('OK' if r.returncode==0 else 'ERR '+r.stderr[:300]))
open(D+'map.txt','w',encoding='utf-8').write('\n'.join(out))
print('done')
