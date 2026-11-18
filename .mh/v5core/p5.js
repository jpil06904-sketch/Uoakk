
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
