cd /workspaces/Uoakk/.mh
rm -f budget_variants.txt
run(){ echo "### BG='$1' BY='$2' BM='$3'" >> budget_variants.txt; BG="$1" BY="$2" BM="$3" timeout 60 node budget_mock.cjs /workspaces/Uoakk/mehryar-v4-final-fixed.html /workspaces/Uoakk/.mh/bm_tmp.txt >/dev/null 2>&1; grep -E 'LAST|REQS' bm_tmp.txt | cut -c1-330 >> budget_variants.txt; }
run 'پایه دوم ابتدایی' '1405-1406' 'آبان'
run 'دوم' '۱۴۰۵-۱۴۰۶' 'آبان'
run 'دوم' '1405-1406' 'آبان ماه'
run 'دوم' '1405-1406' 'مهر'
run 'دوم' '1404-1405' 'آبان'
echo FINISHED >> budget_variants.txt
