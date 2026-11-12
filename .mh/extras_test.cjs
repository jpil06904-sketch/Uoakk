// Round-trip test for the JSON backup extras (chat history, budgets, dossiers).
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const FILE = '/workspaces/Uoakk/mehryar-v4-final-fixed.html';
const OUT = '/workspaces/Uoakk/.mh/extras_test.txt';
const log = [];
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { const m = String(e && (e.message || e)); if (!/navigation|reload/i.test(m)) errors.push(m.slice(0, 300)); });
const dom = new JSDOM(fs.readFileSync(FILE, 'utf8'), {
  url: 'https://mehryar.local/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.fetch = () => Promise.reject(new TypeError('network blocked in test'));
    w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
  }
});
const w = dom.window;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = (name, ok) => log.push((ok ? 'PASS ' : 'FAIL ') + name);
(async () => {
  await new Promise(r => w.document.readyState === 'complete' ? r() : w.addEventListener('load', r));
  await sleep(400);
  // Real (non-demo) class data: take the sample class and import it as real data.
  w.__real = JSON.parse(w.eval('JSON.stringify(sampleState())'));
  w.__real.learning = w.__real.learning || {};
  w.__real.learning.attendanceDays = { '2026-11-10': { [w.__real.students[0].id]: 'absent', [w.__real.students[1].id]: 'late' } };
  check('real class loaded (not demo)', w.eval('replaceState(window.__real)') === true && w.eval('demoMode') === false);
  await sleep(300);
  const ls = w.localStorage;
  const chat = { version: 1, messages: [{ role: 'user', text: 'ایده درس دوم', profile: 'p1', tools: false }, { role: 'model', text: 'سه ایده…', profile: 'p1', tools: false }], draft: '' };
  const budget = { grade: 'دوم', academicYear: '1405-1406', months: [{ month: 'آبان', items: ['فارسی درس ۳ تا ۵'] }] };
  ls.setItem('mehryar_assistant_v1', JSON.stringify(chat));
  ls.setItem('mehyar_budget_دوم_1405-1406', JSON.stringify(budget));
  ls.setItem('mehyar_last_budget_key', 'mehyar_budget_دوم_1405-1406');
  const absentBefore = w.eval('JSON.stringify(state.learning.attendanceDays||{})');

  // 1) export: capture the text that would be downloaded
  w.eval('window.__captured=null; downloadJSONText=function(t,f){window.__captured={t,f};};');
  await w.eval('exportJSON()');
  const cap = w.eval('window.__captured');
  check('export produced a file', !!cap);
  const data = JSON.parse(cap.t);
  log.push('file name: ' + cap.f);
  check('students in backup (' + (data.students || []).length + ')', Array.isArray(data.students) && data.students.length > 0);
  check('attendance (absent/late) in backup', !!data.learning && JSON.stringify(data.learning.attendanceDays || {}) === absentBefore && absentBefore.includes('absent'));
  const x = data.mehryarExtras || {};
  check('chat history in backup', x.chatHistory && x.chatHistory.messages.length === 2);
  check('budget in backup', x.budgets && x.budgets['mehyar_budget_دوم_1405-1406'] && x.lastBudgetKey === 'mehyar_budget_دوم_1405-1406');
  check('student dossiers in backup', !!x.studentDossiers);

  // 2) wipe the extras, then import the file through the real import path
  ls.removeItem('mehryar_assistant_v1'); ls.removeItem('mehyar_budget_دوم_1405-1406'); ls.removeItem('mehyar_last_budget_key');
  w.__importData = JSON.parse(cap.t);
  const ok = w.eval('validateImport(clone(window.__importData)), replaceState(window.__importData)');
  check('import accepted (validateImport + replaceState)', ok === true);
  const chatBack = JSON.parse(ls.getItem('mehryar_assistant_v1') || 'null');
  check('chat history restored', chatBack && chatBack.messages.length === 2 && chatBack.messages[0].text === 'ایده درس دوم');
  check('budget restored', !!ls.getItem('mehyar_budget_دوم_1405-1406') && ls.getItem('mehyar_last_budget_key') === 'mehyar_budget_دوم_1405-1406');
  check('class data restored', w.eval('state.students.length') === data.students.length);
  check('attendance restored', w.eval('JSON.stringify(state.learning.attendanceDays||{})') === absentBefore);
  check('extras key not stored inside class state', w.eval('state.mehryarExtras===undefined') && !JSON.parse(ls.getItem('mehryar_v6')).mehryarExtras);

  // 3) an old backup without extras must still import
  const old = JSON.parse(cap.t); delete old.mehryarExtras;
  w.__old = old;
  check('old backup (without extras) still imports', w.eval('replaceState(window.__old)') === true);

  log.push('errors: ' + JSON.stringify(errors));
  fs.writeFileSync(OUT, log.join('\n'));
  process.exit(0);
})().catch(e => { fs.writeFileSync(OUT, log.join('\n') + '\nFATAL ' + (e.stack || e) + '\nerrors: ' + JSON.stringify(errors)); process.exit(1); });
setTimeout(() => { fs.writeFileSync(OUT, log.join('\n') + '\nTIMEOUT'); process.exit(2); }, 120000);
