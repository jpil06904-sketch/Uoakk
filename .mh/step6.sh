#!/bin/bash
cd /workspaces/Uoakk/.mh
python3 - <<'EOF' > consts6.txt 2>&1
import re
s=open('/workspaces/Uoakk/mehryar-v4-final-fixed.html',encoding='utf-8').read()
for pat in [r'const (LIGHT_MODEL|HEAVY_MODEL|FALLBACK_MODEL|MAX_MODEL_RETRIES|MODEL_FETCH_TIMEOUT_MS|ROUTER_FETCH_TIMEOUT_MS|PANEL_MIN_REQUEST_GAP\w*|WORKER_FALLBACK_ENABLED)\s*=[^;]{0,200};',
            r'async function classifyIntent[\s\S]{0,1500}', r'function modelForPrompt[\s\S]{0,700}',
            r'async function fetchModelWithRetry[\s\S]{0,2500}', r'function reserveRequestSlot[\s\S]{0,900}',
            r'classifyPrompt\(']:
    for m in re.finditer(pat,s):
        print('@%d: %s\n'%(m.start(), m.group(0)))
print('HEAVY count', s.count('HEAVY_MODEL'))
EOF
sed -n '1,60p' res_t0_final.txt | cut -c1-600 > t0head.txt
cat t0sum.txt > t0sum_copy.txt 2>&1
MODELS=gemini-3.8-flash,gemini-3-pro-preview timeout 150 node ping_ai.cjs /workspaces/Uoakk/.mh/ping_heavy.txt 2 > ping_heavy.log 2>&1
echo DONE > step6.done
