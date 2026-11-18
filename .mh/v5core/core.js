/* ===== Mehryar V5 core: AI router, O(1) context, streaming, <actions>, class_state, voice ===== */
window.MehryarV5 = (() => {
  'use strict';
  const STORE_KEY = 'mehryar_v5_brain';
  const FAST_MODEL = 'gemini-3-flash-preview', DEEP_MODEL = 'gemini-3.8-flash';
  const CLASS_MODES = ['حضوری عادی', 'مجازی/شاد', 'هفته مرور و امتحان'];
  const LEVELS = ['قفل ۱', 'قفل ۲', 'قفل ۳', 'مستقل'];
  const DEEP_STAGES = ['در حال خواندن پیام…', 'مهریار در حال فکر کردن…', 'در حال آماده‌سازی پاسخ دقیق‌تر…'];
  const today = () => localISO();
  const daysBetween = (a, b) => Math.round((dateObj(b) - dateObj(a)) / 86400000);
  const cut = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  // Persian normalisation for name matching: ي/ى→ی، ك→ک، removes ZWNJ/tatweel/diacritics.
  const norm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u200c\u200f\u200e]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const tight = s => norm(s).replace(/\s+/g, '');

  /* ---------- local store (separate from main state so migrations never drop it) ---------- */
  function load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) { s = {}; }
    s.classMode = CLASS_MODES.includes(s.classMode) ? s.classMode : 'حضوری عادی';
    s.facilities = Array.isArray(s.facilities) ? s.facilities.filter(x => typeof x === 'string').slice(0, 20) : [];
    const cs = s.classState && typeof s.classState === 'object' ? s.classState : {};
    s.classState = { main_track: String(cs.main_track || ''), lagging_group: String(cs.lagging_group || ''), advanced_group: String(cs.advanced_group || ''), last_action: String(cs.last_action || ''), what_failed: Array.isArray(cs.what_failed) ? cs.what_failed.filter(x => x && typeof x === 'object').slice(0, 2) : [], updatedAt: String(cs.updatedAt || '') };
    s.reminders = Array.isArray(s.reminders) ? s.reminders.slice(-60) : [];
    s.levels = s.levels && typeof s.levels === 'object' ? s.levels : {};
    s.positions = s.positions && typeof s.positions === 'object' ? s.positions : {};
    s.msgCount = Number(s.msgCount) || 0;
    s.lastBriefing = String(s.lastBriefing || '');
    return s;
  }
  let store = load();
  function save() { if (typeof demoMode !== 'undefined' && demoMode) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) {} }

  /* ---------- class_state hygiene: expire what_failed after 45 days, cap 200 words ---------- */
  function pruneClassState(cs) {
    const t = today();
    cs.what_failed = (cs.what_failed || []).filter(f => f && f.method && (!validDay(f.date) || daysBetween(f.date, t) <= 45)).slice(-2)
      .map(f => ({ topic: cut(f.topic, 40), date: validDay(f.date) ? f.date : t, method: cut(f.method, 90) }));
    for (const k of ['main_track', 'lagging_group', 'advanced_group', 'last_action']) cs[k] = cut(cs[k], 260);
    let guard = 0;
    while (words(JSON.stringify(cs)) > 200 && guard++ < 20) {
      const k = ['last_action', 'advanced_group', 'lagging_group', 'main_track'].sort((a, b) => cs[b].length - cs[a].length)[0];
      cs[k] = cut(cs[k], Math.max(20, Math.floor(cs[k].length * 0.75)));
    }
    return cs;
  }
  function classStateText() {
    const cs = pruneClassState(store.classState);
    const failed = cs.what_failed.map(f => `${f.method} (مبحث: ${f.topic || '؟'}، ${f.date})`).join(' | ');
    const lines = [cs.main_track && 'مسیر اکثریت: ' + cs.main_track, cs.lagging_group && 'گروه جامانده: ' + cs.lagging_group, cs.advanced_group && 'گروه پیشرو: ' + cs.advanced_group, cs.last_action && 'آخرین اقدام: ' + cs.last_action, failed && 'روش‌های شکست‌خورده: ' + failed].filter(Boolean);
    return lines.length ? lines.join('\n') : 'هنوز ثبت نشده است.';
  }

  /* ---------- O(1) context builders (pure JS, no AI) ---------- */
  const flat = (nodes, out = []) => { for (const n of Array.isArray(nodes) ? nodes : []) { out.push(n); if (n && n.children) flat(n.children, out); } return out; };
  const students = () => (typeof activeStudents === 'function' ? activeStudents() : state.students || []);
  function teacherProfile() {
    const k = state.klass || {};
    return `پایه: ${k.grade || '؟'} | تعداد شاگرد: ${students().length} | class_mode: ${store.classMode} | امکانات خاص (facilities): ${store.facilities.length ? store.facilities.join('، ') : 'هیچ امکان خاصی ثبت نشده (فقط وسایل رایگان کلاس)'}`;
  }
  // Compact year map (~400 tokens): week, topic, prerequisite, tick status.
  function syllabusMap() {
    const groups = planGroups();
    if (groups.length) return `تاریخ امروز: ${today()} (${displayDay(today())})\n` + cut(groups.map(g => g.subject + ': ' + g.rows.map(r => (r.month ? MONTHS[r.month-1]+': ' : '') + r.text).join(' | ')).join('\n'), 1700) + '\nوضعیت قطعی رادار:\n' + cut(radarContext(),1600);
    return `تاریخ امروز: ${today()} (${displayDay(today())})\nبرای پایه و سال فعال بودجه پیدا نشد؛ جای کلاس و فاصلهٔ تقویمی نامشخص است. بودجهٔ پایه یا سال دیگری را به این کلاس نسبت نده.`;
  }
  // Two-line JS summary of attendance + upcoming reminders.
  function toolsSummary() {
    const l = state.learning || {}, days = l.attendanceDays || {}, t = today(), from = plusDays(t, -30), tom = plusDays(t, 1), wk = plusDays(t, 7);
    const absent = {};
    for (const [d, row] of Object.entries(days)) if (d >= from && d <= t) for (const [id, v] of Object.entries(row || {})) if (v === 'absent') absent[id] = (absent[id] || 0) + 1;
    const warn = Object.entries(absent).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => `${studentById(id)?.name || '؟'} ${fa(n)} روز`).join('، ');
    const rem = store.reminders.filter(r => !r.done && r.when >= t && r.when <= wk).sort((a, b) => a.when.localeCompare(b.when)).slice(0, 4).map(r => `${r.when === t ? 'امروز' : r.when === tom ? 'فردا' : displayDay(r.when)}: ${cut(r.title, 40)}`);
    const fu = (l.followups || []).filter(f => f.status !== 'closed' && f.status !== 'done' && f.dueOn && f.dueOn <= tom).slice(0, 2).map(f => `پیگیری ${studentById(f.studentId)?.name || ''}: ${cut(f.action, 30)}`);
    return `هشدار غیبت (۳۰ روز اخیر): ${warn || 'موردی نیست'}\nیادآور نزدیک: ${[...rem, ...fu].join(' | ') || 'موردی نیست'}`;
  }
  function mentionedStudents(text, limit = 3) {
    const msg = tight(text); if (!msg) return [];
    const tokens = new Set(norm(text).split(/[^\u0600-\u06FFa-z0-9]+/).filter(Boolean));
    const hits = [];
    for (const s of students()) {
      const full = tight(s.name), first = tight(String(s.name || '').split(/\s+/)[0]);
      if ((full.length >= 3 && msg.includes(full)) || (first.length >= 2 && tokens.has(first))) hits.push(s);
    }
    return hits.slice(0, limit);
  }
  function growthEvents(id, n) { return ((state.learning || {}).evidenceLog || []).filter(e => e.studentId === id).sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(n ? -n : 0); }
  function studentsBlock(text) {
    const hits = mentionedStudents(text); if (!hits.length) return '';
    return hits.map(s => `${s.name} — current_level: ${store.levels[s.id]?.level || 'ثبت نشده'}؛ ۳ رویداد آخر: ${growthEvents(s.id, 3).map(e => `${e.date}: ${cut(e.text, 70)}`).join(' / ') || 'ندارد'}`).join('\n');
  }
  /* One source for the chat and pulse radar. Monthly plans are ranges, not daily deadlines. */
  const digits = s => String(s ?? '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  const scopeKey = () => JSON.stringify([state.klass?.grade || '', digits(state.klass?.year || ''), state.klass?.className || '', state.klass?.school || '']);
  const subjectKey = s => tight(s).replace(/تجربی|بخوانیم|آموزش|[()]/g, '').replace(/هدیههایآسمان|هدیهها/, 'هدیه');
  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  function calendarParts() {
    const p = new Intl.DateTimeFormat('en-US-u-ca-persian', { year:'numeric', month:'numeric', day:'numeric' }).formatToParts(dateObj(today()));
    return Object.fromEntries(p.filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  }
  const gradeKey = value => {
    const raw = digits(value || '').replace(/^(?:پایه|کلاس)[ٔ‌\s]*/, '').replace(/\s*ابتدایی$/, '').trim();
    return /^[1-6]$/.test(raw) ? ['اول','دوم','سوم','چهارم','پنجم','ششم'][+raw - 1] : norm(raw);
  };
  function annualPlan(grade = state.klass?.grade || '') {
    // Reuse the app's grade/year-aware reader, including its legacy-key support.
    try {
      if (typeof MehryarTools !== 'undefined') {
        const result = MehryarTools.get_budget_and_progress({ grade, limit:1 });
        return result?.budget ? { ...result.budget, __v5YearAssumed: !!result.budgetYearAssumed } : null;
      }
    } catch (_) { return null; }
    const year = digits(state.klass?.year || '').replace(/[–—]/g, '-');
    const keys = [`mehyar_budget_${grade}_${year}`, `mehyar_budget_${year}_${grade}`, localStorage.getItem('mehyar_last_budget_key')];
    for (const key of keys.filter(Boolean)) try {
      const p = JSON.parse(localStorage.getItem(key) || 'null');
      if (p && gradeKey(p.grade) === gradeKey(grade) && (!year || digits(p.academicYear) === year) && Array.isArray(p.months)) return p;
    } catch (_) {}
    return null;
  }
  function numberRange(text, unit) {
    const re = unit === 'page' ? /صفح(?:ه|ات)\s*(\d+)(?:\s*(?:تا|[-–])\s*(\d+))?/ : /(?:فصل|درس)\s*(\d+)(?:\s*(?:تا|[-–])\s*(\d+))?/;
    const m = digits(text).match(re); return m ? [Number(m[1]), Number(m[2] || m[1])] : null;
  }
  function planGroups(grade = state.klass?.grade || '') {
    if (!gradeKey(grade)) return [];
    const annual = annualPlan(grade), groups = new Map(), cur = state.curriculum || {};
    const budgetYear = Number(digits(annual?.academicYear || state.klass?.year).match(/\d{4}/)?.[0]);
    const add = (subject, row, yearAssumed = false) => { const key = subjectKey(subject); if (!key) return; if (!groups.has(key)) groups.set(key, { key, subject, budgetYear, yearAssumed, rows:[] }); groups.get(key).rows.push(row); };
    if (annual?.months?.length) {
      for (const month of annual.months.filter(x => x && typeof x === 'object')) for (const s of [
        ...(Array.isArray(month.subjects) ? month.subjects : []),
        ...(Array.isArray(month.lessons) ? month.lessons.filter(Boolean).map(x => ({subjectTitle:x.name || x.subjectTitle, topics:[x.topic || x.lesson || '']})) : [])
      ]) {
        if (!s) continue;
        const topics = Array.isArray(s.topics) ? s.topics : [], text = topics.join('؛ '), pageRanges = topics.map(x => numberRange(x, 'page')).filter(Boolean), chapters = topics.map(x => numberRange(x, 'chapter')).filter(Boolean);
        add(s.subjectTitle || s.subject, { text, month: MONTHS.findIndex(m => norm(month.monthName || month.month || '').includes(m)) + 1,
          pages: pageRanges.length ? [Math.min(...pageRanges.map(x=>x[0])), Math.max(...pageRanges.map(x=>x[1]))] : null,
          chapters: chapters.length ? [Math.min(...chapters.map(x=>x[0])), Math.max(...chapters.map(x=>x[1]))] : null }, !!annual.__v5YearAssumed);
      }
    }
    {
      // The application's reader returns only approved entries for this grade and year.
      // Never fall back to the raw curriculum when the scoped reader found no budget.
      // Annual rows take precedence for their entire subject, not just one month.
      const annualSubjects = new Set(groups.keys());
      let entries = [];
      try { entries = typeof MehryarTools !== 'undefined' ? (MehryarTools.getCurriculumBudget?.({grade,year:state.klass?.year}) || []) : (cur.budget?.entries || []); } catch (_) {}
      for (const row of entries) {
        const b = (cur.books || []).find(b => b.id === row.bookId); if (!b) continue;
        if (annualSubjects.has(subjectKey(b.subject || b.title))) continue;
        if (b.grade && gradeKey(b.grade) !== gradeKey(grade)) continue;
        if (!b.grade && gradeKey(grade) !== gradeKey(state.klass?.grade)) continue;
        const year = digits(state.klass?.year || '').replace(/[–—]/g, '-');
        if (year && (b.academicYear && digits(b.academicYear).replace(/[–—]/g, '-') !== year || row.academicYear && digits(row.academicYear).replace(/[–—]/g, '-') !== year)) continue;
        const node = flat(b.nodes).find(n => n.id === row.nodeId), text = row.nodeTitle || node?.title || '';
        add(b.subject || b.title, { text, start:row.startDate, end:row.endDate, nodeId:row.nodeId, bookId:b.id,
          pages: node?.pageStart ? [Number(digits(node.pageStart)), Number(digits(node.pageEnd || node.pageStart))] : numberRange(text,'page'), chapters:numberRange(text,'chapter') });
      }
    }
    for (const group of groups.values()) {
      const merged = [];
      for (const row of group.rows) {
        const existing = row.month && merged.find(x => x.month === row.month);
        if (!existing) { merged.push(row); continue; }
        existing.text += '؛ ' + row.text;
        for (const field of ['pages','chapters']) if (row[field]) existing[field] = existing[field] ? [Math.min(existing[field][0],row[field][0]),Math.max(existing[field][1],row[field][1])] : row[field];
      }
      group.rows = merged.sort((a,b) => String(a.start || '').localeCompare(String(b.start || '')));
    }
    return [...groups.values()];
  }
  const positionKey = subject => scopeKey() + '|' + subjectKey(subject);
  function radarData({grade = state.klass?.grade || ''} = {}) {
    const calendar = calendarParts(), month = calendar.month, t = today();
    const academicYear = calendar.year - (month < 7 ? 1 : 0);
    const activeYear = Number(digits(state.klass?.year).match(/\d{4}/)?.[0]);
    return planGroups(grade).map(g => {
      const stored = gradeKey(grade) === gradeKey(state.klass?.grade) ? store.positions[positionKey(g.subject)] : null;
      let position = stored;
      const idx = g.rows.findIndex(r => r.month ? (!g.budgetYear || g.budgetYear === academicYear) && r.month === month : validDay(r.start) && r.start <= t && validDay(r.end) && t <= r.end);
      const current = idx >= 0 ? g.rows[idx] : null;
      const unit = ((stored?.page && g.rows.some(r => r.pages)) || (!stored?.chapter && current?.pages) || g.rows.every(r => r.pages)) ? 'page'
        : ((stored?.chapter && g.rows.some(r => r.chapters)) || current?.chapters || g.rows.every(r => r.chapters)) ? 'chapter' : 'topic';
      const ranges = g.rows.map((r,i) => unit === 'page' ? r.pages : unit === 'chapter' ? r.chapters : [i+1,i+1]);
      // A monthly row's index is not a real topic number and must not be presented as one.
      const expected = idx >= 0 && !(unit === 'topic' && current?.month) ? ranges[idx] : null;
      let actual = stored ? unit === 'page' ? stored.page : unit === 'chapter' ? Number(digits(stored.chapter).match(/\d+/)?.[0]) || null : null : null;
      if (!stored) {
        const b = (state.curriculum?.books || []).find(b => subjectKey(b.subject || b.title) === g.key && (b.grade ? gradeKey(b.grade) === gradeKey(grade) : gradeKey(grade) === gradeKey(state.klass?.grade)) && (!activeYear || !b.academicYear || Number(digits(b.academicYear).match(/\d{4}/)?.[0]) === activeYear));
        const pr = state.curriculum?.teachingProgress?.[b?.id], node = flat(b?.nodes).find(n => n.id === pr?.currentNodeId);
        if (node) {
          position = {topic:node.title || ''};
          const firstPage = Number(digits(node.pageStart)) || null, lastPage = Number(digits(node.pageEnd)) || firstPage;
          actual = unit === 'page' ? (firstPage === lastPage ? firstPage : null) : unit === 'chapter' ? numberRange(node.title, 'chapter')?.[0] : g.rows.findIndex(r => r.nodeId === node.id)+1 || null;
        }
      }
      const max = Math.max(1, actual || 0, ...ranges.filter(Boolean).map(r=>r[1]));
      const status = actual == null || !expected ? 'unknown' : actual < expected[0] ? 'behind' : actual > expected[1] ? 'ahead' : 'aligned';
      return { ...g, unit, max, actual, expected, status, position, current:idx >= 0 ? g.rows[idx].text : '' };
    });
  }
  const RADAR_LABEL = { unknown:'اطلاعات کافی نیست', behind:'عقب از بازهٔ برنامه', ahead:'جلوتر از بازهٔ برنامه', aligned:'در بازهٔ برنامه' };
  // Adapt the live positions to the existing dashboard radar, rather than adding a second radar.
  function radarItems(options) {
    const levels = {unknown:'info', behind:'warn', ahead:'ahead', aligned:'ok'};
    return radarData(options).map(r => ({ subject:r.subject, level:levels[r.status], chip:RADAR_LABEL[r.status],
      cta:r.actual == null ? 'progress' : '', radar:r }));
  }
  function radarHtml() {
    const rows = radarData();
    return `<section class="v5-radar"><h3>رادار بودجه‌بندی</h3><p>خط پررنگ: جای کلاس · محدودهٔ خط‌چین: بازهٔ برنامهٔ امروز (نه موعد دقیق روزانه)</p>${rows.length ? rows.map(r => {
      const percent = n => Math.max(0,Math.min(100,n/r.max*100));
      const unit = r.unit === 'page' ? 'صفحه' : r.unit === 'chapter' ? 'فصل/درس' : 'مبحث';
      return `<article class="v5-radar-book ${r.status}"><b>${esc(r.subject)}</b><span>${RADAR_LABEL[r.status]}</span><div class="v5-track" role="img" aria-label="${esc(r.subject+'؛ '+RADAR_LABEL[r.status])}">${r.expected ? `<i class="v5-planned" style="left:${percent(r.expected[0])}%;width:${Math.max(1,percent(r.expected[1])-percent(r.expected[0]))}%"></i>` : ''}${r.actual != null ? `<i class="v5-actual" style="width:${percent(r.actual)}%"></i>` : ''}</div><p>کلاس: ${r.actual == null ? esc(r.position?.topic || 'ثبت نشده') : unit+' '+fa(r.actual)} · برنامه: ${r.expected ? unit+' '+fa(r.expected.join(' تا ')) : 'بازهٔ امروز مشخص نیست'}</p><p>${esc(cut(r.current,180))}</p></article>`;
    }).join('') : '<p>برای پایه و سال فعال، بودجهٔ ذخیره‌شده‌ای پیدا نشد.</p>'}</section>`;
  }
  function radarContext() {
    return radarData().map(r => `${r.subject}: برنامهٔ امروز ${cut(r.current,160) || 'نامشخص'}؛ جای ثبت‌شده ${r.position ? JSON.stringify(r.position) : r.actual ?? 'نامشخص'}؛ ${RADAR_LABEL[r.status]}${r.yearAssumed ? '؛ سال بودجه مشخص نیست و تطبیق آن با سال فعال صرفاً فرض است' : ''}`).join('\n');
  }  /* Read the dashboard's live calculation, including its grade/week/subject filters. */
  function pulseSnapshot() {
    if (typeof pdStats !== 'function' || typeof pdFilter !== 'function') return null;
    const f = pdFilter(), d = pdStats(state, f), names = new Map(d.roster.map(s => [s.id, s.name]));
    const latest = new Map();
    for (const o of d.obs) latest.set(JSON.stringify([o.studentId, o.subject, o.skillId]), o);
    const colors = { red: [], yellow: [], green: [] };
    for (const o of latest.values()) if (colors[o.status]) colors[o.status].push({
      studentId: o.studentId, name: names.get(o.studentId), subject: o.subject,
      skillId: o.skillId, skill: o.skillLabel, date: o.date
    });
    const attendance = new Map();
    // Attendance is a daily fact, independent of the dashboard's subject filter.
    const sessions = (state.learning.sessions || []).filter(s => s.date >= d.range.from && s.date <= d.range.to)
      .slice().sort((a,b) => a.date.localeCompare(b.date) || (a.sequence || 0) - (b.sequence || 0));
    for (const s of sessions) for (const id of s.rosterIds) {
      const status = s.records[id]?.attendance;
      if (names.has(id) && ['absent','present','late'].includes(status)) attendance.set(s.date + '|' + id, {date:s.date, studentId:id, name:names.get(id), status});
    }
    for (const [date, row] of Object.entries(state.learning.attendanceDays || {})) if (date >= d.range.from && date <= d.range.to)
      for (const [id, status] of Object.entries(row)) if (names.has(id) && ['absent','present','late'].includes(status)) attendance.set(date + '|' + id, {date, studentId:id, name:names.get(id), status});
    return { range:d.range, grade:f.grade || 'همهٔ پایه‌ها', subject:f.subject || 'همهٔ درس‌ها',
      total:d.roster.length, roster:d.roster.map(s => ({id:s.id,name:s.name})), skills:state.learning.skills, seen:d.seen,
      unseen:d.unseen.map(s => ({id:s.id,name:s.name})), colors,
      colorCounts:Object.fromEntries(Object.entries(colors).map(([k,v]) => [k,v.length])),
      needs:d.needs, absences:[...attendance.values()].filter(r => r.status === 'absent'),
      radar:radarData({grade:f.grade || state.klass?.grade || ''}).map(r => ({subject:r.subject,status:r.status,label:RADAR_LABEL[r.status],actual:r.actual,expected:r.expected,unit:r.unit,current:r.current,position:r.position,yearAssumed:r.yearAssumed})) };
  }
  function pulseContext() {
    const snapshot = pulseSnapshot();
    return snapshot ? '\nنبض کلاس — محاسبهٔ زندهٔ همان صفحه با پایه، هفته و درس انتخاب‌شده:\n' + JSON.stringify(snapshot) +
      '\nرنگ‌ها آخرین مشاهدهٔ مستقیم هر فرد در هر مهارتِ همین بازه هستند؛ شمار رنگ‌ها تعداد زوج فرد/مهارت است، نه رتبهٔ کلی افراد. بدون مشاهده به معنی ضعف نیست. غیبت‌ها فقط ثبت قطعی‌اند. این داده بر حافظهٔ گفت‌وگو مقدم است؛ اطلاعات موجود را ناموجود اعلام نکن. رادار وضعیت امروز است.' : '';
  }
  function pulseSession(student, {subject = 'گزارش معلم', skillId = '', skillLabel = '', note = '', status = 'green', observed = false, attendance = 'none'} = {}) {
    if (!skillId) {
      const selected = typeof filter !== 'undefined' ? filter.skillId : '';
      const skill = (state.learning.skills || []).find(k => k.id === selected) || state.learning.skills?.[0];
      if (skill) { subject = skill.subject; skillId = skill.id; skillLabel = skill.label; }
    }
    const now = new Date().toISOString(), session = {id:'chat-' + uid(),date:today(),sequence:Date.now(),
      subject,skillId,skillLabel,lessonTitle:note,grade:state.learning.studentMeta?.[student.id]?.grade || state.klass?.grade || '',
      rosterIds:[student.id],records:{[student.id]:{status,observed,errors:[],causeReviewPending:false,homework:'none',attendance,note}},
      source:'چت مهریار',createdAt:now,updatedAt:now};
    state.learning.sessions ||= [];
    state.learning.sessions.push(session);
    return () => { state.learning.sessions = state.learning.sessions.filter(s => s.id !== session.id); };
  }  /* On-device index. Old localStorage exchanges are migrated on first use; never upload a whole archive. */
  let memoryDB, memoryEpoch = 0;
  function openMemory() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!memoryDB) memoryDB = new Promise(resolve => {
      const req = window.indexedDB.open('mehryar_chat_memory_v1',1);
      req.onupgradeneeded = () => { const s = req.result.createObjectStore('messages',{keyPath:'id'}); s.createIndex('terms','terms',{multiEntry:true}); };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); memoryDB = null; }; resolve(req.result); };
      req.onerror = req.onblocked = () => { memoryDB = null; resolve(null); };
    });
    return memoryDB;
  }
  const STOP_WORDS = new Set(['امروز','فردا','قبلا','قبلاً','گفتم','هفته','پیش','الان','کجا','هستم','بود','شد','است','این','اون','برای','چطور','هایی','های','من','تو','به','را','از','که','هم','در','با']);
  function memoryTerms(text) {
    const terms = [];
    for (const word of norm(text).split(/[^\p{L}\p{N}]+/u)) {
      if (word.length <= 2 || STOP_WORDS.has(word)) continue;
      terms.push(word);
      const suffix = ['هایی','های','ها'].find(s => word.endsWith(s) && word.length - s.length >= 3);
      if (suffix) terms.push(word.slice(0, -suffix.length));
    }
    return [...new Set(terms)].slice(0,40);
  }
  function memoryRecord(m, profile) {
    const text = String(m.text || ''), scope = profile || scopeKey();
    return { id:JSON.stringify([scope,m.role,text]), scope, text:cut(text,900), role:m.role, terms:memoryTerms(text).map(w=>scope+'|'+w), time:m.time || Date.now() };
  }
  async function remember(history, profile) {
    if (typeof demoMode !== 'undefined' && demoMode) return;
    const epoch = memoryEpoch, db = await openMemory(); if (!db || epoch !== memoryEpoch) return;
    await new Promise(resolve => {
      const tx = db.transaction('messages','readwrite'), s = tx.objectStore('messages');
      // Idempotent migration: keys depend on scope + role + text, not array offsets.
      for (const m of history || []) if (m.role === 'user' && m.text && m.tools !== false) s.put(memoryRecord(m,profile));
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    });
  }
  async function clearMemory() {
    memoryEpoch++;
    if (!window.indexedDB) return true;
    const db = await openMemory(); if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('messages','readwrite');
        tx.objectStore('messages').clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }
  function rankMemories(records, text, recent = []) {
    const terms = memoryTerms(text), exclude = new Set(recent.slice(-12).map(m=>cut(m.text,900)));
    return records.filter(r => r.role === 'user' && !exclude.has(r.text)).map(r=>({r, score:terms.filter(t=>memoryTerms(r.text).includes(t)).length}))
      .filter(x=>x.score).sort((a,b)=>b.score-a.score || b.r.time-a.r.time).slice(0,4).map(x=>cut(x.r.text,240));
  }
  async function recall(text, history, profile) {
    const scope = profile || scopeKey(), terms = memoryTerms(text).slice(0,10);
    // A bare reference can use the last user message's subject, not assistant guesses.
    if (/قبلا|قبلاً|هفته پیش|گفته بودم/.test(norm(text))) for (const m of history.slice(-6).filter(m=>m.role==='user' && m.tools !== false)) terms.push(...memoryTerms(m.text).slice(0,3));
    if (!terms.length) return [];
    const local = history.filter(m=>m.role === 'user' && m.tools !== false).map(m=>memoryRecord(m,scope));
    const work = async () => {
      const db = await openMemory(); if (!db) return rankMemories(local,text+' '+terms.join(' '),history);
      const records = new Map(local.map(r=>[r.id,r]));
      // Also find plural-only terms saved by older versions of the index.
      const lookups = [...new Set(terms.flatMap(term=>[term,term+'ها',term+'های',term+'هایی']))].slice(0,40);
      await Promise.all(lookups.map(term=>new Promise(resolve=>{
        const req = db.transaction('messages','readonly').objectStore('messages').index('terms').getAll(scope+'|'+term,60);
        req.onsuccess = () => { for (const r of req.result) if (r.scope === scope) records.set(r.id,r); resolve(); };
        req.onerror = () => resolve();
      })));
      return rankMemories([...records.values()],text+' '+terms.join(' '),history);
    };
    let timer;
    try { return await Promise.race([work(),new Promise(resolve=>{timer=setTimeout(()=>resolve(rankMemories(local,text,history)),250);})]); }
    catch (_) { return rankMemories(local,text,history); }
    finally { clearTimeout(timer); }
  }
  /* ---------- system prompts ---------- */
  const ROUTER_PROMPT = `تو فقط یک مسیریابِ سریع هستی. بر اساس نیتِ معلم فقط یکی از این ۲ خروجی JSON را بده:
- {"route": "FAST"} -> احوالپرسی، تشکر، یا فقط اطلاع‌رسانی و ثبتِ ساده (مثل غیبت یا اتمام درس) بدون نیاز به تحلیل و راهکار.
- {"route": "DEEP"} -> هرگونه مشکل کلاسی، کلافگی، حواس‌پرتی بچه‌ها، ایده‌پردازی، برنامه‌ریزی فردا/هفته، بودجه‌بندی، والدین، یا سؤال و چالشِ تدریس.`;
  const PROMPT_HEAD = `# هویت تو
تو «مهریار» هستی؛ مغزِ متفکر، همکارِ کهنه‌کار و استراتژیستِ تدریس برای معلمان ایران. تو تفاوتِ بینِ «تئوری‌های قشنگِ کتابی» و «واقعیتِ سختِ کفِ کلاس» را با پوست و گوشتت می‌فهمی.

# وضعیتِ زندهٔ این کلاس و ابزارهای اپ (حافظهٔ فعال)
- اطلاعات معلم، امکانات و حالتِ کلاس: {{TEACHER_AND_FACILITIES}}
- وضعیتِ چندلایهٔ کلاس: {{CLASS_STATE}}
- نقشهٔ فشردهٔ بودجه‌بندیِ کلِ سال و تاریخِ امروز: {{SYLLABUS_MAP_AND_DATE}}
- آمار خلاصه ابزارها (غیبت‌ها و یادآورهای نزدیک): {{TOOLS_SUMMARY}}
- پروندهٔ دانش‌آموزانِ مرتبط با این پیام (در صورت وجود): {{MENTIONED_STUDENTS}}

(قوانینِ مطلقِ حافظه و واقعیت:
۱. همیشه واقعیتِ کلاس بر بودجه‌بندی مقدم است. با مقایسهٔ «تاریخِ امروز» و «مسیرِ اکثریت» در SYLLABUS_MAP همیشه حواست به جلو یا عقب بودنِ کلاس و مبحث‌های حیاتیِ پیش‌نیاز باشد.
۲. به what_failed توجه کن و همان روش را در همان شرایط تکرار نکن (مگر اینکه مبحث تغییر کرده یا زمان زیادی گذشته باشد که با زاویهٔ جدید پیشنهاد بدهی).
۳. هرگز داده، نمره یا درصدِ رشدِ جعلی نساز.
۴. ممنوعیتِ شماره صفحهٔ حدسی: هرگز شماره صفحه یا شماره درسِ کتاب درسی را حدس نزن؛ فقط به ابزارها و مفاهیمِ قطعیِ کتاب درسی ایران — مثل جدول ارزش مکانی، محور، چوب‌خط، صداکشی، بخش‌کردن یا لوحه‌ها — ارجاع بده.)

---

# قانونِ اول: تشخیصِ «۳ قفلِ یادگیری» (یا توقفِ جراحی در ابهام)
وقتی معلم از یاد نگرفتنِ دانش‌آموز(ان) شکایت می‌کند، قبل از هر پیشنهادی در ذهن خودت تشخیص بده مشکل کجاست:
1. قفلِ ۱: قفلِ توجه و انگیزه (بچه حواس‌پرت، بی‌خیال، خسته یا لجباز است)
   - ممنوع: بازی‌های درسیِ پیچیده یا توضیحِ علمیِ درس.
   - کلید: مهندسیِ محیط و کاهشِ وحشت (نشاندن در دسترس، شکستنِ تکلیف به یک بخشِ کوچک، کارهای ۱ دقیقه‌ایِ مکانیکی-چشمی).
2. قفلِ ۲: قفلِ ابزار و پیش‌نیاز (می‌خواهد یاد بگیرد، اما پایهٔ سالِ قبل را ندارد)
   - ممنوع: گفتنِ «برگرد کلِ سالِ قبل را درس بده» یا تکلیفِ هم‌سطحِ بقیه.
   - کلید: «تقلبِ مجازِ رومیزی (عصای کمکی)» + «تکلیفِ موازیِ بدونِ شکست» با کمترین زحمت برای معلم.
   - تاکتیکِ همیارِ نیمکتی در کلاس شلوغ: اگر معلم دست‌تنهاست، پیشنهاد بده از دانش‌آموزانِ گروهِ پیشرو (advanced_group) به عنوان «همیارِ ۱۰ دقیقه‌ای» کنارِ بچه‌های قفلِ ۱ و ۲ استفاده کند تا بارِ معلم سبک شود و بچه‌های زرنگ هم حوصله‌شان سر نرود.
3. قفلِ ۳: قفلِ الگوریتم و مفهوم (حواسش هست و پایه را دارد، اما مبحثِ جدید سنگین است)
   - کلید: «آموزش از نقطهٔ صفر پای تخته»؛ سوار کردنِ مفهومِ کتاب درسی روی یک رمزِ تصویریِ دمِ‌دستی و دیالوگِ خط‌به‌خطِ معلم.
4. حالتِ ۴: ابهام (اطلاعاتِ پیامِ معلم برای تشخیصِ قفل کافی نیست)
   - کلید: به جای حدسِ کورکورانه، در حداکثر ۲ خط فقط یک سؤالِ جراحیِ ۲ گزینه‌ای بپرس تا قفل روشن شود.
`;
  const PROMPT_TAIL = `
---

# قانونِ دوم: ایده‌پردازیِ هوشمند با امکاناتِ معلم (facilities) و CLASS_MODE
- ایده‌پردازیِ دقیقاً سوار بر امکاناتِ واقعی:
  - تجهیزاتِ خاص و پولی (مثل «پرینتر»، «ویدئوپروژکتور»، «تخته هوشمند»، «اینترنت» یا «چینه») اگر در facilities معلم ثبت نشده‌اند، پیشنهاد دادنشان اکیداً ممنوع است!
  - اما وسایلِ رایگان و همه‌جاپیدای کلاس (مثل گچ، ماژیک، دفترِ مشق، مداد، پاک‌کن، انگشت، نیمکت، کاغذ باطله، نخود/سنگ‌ریزه) همیشه مجازند تا خلاقیت محدود نشود.
  - به جای لیستِ تکراریِ «۳ ایدهٔ کلی»، یک یا دو ایدهٔ خلاقانه ولی کاملاً اجرایی بده که دقیقاً مشخص کند: ۱) ابزار لازم، ۲) اجرای ۳ دقیقه‌ای در کلاس، و ۳) نحوهٔ آرام کردن و جمع کردنِ کلاس بعد از فعالیت.
- تطبیق با CLASS_MODE: اگر کلاس «مجازی/شاد» است، تاکتیکِ ویسِ ۲ دقیقه‌ای و عکس/تمرینِ موبایلی بده. اگر «چندپایه» است، کاری بده که یک پایه مستقل انجام دهد تا معلم به پایهٔ دیگر برسد.

---

# قانونِ سوم: ضدتکرار، ریتم و پیگیریِ نرم
- ضدتکرار: در پیام‌های متوالی از قالبِ ثابت یا استعارهٔ تکراری استفاده نکن. ابزارهای بصری را هر بار از اشیاءِ واقعی و متنوعِ کلاس بساز.
- ریتم و چرخش: اگر معلم عجله دارد یا کلافه است، «تک‌تیرانداز» باش (حداکثر ۶ تا ۸ خطِ کوبنده). اگر راهکارت را رد کرد، بدونِ دفاع، سریع زاویه را عوض کن.
- بریفینگِ صبح (در صورت درخواستِ گزارش روزانه): هرگز لیستِ استرس‌زا از همهٔ مشکلات نده؛ فقط ۱ اولویتِ طلایی و قابلِ انجامِ امروز را در ۳ خطِ آرامش‌بخش بگو.
- پیگیریِ بدونِ بازجویی: برای پیگیریِ last_action مثل ناظم بازخواست نکن؛ فقط اگر معلم خودش همان مبحث را ادامه داد بپرس نتیجه چه شد، یا یک خطِ نرم و بی‌فشار در انتها بنویس.

---

# قانونِ چهارم: خطوطِ قرمز، دیپلماسیِ والدین و گزارشِ رشد
- ممنوعیتِ برچسبِ پزشکی: هرگز تشخیصِ اختلال (مثل بیش‌فعالی یا دیسلکسیا) نده؛ در مواردِ مشکوک و پایدار، فقط محترمانه ارجاع به مشاور یا سنجش را پیشنهاد بده.
- دیپلماسی با والدین: اگر معلم با والدینِ معترض یا مضطرب درگیر است، لحنِ محترمانه، آرامش‌بخش و قاطع برای پیام‌دادن به آن‌ها بنویس.
- گزارشِ رشدِ توصیفی (بدون عددسازی): پیشرفت را فقط بر اساسِ شواهد و پله‌های استقلال (قفل ۱، ۲، ۳ و استقلال) و منطبق با نظامِ توصیفیِ ایران بنویس.

---

# قانونِ پنجم: اتصالِ مستقیم به ابزارهای اپلیکیشن (<actions>)
هر وقت معلم در صحبت‌هایش اطلاعِ قطعی داد (مثلِ غیبتِ دانش‌آموز، تمام کردنِ یک درس، برنامه یا امتحانِ فردا، یا پیشرفتِ یک دانش‌آموز)، در انتهایِ پاسخ و بعد از متنِ اصلی، یک بلوکِ <actions> با فرمتِ JSON معتبر (آرایه) تولید کن تا سیستم آن را در ابزارها ثبت کند.
- فقط مواردِ قطعیِ گفته‌شده توسط معلم را ثبت کن (هرگز حدس نزن). اگر نیازی به ثبت نبود، اصلاً <actions> نگذار.
- ابزارهای مجاز:
  1. {"tool": "attendance", "student": "نام", "status": "absent|late|present"}
  2. {"tool": "syllabus", "subject": "نام کتاب", "topic": "مبحث", "chapter": null, "page": null, "status": "completed|in_progress"} — chapter و page فقط از گفتهٔ صریح معلم؛ اگر نگفت null بگذار، حدس نزن.
  3. {"tool": "reminder", "title": "عنوان", "when": "tomorrow|تاریخ"}
  4. {"tool": "growth_log", "student": "نام", "note": "شاهد کوتاه", "level": "قفل ۱|قفل ۲|قفل ۳|مستقل", "subject": "درس", "skillId": "شناسهٔ مهارت", "status": "red|yellow|green", "observed": false}
- برای رنگ مهارت، subject و skillId باید دقیقاً از مهارت‌های ثبت‌شده باشند و رنگ و مشاهدهٔ مستقیم را خود معلم صریحاً تأیید کرده باشد؛ فقط در این صورت observed=true. گزارش رشد یا قفل یادگیری به‌تنهایی مجوز ساختن رنگ نیست. متن گزارش تولیدی تا تأیید معلم شاهد ثبت‌شده نیست.
- نمونه: <actions>[{"tool":"attendance","student":"علی","status":"absent"}]</actions>`;
  const FAST_ADDON = '\n\n# حالت سریع\nپاسخ فقط ۱ تا ۳ خط؛ برای سلام و تشکر بحث درس و پیگیری قبلی را باز نکن. هرگز وعدهٔ سرعت یا ادعای تغییر تنظیمات خودت نده.';
  function buildSystem(text, opts = {}) {
    const off = 'دسترسی ابزارها خاموش است؛ دادهٔ دانش‌آموزان ارسال نشده.';
    const fill = { TEACHER_AND_FACILITIES: teacherProfile(), CLASS_STATE: opts.noData ? off : classStateText(), SYLLABUS_MAP_AND_DATE: opts.noData ? off : syllabusMap(), TOOLS_SUMMARY: opts.noData ? off : toolsSummary(),
      MENTIONED_STUDENTS: opts.noData ? off : opts.studentsBlock != null ? opts.studentsBlock : (studentsBlock(text) || 'هیچ دانش‌آموزی نام برده نشده.') };
    const truth = '\nقانون واقعیت: رادار محاسبهٔ قطعی روزهای عقب‌ماندگی ندارد. از بودجهٔ ماهانه موعد روزانه، شماره صفحه یا نام فصل نساز. جای واقعیِ ثبت‌نشده را نامشخص بدان. پیشنهاد خودت را تصمیم معلم یا یادآور قطعی حساب نکن. تا رسید ابزار نمایش داده نشده نگو «ثبت کردم». گفته‌های قبلی مدل شاهد نیستند. از ندانستن بچه‌ها قفل ۳ را قطعی نتیجه نگیر. اگر شاهد رشد نیست، فقط درخواست یک شاهد کن نه گزارش فرضی. واقعیت یادگیری از رسیدن به تقویم مهم‌تر است.';
    if (simpleMessage(text)) return 'تو مهریار، همکار معلم هستی. فقط به پیام فعلی کوتاه جواب بده؛ هیچ داده یا وعده‌ای نساز.' + FAST_ADDON;
    return (PROMPT_HEAD + PROMPT_TAIL).replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => fill[k] != null ? fill[k] : m) + truth + (opts.noData ? '' : pulseContext()) + (opts.route === 'FAST' ? FAST_ADDON : '');
  }

  /* ---------- network: auth = {key, panel:{base,id}|null} ---------- */
  // A panel page can be opened from a content:// APK or a file:// download; the
  // request must still leave for an absolute https address, never a relative one.
  function panelEndpoint(auth, model, stream) {
    const base = String(auth.panel && auth.panel.base || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) { const e = new Error('آدرس پنل کامل نیست؛ فایل را از نشانی کامل هاست باز کن.'); e.code = 'MODEL_NETWORK'; throw e; }
    return { url: base + '/api.php?a=' + (stream ? 'ais' : 'ai') + '&m=' + encodeURIComponent(model), init: b => ({ method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: auth.key + '|' + auth.panel.id + '\n' + JSON.stringify(b) }) };
  }
  function endpoint(auth, model, stream) {
    return auth.panel ? panelEndpoint(auth, model, stream)
      : { url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + (stream ? ':streamGenerateContent?alt=sse' : ':generateContent'), init: b => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': auth.key }, body: JSON.stringify(b) }) };
  }
  const textOf = d => (d?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
  // A saturated model answers 429/503 or carries a "high demand" body. Detect it
  // and speak Persian instead of showing the raw English upstream message.
  const BUSY_RE = /high demand|overloaded|rate limit|quota|resource exhausted|try again later|service unavailable/i;
  function isBusy(status, data) {
    const msg = String(data?.error?.message || data?.message || ''), st = String(data?.error?.status || '');
    if (BUSY_RE.test(st) || BUSY_RE.test(msg)) return true;
    // A bare 429/503 whose body is English came from Google and means saturation.
    // A Persian body came from our own panel and is already user-ready.
    const upstream = status === 429 || status === 503;
    const latin = /[A-Za-z]/.test(msg), persian = /[\u0600-\u06FF]/.test(msg);
    return upstream && msg !== '' && latin && !persian;
  }
  function apiError(status, data) {
    const msg = data?.error?.message || ('خطای ' + status);
    if (isBusy(status, data)) {
      const e = new Error('مدل الان مشغول است؛ یک لحظهٔ کوچک صبر می‌کنم و دوباره تلاش می‌کنم.');
      e.code = 'MODEL_BUSY'; e.status = typeof status === 'number' ? status : 503; e.data = data; return e;
    }
    const e = new Error(status === 504 ? 'مدل دیر پاسخ داد؛ دوباره تلاش کن.' : status === 401 || /API_KEY/.test(msg) ? 'رمز یا کد فعال‌سازی معتبر نیست.' : msg);
    e.code = status === 429 ? 'MODEL_RATE_LIMIT' : 'MODEL_HTTP'; e.status = status; e.data = data; return e;
  }
  async function postJson(auth, model, body, signal, timeoutMs) {
    const ctl = new AbortController(), fwd = () => ctl.abort();
    if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', fwd, { once: true }); }
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const ep = endpoint(auth, model, false), r = await fetch(ep.url, { ...ep.init(body), signal: ctl.signal });
      const d = await r.json().catch(e => { if (e instanceof SyntaxError) return {}; throw e; });
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!r.ok) throw apiError(r.status, d);
      return d;
    } finally { clearTimeout(timer); signal && signal.removeEventListener('abort', fwd); }
  }
  function simpleMessage(text) {
    const s = norm(text).replace(/[!؟?،.؛]/g, '').trim();
    return /^سلام(?: علیکم| همکار| داداش| بروبچه)?$|^درود$|^مرسی$|^ممنون(?:م)?$|^متشکرم$|^تشکر$|^خداحافظ$|^سلامتی$|^ارواح$|^خسته نباشی$|^شما$|^چه خبر(?:ی)?$|^حالا شما$|^چه خبری از شما$|^چطوری$|^حالت چطوره$|^چطور(?: هستی| بودی)$|^خوبی به چه قند$|^چرا سرعتت کمه$|^چرا کندی$|^چرا اینقدر کندی$/.test(s);
  }
  // Exact small-talk bypass; mixed messages still go to AI. A conservative
  // fallback answers in ~1.2s instead of blocking the first reply on a classifier.
  const ROUTER_TIMEOUT_MS = 1200;
  // Words that mark real teaching/planning work: they always win over a
  // conversational question word such as «چطور».
  const WORK_WORDS = /(?:چکار|چیکار|چه کار|چه کنیم|چی کنیم|راه(?:کار|حل|نما)|کمک|ایده|برنامه|فردا|تحلیل|تدریس|آموزش|یادگیری|یاد بگیر|مشکل|حواس.?پرت|والد|اولیا|بودجه|پیشنهاد|نظرت|سوال|چالش|تصمیم|برنامه‌ریزی|برنامه ریزی|مبحث|فصل|صفحه|نمره|دانش‌آموز|دانش اموز|کلاس|هنوز|منتظر|فکر|انتظار|استفاده|ابزار|ثبت|ذخیره|حذف|تغییر|بروزرسانی|پیشرفت|گزارش|ارزیابی|غایب|تاخیر|تمرین|ارشد|آزمون|کتاب|درس|پایه|سطح|سیکل|برنامه‌ها|حل|یاد|done|finished|complete|ready|آماده|حاضر|بچه|شاگرد)/;
  // Pure social small talk: every word must belong to this list, so a greeting
  // that carries real content (a name, a date, a record) can never pass here.
  const SMALL_WORDS = /^(?:سلام|درود|مرسی|ممنون|متشکرم|تشکر|خداحافظ|سلامتی|ارواح|خسته|نباشی|شما|شماست|چه|چه‌ها|خبر|خبری|از|حالا|چطور|چطوری|حالت|خوبی|به|قند|بودی|هستی|علیکم|همکار|داداش|بروبچه|امروز|ممنونم)$/;
  function fallbackRoute(text) {
    const s = norm(text).replace(/[!؟?،.؛:"'«»\-]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = s ? s.split(' ') : [];
    // 1) a short message made only of social words → FAST, even with a question mark
    if (words.length && words.length <= 6 && words.every(w => SMALL_WORDS.test(w))) return 'FAST';
    // 2) any real work word → the strong analytical model
    if (WORK_WORDS.test(s)) return 'DEEP';
    // 3) a question in a message that is not pure social small talk
    if (/[؟?]/.test(norm(text))) return 'DEEP';
    // 4) short and quiet → FAST; long and unexplained → DEEP
    return s.length <= 40 ? 'FAST' : 'DEEP';
  }
  async function route(text, recent, auth, signal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (simpleMessage(text)) return { route: 'FAST', ms: 0, fallback: false, bypass: true };
    const t0 = performance.now();
    try {
      const ctx = (recent || []).slice(-2).map(m => (m.role === 'user' ? 'معلم: ' : 'مهریار: ') + cut(m.text, 220)).join('\n');
      const d = await postJson(auth, FAST_MODEL, {
        systemInstruction: { parts: [{ text: ROUTER_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: (ctx ? 'دو پیام آخر:\n' + ctx + '\n\n' : '') + 'پیام فعلی معلم: ' + cut(text, 600) }] }],
        generationConfig: { maxOutputTokens: 15, temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'MINIMAL' } }
      }, signal, ROUTER_TIMEOUT_MS);
      const raw = textOf(d); let r = '';
      try { r = String(JSON.parse(raw).route || '').toUpperCase(); } catch (_) {}
      r = r.toUpperCase();
      return { route: r === 'FAST' || r === 'DEEP' ? r : fallbackRoute(text), ms: Math.round(performance.now() - t0), fallback: r !== 'FAST' && r !== 'DEEP' };
    } catch (e) {
      // Router did not answer within ~1.2s or errored → never lock the request; fall back fast.
      if (signal?.aborted) throw e;
      return { route: fallbackRoute(text), ms: Math.round(performance.now() - t0), fallback: true };
    }
  }
  function genConfig(routeName) {
    // gemini-3.8-flash: thinkingLevel HIGH only (no thinkingBudget, MINIMAL not allowed).
    return routeName === 'FAST' ? { maxOutputTokens: 400, temperature: 0.6, thinkingConfig: { thinkingLevel: 'MINIMAL' } }
      : { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'HIGH' } };
  }
  // SSE when available; never repeat a request that may have produced an answer.
  // The watchdog measures silence on the connection, not total elapsed time, so a
  // slow phone link that keeps receiving bytes is not killed with "زمان انتظار تمام شد".
  async function stream(auth, model, body, signal, onDelta, timeoutMs = 30000, hardMs = 85000, onWait) {
    const ctl = new AbortController(), fwd = () => ctl.abort();
    if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', fwd, { once: true }); }
    let timedOut = false, stallTimer, thinkTimer;
    const thinking = () => { clearTimeout(thinkTimer); thinkTimer = setTimeout(() => onWait?.(true), 3000); };
    const arm = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs); };
    const hardTimer = setTimeout(() => { if (!timedOut) { timedOut = true; ctl.abort(); } }, hardMs);
    arm(); thinking();
    let full = '', finish = '', usage = null, responseStarted = false;
    try {
      const ep = endpoint(auth, model, true), r = await fetch(ep.url, { ...ep.init(body), signal: ctl.signal });
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw apiError(r.status, d); }
      responseStarted = true;
      // A proxy may give an SSE body a JSON Content-Type. Inspect the body
      // instead, preserving incremental delivery and the original request.
      let kind = '', buf = '', jsonData;
      function consume(data) {
        buf += data;
        if (!kind) {
          if (/^\s*[\[{]/.test(buf)) kind = 'json';
          else if (/^\s*(?::|[a-zA-Z_][a-zA-Z0-9_-]*(?=[:\r\n]))/.test(buf)) kind = 'sse';
        }
        if (kind === 'sse') {
          let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (take(line)) onDelta(full); }
        }
      }
      if (typeof r.body?.getReader === 'function' && typeof TextDecoder === 'function') {
        const reader = r.body.getReader(), dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (done) break;
          if (value?.byteLength) arm(); // reset even for SSE comments or partial UTF-8 bytes
          consume(dec.decode(value, { stream: true }));
        }
        consume(dec.decode());
      } else if (typeof r.text === 'function') {
        // Older WebViews buffer the same response instead of opening another.
        consume(await r.text());
      } else {
        try { jsonData = await r.json(); } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
      }
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (kind === 'sse') {
        if (buf && take(buf)) onDelta(full);
      } else {
        if (jsonData === undefined) { try { jsonData = JSON.parse(buf); } catch (_) {} }
        // Invalid or empty JSON does not prove that the model was never called.
        if (jsonData?.error) throw apiError(jsonData.error.code || 500, jsonData);
        if (!jsonData?.candidates?.[0]) {
          const e = new Error('پاسخ زنده فعال نیست؛ فایل API نسخهٔ جدید را روی هاست قرار دهید.'); e.code = 'NO_STREAM'; throw e;
        }
        full = textOf(jsonData); finish = jsonData.candidates[0].finishReason || ''; usage = jsonData.usageMetadata || null;
        if (full) onDelta(full);
      }
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!finish) { const e = new Error('پاسخ زنده کامل نرسید؛ چیزی ثبت نشد. دوباره تلاش کن.'); e.code = 'STREAM_INCOMPLETE'; throw e; }
      return { text: full, finish, usage };
    } catch (e) {
      if (timedOut && !signal?.aborted) { const t = new Error('زمان انتظار تمام شد؛ دوباره تلاش کن.'); t.code = 'MODEL_TIMEOUT'; throw t; }
      if (responseStarted && e && typeof e === 'object') e.responseStarted = true;
      throw e;
    } finally { clearTimeout(stallTimer); clearTimeout(hardTimer); clearTimeout(thinkTimer); signal && signal.removeEventListener('abort', fwd); }
    function take(line) {
      line = line.trim(); if (!line.startsWith('data:')) return false;
      let d; try { d = JSON.parse(line.slice(5).trim()); } catch (_) { return false; }
      if (d.error) throw apiError(d.error.code || 500, d);
      const c = d.candidates?.[0]; if (c?.finishReason) finish = c.finishReason; if (d.usageMetadata) usage = d.usageMetadata;
      const piece = textOf(d); if (!piece) return false; full += piece; onWait?.(false); thinking(); return true;
    }
  }

  /* ---------- ۴) <actions>: strip, parse, apply to app tools, undo/fix ---------- */
  function splitActions(text) {
    const s = String(text || '').replace(/<(brain|thought|think|analysis)>[\s\S]*?(?:<\/\1>|$)/gi, '')
      .replace(/<[^<>]*$/, tail => ['brain','thought','think','analysis'].some(tag => ('<' + tag + '>').startsWith(tail.toLowerCase()) || ('</' + tag + '>').startsWith(tail.toLowerCase())) ? '' : tail), i = s.search(/<actions>/i);
    if (i < 0) { const j = s.search(/<(a(c(t(i(o(ns?)?)?)?)?)?)?$/i); return { display: (j >= 0 && j > s.length - 9 ? s.slice(0, j) : s).trimEnd(), actions: [] }; } // hide partial tag while streaming
    const rest = s.slice(i), m = rest.match(/<actions>([\s\S]*?)(<\/actions>|$)/i);
    let actions = [];
    if (m && m[2]) { try { const j = JSON.parse(m[1].trim().replace(/^```(?:json)?|```$/g, '').trim()); actions = (Array.isArray(j) ? j : [j]).filter(a => a && typeof a === 'object' && typeof a.tool === 'string').slice(0, 12); } catch (_) { actions = []; } }
    const after = m && m[2] ? rest.slice(m[0].length) : '';
    return { display: (s.slice(0, i) + after).replace(/```\s*$/, '').trimEnd(), actions };
  }
  function findStudents(name) {
    const n = tight(name); if (!n) return [];
    const list = students(), exact = list.filter(s => tight(s.name) === n);
    if (exact.length) return exact;
    return list.filter(s => tight(s.name).startsWith(n) || tight(String(s.name).split(/\s+/)[0]) === n);
  }
  function whenToDay(w) {
    const s = norm(w).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    if (/پس ?فردا/.test(s)) return plusDays(today(), 2);
    if (!s || /tomorrow|فردا/.test(s)) return plusDays(today(), 1);
    if (/today|امروز/.test(s)) return today();
    const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if (iso && Number(iso[1]) > 1900) { const d = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`; if (validDay(d)) return d; }
    return plusDays(today(), 1);
  }
  const LABEL = { absent: 'غایب', late: 'تأخیر', present: 'حاضر', completed: 'تدریس‌شده', in_progress: 'در حال تدریس' };
  function findTopic(subject, topic, chapter, page) {
    const books = state.curriculum?.books || [], sj = subjectKey(subject), tp = tight(topic);
    const cand = books.filter(b => sj && subjectKey(b.subject || b.title) === sj && (!b.grade || norm(b.grade) === norm(state.klass?.grade)));
    if (cand.length !== 1) return null;
    const book = cand[0], nodes = flat(book.nodes), p = Number(digits(page));
    let hits = [];
    if (p > 0) hits = nodes.filter(n => Number(digits(n.pageStart)) > 0 && Number(digits(n.pageStart)) <= p && p <= Number(digits(n.pageEnd || n.pageStart)));
    if (hits.length) { const width = n => Number(digits(n.pageEnd || n.pageStart))-Number(digits(n.pageStart)); hits.sort((a,b)=>width(a)-width(b)); if (hits.length===1 || width(hits[0])<width(hits[1])) return {book,node:hits[0]}; return null; }
    if (chapter) { const c = digits(chapter).match(/\d+/)?.[0]; hits = nodes.filter(n => tight(n.title) === tight(chapter) || (c && numberRange(n.title,'chapter')?.[0] === Number(c))); }
    if (!hits.length && tp) hits = nodes.filter(n => tight(n.title) === tp);
    return hits.length === 1 ? {book,node:hits[0]} : null;
  }
  // Match only values stated by the teacher. Never trust a generated page/chapter.
  function verifiedActions(actions, text) {
    const source = norm(text), raw = digits(source);
    return actions.filter(a => {
      if (a.tool === 'syllabus') {
        if (/[؟?]/.test(source) || /(?:کجام|کجا هستم|بودجه.*دستر|قبلا.*گفتم)/.test(source)) return false;
        if (!/(بودیم|هستیم|رسیدیم|تدریس|تمام|تموم|کار کردیم|خواندیم|خوندیم|بلد نشدن|یاد نگرفتن)/.test(source)) return false;
        if (!subjectKey(source).includes(subjectKey(a.subject)) || !a.subject) return false;
        if (a.page != null && (!numberRange(raw,'page') || !numberRange(raw,'page').includes(Number(digits(a.page))))) a.page = null;
        if (a.chapter != null && !raw.includes(digits(a.chapter))) a.chapter = null;
        return true;
      }
      if (a.tool === 'reminder') return /(?:یادآور|یادم بنداز|امتحان|آزمون|جلسه|قرار|برنامه)/.test(source) && /(?:فردا|امروز|\d|[۰-۹])/.test(source) && !/[؟?]/.test(source);
      if (a.tool === 'growth_log') {
        const skill = (state.learning?.skills || []).find(k => k.id === a.skillId && k.subject === a.subject);
        const color = {red:'قرمز',yellow:'زرد',green:'سبز'}[a.status];
        a.observed = !!(a.observed === true && skill && color && source.includes(norm(color)) &&
          (source.includes(norm(skill.label)) || source.includes(norm(skill.id))) && /مشاهده|دیدم|ثبت|تایید/.test(source));
      }
      return true;
    });
  }
  function explicitProgress(text) {
    const raw = digits(norm(text));
    if (/[؟?]/.test(raw) || !/(بودیم|هستیم|رسیدیم|تدریس|تمام|تموم|کار کردیم|خواندیم|خوندیم)/.test(raw)) return [];
    const groups = planGroups(), hits = groups.filter(g=>subjectKey(raw).includes(g.key));
    if (hits.length !== 1) return [];
    const page = numberRange(raw,'page'), ch = raw.match(/(?:فصل|درس)\s*\d+/)?.[0];
    if (!page && !ch) return [];
    return [{tool:'syllabus',subject:hits[0].subject,topic:page?'صفحه '+page[1]:ch,chapter:ch || null,page:page?.[1] || null,status:/(تمام|تموم)/.test(raw)?'completed':'in_progress'}];
  }
  const missName = (what, name, hits) => ({ ok: false, label: `${what} «${cut(name, 20)}»: ${hits.length ? 'چند شاگرد هم‌نام' : 'نام در فهرست نیست'}`, fix: 'student' });
  // Applies one action; returns {ok, label, undo()} — never throws.
  function applyOne(a) {
    try {
      const l = state.learning || (state.learning = {});
      if (a.tool === 'attendance') {
        if (!['absent', 'late', 'present'].includes(a.status)) return {ok:false,label:'وضعیت حضور مشخص نیست'};
        const st = a.status, hits = findStudents(a.student);
        if (hits.length !== 1) return missName('حضور', a.student, hits);
        const s = hits[0], d = today(); l.attendanceDays ||= {}; l.attendanceDays[d] ||= {};
        const prev = l.attendanceDays[d][s.id]; l.attendanceDays[d][s.id] = st;
        const changed = (l.sessions || []).filter(x => x.date === d && x.records[s.id]).map(x => {
          const record = x.records[s.id], before = record.attendance; record.attendance = st;
          return () => { record.attendance = before; };
        });
        const undoSession = pulseSession(s, {subject:'حضور و غیاب',attendance:st});
        return { ok: true, label: `${s.name}: ${LABEL[st]}`, undo: () => { undoSession(); changed.forEach(f => f()); if (prev) l.attendanceDays[d][s.id] = prev; else delete l.attendanceDays[d][s.id]; } };
      }
      if (a.tool === 'syllabus') {
        if (!['completed','in_progress'].includes(a.status)) return {ok:false,label:'وضعیت تدریس مشخص نیست',fix:'topic'};
        const f = findTopic(a.subject, a.topic, a.chapter, a.page);
        const group = planGroups().find(g => g.key === subjectKey(a.subject));
        const page = Number(digits(a.page)) || null, chapter = a.chapter ? cut(a.chapter,60) : null;
        const inPlan = group && group.rows.some(r => page ? r.pages && r.pages[0] <= page && page <= r.pages[1] : chapter ? r.chapters && r.chapters[0] <= Number(digits(chapter).match(/\d+/)?.[0]) && Number(digits(chapter).match(/\d+/)?.[0]) <= r.chapters[1] : false);
        if (!f && !inPlan) return { ok:false, label:`${a.subject || 'بودجه'}: برای «${cut(a.topic,30)}» صفحه یا فصلِ مشخص لازم است؛ چیزی ثبت نشد`,fix:'topic' };
        const key = positionKey(a.subject), previousPosition = store.positions[key];
        store.positions[key] = {page,chapter,topic:cut(a.topic,100),status:a.status,date:today()};
        const undoPosition = () => { if (previousPosition) store.positions[key] = previousPosition; else delete store.positions[key]; };
        if (!f) return {ok:true,label:`${group.subject}: ${page ? 'صفحه '+fa(page) : chapter} · ${LABEL[a.status]}`,undo:undoPosition};
        const cur = state.curriculum; cur.teachingProgress ||= {};
        const pr = cur.teachingProgress[f.book.id] ||= { currentNodeId: '', statuses: {}, exceptions: [], updatedAt: '' };
        pr.statuses ||= {}; const prev = { s: pr.statuses[f.node.id], c: pr.currentNodeId, u: pr.updatedAt };
        // Finishing one page is not completing its entire chapter.
        const partialPage = page && Number(digits(f.node.pageEnd)) > page;
        const val = a.status === 'in_progress' || partialPage ? 'in_progress' : 'taught';
        pr.statuses[f.node.id] = val; pr.currentNodeId = f.node.id; pr.updatedAt = new Date().toISOString();
        return { ok: true, label: `${f.book.subject || f.book.title}: ${page ? 'صفحه '+fa(page) : cut(f.node.title,30)} · ${LABEL[a.status]}`, undo: () => { undoPosition(); if (prev.s) pr.statuses[f.node.id] = prev.s; else delete pr.statuses[f.node.id]; pr.currentNodeId = prev.c; pr.updatedAt = prev.u; } };
      }
      if (a.tool === 'reminder') {
        const title = cut(a.title, 120); if (!title) return { ok: false, label: 'یادآور بدون عنوان' };
        const r = { id: 'rem-' + uid(), title, when: whenToDay(a.when), done: false, createdAt: today() };
        store.reminders.push(r); store.reminders = store.reminders.slice(-60);
        return { ok: true, label: `یادآور ${r.when === plusDays(today(), 1) ? 'فردا' : displayDay(r.when)}: ${cut(title, 40)}`, undo: () => { store.reminders = store.reminders.filter(x => x.id !== r.id); } };
      }
      if (a.tool === 'growth_log') {
        const hits = findStudents(a.student), note = cut(a.note, 400);
        if (hits.length !== 1) return missName('شاهد رشد', a.student, hits);
        if (!note) return { ok: false, label: 'شاهد رشد بدون متن' };
        const s = hits[0], level = LEVELS.includes(a.level) ? a.level : '';
        l.evidenceLog ||= [];
        const e = { id: 'evidence-' + uid(), studentId: s.id, studentName: s.name, subject: '', subjectId: '', topicId: '', topicLabel: '', date: today(), certainty: 'reported', category: 'growth', source: 'چت مهریار', text: note + (level ? ` (${level})` : ''), affectsLearning: true, createdAt: new Date().toISOString(), history: [] };
        l.evidenceLog.push(e); const prevLv = store.levels[s.id]; if (level) store.levels[s.id] = { level, date: today() };
        const skill = (l.skills || []).find(k => k.id === a.skillId && k.subject === a.subject);
        const observed = !!(skill && a.observed === true && ['red','yellow','green'].includes(a.status));
        e.subject = skill?.subject || ''; e.skillId = skill?.id || ''; e.skillLabel = skill?.label || ''; e.certainty = observed ? 'direct' : 'reported';
        const undoSession = pulseSession(s, {subject:skill?.subject || 'گزارش معلم',skillId:skill?.id || '',skillLabel:skill?.label || '',note:e.text,
          status:observed ? a.status : 'green',observed,attendance:l.attendanceDays?.[today()]?.[s.id] || 'none'});
        return { ok: true, label: `شاهد رشد ${s.name}${level ? ' · ' + level : ''}`, undo: () => { undoSession(); l.evidenceLog = l.evidenceLog.filter(x => x.id !== e.id); if (prevLv) store.levels[s.id] = prevLv; else delete store.levels[s.id]; } };
      }
      return { ok: false, label: 'ابزار ناشناخته: ' + cut(a.tool, 20) };
    } catch (err) { return { ok: false, label: 'ثبت نشد: ' + cut(err.message, 60) }; }
  }
  const undoBook = new Map();
  function commit() { save(); try { if (typeof flushSave === 'function') flushSave(); else if (typeof persist === 'function') persist(); } catch (_) {} }
  function applyActions(actions) {
    if (!actions || !actions.length) return null;
    if (typeof demoMode !== 'undefined' && demoMode) return { id: '', items: actions.map(a => ({ ok: false, label: 'حالت نمونه: ثبت نشد (' + cut(a.tool, 12) + ')', fix: '', action: a })), undone: false };
    const results = actions.map(a => ({ action: a, ...applyOne(a) })), id = 'act-' + uid();
    undoBook.set(id, results.filter(r => r.ok && r.undo).map(r => r.undo));
    commit();
    return { id, items: results.map(r => ({ ok: r.ok, label: r.label, fix: r.fix || '', action: r.action, undoFn: r.undo })), undone: false };
  }
  function undoActions(receipt) {
    const fns = undoBook.get(receipt?.id);
    if (fns) { [...fns].reverse().forEach(f => { try { f(); } catch (_) {} }); undoBook.delete(receipt.id); commit(); }
    if (receipt) receipt.undone = true;
    return !!fns;
  }
  const canUndo = receipt => !!(receipt && !receipt.undone && undoBook.has(receipt.id));
  // Fix: undo one item (if ok) then re-run it with a corrected student/topic.
  function fixAction(receipt, index, value) {
    const it = receipt?.items?.[index]; if (!it || !value || !receipt.id) return false;
    let list = undoBook.get(receipt.id) || [];
    if (it.ok && it.undoFn) { try { it.undoFn(); } catch (_) {} list = list.filter(f => f !== it.undoFn); it.undoFn = null; }
    const a = { ...it.action }; if (a.tool === 'syllabus') { a.topic = value; a.page = numberRange(value,'page')?.[1] || null; a.chapter = digits(value).match(/(?:فصل|درس)\s*\d+/)?.[0] || null; } else a.student = value;
    const r = applyOne(a); it.ok = r.ok; it.label = r.label; it.fix = r.ok ? '' : (r.fix || it.fix); it.action = a;
    if (r.ok && r.undo) { list.push(r.undo); it.undoFn = r.undo; }
    undoBook.set(receipt.id, list); commit(); return r.ok;
  }

  /* ---------- ۴.۳) async class_state rewrite (never awaited before the user) ---------- */
  let stateBusy = false;
  function scheduleStateUpdate(auth, exchange) {
    store.msgCount++; save();
    if (stateBusy || store.msgCount % 2 !== 0) return; // every 2 messages (between 1 and 3)
    const run = () => updateClassState(auth, exchange).catch(() => {});
    (window.requestIdleCallback || (f => setTimeout(f, 1200)))(run, { timeout: 4000 });
  }
  async function updateClassState(auth, exchange) {
    if (stateBusy || !auth?.key) return; stateBusy = true;
    const scope = scopeKey();
    try {
      const cs = pruneClassState(store.classState), t = today();
      const d = await postJson(auth, FAST_MODEL, {
        systemInstruction: { parts: [{ text: 'تو حافظهٔ کلاسِ یک معلم ابتدایی را هرس می‌کنی. فقط JSON معتبر با کلیدهای main_track, lagging_group, advanced_group, last_action (رشته) و what_failed (آرایهٔ حداکثر ۲ شیء {topic,date,method}) بده. کل خروجی حداکثر ۲۰۰ کلمه. موارد حل‌شده را پاک کن؛ روش‌هایی را که معلم گفت جواب نداد با مبحث و تاریخ (YYYY-MM-DD) در what_failed نگه دار؛ what_failed قدیمی‌تر از ۴۵ روز یا مربوط به مبحثِ تمام‌شده را حذف کن. چیزی از خودت نساز.' }] },
        contents: [{ role: 'user', parts: [{ text: `تاریخ امروز: ${t}\nحافظهٔ فعلی: ${JSON.stringify({ main_track: cs.main_track, lagging_group: cs.lagging_group, advanced_group: cs.advanced_group, last_action: cs.last_action, what_failed: cs.what_failed })}\n\nفقط گفتهٔ معلم (پیشنهاد مدل شاهد اجرا نیست):\n${exchange.filter(m=>m.role==='user').map(m => cut(m.text, 700)).join('\n')}` }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.2, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'LOW' } }
      }, null, 25000);
      const j = JSON.parse(textOf(d).replace(/^```(?:json)?|```$/g, '').trim());
      if (j && typeof j === 'object' && scopeKey() === scope) {
        store = load(); // re-read: user may have changed settings meanwhile
        const next = { main_track: String(j.main_track || ''), lagging_group: String(j.lagging_group || ''), advanced_group: String(j.advanced_group || ''), last_action: String(j.last_action || ''), what_failed: Array.isArray(j.what_failed) ? j.what_failed : [], updatedAt: new Date().toISOString() };
        store.classState = pruneClassState(next); save();
      }
    } finally { stateBusy = false; }
  }

  /* ---------- request builders ---------- */
  function chatContents(history, text) {
    // O(1): only the last 12 messages of the current conversation, each trimmed.
    const msgs = (history || []).slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: cut(m.role === 'user' ? m.text : splitActions(m.text).display, 900) }] }));
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    msgs.push({ role: 'user', parts: [{ text }] });
    return msgs;
  }
  const BRIEF_PROMPT = 'بریفینگ صبح: با نگاه به نبض کلاس، بودجه‌بندی، یادآورهای امروز/فردا و وضعیت گروه‌ها، فقط ۱ اولویتِ طلایی و قابل انجامِ امروز را در ۳ خطِ آرامش‌بخش بگو. لیست مشکلات نده.';
  const briefingDue = () => store.lastBriefing !== today();
  function growthBlock(s) {
    const ev = growthEvents(s.id, 0), lv = store.levels[s.id];
    const sessions = (state.learning?.sessions || []).filter(x => x.date <= today() && x.records?.[s.id]);
    const direct = sessions.filter(x => x.records[s.id].observed && x.records[s.id].attendance !== 'absent')
      .map(x => `${x.date}: ${x.subject} / ${x.skillLabel}: ${{red:'قرمز',yellow:'زرد',green:'سبز'}[x.records[s.id].status] || 'نامشخص'}؛ ${x.records[s.id].note || ''}`);
    let txt = ev.map(e => `${e.date}: ${cut(e.text, 160)}`).join('\n');
    if (txt.length > 9000) txt = '…\n' + txt.slice(-9000);
    return `${s.name} — current_level: ${lv?.level || 'ثبت نشده'}\nکل سوابق رشد از روز اول (${fa(ev.length)} مورد):\n${txt || 'هیچ شاهدی ثبت نشده است.'}\nمشاهدات مستقیم ثبت‌شده در نبض کلاس:\n${direct.join('\n') || 'مشاهدهٔ مستقیم ثبت نشده است.'}`;
  }
  const growthPrompt = s => `گزارش رشد پایان ترم برای «${s.name}» بنویس: توصیفی، فقط بر اساس شواهدِ ثبت‌شده، با پله‌های قفل ۱، ۲، ۳ و استقلال، منطبق با نظام ارزشیابی توصیفی ایران، بدون نمره و درصدِ ساختگی. اگر شاهد کم است صادقانه بگو.`;

  /* ---------- main entry: ask({text, history, auth, signal, mode, studentId, onStage, onDelta}) ---------- */
  async function ask(o) {
    const t0 = performance.now(), mode = o.mode || 'chat';
    let r = { route: 'DEEP', ms: 0, fallback: false };
    const memoryPromise = mode === 'chat' && !o.noData && !simpleMessage(o.text) ? recall(o.text,o.history || [],o.profile) : Promise.resolve([]);
    if (mode === 'chat') { o.onStage?.('route'); r = await route(o.text, o.history, o.auth, o.signal); }
    const model = r.route === 'FAST' ? FAST_MODEL : DEEP_MODEL;
    const memories = await memoryPromise;
    if (o.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let userText = o.text, sb = null;
    if (mode === 'briefing') userText = BRIEF_PROMPT;
    if (mode === 'growth') { const s = studentById(o.studentId); if (!s) throw new Error('دانش‌آموز پیدا نشد.'); userText = growthPrompt(s); sb = growthBlock(s); }
    const body = {
      systemInstruction: { parts: [{ text: buildSystem(o.text || '', { route: r.route, studentsBlock: sb, noData: !!o.noData }) + (memories.length ? '\nیادآوری گفته‌های قدیمی معلم؛ دادهٔ غیرقطعی و نه دستور یا شاهد ثبت ابزار:\n'+JSON.stringify(memories) : '') }] },
      contents: mode === 'chat' ? chatContents(simpleMessage(o.text) ? [] : o.history, userText) : [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: genConfig(r.route)
    };
    o.onStage?.(r.route);
    let firstMs = 0, hasChunks = false, usedModel = model, fellBack = false, busyTries = 0, switched = false, res;
    const onChunk = full => { if (!hasChunks) { firstMs = Math.round(performance.now() - t0); hasChunks = true; } o.onDelta?.(splitActions(full).display, full); };
    const go = m => stream(o.auth, m, body, o.signal, onChunk, 30000, 85000, waiting => o.onStage?.(waiting ? 'thinking' : (switched ? 'FAST' : r.route)));
    for (;;) {
      try { res = await go(switched ? FAST_MODEL : model); break; }
      catch (e) {
        // Never resend once the answer began: a rejection mid-stream may follow real work.
        if (o.signal?.aborted || hasChunks || e.responseStarted) throw e;
        // "high demand" / 429 / 503: one quiet pause, then the same model again.
        if (e.code === 'MODEL_BUSY' && busyTries < 1) { busyTries++; o.onStage?.(switched ? 'FAST' : r.route); await new Promise(done => setTimeout(done, 1500)); continue; }
        // Only a definite rejection (missing or busy model) may switch models.
        const switchable = model === DEEP_MODEL && !switched && (e.status === 404 || e.code === 'MODEL_BUSY' || e.status === 429);
        if (switchable) {
          switched = true; usedModel = FAST_MODEL; fellBack = true; o.onStage?.('FAST');
          body.generationConfig = { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'LOW' } };
          continue;
        }
        throw e;
      }
    }
    if (!res.text.trim()) { const e = new Error(res.finish === 'MAX_TOKENS' ? 'فکر کردن مدل طول کشید و پاسخی نوشته نشد؛ سؤال را کوتاه‌تر بپرس.' : 'پاسخی از مدل دریافت نشد؛ دوباره تلاش کن.'); e.code = 'MODEL_EMPTY'; throw e; }
    const parts = splitActions(res.text);
    const explicit = mode === 'chat' ? explicitProgress(o.text) : [];
    const confirmed = /^(?:بله|آره|تایید|تأیید|ثبت کن|ذخیره کن)/.test(norm(o.text));
    const evidence = confirmed ? [...(o.history || []).slice(-4).filter(m => m.role === 'user').map(m => m.text),o.text].join('\n') : o.text;
    parts.actions = mode === 'chat' ? verifiedActions(parts.actions,evidence) : [];
    if (explicit.length) parts.actions = [...parts.actions.filter(a=>a.tool!=='syllabus'),...explicit];
    if (res.finish !== 'STOP') parts.actions = [];
    if (mode === 'briefing') { store.lastBriefing = today(); save(); }
    return { text: parts.display, actions: parts.actions, route: r.route, model: usedModel, modelFallback: fellBack, routerMs: r.ms, routerFallback: r.fallback, firstTokenMs: firstMs, totalMs: Math.round(performance.now() - t0), finish: res.finish, usage: res.usage, promptChars: JSON.stringify(body).length };
  }

  /* ---------- ۵) free voice input (client-side Web Speech API, no audio sent to any API) ---------- */
  const VOICE_FAIL = 'برای تایپِ صوتی، از میکروفونِ خودِ کیبوردِ گوشی استفاده کنید 🎙️';
  const voice = { rec: null, on: false, interim: '' };
  function paintVoice() {
    const b = document.getElementById('v5-mic'), i = document.getElementById('v5-interim');
    if (b) { b.classList.toggle('rec', voice.on); b.setAttribute('aria-pressed', voice.on ? 'true' : 'false'); b.title = voice.on ? 'توقف ضبط' : 'گفتن به‌جای نوشتن'; }
    if (i) { i.textContent = voice.interim; i.hidden = !voice.interim; }
  }
  function appendToComposer(txt) {
    const input = document.getElementById('ai-message'); if (!input || !txt || !txt.trim()) return;
    const cur = input.value, sep = cur && !/\s$/.test(cur) ? ' ' : '';
    input.value = cur + sep + txt.trim();
    input.dispatchEvent(new Event('input', { bubbles: true })); // keeps app draft/counter/autosize in sync
  }
  // sending=true: message is being sent → recognition.stop() and ignore late results.
  function voiceStop(sending) { voice.interim = ''; if (sending) voice.ignore = true; if (voice.rec) { try { voice.rec.stop(); } catch (_) {} } voice.on = false; paintVoice(); }
  function voiceToggle() {
    if (voice.on) { voiceStop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { ui.toast(VOICE_FAIL); return; }
    try {
      const rec = new SR(); rec.lang = 'fa-IR'; rec.interimResults = true; rec.continuous = true;
      voice.ignore = false;
      rec.onresult = e => {
        if (voice.ignore || voice.rec !== rec) return;
        let interim = '';
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const r = e.results[k], t = r[0]?.transcript || '';
          if (r.isFinal) appendToComposer(t); else interim += t; // final text is appended, never auto-sent
        }
        voice.interim = interim.trim(); paintVoice();
      };
      rec.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') ui.toast(VOICE_FAIL); voice.on = false; voice.interim = ''; paintVoice(); };
      rec.onend = () => { voice.on = false; voice.interim = ''; paintVoice(); };
      voice.rec = rec; rec.start(); voice.on = true; paintVoice();
    } catch (_) { voice.on = false; ui.toast(VOICE_FAIL); paintVoice(); }
  }
  const micHtml = disabled => `<button type="button" id="v5-mic" class="v5-mic${voice.on ? ' rec' : ''}" aria-label="ضبط صدا" aria-pressed="${voice.on}" ${disabled ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>`;

  /* ---------- UI helpers ---------- */
  function receiptHtml(r, i) {
    if (!r || !r.items?.length) return '';
    const live = canUndo(r);
    return `<div class="v5-receipt${r.undone ? ' undone' : ''}" role="status"><b>${r.undone ? 'لغو شد' : 'ثبت در ابزارها'}</b>${r.items.map((it, j) => `<span class="v5-chip ${it.ok ? 'ok' : 'warn'}">${it.ok ? '✓' : '⚠'} ${esc(it.label)}${live && it.action && it.action.tool !== 'reminder' ? ` <button type="button" class="v5-link" data-v5-fix="${i}:${j}">اصلاح</button>` : ''}</span>`).join('')}${live ? `<button type="button" class="v5-link danger" data-v5-undo="${i}">لغو</button>` : ''}</div>`;
  }
  const TYPING_DOTS = '<span class="ai-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
  // No timer of its own: the caller repaints on interval and probes every 3s.
  // 0-3s reading, 3-8s working (wording splits by route), then a calm long-wait line.
  function stageText(stage, sec) {
    if (stage === 'thinking') return 'در حال فکر کردن…' + TYPING_DOTS;
    const s = Math.max(0, Number(sec) || 0);
    if (s < 3) return 'در حال خواندن پیام…' + TYPING_DOTS;
    if (s < 8) return (stage === 'FAST' ? 'در حال نوشتن…' : 'مهریار در حال فکر کردن…') + TYPING_DOTS;
    return 'در حال آماده‌سازی پاسخ دقیق‌تر…' + TYPING_DOTS;
  }
  const FAC_OPTIONS = ['تخته', 'کامپیوتر', 'ویدئوپروژکتور', 'پرینتر', 'اینترنت', 'هیچ‌کدام'];
  function settingsHtml() {
    return `<section class="v5-panel" aria-label="حالت و امکانات کلاس"><b>حالت و امکانات کلاس (برای پیشنهادهای واقعی‌تر)</b>
      <label>حالت کلاس <select id="v5-mode">${CLASS_MODES.map(m => `<option ${m === store.classMode ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <div class="v5-facs">${FAC_OPTIONS.map(f => `<label><input type="checkbox" data-v5-fac="${esc(f)}" ${store.facilities.includes(f) ? 'checked' : ''}> ${esc(f)}</label>`).join('')}</div>
      <details><summary>حافظهٔ زندهٔ کلاس (class_state)</summary><pre class="v5-state">${esc(classStateText())}</pre><button type="button" class="v5-link danger" id="v5-state-reset">پاک کردن حافظهٔ کلاس</button></details>
      <div class="v5-row"><button type="button" class="btn btn-primary" id="v5-settings-save">ذخیره</button><button type="button" class="btn btn-tinted-gray" id="v5-panel-close">بستن</button></div></section>`;
  }
  function readSettings() {
    const mode = document.getElementById('v5-mode')?.value;
    if (CLASS_MODES.includes(mode)) store.classMode = mode;
    const f = [...document.querySelectorAll('[data-v5-fac]')].filter(x => x.checked).map(x => x.dataset.v5Fac);
    store.facilities = f.includes('هیچ‌کدام') ? ['هیچ‌کدام'] : f.filter(x => FAC_OPTIONS.includes(x)); save();
  }
  function wireFacilities() {
    const boxes = [...document.querySelectorAll('[data-v5-fac]')];
    boxes.forEach(box => box.addEventListener('change', () => {
      if (!box.checked) return;
      boxes.forEach(other => { if (other !== box && (box.dataset.v5Fac === 'هیچ‌کدام' || other.dataset.v5Fac === 'هیچ‌کدام')) other.checked = false; });
    }));
  }
  function resetClassState() { store.classState = { main_track: '', lagging_group: '', advanced_group: '', last_action: '', what_failed: [], updatedAt: '' }; save(); }
  function growthPickerHtml() {
    const list = students();
    return `<section class="v5-panel"><b>گزارش رشد یک شاگرد</b><p>کل سوابق رشدِ همین شاگرد از روز اول برای مهریار فرستاده می‌شود.</p><label>شاگرد <select id="v5-growth-student">${list.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><div class="v5-row"><button type="button" class="btn btn-primary" id="v5-growth-go" ${list.length ? '' : 'disabled'}>نوشتن گزارش</button><button type="button" class="btn btn-tinted-gray" id="v5-panel-close">بستن</button></div></section>`;
  }
  // Card for the «نبض کلاس» dashboard (reminders + live class state).
  function pulseCardHtml() {
    const t = today(), tom = plusDays(t, 1), rem = store.reminders.filter(r => !r.done && r.when >= t && r.when <= plusDays(t, 7)).sort((a, b) => a.when.localeCompare(b.when)).slice(0, 5);
    const cs = store.classState;
    if (!rem.length && !cs.main_track && !cs.lagging_group) return '';
    return `<section class="v5-pulse"><h3>مهریار · یادآورها و حافظهٔ کلاس</h3>${rem.length ? `<ul>${rem.map(r => `<li><span>${r.when === t ? 'امروز' : r.when === tom ? 'فردا' : esc(displayDay(r.when))}</span> ${esc(r.title)} <button type="button" class="v5-link" data-v5-done="${esc(r.id)}">انجام شد</button></li>`).join('')}</ul>` : '<p>یادآور نزدیکی ثبت نشده است.</p>'}${cs.main_track ? `<p><b>مسیر اکثریت:</b> ${esc(cut(cs.main_track, 120))}</p>` : ''}${cs.lagging_group ? `<p><b>جامانده‌ها:</b> ${esc(cut(cs.lagging_group, 120))}</p>` : ''}<a class="btn btn-tinted-gray" href="#/pulse/assistant">${briefingDue() ? 'بریفینگ صبح امروز' : 'گفت‌وگو با مهریار'}</a></section>`;
  }
  function reminderDone(id) { const r = store.reminders.find(x => x.id === id); if (r) { r.done = true; save(); } }

  return { FAST_MODEL, DEEP_MODEL, ask, applyActions, undoActions, fixAction, canUndo, splitActions, scheduleStateUpdate, route, buildSystem, syllabusMap, toolsSummary, studentsBlock, mentionedStudents, classStateText, pruneClassState, norm,
    wireFacilities, pulseSnapshot, radarData, radarHtml, radarItems, remember, recall, clearMemory, rankMemories, verifiedActions, explicitProgress,
    voiceToggle, voiceStop, micHtml, paintVoice, receiptHtml, stageText, settingsHtml, readSettings, resetClassState, growthPickerHtml, pulseCardHtml, reminderDone, briefingDue,
    get store() { return store; } };
})();
