
/* Topic-aware learning status: skillId remains the stored compatibility key. */
(() => {
  'use strict';
  if (window.__mehryarTopicStatus) return;
  window.__mehryarTopicStatus = true;

  const topicIdOf = item => String(item?.topicId || item?.skillId || '');
  const topicLabelOf = item => String(item?.topicLabel || item?.skillLabel || item?.label || 'مبحث نامشخص');
  const topicKeyOf = item => `${item?.studentId || ''}|${topicIdOf(item)}`;

  function normalizeTopicData(data) {
    const learning = data?.learning;
    if (!learning) return false;
    let changed = false;
    const set = (obj, key, value) => {
      if (value && obj[key] !== value) { obj[key] = value; changed = true; }
    };
    const findSkill = (id, subject) => learning.skills.find(skill =>
      skill.id === id && (!subject || skill.subject === subject)) || learning.skills.find(skill => skill.id === id);
    for (const skill of learning.skills || []) {
      set(skill, 'topicId', skill.topicId || skill.id);
      set(skill, 'topicLabel', skill.topicLabel || skill.label);
    }
    const normalizeSession = session => {
      if (!session || typeof session !== 'object') return;
      const skill = findSkill(session.topicId || session.skillId, session.subject);
      const id = session.topicId || session.skillId || skill?.id;
      set(session, 'topicId', id);
      set(session, 'skillId', session.skillId || id);
      set(session, 'topicLabel', session.topicLabel || session.skillLabel || skill?.topicLabel || skill?.label);
      set(session, 'skillLabel', session.skillLabel || session.topicLabel || skill?.label);
      set(session, 'subject', session.subject || skill?.subject);
    };
    for (const session of learning.sessions || []) normalizeSession(session);
    for (const draft of Object.values(learning.drafts || {})) normalizeSession(draft);
    for (const row of [...(learning.followups || []), ...(learning.dailyPlans || []), ...(learning.teachingReports || [])]) {
      if (!row || typeof row !== 'object') continue;
      const skill = findSkill(row.topicId || row.skillId, row.subject);
      const id = row.topicId || row.skillId || skill?.id;
      set(row, 'topicId', id);
      set(row, 'skillId', row.skillId || id);
      set(row, 'topicLabel', row.topicLabel || row.skillLabel || skill?.topicLabel || skill?.label);
      set(row, 'skillLabel', row.skillLabel || row.topicLabel || skill?.label);
      set(row, 'subject', row.subject || skill?.subject);
    }
    return changed;
  }

  const migrateBeforeTopics = migrate;
  migrate = function(saved) {
    const next = migrateBeforeTopics(saved);
    normalizeTopicData(next);
    return next;
  };
  const normalizedCurrent = normalizeTopicData(state);
  if (normalizedCurrent && !demoMode) { dirty = true; persist(); }

  const selectSessionsBeforeTopics = selectSessions;
  selectSessions = function(data = state, f = {}) {
    const topicId = f.topicId || '';
    const rows = selectSessionsBeforeTopics(data, topicId ? { ...f, skillId: topicId } : f);
    return topicId ? rows.filter(session => topicIdOf(session) === String(topicId)) : rows;
  };

  const observationsBeforeTopics = getDirectObservations;
  getDirectObservations = function(data = state, f = {}) {
    return observationsBeforeTopics(data, f).map(row => ({
      ...row,
      topicId: topicIdOf(row),
      topicLabel: topicLabelOf(row)
    }));
  };

  const historyBeforeTopics = getSkillHistory;
  getSkillHistory = function(id, subject, skillId, data = state, f = {}) {
    return historyBeforeTopics(id, subject, skillId || f.topicId, data, { ...f, skillId: skillId || f.topicId });
  };

  latestRecord = function(id, f = filter) {
    const sessions = selectSessions(state, f);
    for (let i = sessions.length - 1; i >= 0; i--) {
      const session = sessions[i];
      if (!session.rosterIds.includes(id)) continue;
      const record = session.records?.[id];
      if (!record) continue;
      return {
        ...record,
        date: session.date,
        sequence: session.sequence,
        subject: session.subject,
        skillId: session.skillId,
        skillLabel: session.skillLabel,
        topicId: topicIdOf(session),
        topicLabel: topicLabelOf(session)
      };
    }
    return null;
  };

  const newSessionBeforeTopics = newSession;
  newSession = function() {
    const session = newSessionBeforeTopics();
    normalizeTopicData({ learning: { skills: state.learning.skills, sessions: [session], drafts: {}, followups: [], dailyPlans: [], teachingReports: [] } });
    return session;
  };
  const saveQuickBeforeTopics = saveQuick;
  saveQuick = function() {
    normalizeTopicData({ learning: { skills: state.learning.skills, sessions: [quickDraft], drafts: {}, followups: [], dailyPlans: [], teachingReports: [] } });
    return saveQuickBeforeTopics();
  };

  const pdStatsBeforeTopics = pdStats;
  pdStats = function(data = state, f = {}) {
    const topicId = f.topicId || f.skillId || '';
    const result = pdStatsBeforeTopics(data, topicId ? { ...f, skillId: topicId } : f);
    const latest = new Map();
    for (const observation of result.obs || []) latest.set(topicKeyOf(observation), observation);
    const grouped = new Map();
    for (const observation of latest.values()) {
      const id = topicIdOf(observation);
      if (!id) continue;
      const key = `${observation.subject || ''}|${id}`;
      const row = grouped.get(key) || {
        topicId: id,
        topicLabel: topicLabelOf(observation),
        subject: observation.subject || '',
        red: 0,
        yellow: 0,
        green: 0,
        observedStudents: 0
      };
      if (row[observation.status] !== undefined) row[observation.status]++;
      row.observedStudents++;
      grouped.set(key, row);
    }
    result.topicId = topicId;
    result.latestTopicObservations = [...latest.values()];
    result.topicStatus = [...grouped.values()].sort((a, b) =>
      a.subject.localeCompare(b.subject, 'fa') || a.topicLabel.localeCompare(b.topicLabel, 'fa'));
    return result;
  };

  pulseDashboardView.topicId = pulseDashboardView.topicId || '';
  const pdFilterBeforeTopics = pdFilter;
  pdFilter = function() {
    const result = pdFilterBeforeTopics();
    const topicId = pulseDashboardView.topicId || '';
    if (topicId) {
      const topic = skillById(topicId);
      result.topicId = topicId;
      result.skillId = topicId;
      if (topic) result.subject = topic.subject;
    }
    return result;
  };
  const pdSyncBeforeTopics = pdSync;
  pdSync = function() {
    pdSyncBeforeTopics();
    const topicId = pulseDashboardView.topicId || '';
    filter.topicId = topicId;
    if (topicId) {
      const topic = skillById(topicId);
      if (topic) {
        pulseDashboardView.subject = topic.subject;
        filter.subject = topic.subject;
        filter.skillId = topicId;
      }
    } else if (pulseDashboardView.subject) {
      filter.skillId = state.learning.skills.find(skill => skill.subject === pulseDashboardView.subject)?.id || '';
    }
  };

  pdControls = function() {
    const range = pdRange();
    const subject = pulseDashboardView.subject || '';
    const topics = state.learning.skills.filter(skill => !subject || skill.subject === subject);
    return `<section class="pd-controls" aria-label="پایه، درس، مبحث و بازهٔ گزارش">
      <div class="pd-filter-fields">
        ${ui.field('پایهٔ کلاس', ui.select({ id:'pd-grade', value:pdGrade(), options:[['','همهٔ پایه‌ها'],...PD_GRADES], onChange:pdChangeGrade }))}
        ${ui.field('درس در آمار', ui.select({ id:'pd-subject', value:subject, options:[['','همهٔ درس‌ها'],...SUBJECTS], onChange:v=>{ pulseDashboardView.subject=v; pulseDashboardView.topicId=''; pdSync(); rerender(); } }))}
        ${ui.field('مبحث', ui.select({ id:'pd-topic', value:pulseDashboardView.topicId || '', options:[['','همهٔ مباحث'],...topics.map(topic=>[topic.id,subject?topic.label:`${topic.subject} / ${topic.label}`])], onChange:v=>{ pulseDashboardView.topicId=v; const topic=skillById(v); if(topic) pulseDashboardView.subject=topic.subject; pdSync(); rerender(); } }))}
      </div>
      <div class="pd-week-nav">
        ${ui.btnPlain('هفتهٔ قبل',()=>pdMoveWeek(-1),{attrs:'aria-label="هفتهٔ قبل"'})}
        <div><b>${range.from===pdRange(localISO()).from?'این هفته':'هفتهٔ انتخاب‌شده'}</b><small>${displayDay(range.from)} تا ${displayDay(range.to)}</small></div>
        ${ui.btnPlain('هفتهٔ بعد',()=>pdMoveWeek(1),{disabled:plusDays(range.from,7)>localISO(),attrs:'aria-label="هفتهٔ بعد"'})}
      </div>
    </section>`;
  };

  function topicStatusHtml(data) {
    const rows = data.topicStatus || [];
    const body = rows.length ? rows.map(row => {
      const choose = () => {
        pulseDashboardView.subject = row.subject;
        pulseDashboardView.topicId = row.topicId;
        pdSync();
        rerender();
      };
      return `<article class="topic-status-row">
        <div class="topic-status-main"><div><b>${esc(row.subject+' / '+row.topicLabel)}</b><small>${fa(row.observedStudents)} نفر با آخرین مشاهدهٔ این مبحث</small></div>${ui.btnPlain('فقط این مبحث',choose,{sm:true})}</div>
        <div class="topic-status-chips"><span class="topic-chip red">قرمز ${fa(row.red)}</span><span class="topic-chip yellow">زرد ${fa(row.yellow)}</span><span class="topic-chip green">سبز ${fa(row.green)}</span></div>
      </article>`;
    }).join('') : '<p class="pd-empty-inline">در این درس و بازه هنوز مشاهدهٔ مستقیمی ثبت نشده است.</p>';
    const scope = data.topicId ? 'برای مبحث انتخاب‌شده' : 'هر دانش‌آموز در هر مبحث جدا شمرده می‌شود';
    return `<section class="pd-panel topic-status-panel"><div class="pd-section-head"><div><h2>وضعیت به تفکیک مبحث</h2><p>${scope}؛ رنگ کلی برای چند مبحث با هم ساخته نمی‌شود.</p></div></div>${body}<p class="pd-footnote">فقط آخرین مشاهدهٔ مستقیم هر دانش‌آموز در همان مبحث در این شمارش است؛ یک دانش‌آموز می‌تواند در دو مبحث وضعیت متفاوت داشته باشد.</p></section>`;
  }

  function topicColorCounts(data) {
    const counts = { red:0, yellow:0, green:0, gray:0 };
    for (const observation of data.latestTopicObservations || []) if (counts[observation.status] !== undefined) counts[observation.status]++;
    if (data.topicId) counts.gray = Math.max(0, data.roster.length - (counts.red + counts.yellow + counts.green));
    else counts.gray = Math.max(0, data.roster.length - new Set((data.latestTopicObservations || []).map(o => o.studentId)).size);
    return counts;
  }

  function patchTopicColorStrip(data) {
    const root = document.getElementById('content');
    const cards = root?.querySelectorAll('.dv-color-metrics .dv-color');
    if (!cards?.length) return;
    const counts = topicColorCounts(data);
    ['red','yellow','green','gray'].forEach((color, index) => {
      const value = cards[index]?.querySelector('strong');
      if (value) value.textContent = fa(counts[color]);
    });
    const hint = root.querySelector('.dv-colors-panel .pd-footnote');
    if (hint) hint.textContent = data.topicId ? 'آخرین مشاهدهٔ هر دانش‌آموز در مبحث انتخاب‌شده؛ مشاهده‌نشده به معنی ضعف نیست.' : 'شمارش قرمز، زرد و سبز بر اساس آخرین مشاهدهٔ هر دانش‌آموز در هر مبحث است؛ یک نفر ممکن است بیش از یک بار در شمارش بیاید.';
  }

  function enhanceTopicDashboard() {
    if (location.hash !== '#/pulse' && location.hash !== '#/pulse/week') return;
    const root = document.getElementById('content');
    if (!root) return;
    root.querySelector('.topic-status-panel')?.remove();
    const data = pdStats(state, pdFilter());
    const wrapper = document.createElement('div');
    wrapper.innerHTML = topicStatusHtml(data);
    const panel = wrapper.firstElementChild;
    const target = root.querySelector(location.hash === '#/pulse' ? '.pd-grid' : '.pd-chart-panel');
    if (target?.parentNode) target.parentNode.insertBefore(panel, target);
    else root.append(panel);
    patchTopicColorStrip(data);
  }

  function renderTopicColorList(kind) {
    pdSync();
    const data = pdStats(state, pdFilter());
    const labels = { red:['قرمز','نیازمند آموزش دوباره'], yellow:['زرد','نیازمند تمرین'], green:['سبز','یادگیری ثبت‌شده'], gray:['مشاهده‌نشده','در این بازه دیده نشده'] };
    const [title, detail] = labels[kind] || labels.gray;
    const latest = data.latestTopicObservations || [];
    const selected = new Set(latest.filter(row => row.status === kind).map(row => topicKeyOf(row)));
    let rows = latest.filter(row => selected.has(topicKeyOf(row)));
    if (kind === 'gray') {
      const observed = new Set(latest.map(row => topicKeyOf(row)));
      const topicId = data.topicId;
      rows = data.roster.filter(student => topicId ? !observed.has(`${student.id}|${topicId}`) : !latest.some(row => row.studentId === student.id)).map(student => ({ studentId:student.id, name:student.name, subject:data.subject || '', topicLabel:topicId ? topicLabelOf(skillById(topicId) || {}) : 'مبحثی انتخاب نشده', date:'' }));
    }
    const body = rows.map(row => {
      const student = studentById(row.studentId);
      return `<a class="pd-person" href="#/pulse/student/${row.studentId}"><span class="pd-person-mark">${fa(student?.no || '•')}</span><span><b>${esc(student?.name || row.name || 'دانش‌آموز')}</b><small>${esc([row.subject, row.topicLabel].filter(Boolean).join(' / ')+(row.date?' · '+displayDay(row.date):''))}</small></span>${icon('chevron')}</a>`;
    }).join('');
    pulseMount(title+' — '+detail, `<div class="pd-dashboard">${pdControls()}<section class="pd-panel"><h1 class="pd-list-title">${title}</h1><p class="pd-footnote">${detail}؛ وضعیت هر دانش‌آموز در هر مبحث جدا بررسی می‌شود.</p>${body || '<p class="pd-empty-inline">در این گروه و بازه موردی وجود ندارد.</p>'}</section></div>`);
    document.getElementById('content')?.classList.add('pd-content');
  }

  const renderPulseBeforeTopics = renderPulse;
  renderPulse = function() {
    const result = renderPulseBeforeTopics.apply(this, arguments);
    enhanceTopicDashboard();
    return result;
  };
  const renderWeekBeforeTopics = renderWeek;
  renderWeek = function() {
    const result = renderWeekBeforeTopics.apply(this, arguments);
    enhanceTopicDashboard();
    return result;
  };
  const renderQuickBeforeTopics = renderQuick;
  renderQuick = function() {
    const result = renderQuickBeforeTopics.apply(this, arguments);
    if (/^#\/pulse\/(quick|session\/)/.test(location.hash)) {
      document.querySelectorAll('#content label').forEach(label => {
        if (label.textContent.trim() === 'مهارت') label.textContent = 'مبحث';
        if (label.textContent.trim() === 'موضوع کوتاه') label.textContent = 'عنوان جلسه (اختیاری)';
      });
    }
    return result;
  };

  ROUTES.unshift([/^#\/pulse\/color\/(red|yellow|green|gray)$/, match => renderTopicColorList(match[1])]);

  const style = document.createElement('style');
  style.textContent = `.pd-filter-fields{grid-template-columns:repeat(3,minmax(0,1fr))}.topic-status-panel{margin-top:14px}.topic-status-row{padding:12px 0;border-bottom:1px solid var(--sep)}.topic-status-row:last-of-type{border-bottom:0}.topic-status-main{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.topic-status-main b,.topic-status-main small{display:block}.topic-status-main small{color:var(--muted);font-size:12px;margin-top:4px}.topic-status-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.topic-chip{border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700}.topic-chip.red{color:#c02a20;background:rgba(255,59,48,.12)}.topic-chip.yellow{color:#b26a00;background:rgba(255,159,10,.16)}.topic-chip.green{color:#1f8f3b;background:rgba(52,199,89,.14)}@media(max-width:700px){.pd-filter-fields{grid-template-columns:1fr 1fr}}@media(max-width:480px){.pd-filter-fields{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  if (location.hash === '#/pulse' || location.hash === '#/pulse/week') scheduleRender();
})();
