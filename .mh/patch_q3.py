P='/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s=open(P,encoding='utf-8').read()
old="if(!useTools)return 'برای پیشنهاد دقیقِ درسی باید"
new="if(!useTools&&!isInstructionalIdeaPrompt(prompt)&&!isTomorrowPrompt(prompt))return '';\n    if(!useTools)return 'برای پیشنهاد دقیقِ درسی باید"
c=s.count(old)
if c==1:
    s=s.replace(old,new); open(P,'w',encoding='utf-8').write(s)
open('/workspaces/Uoakk/.mh/patch_q3.txt','w').write('count=%d\n'%c)
