P='/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s=open(P,encoding='utf-8').read()
log=[]
def rep(old,new,n=1):
    global s
    c=s.count(old)
    if c!=n: log.append('FAIL count=%d for: %s'%(c,old[:120])); return
    s=s.replace(old,new); log.append('OK: '+old[:80])

# 1) no network intent pre-call (one extra request per message, 1-5 s, and 429s that blocked the main answer); local regex routing remains
rep("  async function classifyIntent(prompt) {\n    try {\n      if (demoMode || !useTools) return;",
    "  const NETWORK_INTENT_CLASSIFIER = false;\n  async function classifyIntent(prompt) {\n    try {\n      if (!NETWORK_INTENT_CLASSIFIER || demoMode || !useTools) return;")
# 2) no network router pre-call: local heuristic picks the model
rep("    const cached = routeCache.get(prompt);\n    if (cached) return cached;\n    try {\n      const {response,data}=await fetchModelWithRetry(LIGHT_MODEL,{systemInstruction:{parts:[{text:ROUTER_SYSTEM_PROMPT}]}",
    "    const cached = routeCache.get(prompt);\n    if (cached) return cached;\n    if (!NETWORK_INTENT_CLASSIFIER) return modelForPrompt(prompt);\n    try {\n      const {response,data}=await fetchModelWithRetry(LIGHT_MODEL,{systemInstruction:{parts:[{text:ROUTER_SYSTEM_PROMPT}]}")
# 3) heavy model via panel: short timeout (it hung 40-80 s in live tests), then the fast model answers
rep("    const waitMs = viaPanel && timeoutMs === MODEL_FETCH_TIMEOUT_MS ? PANEL_FETCH_TIMEOUT_MS : timeoutMs;",
    "    const waitMs = viaPanel && timeoutMs === MODEL_FETCH_TIMEOUT_MS ? (model === HEAVY_MODEL ? 20000 : PANEL_FETCH_TIMEOUT_MS) : timeoutMs;")
# 4) STUDENT preflight refusal: skip when the teacher already named a concrete skill
rep("if(intentOf(prompt)==='STUDENT'&&inquiry.status==='insufficient_evidence'&&!promptHasConcreteEvidence(prompt))",
    "if(intentOf(prompt)==='STUDENT'&&inquiry.status==='insufficient_evidence'&&!promptHasConcreteEvidence(prompt)&&!/(جمع|تفریق|ضرب|تقسیم|انتقال|عدد|کسر|خواندن|روخوانی|نوشتن|املا|دیکته|حرف|کلمه|جمله|نشانه|ساعت|اندازه|شکل|علوم|ریاضی|فارسی)/.test(normKey(prompt)))")

bad=[l for l in log if l.startswith('FAIL')]
open('/workspaces/Uoakk/.mh/patch_speed2.txt','w',encoding='utf-8').write('\n'.join(log)+'\nBAD=%d\n'%len(bad))
if not bad: open(P,'w',encoding='utf-8').write(s)
