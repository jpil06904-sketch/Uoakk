#!/bin/bash
cd /workspaces/Uoakk/.mh
rm -f rerun3.done
TOOLS=1 QSET=teacher timeout 900 node chat_live.cjs /workspaces/Uoakk/mehryar-v4-final-fixed.html /workspaces/Uoakk/.mh/res3_t1.txt > res3_t1.log 2>&1
grep -n '===\|ai gemini\|RETRY\|ERRS' res3_t1.txt | cut -c1-330 > sum3_t1.txt
TOOLS=0 QSET=teacher timeout 900 node chat_live.cjs /workspaces/Uoakk/mehryar-v4-final-fixed.html /workspaces/Uoakk/.mh/res3_t0.txt > res3_t0.log 2>&1
grep -n '===\|ai gemini\|RETRY\|ERRS' res3_t0.txt | cut -c1-330 > sum3_t0.txt
echo DONE > rerun3.done
