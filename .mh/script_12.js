
/* Budget radar: calm pacing notes at the end of the class pulse. Read-only; changes nothing. */
(() => {
  'use strict';
  if (window.__mehryarBudgetRadar) return;
  window.__mehryarBudgetRadar = true;

  const HIDE_KEY = 'mehryar_budget_radar_hidden';
  const ALERT_BEHIND = 3;   // این تعداد مبحث یا بیشتر عقب‌تر = فاصلهٔ زیاد
  const MAX_LISTED = 3;     // حداکثر مباحث جامانده‌ای که نام برده می‌شود
  const RANK = { alert: 4, warn: 3, info: 2, ahead: 1, ok: 0 };

  const isHidden = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch (_) { return false; } };
  const setHidden = value => { try { if (value) localStorage.setItem(HIDE_KEY, '1'); else localStorage.removeItem(HIDE_KEY); } catch (_) {} };
  const topicName = value => String(value && typeof value === 'object' ? value.topic : value || '').trim();
  const q = value => '«' + esc(value) + '»';
  const isDemo = () => { try { return typeof demoMode !== 'undefined' && !!demoMode; } catch (_) { return false; } };
  const demoItems = () => [
    { subject: 'ریاضی', level: 'alert', chip: `${fa(3)} مبحث عقب‌تر`, text: `آخرین مبحث تدریس‌شده: ${q('جمع و تفریق')}. طبق بودجه تا امروز (تخمینی) باید به ${q('شکل‌های هندسی')} می‌رسیدی.`, sub: `مباحث جامانده: ${q('ضرب اولیه')}، ${q('الگوها')}، ${q('شکل‌های هندسی')}.` },
    { subject: 'فارسی', level: 'ok', chip: 'طبق برنامه', text: `آخرین مبحث تدریس‌شده ${q('درس سوم')} است و با بودجهٔ امروز می‌خواند.` },
    { subject: 'علوم تجربی', level: 'ahead', chip: `${fa(1)} مبحث جلوتر`, text: 'از برنامهٔ تخمینی جلوتری. یک روز مرور یا آزمونک کمک می‌کند همهٔ بچه‌ها همراه بمانند.' }
  ];

  function subjectsOfBudget(budget) {
    const found = new Set();
    for (const month of Array.isArray(budget?.months) ? budget.months : []) {
      for (const item of Array.isArray(month?.subjects) ? month.subjects : []) { const name = item && (item.subjectTitle || item.subject); if (name) found.add(String(name)); }
      for (const item of Array.isArray(month?.lessons) ? month.lessons : []) { const name = item && (item.name || item.subjectTitle); if (name) found.add(String(name)); }
    }
    for (const entry of Array.isArray(budget?.entries) ? budget.entries : []) { if (entry && entry.subject) found.add(String(entry.subject)); }
    return [...found];
  }

  function itemFor(subject, result) {
    const hint = result && result.scheduleHint;
    if (!hint) return null;
    const last = topicName(hint.lastTaughtTopic), expected = topicName(hint.expectedTopicByTomorrow);
    if (hint.status === 'before_budget_start') return { subject, level: 'info', chip: 'هنوز زود است', text: `بودجهٔ این درس از ${esc(hint.firstBudgetMonth || 'ماه بعد')} شروع می‌شود.` };
    if (!hint.lastTaughtKnown) return { subject, level: 'info', chip: 'جایگاه ثبت نشده', text: 'آخرین مبحث تدریس‌شدهٔ این درس ثبت نشده است؛ رادار بدون آن نمی‌تواند سرعت را بسنجد.', cta: 'progress' };
    if (hint.status === 'behind') {
      const n = Number(hint.topicsBehind) || 0, names = (Array.isArray(hint.catchUpTopics) ? hint.catchUpTopics : []).map(topicName).filter(Boolean);
      const listed = names.slice(0, MAX_LISTED).map(q).join('، '), more = Math.max(0, n - MAX_LISTED);
      return { subject, level: n >= ALERT_BEHIND ? 'alert' : 'warn', chip: `${fa(n)} مبحث عقب‌تر`,
        text: `آخرین مبحث تدریس‌شده: ${q(last)}. طبق بودجه تا امروز (تخمینی) باید به ${q(expected)} می‌رسیدی.`,
        sub: listed ? `مباحث جامانده: ${listed}${more ? ' و ' + fa(more) + ' مبحث دیگر' : ''}.` : '' };
    }
    if (hint.status === 'on_track') return { subject, level: 'ok', chip: 'طبق برنامه', text: `آخرین مبحث تدریس‌شده ${q(last)} است و با بودجهٔ امروز می‌خواند.` };
    if (hint.status === 'ahead') {
      const n = Number(hint.topicsAhead) || 0;
      return { subject, level: 'ahead', chip: `${fa(n)} مبحث جلوتر`, text: `از برنامهٔ تخمینی جلوتری. یک روز مرور یا آزمونک کمک می‌کند همهٔ بچه‌ها همراه بمانند.` };
    }
    if (hint.status === 'past_budget_end') {
      const rest = Number(hint.remainingAfterLast) || 0;
      return rest > 0
        ? { subject, level: 'warn', chip: `${fa(rest)} مبحث مانده`, text: `بودجهٔ این درس تا ${esc(hint.lastBudgetMonth || 'آخرین ماه ثبت‌شده')} بود و هنوز ${fa(rest)} مبحث بعد از ${q(last)} مانده است.` }
        : { subject, level: 'ok', chip: 'بودجه تمام شد', text: 'همهٔ مباحث بودجهٔ این درس تدریس شده‌اند.' };
    }
    if (hint.status === 'month_without_topics') return { subject, level: 'info', chip: 'ماه بدون مبحث', text: 'برای این ماه مبحثی در بودجهٔ این درس ثبت نشده است.' };
    return null;
  }

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  let mountSeq = 0, cache = { sig: '', at: 0, data: null };
  const CACHE_MS = 8000;

  function currentGrade() { const filter = typeof pdFilter === 'function' ? (pdFilter() || {}) : {}; return filter.grade || ''; }

  function signature(grade) {
    let budgets = '';
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mehyar_budget_')) {
          const text = localStorage.getItem(key) || ''; let hash = 5381;
          for (let j = 0; j < text.length; j++) hash = ((hash << 5) + hash + text.charCodeAt(j)) | 0;
          budgets += key + ':' + text.length + ':' + hash + ';';
        }
      }
    } catch (_) {}
    const sessions = (state.learning && state.learning.sessions) || [], lastSession = sessions.length ? sessions[sessions.length - 1] : null;
    const progress = (state.curriculum && state.curriculum.teachingProgress) || {};
    let progressSig = ''; for (const id in progress) progressSig += id + ':' + (progress[id] && progress[id].updatedAt || '') + ':' + Object.keys(progress[id] && progress[id].statuses || {}).length + ';';
    return [grade, isDemo() ? 'demo' : '', localISO(), budgets, sessions.length, lastSession ? (lastSession.updatedAt || lastSession.date || '') : '', progressSig, ((state.curriculum && state.curriculum.books) || []).length].join('|');
  }

  async function model(grade, seq) {
    const base = MehryarTools.get_budget_and_progress({ grade, prompt: 'امروز', limit: 1 });
    if (!base || !base.budget) return { kind: 'nobudget', base: base || {} };
    const subjects = subjectsOfBudget(base.budget);
    if (!subjects.length) return { kind: 'noitems', base };
    const items = [];
    for (const subject of subjects) {
      await tick();
      if (seq !== mountSeq) return null;
      const result = MehryarTools.get_budget_and_progress({ grade, subject, prompt: 'امروز', limit: 1 });
      const item = result && result.subjectFound !== false ? itemFor(subject, result) : null;
      if (item) items.push(item);
    }
    return { kind: items.length ? 'items' : 'noitems', items, base };
  }

  function worstLevel(items) { return items.reduce((worst, item) => RANK[item.level] > RANK[worst] ? item.level : worst, 'ok'); }

  function leadFor(items) {
    const alerts = items.filter(i => i.level === 'alert').length, warns = items.filter(i => i.level === 'warn').length;
    if (alerts) return `برای ${fa(alerts + warns)} درس فاصله با بودجه زیاد شده؛ بهتر است برنامهٔ جبران بریزی. نگران نباش، با یک قدم کوچک شروع می‌شود.`;
    if (warns) return `${fa(warns)} درس کمی از برنامهٔ تخمینی عقب‌تر است. نگران نباش؛ جبرانش با چند قدم کوچک شدنی است.`;
    if (items.some(i => i.level === 'info')) return 'برای دقیق‌تر شدن رادار، جایگاه تدریس درس‌ها را ثبت کن.';
    if (items.some(i => i.level === 'ahead')) return 'از برنامهٔ تخمینی جلوتری؛ خبر خوبی است. فقط مطمئن شو بچه‌ها همراه‌اند.';
    return 'سرعت کلاس با بودجه می‌خواند.';
  }

  function html(data) {
    const head = count => `<div class="pd-section-head"><h2>رادار بودجه‌بندی</h2>${count}</div>`;
    const foot = '<p class="pd-footnote">بودجهٔ ماهانه تاریخ دقیق هر روز را ندارد؛ جایگاهِ مورد انتظار «تخمینی» است، نه حکم. این بخش چیزی را تغییر نمی‌دهد و فقط برای توست.</p>';
    const hide = '<button type="button" class="br-link" data-br="hide">پنهان‌کردن رادار</button>';
    if (data.kind === 'nobudget') {
      const others = Array.isArray(data.base.otherSavedBudgets) ? data.base.otherSavedBudgets : [];
      const text = others.length
        ? `برای پایهٔ ${esc(data.base.grade || 'فعال')} بودجه‌ای پیدا نشد؛ بودجهٔ ثبت‌شده برای ${others.map(b => 'پایهٔ ' + esc(b.grade)).join('، ')} است.`
        : 'هنوز بودجه‌بندی‌ای ثبت نشده است. اگر بودجه داری، ثبتش کن تا رادار سرعت را بسنجد؛ اگر از جدول خوشت نمی‌آید، می‌توانی این بخش را پنهان کنی.';
      return { level: 'none', html: head('') + `<p class="br-lead">${text}</p><div class="br-actions"><a class="btn btn-tinted" href="#/curriculum/budget">ثبت بودجه‌بندی</a>${hide}</div>` };
    }
    if (data.kind !== 'items') return { level: 'none', html: head('') + '<p class="br-lead">برای درس‌های بودجه هنوز مبحثی قابل سنجش نیست.</p><div class="br-actions"><a class="btn btn-tinted" href="#/curriculum/budget">دیدن بودجه</a>' + hide + '</div>' };
    const level = worstLevel(data.items), behind = data.items.filter(i => i.level === 'warn' || i.level === 'alert');
    const needsProgress = data.items.some(i => i.cta === 'progress');
    const cards = data.items.map(i => `<div class="br-item br-${i.level}" data-subject="${esc(i.subject)}"><div class="br-head"><b>${esc(i.subject)}</b><span class="br-chip">${esc(i.chip)}</span></div><p class="br-text">${i.text}</p>${i.sub ? `<p class="br-sub">${i.sub}</p>` : ''}</div>`).join('');
    const ask = behind.length ? `<button type="button" class="btn btn-tinted" data-br="ask" data-prompt="${esc(`در درس ${behind.map(i => i.subject).join(' و ')} از بودجه عقب‌ترم؛ بدون فشار به بچه‌ها برای جبران چه پیشنهادی داری؟`)}">پیشنهاد جبران از چت‌بات</button>` : '';
    const lead = (data.demo ? 'نمونهٔ فرضی است تا ببینی رادار چطور هشدار می‌دهد؛ با بودجهٔ خودت عددها واقعی می‌شود. ' : '') + leadFor(data.items);
    return { level, html: head(behind.length ? `<span class="pd-count br-count br-${level}">${fa(behind.length)}</span>` : '') + `<p class="br-lead">${esc(lead)}</p><div class="br-list">${cards}</div><div class="br-actions">${ask}<a class="btn btn-plain" href="#/curriculum/progress">${needsProgress ? 'ثبت جایگاه تدریس' : 'اصلاح جایگاه تدریس'}</a>${hide}</div>` + foot };
  }

  function openAssistantWith(text) {
    location.hash = '#/pulse/assistant';
    let tries = 0;
    const timer = setInterval(() => {
      const area = document.getElementById('ai-message');
      if (area) { area.value = text; area.dispatchEvent(new Event('input', { bubbles: true })); try { area.focus(); } catch (_) {} clearInterval(timer); }
      else if (++tries > 40) clearInterval(timer);
    }, 60);
  }

  function mount() {
    const dash = document.querySelector('#content .pd-dashboard');
    if (!dash) return;
    dash.querySelectorAll(':scope > .budget-radar').forEach(node => node.remove());
    const section = document.createElement('section');
    section.className = 'pd-panel budget-radar';
    section.setAttribute('role', 'region'); section.setAttribute('aria-label', 'رادار بودجه‌بندی');
    const seq = ++mountSeq;
    if (isHidden()) {
      section.dataset.level = 'hidden';
      section.innerHTML = '<div class="pd-section-head"><h2>رادار بودجه‌بندی</h2><button type="button" class="br-link" data-br="show">نمایش</button></div>';
    } else {
      const grade = currentGrade(), sig = signature(grade);
      if (cache.data && cache.sig === sig && Date.now() - cache.at < CACHE_MS) {
        section.dataset.level = cache.data.level; section.innerHTML = cache.data.html;
      } else {
        section.dataset.level = 'loading';
        section.innerHTML = '<div class="pd-section-head"><h2>رادار بودجه‌بندی</h2></div><p class="br-lead">در حال بررسی بودجه…</p>';
        (async () => {
          await tick();
          if (seq !== mountSeq || !section.isConnected) return;
          let data;
          try { let result = await model(grade, seq); if (!result) return; if (result.kind === 'nobudget' && isDemo()) result = { kind: 'items', items: demoItems(), demo: true, base: result.base }; data = html(result); } catch (_) { if (section.isConnected) section.remove(); return; }
          if (seq !== mountSeq || !section.isConnected) return;
          cache = { sig, at: Date.now(), data };
          section.dataset.level = data.level; section.innerHTML = data.html;
        })();
      }
    }
    section.addEventListener('click', event => {
      const target = event.target.closest('[data-br]'); if (!target) return;
      const action = target.dataset.br;
      if (action === 'hide') { setHidden(true); mount(); }
      else if (action === 'show') { setHidden(false); mount(); }
      else if (action === 'ask') openAssistantWith(target.dataset.prompt || '');
    });
    const footnote = dash.querySelector(':scope > .pd-footnote');
    dash.insertBefore(section, footnote || null);
  }

  const style = document.createElement('style');
  style.textContent = `.budget-radar .br-lead{margin:6px 0 12px;color:var(--muted);font-size:13px;line-height:1.9}.br-list{display:grid;gap:10px}.br-item{border:1px solid var(--sep);border-right-width:4px;border-radius:14px;padding:11px 12px}.br-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.br-chip{border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800}.br-text{margin:8px 0 0;font-size:13px;line-height:1.9}.br-sub{margin:4px 0 0;font-size:12px;color:var(--muted);line-height:1.9}.br-ok{border-right-color:#34c759}.br-ok .br-chip{color:#16682b;background:rgba(52,199,89,.14)}.br-ahead{border-right-color:#0a84ff}.br-ahead .br-chip{color:#0a64c2;background:rgba(10,132,255,.12)}.br-warn{border-right-color:#ff9f0a}.br-warn .br-chip,.br-count.br-warn{color:#8a5200;background:rgba(255,159,10,.16)}.br-alert{border-right-color:#ff6a00}.br-alert .br-chip,.br-count.br-alert{color:#b34700;background:rgba(255,106,0,.16)}.br-info{border-right-color:#8e8e93}.br-info .br-chip{color:#5c5c61;background:rgba(142,142,147,.16)}.br-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}.br-actions .btn{width:auto;padding-inline:14px;text-decoration:none}.br-link{background:none;border:0;color:var(--muted);font-size:12px;text-decoration:underline;cursor:pointer;padding:6px}html[data-theme=dark] .br-ok .br-chip{color:#7ce298;background:rgba(52,199,89,.22)}html[data-theme=dark] .br-ahead .br-chip{color:#7cc2ff;background:rgba(10,132,255,.24)}html[data-theme=dark] .br-warn .br-chip,html[data-theme=dark] .br-count.br-warn{color:#ffcf66;background:rgba(255,159,10,.24)}html[data-theme=dark] .br-alert .br-chip,html[data-theme=dark] .br-count.br-alert{color:#ffa56b;background:rgba(255,106,0,.26)}html[data-theme=dark] .br-info .br-chip{color:#d1d1d6;background:rgba(142,142,147,.26)}`;
  document.head.appendChild(style);

  const previousRenderPulse = renderPulse;
  renderPulse = function() {
    const result = previousRenderPulse.apply(this, arguments);
    try { mount(); } catch (_) {}
    return result;
  };
  if (location.hash === '#/pulse') setTimeout(() => { if (location.hash === '#/pulse') route(); }, 0);
})();
