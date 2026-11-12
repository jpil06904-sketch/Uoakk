import json, os, sys
os.chdir('/workspaces/Uoakk/.mh')
out = []
for f in sys.argv[1:] or ['smoke_empty.json', 'smoke_seed.json']:
    if not os.path.exists(f):
        out.append(f'{f} MISSING'); continue
    r = json.load(open(f))
    out.append(f"===== {f} seed={r.get('seed')} routes={len(r['routes'])} totalErrors={r['totalErrors']} bootErrors={r['bootErrors']}")
    out.append('blocked: ' + str(r['blockedRequests']))
    for e in r['errors']:
        out.append(f"ERR {e['route']} {e['type']} " + e['msg'][:900].replace('\n', ' | '))
    for x in r['routes']:
        flag = '' if x['final'] == x['route'] else '  -> ' + x['final']
        if x['errors'] or x['textLen'] < 20 or flag:
            out.append(f"ROUTE {x['route']} len={x['textLen']} err={x['errors']}{flag}")
    out.append('ALL ROUTES: ' + ', '.join(f"{x['route']}({x['textLen']})" for x in r['routes']))
open('summary.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('ok')
