import re, json
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
out=[]
for pat in ['const bookProgressSummary = book =>','function renderProgress() {','const weekProgressLabel = entry =>']:
    idxs=[m.start() for m in re.finditer(re.escape(pat),s)]
    out.append(f'### {pat} count={len(idxs)} idx={idxs}')
    for i in idxs:
        line=s.count('\n',0,i)+1
        out.append(f'-- line {line}')
        out.append(s[i:i+1800])
r=json.load(open('smoke_seed.json'))
out.append('### SEED: '+str(r.get('seed'))+' routes='+str(len(r['routes']))+' total='+str(r['totalErrors']))
out.append(', '.join(f"{x['route']}({x['textLen']},e{x['errors']})" for x in r['routes']))
open('ctx.txt','w',encoding='utf-8').write('\n'.join(out))
