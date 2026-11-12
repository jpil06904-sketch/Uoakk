import re
p='/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s=open(p,encoding='utf-8').read()
def rep(old,new):
    global s
    assert s.count(old)==1,(s.count(old),old[:80])
    s=s.replace(old,new)
# 1) broken heavy model (503) -> use the fast model for everything
rep("const HEAVY_MODEL = 'gemini-3.8-flash', LIGHT_MODEL = 'gemini-3-flash-preview'","const LIGHT_MODEL = 'gemini-3-flash-preview', HEAVY_MODEL = LIGHT_MODEL")
# 2) remove client-side throttles
rep("const PANEL_MIN_REQUEST_GAP = 400, PANEL_MAX_REQUESTS_PER_MINUTE = 30,","const PANEL_MIN_REQUEST_GAP = 0, PANEL_MAX_REQUESTS_PER_MINUTE = 100000,")
rep("const MIN_REQUEST_GAP = 4500, MAX_REQUESTS_PER_MINUTE = 6, HEAVY_REQUESTS_PER_DAY = 50, LIGHT_REQUESTS_PER_DAY = 1500,","const MIN_REQUEST_GAP = 0, MAX_REQUESTS_PER_MINUTE = 100000, HEAVY_REQUESTS_PER_DAY = 1000000, LIGHT_REQUESTS_PER_DAY = 1000000,")
# 3) less thinking = faster answers
rep("ideaMode?{thinkingConfig:{thinkingBudget:3072}}:learnMode?{thinkingConfig:{thinkingBudget:1024}}:isTomorrowPrompt(fallbackPrompt)?{thinkingConfig:{thinkingBudget:768}}","ideaMode?{thinkingConfig:{thinkingBudget:1024}}:learnMode?{thinkingConfig:{thinkingBudget:512}}:isTomorrowPrompt(fallbackPrompt)?{thinkingConfig:{thinkingBudget:512}}")
rep("thinkingBudget:allowToolCalls?1024:model===LIGHT_MODEL&&normKey(fallbackPrompt).length<=60?512:1024}","thinkingBudget:allowToolCalls?512:0}")
open(p,'w',encoding='utf-8').write(s)
print('ok')
