#!/bin/bash
cd /workspaces/Uoakk/.mh
rm -f rerun.done
TOOLS=0 QSET=teacher timeout 900 node chat_live.cjs /workspaces/Uoakk/mehryar-v4-final-fixed.html /workspaces/Uoakk/.mh/res2_t0.txt > res2_t0.log 2>&1
TOOLS=1 QSET=teacher timeout 900 node chat_live.cjs /workspaces/Uoakk/mehryar-v4-final-fixed.html /workspaces/Uoakk/.mh/res2_t1.txt > res2_t1.log 2>&1
grep -n '===\|ai gemini\|RETRY\|ERRS' res2_t0.txt | cut -c1-330 > sum2_t0.txt
grep -n '===\|ai gemini\|RETRY\|ERRS' res2_t1.txt | cut -c1-330 > sum2_t1.txt
echo DONE > rerun.done
