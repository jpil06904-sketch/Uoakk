  /* Read the dashboard's live calculation, including its grade/week/subject filters. */
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
  }