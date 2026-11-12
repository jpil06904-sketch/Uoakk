#!/bin/bash
# Test which "analytical" models answer through the real panel right now (short prompts, small output).
cd /workspaces/Uoakk/.mh
OUT=heavy_test.txt
DID=$(tr -d '\n\r ' < live_did2.txt)
CODE='MH-E7FT-QEJ2'
U='https://billowing-feather-ba20.ssioojiu63.workers.dev/panel/api.php?a=ai&m='
BODY='{"contents":[{"role":"user","parts":[{"text":"برای معلم کلاس دوم: دانش‌آموزی در جمع دو رقمی با انتقال اشتباه می‌کند. علت محتمل را در دو جمله بگو."}]}],"generationConfig":{"maxOutputTokens":2000}}'
echo "start $(date +%T)" > $OUT
for M in "$@"; do
  echo "== $M" >> $OUT
  printf '%s|%s\n%s' "$CODE" "$DID" "$BODY" > /tmp/hb.txt
  curl -s -m 95 -o /tmp/hr.txt -w "HTTP %{http_code} total=%{time_total}\n" -X POST -H 'Content-Type: text/plain' --data-binary @/tmp/hb.txt "$U$M" >> $OUT 2>&1
  python3 - >> $OUT 2>&1 <<'EOF'
import json
try:
    d=json.load(open('/tmp/hr.txt',encoding='utf-8'))
except Exception as e:
    print('non-json:',open('/tmp/hr.txt',encoding='utf-8',errors='ignore').read()[:200]); raise SystemExit
if 'error' in d: print('ERR',d['error'].get('code'),d['error'].get('message','')[:220])
else:
    u=d.get('usageMetadata',{}); t=''.join(p.get('text','') for p in d['candidates'][0]['content'].get('parts',[]))
    print('OK thoughts=',u.get('thoughtsTokenCount',0),'out=',u.get('candidatesTokenCount',0)); print('TEXT:',t[:300].replace('\n',' '))
EOF
done
echo "FINISHED $(date +%T)" >> $OUT
