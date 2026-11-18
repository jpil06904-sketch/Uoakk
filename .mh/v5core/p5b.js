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
