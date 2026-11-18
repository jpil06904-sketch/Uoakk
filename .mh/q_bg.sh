#!/bin/bash
cd /workspaces/Uoakk/.mh
Q='بچه‌های کلاس سوم موقع ضرب حواسشان پرت است. یک راهکار کوتاه بده.'
for i in 1 2; do
TMO=90 bash gc_test.sh gemini-3.8-flash '{"maxOutputTokens":900,"thinkingConfig":{"thinkingLevel":"HIGH"}}' "$Q"
done
TMO=60 bash gc_test.sh gemini-3.8-flash '{"maxOutputTokens":20,"thinkingConfig":{"thinkingLevel":"MINIMAL"}}' 'سلام'
TMO=60 bash gc_test.sh gemini-3-flash-preview '{"maxOutputTokens":400,"thinkingConfig":{"thinkingLevel":"MINIMAL"}}' 'علی امروز غایب بود'
TMO=90 bash gc_test.sh gemini-3-flash-preview '{"maxOutputTokens":900,"thinkingConfig":{"thinkingLevel":"HIGH"}}' "$Q"
TMO=90 bash gc_test.sh gemini-3.5-flash '{"maxOutputTokens":900,"thinkingConfig":{"thinkingLevel":"HIGH"}}' "$Q"
echo ALLDONE
