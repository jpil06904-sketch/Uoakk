#!/bin/bash
# Compare thinking budgets on gemini-3.5-flash for a realistic teacher question: time, thought tokens, full answer.
cd /workspaces/Uoakk/.mh
OUT=bench.txt
DID=$(tr -d '\n\r ' < live_did2.txt)
CODE='MH-E7FT-QEJ2'
M="gemini-3.5-flash"
U="https://billowing-feather-ba20.ssioojiu63.workers.dev/panel/api.php?a=ai&m=$M"
SYS='تو مهریار، دستیار معلم ابتدایی ایرانی هستی. کوتاه، عملی و دقیق جواب بده. فقط بر اساس داده‌های داده‌شده نتیجه بگیر و چیزی از خودت نساز.'
Q='کلاس دوم دارم، ۲۴ نفر. شش نفر در جمع دو رقمی با انتقال هنوز اشتباه می‌کنند؛ دو نفرشان در خواندن صورت مسئله هم مشکل دارند. هفتهٔ پیش با چوب‌خط تدریس کردم و بیشتر بچه‌ها یاد گرفتند. ریشهٔ مشکل این شش نفر را تحلیل کن، پیش‌بینی کن اگر کاری نکنم آخر ماه چه می‌شود، و برای فردا یک برنامهٔ ۲۰ دقیقه‌ای بده.'
echo "start $(date +%T)" > $OUT
for B in "$@"; do
  for R in 1 2; do
    echo "== budget=$B run=$R" >> $OUT
    BODY='{"systemInstruction":{"parts":[{"text":"'"$SYS"'"}]},"contents":[{"role":"user","parts":[{"text":"'"$Q"'"}]}],"generationConfig":{"temperature":0.45,"maxOutputTokens":3072,"thinkingConfig":{"thinkingBudget":'"$B"'}}}'
    printf '%s|%s\n%s' "$CODE" "$DID" "$BODY" > /tmp/bb.txt
    curl -s -m 100 -o /tmp/br.txt -w "HTTP %{http_code} total=%{time_total}\n" -X POST -H 'Content-Type: text/plain' --data-binary @/tmp/bb.txt "$U" >> $OUT 2>&1
    B=$B R=$R python3 - >> $OUT 2>&1 <<'EOF'
import json,os
raw=open('/tmp/br.txt',encoding='utf-8',errors='ignore').read()
try: d=json.loads(raw)
except Exception: print('non-json:',raw[:200]); raise SystemExit
if 'error' in d: print('ERR',d['error'].get('code'),d['error'].get('message','')[:200]); raise SystemExit
u=d.get('usageMetadata',{}); c=d['candidates'][0]
t=''.join(p.get('text','') for p in c.get('content',{}).get('parts',[]) if not p.get('thought'))
print('OK finish=',c.get('finishReason'),'thoughts=',u.get('thoughtsTokenCount',0),'out=',u.get('candidatesTokenCount',0),'chars=',len(t))
if os.environ['R']=='1': open('/workspaces/Uoakk/.mh/bench_ans_'+os.environ['B'].replace('-','m')+'.txt','w',encoding='utf-8').write(t)
EOF
  done
done
echo "FINISHED $(date +%T)" >> $OUT
