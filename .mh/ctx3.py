import re
P='/workspaces/Uoakk/mehryar-v4-final (10).html'
s=open(P,encoding='utf-8').read()
out=[]
def show(pat,n=900,before=0):
    idxs=[m.start() for m in re.finditer(pat,s)]
    out.append(f'### {pat} count={len(idxs)}')
    for i in idxs[:4]:
        out.append(f'-- line {s.count(chr(10),0,i)+1}: '+s[max(0,i-before):i+n])
show(r'const progressPreview\s*=',900)
show(r'const curriculumBook\s*=',300)
show(r'const activeCurriculumBooks\s*=',400)
show(r'function renderBudget\(\)',1500)
show(r'curriculum-empty',250,150)
show(r'bookProgressSummary\(',120,80)
open('ctx3.txt','w',encoding='utf-8').write('\n'.join(out))
