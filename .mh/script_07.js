
(() => {
  'use strict';
  if (window.__mehryarDailyMessage) return;
  window.__mehryarDailyMessage = true;

  const DAILY_MESSAGE_WORKER = 'https://red-heart-c9c0.ssioojiu63.workers.dev/';
  const dailyMessageState = {day:'',busy:false,text:'',error:''};

  function dailyMessageTrim(value, limit=260) {
    return String(value || '').replace(/\s+/g,' ').trim().slice(0,limit);
  }

  function dailyMessageData() {
    const today = localISO();
    const sessions = Array.isArray(state.learning?.sessions) ? state.learning.sessions : [];
    const plans = Array.isArray(state.learning?.dailyPlans) ? state.learning.dailyPlans : [];
    const rows = [];
    const seen = new Set();
    const add = (subject, skill, title, detail) => {
      const row = [subject, skill, title, detail].map(value => dailyMessageTrim(value));
      if (!row.some(Boolean)) return;
      const key = row.join('|');
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({subject:row[0],skill:row[1],title:row[2],detail:row[3]});
    };
    sessions.filter(s => s.date === today).forEach(s => add(s.subject,s.skillLabel,s.lessonTitle,''));
    plans.filter(p => p.date === today).forEach(p => {
      const skill = typeof skillById === 'function' ? skillById(p.skillId) : null;
      add(p.subject || skill?.subject, p.skillLabel || skill?.label, p.lessonTitle || '', p.activityText || p.board || p.exitCheck || '');
    });
    return {today,rows};
  }

  function dailyMessagePrompt(data) {
    const identity = state.klass || {};
    const lessons = data.rows.map((row,i) => `${i+1}. ${[row.subject,row.skill,row.title].filter(Boolean).join(' / ')}${row.detail ? ` — ${row.detail}` : ''}`).join('\n');
    return `برای گروه اولیای کلاس یک «پیام روز» کوتاه و محترمانه بنویس.
تاریخ: ${displayDay(data.today)}
پایه: ${identity.grade || 'ثبت نشده'}
درس‌ها و موضوع‌های ثبت‌شدهٔ امروز:
${lessons}

فقط از اطلاعات بالا استفاده کن. تکلیف، زمان، نتیجهٔ یادگیری، حضور و نام دانش‌آموزان را حدس نزن. متن فارسی، گرم و قابل کپی در شاد یا ایتا باشد؛ سلام کوتاه، اشاره به درس‌های امروز و یک جملهٔ همکاری خانواده کافی است. متن را در ۲ تا ۴ خط بنویس و فقط خود پیام را برگردان.`;
  }

  function dailyMessagePanel() {
    const data = dailyMessageData();
    if (dailyMessageState.day !== data.today) { dailyMessageState.day = data.today; dailyMessageState.text = ''; dailyMessageState.error = ''; }
    const panel = document.createElement('section');
    panel.className = 'pd-panel daily-message-panel';
    panel.innerHTML = '<div class="daily-message-head"><div><h2>پیام روز ✉️</h2><p>پیام کوتاه برای گروه اولیا، بر اساس درس‌های امروز</p></div><span class="daily-message-badge">بدون نام دانش‌آموز</span></div><div class="daily-message-lessons" data-dm-lessons></div><div class="daily-message-actions"><button type="button" class="btn btn-primary" data-dm-generate>ساخت پیام روز</button><button type="button" class="btn btn-tinted" data-dm-copy hidden>کپی برای شاد / ایتا</button></div><p class="pd-footnote daily-message-status" data-dm-status role="status" aria-live="polite"></p><div class="daily-message-output" data-dm-output hidden></div>';
    const lessons = panel.querySelector('[data-dm-lessons]');
    const generate = panel.querySelector('[data-dm-generate]');
    const copy = panel.querySelector('[data-dm-copy]');
    const status = panel.querySelector('[data-dm-status]');
    const output = panel.querySelector('[data-dm-output]');
    lessons.textContent = data.rows.length ? `امروز: ${data.rows.map(row => [row.subject,row.skill,row.title].filter(Boolean).join(' / ')).join(' · ')}` : 'برای امروز جلسه یا برنامه‌ای ثبت نشده است.';
    generate.disabled = !data.rows.length;

    const paint = () => {
      generate.disabled = dailyMessageState.busy || !data.rows.length;
      generate.textContent = dailyMessageState.busy ? 'در حال ساخت پیام…' : 'ساخت پیام روز';
      copy.hidden = !dailyMessageState.text;
      output.hidden = !dailyMessageState.text;
      output.textContent = dailyMessageState.text;
      status.textContent = dailyMessageState.busy ? 'پیام در حال آماده‌شدن است؛ ممکن است کمی زمان ببرد.' : dailyMessageState.error || (!data.rows.length ? 'ابتدا جلسه یا برنامهٔ امروز را ثبت کن.' : dailyMessageState.text ? 'متن آماده است؛ پیش از ارسال یک‌بار بررسی‌اش کن.' : '');
      status.classList.toggle('daily-message-error',!!dailyMessageState.error);
    };

    copy.addEventListener('click', () => { if (dailyMessageState.text && typeof copyText === 'function') copyText(dailyMessageState.text); });
    generate.addEventListener('click', async () => {
      if (dailyMessageState.busy || !data.rows.length) return;
      dailyMessageState.day = data.today; dailyMessageState.busy = true; dailyMessageState.text = ''; dailyMessageState.error = ''; paint();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 240000);
      try {
        let answer = '';
        for (let attempt=0; attempt<3; attempt++) {
          const response = await fetch(DAILY_MESSAGE_WORKER,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:dailyMessagePrompt(data)}),signal:controller.signal});
          const body = await response.json().catch(() => ({}));
          if (!response.ok || typeof body.text !== 'string' || !body.text.trim()) throw new Error('پاسخ معتبر نبود.');
          answer = body.text.trim();
          if (attempt < 2 && /پاسخ موقتاً با کندی مواجه شد|مجدداً امتحان کنید/.test(answer)) { await new Promise(resolve => setTimeout(resolve,1200)); continue; }
          break;
        }
        if (!answer || /پاسخ موقتاً با کندی مواجه شد|مجدداً امتحان کنید/.test(answer)) throw new Error('پاسخ کامل دریافت نشد.');
        dailyMessageState.text = answer;
      } catch (error) {
        dailyMessageState.error = error.name === 'AbortError' ? 'ساخت پیام طول کشید؛ دوباره تلاش کن.' : 'ساخت پیام ممکن نشد؛ دوباره تلاش کن.';
      } finally {
        clearTimeout(timer); dailyMessageState.busy = false; paint();
      }
    });
    paint();
    return panel;
  }

  const previousRenderPulse = typeof renderPulse === 'function' ? renderPulse : null;
  if (!previousRenderPulse) return;
  renderPulse = function() {
    previousRenderPulse();
    const root = document.getElementById('content');
    const actions = root?.querySelector('.pd-main-actions');
    if (!actions || root.querySelector('.daily-message-panel')) return;
    actions.insertAdjacentElement('afterend',dailyMessagePanel());
  };

  const style = document.createElement('style');
  style.textContent = '.daily-message-panel{margin-top:14px}.daily-message-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.daily-message-head h2{margin:0 0 4px}.daily-message-head p{margin:0;color:var(--muted);font-size:12px}.daily-message-badge{font-size:11px;color:var(--green);background:color-mix(in srgb,var(--green) 12%,transparent);border-radius:999px;padding:6px 9px}.daily-message-lessons{margin:14px 0;padding:10px 12px;border-radius:12px;background:var(--card2);font-size:13px;line-height:1.8}.daily-message-actions{display:flex;gap:8px;flex-wrap:wrap}.daily-message-status{min-height:20px;margin:10px 0 0}.daily-message-error{color:var(--red)}.daily-message-output{margin-top:12px;padding:13px;border:1px solid var(--sep);border-radius:13px;white-space:pre-wrap;line-height:1.95;font-size:14px;background:var(--card2)}';
   document.head.appendChild(style);
    const budgetDraftStyle=document.createElement('style');budgetDraftStyle.textContent='.budget-draft-panel{margin-top:14px}.budget-draft-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.budget-draft-summary b{padding:7px 10px;border-radius:999px;background:var(--card2);font-size:11px}.budget-draft-list{display:grid;gap:10px}.budget-draft-row{border:1px solid var(--sep);border-radius:14px;padding:12px;background:var(--card2)}.budget-draft-row.matched{border-color:rgba(52,199,89,.45)}.budget-draft-row.ambiguous{border-color:rgba(255,159,10,.5)}.budget-draft-row.unresolved{border-color:rgba(255,59,48,.35)}.budget-draft-row-head{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.budget-draft-row-head span,.budget-draft-source,.budget-draft-reason{font-size:12px;color:var(--muted);line-height:1.8}.budget-draft-source{margin:6px 0;color:var(--text)}.budget-draft-fields{display:grid;grid-template-columns:2fr 1fr 1fr .7fr;gap:8px}.budget-draft-fields label,.budget-draft-choice{display:grid;gap:4px;font-size:11px;color:var(--muted);margin-top:8px}.budget-draft-fields input,.budget-draft-choice select{width:100%;min-width:0}.budget-draft-reason{margin:8px 0 0}.budget-draft-row input,.budget-draft-row select{border:1px solid var(--sep);border-radius:9px;padding:8px;background:var(--card);color:var(--text)}.budget-dependencies{margin:12px 0;padding:12px;border:1px solid rgba(10,132,255,.35);border-radius:14px;background:rgba(10,132,255,.06)}.budget-dependencies h3{margin:0 0 5px;font-size:14px}.budget-dependencies ul{margin:8px 0 0;padding:0 20px 0 0}.budget-dependencies li{margin:7px 0}.budget-dependencies small{display:block;color:var(--muted);line-height:1.7}@media(max-width:700px){.budget-draft-fields{grid-template-columns:1fr 1fr}.budget-draft-fields label:first-child{grid-column:1/-1}}';document.head.appendChild(budgetDraftStyle);
     const budgetChatStyle=document.createElement('style');budgetChatStyle.textContent='.ai-budget-preview{margin-top:12px;padding:12px;border:1px solid rgba(10,132,255,.35);border-radius:14px;background:rgba(10,132,255,.05)}.ai-budget-preview h4{margin:0 0 5px}.ai-budget-preview p{font-size:12px;color:var(--muted)}.ai-budget-summary{display:flex;gap:6px;flex-wrap:wrap;margin:9px 0}.ai-budget-summary span{padding:5px 8px;border-radius:999px;background:var(--card);font-size:11px}.ai-budget-dependencies{margin:10px 0;padding:9px;border-radius:10px;background:var(--card)}.ai-budget-dependencies ul{margin:6px 0;padding:0 18px 0 0}.ai-budget-dependencies li{margin:5px 0}.ai-budget-dependencies small,.ai-budget-rows span,.ai-budget-rows small{display:block;color:var(--muted);font-size:11px}.ai-budget-rows{display:grid;gap:7px}.ai-budget-rows>div{padding:8px;border:1px solid var(--sep);border-radius:9px;background:var(--card)}.ai-budget-rows b{font-size:12px}.ai-budget-rows small{margin-top:4px;white-space:pre-wrap}';document.head.appendChild(budgetChatStyle);
  if (location.hash === '#/pulse') {
    const root = document.getElementById('content');
    const actions = root?.querySelector('.pd-main-actions');
    if (actions && !root.querySelector('.daily-message-panel')) actions.insertAdjacentElement('afterend',dailyMessagePanel());
  }
})();
