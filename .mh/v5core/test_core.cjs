const assert = require('assert');
const { V5, g, t } = require('./test_env.cjs')();
// 1) normalisation + conditional student injection
assert.strictEqual(V5.norm('علي‌ كريمي'), 'علی کریمی'); // ي/ك normalised, ZWNJ removed
assert.strictEqual(V5.norm('علی\u200cاکبر'), 'علیاکبر');
assert.deepStrictEqual(V5.mentionedStudents('امروز زهرا كريمي خیلی کلافه بود').map(s => s.id), ['s2']);
assert.deepStrictEqual(V5.mentionedStudents('مريم امروز خوب نوشت').map(s => s.id), ['s4']);
assert.strictEqual(V5.studentsBlock('کلاس امروز شلوغ بود'), '', 'no names → zero bytes');
const sb = V5.studentsBlock('مریم چطوره؟');
assert.ok(sb.includes('خواندن روان') && sb.includes('نوشتن مستقل') && sb.includes('تفریق با محور') && !sb.includes('چوب‌خط'), 'only last 3 events');
// 2) tools summary: 30-day window, 2 lines
const ts = V5.toolsSummary();
assert.strictEqual(ts.split('\n').length, 2); assert.ok(ts.includes('زهرا کریمی 2 روز') && !ts.includes('علی رضایی'), ts);
// 3) syllabus map
const sm = V5.syllabusMap(); console.log(sm);
assert.ok(sm.includes('الگوها') && sm.includes('اطلاعات کافی نیست') && !sm.includes('(عقب)'), sm);
// 4) O(1): bounded prompt after 180 days of data
for (let d = 0; d < 180; d++) { const day = g.plusDays(t, -d); g.state.learning.attendanceDays[day] = { s1: d % 3 ? 'present' : 'absent', s2: 'present' }; g.state.learning.evidenceLog.push({ id: 'x' + d, studentId: 's1', date: day, text: 'شاهد شمارهٔ ' + d }); }
const sys = V5.buildSystem('علی رضایی امروز حواسش پرت بود', { route: 'DEEP' });
console.log('system prompt chars after 180 days:', sys.length);
assert.ok(!/\{\{[A-Z_]+\}\}/.test(sys) && !sys.includes('<brain>') && sys.length < 9000);
assert.ok(V5.buildSystem('زهرا', { noData: true }).includes('دسترسی ابزارها خاموش'));
// 5) <actions>
assert.strictEqual(V5.splitActions('سلام <act').display, 'سلام');
const sp = V5.splitActions('ثبت شد.\n<actions>[{"tool":"attendance","student":"زهرا","status":"absent"},{"tool":"syllabus","subject":"ریاضی","topic":"جمع و تفريق","status":"completed"},{"tool":"reminder","title":"امتحان علوم","when":"tomorrow"},{"tool":"growth_log","student":"مریم","note":"جمع مستقل","level":"مستقل"},{"tool":"attendance","student":"علی","status":"late"}]</actions>');
assert.strictEqual(sp.display, 'ثبت شد.'); assert.strictEqual(sp.actions.length, 5);
// 6) apply + ambiguous + fix + undo
const ev0 = g.state.learning.evidenceLog.length, before = { ...g.state.learning.attendanceDays[t] };
const rc = V5.applyActions(sp.actions);
console.log(rc.items.map(i => (i.ok ? 'OK ' : 'WARN ') + i.label).join('\n'));
assert.deepStrictEqual(rc.items.map(i => i.ok), [true, true, true, true, false]);
assert.strictEqual(g.state.learning.attendanceDays[t].s2, 'absent');
assert.strictEqual(g.state.curriculum.teachingProgress.b1.statuses.n12, 'taught');
assert.strictEqual(V5.store.reminders.at(-1).when, g.plusDays(t, 1));
assert.strictEqual(g.state.learning.evidenceLog.length, ev0 + 1);
assert.ok(V5.toolsSummary().includes('امتحان علوم'));
assert.ok(V5.fixAction(rc, 4, 'علی رضایی')); assert.strictEqual(g.state.learning.attendanceDays[t].s1, 'late');
assert.ok(V5.receiptHtml(rc, 3).includes('data-v5-undo'));
assert.ok(V5.undoActions(rc));
assert.deepStrictEqual(g.state.learning.attendanceDays[t], before, 'undo restores previous attendance');
assert.strictEqual(g.state.curriculum.teachingProgress.b1.statuses.n12, undefined);
assert.strictEqual(g.state.learning.evidenceLog.length, ev0); assert.ok(!V5.store.reminders.some(r => r.title === 'امتحان علوم'));
// 7) class_state pruning
const cs = V5.pruneClassState({ main_track: 'کلمه '.repeat(300), lagging_group: 'الف', advanced_group: '', last_action: '', what_failed: [{ topic: 'ضرب', date: g.plusDays(t, -60), method: 'قدیمی' }, { topic: 'جمع', date: t, method: 'کارت' }] });
assert.ok(JSON.stringify(cs).split(/\s+/).length <= 210); assert.deepStrictEqual(cs.what_failed.map(f => f.method), ['کارت']);
// 8) stage messages: read → think → prepare
assert.match(V5.stageText('DEEP', 0), /^در حال خواندن پیام…<span class="ai-typing-dots"[^>]*><span><\/span><span><\/span><span><\/span><\/span>$/);
assert.match(V5.stageText('DEEP', 2.9), /^در حال خواندن پیام…/);
assert.equal(V5.stageText('DEEP', 5.9), V5.stageText('DEEP', 3), 'same message inside a window');
assert.match(V5.stageText('DEEP', 3), /^مهریار در حال فکر کردن…/);
assert.equal(V5.stageText('DEEP', 5.9), V5.stageText('DEEP', 3.2), 'same message inside a window');
assert.match(V5.stageText('FAST', 3.2), /^در حال نوشتن…/);
assert.equal(V5.stageText('FAST', 7.9), V5.stageText('FAST', 3.2), 'same message inside a window');
assert.match(V5.stageText('DEEP', 9), /^در حال آماده‌سازی پاسخ دقیق‌تر…/);
assert.match(V5.stageText('FAST', 9), /^در حال آماده‌سازی پاسخ دقیق‌تر…/);
assert.match(V5.stageText('route', 99), /^در حال آماده‌سازی پاسخ دقیق‌تر…/);
assert.equal(V5.stageText('route', 1), V5.stageText('DEEP', 1), 'the router stage shares the early line');
assert.ok(!V5.stageText('DEEP', 99).includes('هنوز منتظر پاسخ مدل'), 'the withdrawn waiting line is gone');
assert.ok(V5.stageText('DEEP', -1).includes('در حال خواندن'), 'negative clock is clamped');
console.log('ALL CORE TESTS PASSED');
