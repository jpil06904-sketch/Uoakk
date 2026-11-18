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
  }