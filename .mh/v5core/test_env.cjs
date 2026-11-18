// Mocked app environment for MehryarV5 core tests (no network).
const fs = require('fs');
module.exports = function load(extra = {}) {
  const core = fs.readFileSync(__dirname + '/core.js', 'utf8');
  const ls = new Map();
  const g = {
    localStorage: { get length() { return ls.size; }, key: i => [...ls.keys()][i] ?? null, getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    performance: { now: () => Date.now() }, window: {}, document: { getElementById: () => null, querySelectorAll: () => [] },
    ui: { toast() {} }, demoMode: false,
  };
  const pad = n => String(n).padStart(2, '0');
  g.localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  g.dateObj = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  g.validDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && g.localISO(g.dateObj(s)) === s;
  g.plusDays = (s, n) => { const d = g.dateObj(s); d.setDate(d.getDate() + n); return g.localISO(d); };
  g.displayDay = s => s; g.fa = s => String(s); g.uid = () => Math.random().toString(36).slice(2, 10);
  g.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const t = g.localISO();
  g.state = {
    klass: { grade: 'سوم', teacher: 'خانم رضایی' },
    students: [{ id: 's1', name: 'علی رضایی' }, { id: 's2', name: 'زهرا کریمی' }, { id: 's3', name: 'علی‌اکبر نوری' }, { id: 's4', name: 'مریم' }],
    learning: { attendanceDays: { [g.plusDays(t, -3)]: { s2: 'absent' }, [g.plusDays(t, -5)]: { s2: 'absent' }, [g.plusDays(t, -40)]: { s1: 'absent' } }, followups: [], evidenceLog: [
      { id: 'e1', studentId: 's4', date: g.plusDays(t, -20), text: 'جمع دورقمی با چوب‌خط' }, { id: 'e2', studentId: 's4', date: g.plusDays(t, -10), text: 'تفریق با محور' },
      { id: 'e3', studentId: 's4', date: g.plusDays(t, -5), text: 'خواندن روان' }, { id: 'e4', studentId: 's4', date: g.plusDays(t, -1), text: 'نوشتن مستقل' }] },
    curriculum: { books: [{ id: 'b1', subject: 'ریاضی', title: 'ریاضی سوم', nodes: [{ id: 'n1', title: 'فصل ۱', children: [{ id: 'n11', title: 'الگوها' }, { id: 'n12', title: 'جمع و تفریق' }] }, { id: 'n2', title: 'ضرب' }] }],
      teachingProgress: { b1: { currentNodeId: '', statuses: { n11: 'taught' }, exceptions: [], updatedAt: '' } },
      budget: { entries: [{ bookId: 'b1', nodeId: 'n11', nodeTitle: 'الگوها', startDate: g.plusDays(t, -30) }, { bookId: 'b1', nodeId: 'n12', nodeTitle: 'جمع و تفریق', startDate: g.plusDays(t, -10) }, { bookId: 'b1', nodeId: 'n2', nodeTitle: 'ضرب', startDate: g.plusDays(t, 20) }] } },
  };
  g.activeStudents = () => g.state.students;
  g.studentById = id => g.state.students.find(s => s.id === id);
  g.saved = 0; g.flushSave = () => { g.saved++; return true; };
  Object.assign(g, extra);
  const keys = Object.keys(g).filter(k => k !== 'saved');
  const V5 = new Function(...keys, core + '\nreturn window.MehryarV5;')(...keys.map(k => g[k]));
  return { V5, g, t };
};
