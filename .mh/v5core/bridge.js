  /* ===== V5 bridge (inside assistant scope): router → stream → <actions> → async class_state ===== */
  let v5live = null, v5Panel = '', v5PaintQueued = false, v5MenuOpen = false;
  const v5Fmt = t => esc(t).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  const v5Ready = () => !!window.MehryarV5;
  function v5LiveHtml() {
    if (!v5live) return '';
    return `<article id="v5-live" class="ai-message assistant" aria-live="polite">${v5LiveInner()}</article>`;
  }
  function v5LiveInner() {
    if (v5live.text) return `<div class="ai-author">مهریار</div><div class="ai-bubble">${v5Fmt(v5live.text)}</div>${v5live.stage === 'thinking' ? '<div class="v5-stage" role="status">در حال فکر کردن…</div>' : ''}`;
    const sec = (Date.now() - v5live.t0) / 1000;
    return `<div class="v5-stage" role="status"><span class="ai-spinner" aria-hidden="true"></span><span data-v5-stage-text>${MehryarV5.stageText(v5live.stage, sec)}</span></div>`;
  }
  function paintV5Live() {
    if (v5PaintQueued) return; v5PaintQueued = true;
    requestAnimationFrame(() => {
      v5PaintQueued = false;
      const el = document.getElementById('v5-live'), log = document.getElementById('ai-log'); if (!el || !v5live) return;
      const stick = log ? log.scrollHeight - log.scrollTop - log.clientHeight < 120 : false;
      const stage = !v5live.text && el.querySelector('[data-v5-stage-text]');
      if (stage) stage.innerHTML = MehryarV5.stageText(v5live.stage, (Date.now() - v5live.t0) / 1000);
      else el.innerHTML = v5LiveInner();
      if (stick && log) log.scrollTop = log.scrollHeight;
    });
  }
  function v5MsgExtra(m, i) {
    if (m.role !== 'model') return '';
    const r = m.v5r ? MehryarV5.receiptHtml(m.v5r, i) : '';
    const tag = m.v5 ? `<span class="v5-route">${m.v5.route === 'FAST' ? '⚡ سریع' : '🧠 تحلیلی'} · ${fa((m.v5.ms / 1000).toFixed(1))} ثانیه</span>` : '';
    return r + tag;
  }
  function v5StripHtml() {
    if (!v5Ready()) return '';
    const dis = busy || pendingAnnualBudget ? 'disabled' : '';
    return `<details class="v5-menu" id="v5-menu" ${v5MenuOpen ? 'open' : ''}><summary>امکانات بیشتر مهریار</summary><div class="v5-strip"><button type="button" class="btn btn-tinted-gray" id="v5-brief" ${dis}>${MehryarV5.briefingDue() ? '☀️ بریفینگ صبح' : 'بریفینگ دوباره'}</button><button type="button" class="btn btn-tinted-gray" id="v5-growth" ${dis}>گزارش رشد یک شاگرد</button><button type="button" class="btn btn-tinted-gray" id="v5-settings" ${busy ? 'disabled' : ''}>حالت و امکانات کلاس</button></div>${v5Panel === 'settings' ? MehryarV5.settingsHtml() : v5Panel === 'growth' ? MehryarV5.growthPickerHtml() : ''}</details>`;
  }
  function v5Wire(get) {
    if (!v5Ready()) return;
    const pop = get('ai-tools-pop'), panel = pop?.querySelector('.ai-tools-pop-body');
    // Fixed placement avoids clipping by the toolbar's horizontal overflow guard.
    const place = () => {
      if (!pop?.open || !panel) return;
      const rect = pop.getBoundingClientRect(), vw = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(300, vw * .92), right = Math.max(0, Math.min(vw - rect.right, vw - width));
      panel.style.position = 'fixed'; panel.style.right = right + 'px'; panel.style.left = 'auto';
      panel.style.top = Math.max(0, rect.bottom + 8) + 'px';
      panel.style.maxHeight = Math.max(80, window.innerHeight - rect.bottom - 20) + 'px';
    };
    pop?.addEventListener('toggle', place);
    if (panel) {
      const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null; observer?.observe(pop);
      window.addEventListener('resize', place);
      // A refresh replaces this node, so its observer must not retain it.
      const cleanup = new MutationObserver(() => { if (!pop.isConnected) { observer?.disconnect(); window.removeEventListener('resize', place); cleanup.disconnect(); } });
      cleanup.observe(document.getElementById('content') || document.body, {childList:true,subtree:true});
    }
    get('v5-menu')?.addEventListener('toggle', e => { if (e.currentTarget.isConnected) v5MenuOpen = e.currentTarget.open; });
    get('v5-mic')?.addEventListener('click', () => MehryarV5.voiceToggle());
    MehryarV5.paintVoice();
    MehryarV5.wireFacilities();
    get('v5-brief')?.addEventListener('click', () => { void runV5('☀️ بریفینگ صبح امروز', 'briefing'); });
    get('v5-growth')?.addEventListener('click', () => { v5Panel = v5Panel === 'growth' ? '' : 'growth'; refresh(); });
    get('v5-settings')?.addEventListener('click', () => { v5Panel = v5Panel === 'settings' ? '' : 'settings'; refresh(); });
    get('v5-panel-close')?.addEventListener('click', () => { v5Panel = ''; refresh(); });
    get('v5-settings-save')?.addEventListener('click', () => { MehryarV5.readSettings(); v5Panel = ''; ui.toast('حالت و امکانات کلاس ذخیره شد', { icon: 'check' }); refresh(); });
    get('v5-state-reset')?.addEventListener('click', () => { if (window.confirm('حافظهٔ زندهٔ کلاس پاک شود؟')) { MehryarV5.resetClassState(); refresh(); } });
    get('v5-growth-go')?.addEventListener('click', () => { const id = get('v5-growth-student')?.value, s = studentById(id); if (!s) return; v5Panel = ''; void runV5('📈 گزارش رشد پایان ترم: ' + s.name, 'growth', id); });
    get('ai-log')?.addEventListener('click', e => {
      const u = e.target.closest('[data-v5-undo]'), f = e.target.closest('[data-v5-fix]');
      if (u) { const m = messages[Number(u.dataset.v5Undo)]; if (m?.v5r && MehryarV5.undoActions(m.v5r)) { ui.toast('ثبت‌های این پیام لغو شد', { icon: 'check' }); saveHistory(); refresh(); } }
      if (f) {
        const [i, j] = f.dataset.v5Fix.split(':').map(Number), m = messages[i], it = m?.v5r?.items?.[j]; if (!it) return;
        const isTopic = it.action.tool === 'syllabus', cur = isTopic ? it.action.topic : it.action.student;
        const val = window.prompt(isTopic ? 'صفحه یا فصل گفته‌شده را بنویس (مثلاً صفحه ۳۰ یا فصل ۲)، یا نام دقیق مبحث:' : 'نام درست دانش‌آموز را بنویس (همان‌طور که در فهرست کلاس است):', cur || '');
        if (val == null || !val.trim()) return;
        const ok = MehryarV5.fixAction(m.v5r, j, val.trim());
        ui.toast(ok ? 'اصلاح و ثبت شد' : 'باز هم پیدا نشد؛ نام را دقیق‌تر بنویس'); saveHistory(); refresh();
      }
    });
  }
