#!/bin/bash
# تست زندهٔ پنل با generationConfig دلخواه
# استفاده: TMO=60 bash gc_test.sh MODEL 'GENCONFIG_JSON' "سؤال" ["system"]
cd /workspaces/Uoakk/.mh
DID=$(tr -d '\n\r ' < test_did_ssyp.txt)
M="$1"; GC="$2"; Q="$3"; SYS="${4:-تو مهریار، دستیار معلم ابتدایی ایرانی هستی. کوتاه، عملی و دقیق جواب بده.}"
U="https://billowing-feather-ba20.ssioojiu63.workers.dev/panel/api.php?a=ai&m=$M"
OUT=/tmp/gc_resp_$$.txt; BODY=/tmp/gc_body_$$.txt
GC="$GC" Q="$Q" SYS="$SYS" DID="$DID" python3 - > $BODY <<'EOF'
import json,os
body={"systemInstruction":{"parts":[{"text":os.environ['SYS']}]},"contents":[{"role":"user","parts":[{"text":os.environ['Q']}]}],"generationConfig":json.loads(os.environ['GC'])}
print('MH-SSYP-TP35|'+os.environ['DID']+'\n'+json.dumps(body,ensure_ascii=False),end='')
EOF
META=$(curl -s -m ${TMO:-90} -o $OUT -w "%{http_code} %{time_total}" -X POST -H 'Content-Type: text/plain' --data-binary @$BODY "$U")
python3 - "$M" "$META" "$OUT" "$GC" <<'EOF'
import json,sys
m,meta,out,gc=sys.argv[1:]
hc,tt=meta.split()
raw=open(out,encoding='utf-8',errors='ignore').read()
tag=f'{m} {gc} HTTP {hc} {float(tt):.1f}s'
try:d=json.loads(raw)
except Exception:print(tag,'non-json',repr(raw[:150]));sys.exit()
if 'error' in d:print(tag,'ERR',str(d['error'].get('message',''))[:220]);sys.exit()
u=d.get('usageMetadata',{});c=(d.get('candidates') or [{}])[0]
t=''.join(p.get('text','') for p in c.get('content',{}).get('parts',[]) if not p.get('thought'))
print(tag,f'thoughts={u.get("thoughtsTokenCount",0)} out={u.get("candidatesTokenCount",0)} finish={c.get("finishReason")} text={t[:160]!r}')
EOF
rm -f $OUT $BODY
