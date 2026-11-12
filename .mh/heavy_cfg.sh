#!/bin/bash
# Check gemini-3.5-flash with the exact generationConfig shapes the app sends (thinking budgets + tools).
cd /workspaces/Uoakk/.mh
OUT=heavy_cfg.txt
DID=$(tr -d '\n\r ' < live_did2.txt)
CODE='MH-E7FT-QEJ2'
M="${1:-gemini-3.5-flash}"
U="https://billowing-feather-ba20.ssioojiu63.workers.dev/panel/api.php?a=ai&m=$M"
Q='یکی از دانش‌آموزانم در جمع دو رقمی با انتقال مدام اشتباه می‌کند و دیروز هم گریه کرد. ریشه را تحلیل کن و برای فردا یک برنامهٔ سه‌قدمی بده.'
TOOL='"tools":[{"functionDeclarations":[{"name":"get_student","description":"اطلاعات یک دانش‌آموز را برمی‌گرداند","parameters":{"type":"OBJECT","properties":{"name":{"type":"STRING"}},"required":["name"]}}]}],'
echo "model=$M start $(date +%T)" > $OUT
run(){
  echo "== $1" >> $OUT
  printf '%s|%s\n%s' "$CODE" "$DID" "$2" > /tmp/hc.txt
  curl -s -m 95 -o /tmp/hcr.txt -w "HTTP %{http_code} total=%{time_total}\n" -X POST -H 'Content-Type: text/plain' --data-binary @/tmp/hc.txt "$U" >> $OUT 2>&1
  python3 - >> $OUT 2>&1 <<'EOF'
import json
raw=open('/tmp/hcr.txt',encoding='utf-8',errors='ignore').read()
try: d=json.loads(raw)
except Exception: print('non-json:',raw[:200]); raise SystemExit
if 'error' in d: print('ERR',d['error'].get('code'),d['error'].get('message','')[:240]); raise SystemExit
u=d.get('usageMetadata',{}); c=d['candidates'][0]; parts=c.get('content',{}).get('parts',[])
fc=[p['functionCall']['name'] for p in parts if 'functionCall' in p]
t=''.join(p.get('text','') for p in parts if not p.get('thought'))
print('OK finish=',c.get('finishReason'),'thoughts=',u.get('thoughtsTokenCount',0),'out=',u.get('candidatesTokenCount',0),'calls=',fc)
print('TEXT:',t[:260].replace('\n',' '))
EOF
}
run 'budget2048_no_tools' '{"contents":[{"role":"user","parts":[{"text":"'"$Q"'"}]}],"generationConfig":{"temperature":0.45,"maxOutputTokens":3072,"thinkingConfig":{"thinkingBudget":2048}}}'
run 'budget2048_with_tools' '{'"$TOOL"'"contents":[{"role":"user","parts":[{"text":"وضعیت سارا را بررسی کن و بگو فردا با او چه کنم."}]}],"generationConfig":{"temperature":0.45,"maxOutputTokens":3072,"thinkingConfig":{"thinkingBudget":2048}}}'
run 'budget0' '{"contents":[{"role":"user","parts":[{"text":"فقط بنویس: آماده"}]}],"generationConfig":{"maxOutputTokens":20,"thinkingConfig":{"thinkingBudget":0}}}'
echo "FINISHED $(date +%T)" >> $OUT
