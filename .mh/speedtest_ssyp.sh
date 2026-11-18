#!/bin/bash
# تست سرعت واقعی مدل‌ها از مسیر پنل با کد MH-SSYP-TP35
# استفاده: bash speedtest_ssyp.sh MODEL BUDGET "سؤال"
cd /workspaces/Uoakk/.mh
DID=$(tr -d '\n\r ' < test_did_ssyp.txt)
CODE='MH-SSYP-TP35'
M="$1"; BUD="$2"; Q="$3"
U="https://billowing-feather-ba20.ssioojiu63.workers.dev/panel/api.php?a=ai&m=$M"
MAXT="${MAXT:-3072}" M="$M" BUD="$BUD" Q="$Q" CODE="$CODE" DID="$DID" python3 - > /tmp/st_body.txt <<'EOF'
import json,os
sys_t='تو مهریار، دستیار معلم ابتدایی ایرانی هستی. کوتاه، عملی و دقیق جواب بده.'
gc={"temperature":0.45,"maxOutputTokens":int(os.environ.get("MAXT","3072"))}
b=int(os.environ['BUD'])
if b!=-2: gc["thinkingConfig"]={"thinkingBudget":b}
body={"systemInstruction":{"parts":[{"text":sys_t}]},"contents":[{"role":"user","parts":[{"text":os.environ['Q']}]}],"generationConfig":gc}
print(os.environ['CODE']+'|'+os.environ['DID']+'\n'+json.dumps(body,ensure_ascii=False),end='')
EOF
curl -s -m ${TMO:-130} -o /tmp/st_resp.txt -w "%{http_code} %{time_total}" -X POST -H 'Content-Type: text/plain' --data-binary @/tmp/st_body.txt "$U" > /tmp/st_meta.txt
read HC TT < /tmp/st_meta.txt
python3 - "$M" "$BUD" "$HC" "$TT" <<'EOF'
import json,sys
m,b,hc,tt=sys.argv[1:]
raw=open('/tmp/st_resp.txt',encoding='utf-8',errors='ignore').read()
try:d=json.loads(raw)
except Exception:print(f'{m} budget={b} HTTP {hc} {float(tt):.1f}s non-json {raw[:120]!r}');sys.exit()
if 'error' in d:print(f'{m} budget={b} HTTP {hc} {float(tt):.1f}s ERR {str(d["error"].get("message",""))[:150]}');sys.exit()
u=d.get('usageMetadata',{});c=d['candidates'][0]
t=''.join(p.get('text','') for p in c.get('content',{}).get('parts',[]) if not p.get('thought'))
print(f'{m} budget={b} HTTP {hc} {float(tt):.1f}s thoughts={u.get("thoughtsTokenCount",0)} out={u.get("candidatesTokenCount",0)} chars={len(t)} finish={c.get("finishReason")}')
EOF
