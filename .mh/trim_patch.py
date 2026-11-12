p='/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s=open(p,encoding='utf-8').read()
old="(isFollowUpPlanPrompt(prompt)||isProgramPrompt(prompt)?10:6))).filter(m=>useTools||m.tools===false).map(m => ({role:m.role,parts:[{text:m.text}]}));"
new="(isFollowUpPlanPrompt(prompt)||isProgramPrompt(prompt)?10:4))).filter(m=>useTools||m.tools===false).map(m => ({role:m.role,parts:[{text:m.text.length>1500?m.text.slice(0,1500)+' …':m.text}]}));"
assert s.count(old)==1
s=s.replace(old,new)
open(p,'w',encoding='utf-8').write(s)
print('ok')
