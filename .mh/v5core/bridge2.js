  async function runV5(prompt, mode = 'chat', studentId = '') {
    if (busy || !v5Ready()) return;
    const p = profile();
    if (!p.ready) { errorText = 'اول اطلاعات اولیهٔ معلم و کلاس را وارد کن.'; refresh(); return; }
    if (!key) { openKey(true); return; }
    if (!navigator.onLine) { errorText = 'اینترنت قطع است. پس از اتصال دوباره تلاش کن.'; refresh(); return; }
    if (isActCode(key) && !window.__mehryarPanel) { errorText = 'اتصال به پنل در این نسخه روشن نیست.'; refresh(); return; }
    MehryarV5.voiceStop(true);
    const auth = { key, panel: isActCode(key) ? window.__mehryarPanel : null };
    const start = messages.findLastIndex(m => m.profile !== p.id) + 1;
    const history = mode === 'chat' ? messages.slice(start).filter(m => useTools || m.tools === false) : [];
    if (useTools && mode === 'chat') void MehryarV5.remember(history,p.id).catch(()=>{});
    const id = ++requestId, abort = new AbortController();
    controller = abort; pending = { role: 'user', text: prompt, profile: p.id, tools: useTools };
    if (mode === 'chat') draft = '';
    busy = true; errorText = '';
    v5live = { t0: Date.now(), stage: mode === 'chat' ? 'route' : 'DEEP', text: '' };
    saveHistory(); refresh(); scrollChat();
    const ticker = setInterval(() => { if (v5live && !v5live.text) paintV5Live(); }, 1000);
    try {
      const r = await MehryarV5.ask({ text: prompt, history, profile:p.id, auth, signal: abort.signal, mode, studentId, noData: !useTools,
        onStage: s => { if (id !== requestId || !v5live) return; if (s !== v5live.stage) { v5live.stage = s; v5live.t0 = Date.now(); } paintV5Live(); },
        onDelta: t => { if (id !== requestId || !v5live) return; v5live.text = t; paintV5Live(); } });
      if (id !== requestId) return;
      if (profile().id !== p.id) throw new Error('اطلاعات کلاس در این فاصله تغییر کرد؛ سؤال را دوباره بفرست.');
      verified = true; if (window.__mehryarStat) window.__mehryarStat('ai_ok');
      const receipt = !r.actions.length ? null : useTools ? MehryarV5.applyActions(r.actions)
        : { id: '', undone: false, items: r.actions.map(a => ({ ok: false, label: 'دسترسی ابزارها خاموش است؛ «' + String(a.tool) + '» ثبت نشد', fix: '', action: null })) };
      messages.push(pending, { role: 'model', text: r.text, profile: p.id, tools: useTools, v5: { route: r.route, ms: r.totalMs }, ...(receipt ? { v5r: receipt } : {}) });
      messages = messages.slice(-200); pending = null;
      if (useTools && mode === 'chat') void MehryarV5.remember([{role:'user',text:prompt}],p.id).catch(()=>{});
      if (mode === 'chat' && useTools) MehryarV5.scheduleStateUpdate(auth, [{ role: 'user', text: prompt }, { role: 'model', text: r.text }]);
      console.info('[Mehryar V5]', { route: r.route, model: r.model, fallbackModel: r.modelFallback, routerMs: r.routerMs, routerFallback: r.routerFallback, firstTokenMs: r.firstTokenMs, totalMs: r.totalMs, promptChars: r.promptChars, usage: r.usage, finish: r.finish });
    } catch (error) {
      if (id !== requestId) return;
      if (window.__mehryarStat && error?.name !== 'AbortError') window.__mehryarStat(error?.code === 'MODEL_RATE_LIMIT' ? 'ai_quota' : 'ai_err');
      if (mode === 'chat') draft = prompt;
      pending = null;
      errorText = error?.name === 'AbortError' ? 'درخواست متوقف شد و متن سؤال حفظ شد.' : error instanceof TypeError ? 'ارتباط برقرار نشد. اینترنت و دسترسی به سرویس را بررسی کن؛ متن سؤال حفظ شد.' : String(error?.message || error);
    } finally {
      clearInterval(ticker);
      if (id === requestId) { controller = null; busy = false; v5live = null; saveHistory(); refresh(); scrollChat(); }
    }
  }
