
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
