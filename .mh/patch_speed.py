import sys
P='/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s=open(P,encoding='utf-8').read()
log=[]
def rep(old,new,n=1):
    global s
    c=s.count(old)
    if c!=n:
        log.append('FAIL count=%d for: %s'%(c,old[:120])); return
    s=s.replace(old,new); log.append('OK: '+old[:80])

# 1) timeouts / retry delays / transient statuses
rep("MAX_MODEL_RETRIES = 3, MODEL_RETRY_DELAY_MS = 2000,","MAX_MODEL_RETRIES = 3, MODEL_RETRY_DELAY_MS = 1000,")
rep("new Set([408,500,502,503,504]);","new Set([408,500,502,503,504,520,522,524]);")
rep("PANEL_FETCH_TIMEOUT_MS = 80000;","PANEL_FETCH_TIMEOUT_MS = 40000; let heavyDownUntil = 0;")
rep("ROUTER_FETCH_TIMEOUT_MS = 30000;","ROUTER_FETCH_TIMEOUT_MS = 8000;")

# 2) fetchModelWithRetry: panel => at most 1 retry; overloaded heavy model => no retry (request() falls back to the fast model at once)
rep("    for (let attempt = 0; attempt <= retries; attempt++) {\n      if (attempt) await waitAbortable(MODEL_RETRY_DELAY_MS",
    "    if (viaPanel) retries = Math.min(retries, model === HEAVY_MODEL ? 0 : 1);\n    for (let attempt = 0; attempt <= retries; attempt++) {\n      if (attempt) await waitAbortable(MODEL_RETRY_DELAY_MS")

# 3) request(): skip the heavy model while it is known to be down
rep("const model=options.model||LIGHT_MODEL;\n",
    "const model=options.model===HEAVY_MODEL&&!options.annualBudget&&Date.now()<heavyDownUntil?LIGHT_MODEL:(options.model||LIGHT_MODEL);\n")

# 4) request() catch: no heavy->light->heavy ping-pong; light failure => one light retry (heavy only for rate limits)
rep("if(model!==FALLBACK_MODEL&&isTransientModelFailure(error))return request(contents,info,signal,expectedProfile,{...options,model:FALLBACK_MODEL});",
    "if(model===HEAVY_MODEL&&isTransientModelFailure(error))heavyDownUntil=Date.now()+600000;\n           if(model!==FALLBACK_MODEL&&isTransientModelFailure(error))return request(contents,info,signal,expectedProfile,{...options,model:FALLBACK_MODEL,triedHeavy:true});")
rep("if(model===FALLBACK_MODEL&&!options.triedHeavy&&!annualBudgetMode&&isTransientModelFailure(error))return request(contents,info,signal,expectedProfile,{...options,model:HEAVY_MODEL,triedHeavy:true});",
    "if(model===FALLBACK_MODEL&&!options.triedHeavy&&!annualBudgetMode&&isTransientModelFailure(error))return request(contents,info,signal,expectedProfile,{...options,model:error.code==='MODEL_RATE_LIMIT'&&Date.now()>=heavyDownUntil?HEAVY_MODEL:FALLBACK_MODEL,triedHeavy:true});")

# 5) status path: heavy 5xx => mark down; light 5xx => do not escalate to the overloaded heavy model (only on 404)
rep("if((RETRYABLE_MODEL_STATUSES.has(response.status)||response.status===404)&&model!==FALLBACK_MODEL&&!options.triedHeavy)return",
    "if(model===HEAVY_MODEL&&RETRYABLE_MODEL_STATUSES.has(response.status))heavyDownUntil=Date.now()+600000;\n           if((RETRYABLE_MODEL_STATUSES.has(response.status)||response.status===404)&&model!==FALLBACK_MODEL&&!options.triedHeavy)return")
rep("if((RETRYABLE_MODEL_STATUSES.has(response.status)||response.status===404)&&model===FALLBACK_MODEL&&!options.triedHeavy&&!annualBudgetMode){",
    "if(response.status===404&&model===FALLBACK_MODEL&&!options.triedHeavy&&!annualBudgetMode&&Date.now()>=heavyDownUntil){")

# 6) thinking: always cap it (dynamic thinking made simple answers take 5-50 s)
rep("!allowToolCalls&&!programMode&&!thinkingTrimBroken&&normKey(fallbackPrompt).length<=24?{thinkingConfig:{thinkingBudget:model===LIGHT_MODEL?512:1024}}:{}",
    "!programMode&&!thinkingTrimBroken?{thinkingConfig:{thinkingBudget:allowToolCalls?1024:model===LIGHT_MODEL&&normKey(fallbackPrompt).length<=60?512:1024}}:{}")

# 7) classifier: if intent check fails, do not call the router as well
rep("      routeCache.set(prompt, label === 'RECORD' || label === 'OTHER' ? LIGHT_MODEL : HEAVY_MODEL);\n    } catch (_) {}",
    "      routeCache.set(prompt, label === 'RECORD' || label === 'OTHER' ? LIGHT_MODEL : HEAVY_MODEL);\n    } catch (_) { try { routeCache.set(prompt, modelForPrompt(prompt)); } catch (__) {} }")

bad=[l for l in log if l.startswith('FAIL')]
open('/workspaces/Uoakk/.mh/patch_speed.txt','w',encoding='utf-8').write('\n'.join(log)+'\nBAD=%d\n'%len(bad))
if not bad:
    open(P,'w',encoding='utf-8').write(s)
