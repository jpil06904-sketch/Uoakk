import shutil, os, hashlib
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
B='/workspaces/Uoakk/.mh/backup-original.html'
if not os.path.exists(B): shutil.copy2(P,B)
s=open(P,encoding='utf-8').read()
log=[]
old1="const bookProgressSummary = book => { const nodes=curriculumNodes(book), progress=currentProgress(book.id),"
new1="const bookProgressSummary = book => { const nodes=curriculumNodes(book), progress=currentProgress(book?.id),"
assert s.count(old1)==1, ('old1', s.count(old1))
s=s.replace(old1,new1)
start=s.index('function renderProgress() {')
old2="const books=activeCurriculumBooks(), selected="
k=s.index(old2,start)
assert k-start<200, k-start
assert s.count(old2)==1, ('old2', s.count(old2))
new2=("const books=activeCurriculumBooks(); "
 "if(!books.length){progressEditor.bookId='';progressEditor.selectedNodeId='';progressEditor.preview=null;"
 "mount({title:'جایگاه واقعی تدریس',backHref:'#/curriculum',content:`${curriculumNav('curriculum/progress')}${classCurriculumNotice()}"
 "<div class=\"curriculum-empty\">هنوز کتاب فعالی برای این کلاس وجود ندارد؛ جایگاه تدریس بدون کتاب قابل ثبت نیست. "
 "ابتدا پایهٔ کلاس را مشخص کن یا از بخش «کتاب‌ها» کتاب واقعی کلاس را اضافه کن. ${link('#/curriculum/books','کتاب‌ها','book')}</div>`});return;} "
 "const selected=")
s=s[:k]+new2+s[k+len(old2):]
open(P,'w',encoding='utf-8').write(s)
log.append('OK size=%d backup=%s'%(os.path.getsize(P),os.path.getsize(B)))
open('/workspaces/Uoakk/.mh/fix_log.txt','w').write('\n'.join(log))
