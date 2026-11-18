const assert = require('node:assert/strict');
const load = require('./test_env.cjs');
const calendar = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric'}).formatToParts(new Date()).map(x => [x.type,Number(x.value)]));
const names = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const year = calendar.year - (calendar.month < 7 ? 1 : 0), month = names[calendar.month - 1];
const budgets = new Map(); let curriculum = [], yearAssumed = false;
const tools = {
  get_budget_and_progress({grade}) { return {budget:budgets.get(grade) || null, budgetYearAssumed:yearAssumed}; },
  getCurriculumBudget({grade}) { return curriculum.filter(x=>x.grade === grade); }
};
const {V5,g,t} = load({MehryarTools:tools});
g.state.klass.year = `${year}-${year+1}`;
g.state.curriculum.books[0].grade = 'سوم';
const monthly = (grade,academicYear,subjects,lessons=[]) => ({grade,academicYear,months:[{monthName:month,subjects,lessons}]});
budgets.set('سوم',monthly('سوم',g.state.klass.year,[
  {subjectTitle:'ریاضی',topics:['صفحات ۲۲ تا ۳۱']},
  {subjectTitle:'ریاضی',topics:['صفحات ۳۲ تا ۴۴']}
],[{name:'فارسی',topic:'صفحات ۵ تا ۲۰'}]));
let rows = V5.radarData();
assert.equal(rows.length,2); assert.deepEqual(rows[0].expected,[22,44]);
assert.deepEqual(rows[1].expected,[5,20]);
const rec = V5.applyActions([{tool:'syllabus',subject:'ریاضی',page:30,topic:'صفحه ۳۰',status:'in_progress'}]);
assert.equal(rec.items[0].ok,true); assert.equal(V5.radarData()[0].status,'aligned');
budgets.set('دوم',monthly('دوم',g.state.klass.year,[{subjectTitle:'ریاضی',topics:['صفحات ۵۰ تا ۷۰']}]));
rows = V5.radarData({grade:'دوم'});
assert.deepEqual(rows[0].expected,[50,70]); assert.equal(rows[0].actual,null,'active grade position must not leak');
assert.equal(rows[0].status,'unknown');
V5.undoActions(rec);
g.state.klass.year = `${year+1}-${year+2}`;
budgets.set('سوم',monthly('سوم',g.state.klass.year,[{subjectTitle:'ریاضی',topics:['صفحات ۲۲ تا ۴۴']}]));
assert.equal(V5.radarData()[0].expected,null,'a plan for another school year is not the current month');
g.state.klass.year = `${year}-${year+1}`;
budgets.delete('سوم'); curriculum = [];
assert.deepEqual(V5.radarData(),[],'raw entries must not bypass scoped curriculum reader');
assert.ok(V5.syllabusMap().includes('بودجه پیدا نشد'));
curriculum = [{grade:'سوم',bookId:'b1',nodeId:'n12',startDate:g.plusDays(t,-1),endDate:g.plusDays(t,1)}];
g.state.curriculum.teachingProgress.b1.currentNodeId='n12';
rows=V5.radarData(); assert.equal(rows[0].status,'aligned');
assert.equal(V5.radarData({grade:'دوم'})[0].actual,null);
budgets.set('سوم',monthly('سوم',g.state.klass.year,[{subjectTitle:'ریاضی',topics:['صفحات ۲۲ تا ۴۴']}]));
g.state.curriculum.books[0].nodes[0].children[1].pageStart=20;
g.state.curriculum.books[0].nodes[0].children[1].pageEnd=40;
rows=V5.radarData(); assert.equal(rows[0].actual,null,'a chapter page range is not an exact page');
assert.equal(rows[0].position.topic,'جمع و تفریق'); assert.equal(rows[0].status,'unknown');
yearAssumed = true;
assert.ok(V5.syllabusMap().includes('سال بودجه مشخص نیست'), 'unscoped year must be presented as an assumption to the assistant');
g.state.curriculum.books.push({id:'b2',grade:'سوم',subject:'علوم',nodes:[{id:'science',title:'آب'}]});
curriculum.push({grade:'سوم',bookId:'b2',nodeId:'science',startDate:g.plusDays(t,-1),endDate:g.plusDays(t,1)});
rows=V5.radarData();
assert.deepEqual(rows.map(r=>r.subject),['ریاضی','علوم'], 'approved subjects missing from the annual plan remain visible');
assert.equal(rows[0].rows.length,1,'annual plan takes precedence over dated entries for the same subject');
assert.equal(rows[1].current,'آب');
assert.equal(rows[0].yearAssumed,true);
assert.equal(rows[1].yearAssumed,false,'annual year uncertainty must not leak to a separate curriculum subject');
budgets.set('سوم',monthly('سوم',g.state.klass.year,[{subjectTitle:'ریاضی',topics:['صفحات ۵ تا ۱۰']} ]));
budgets.get('سوم').months[0].monthName = names[(calendar.month % 12)];
rows=V5.radarData(); assert.equal(rows[0].current,'','a dated row must not fill a gap for an annual subject');
assert.equal(rows[1].current,'آب');
console.log('BUDGET SCOPE AND PRECISION TESTS PASSED');