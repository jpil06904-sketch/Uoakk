#!/bin/bash
cd /workspaces/Uoakk/.mh
python3 - <<'EOF' > ci7.txt 2>&1
import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
def ctx(i,a=600,b=900): return s[max(0,i-a):i+b].replace('\n',' | ')
for pat,a,b in [(r'RETRYABLE_MODEL_STATUSES\s*=',100,300),(r'برای پیشنهاد دقیقِ درسی',1500,400),(r'classifyPrompt\(prompt',1200,1500),
 (r'function isTransientModelFailure',0,700),(r'function isHeavyPrompt',0,900),(r'ROUTER_FETCH_TIMEOUT_MS\s*=',100,200),(r'MIN_REQUEST_GAP\s*=',100,200),
 (r'async function fetchJsonWithTimeout',0,1500),(r'function workerFallback',0,200)]:
    ms=list(re.finditer(pat,s))
    print('#### %s count=%d'%(pat,len(ms)))
    for m in ms[:3]: print('@%d: %s\n'%(m.start(),ctx(m.start(),a,b)))
EOF
head -c 9000 res_t1.txt > t1head.txt
grep -n '===\|ai gemini\|RETRY\|ERR' res_t1.txt | cut -c1-400 > t1sum.txt
echo DONE > step7.done
