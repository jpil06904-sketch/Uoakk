const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {V5, g} = require('./test_env.cjs')();
const date = Object.fromEntries(new Intl.DateTimeFormat('en-US-u-ca-persian', {year:'numeric', month:'numeric'}).formatToParts(new Date()).map(p => [p.type, +p.value]));
const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const earlierMonth = months.find(m => m !== months[date.month-1]);
const otherMonth = months.find(m => m !== months[date.month-1] && m !== earlierMonth);
const year = date.year - (date.month < 7 ? 1 : 0);
g.state.klass.year = `${year}-${year+1}`;
g.localStorage.setItem(`mehyar_budget_سوم_${year}-${year+1}`, JSON.stringify({grade:'سوم', academicYear:g.state.klass.year, months:[
  {monthName:earlierMonth, subjects:[{subjectTitle:'ریاضی', topics:['صفحات ۱ تا ۲۱']}]},
  {monthName:months[date.month-1], subjects:[{subjectTitle:'ریاضی', topics:['صفحات ۲۲ تا ۴۴']}]},
  {monthName:otherMonth, subjects:[{subjectTitle:'ریاضی', topics:['صفحات ۴۵ تا ۶۴']}]}]}));

let current, yearAssumed = false;
const dashboard = {querySelectorAll:() => [], querySelector:() => null, insertBefore:section => { current = section; }};
const document = {querySelector:s => s === '#content .pd-dashboard' ? dashboard : null,
  createElement:() => ({dataset:{},isConnected:true,setAttribute(){},addEventListener(){},remove(){this.isConnected=false;}}),
  head:{appendChild(){}}};
const html = fs.readFileSync('/workspaces/Uoakk/v5/mehryar-v5.html','utf8');
const block = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('if (window.__mehryarBudgetRadar)'));
assert.ok(block, 'original radar script exists');
const context = {...g, document, window:{MehryarV5:V5}, location:{hash:''}, setTimeout, setInterval, clearInterval,
  renderPulse:() => {}, pdFilter:() => ({grade:'سوم'}), route(){},
  MehryarTools:{get_budget_and_progress:()=>({budget:{months:[]}, budgetYearAssumed:yearAssumed})}};
vm.runInNewContext(block, context);
const wait = () => new Promise(resolve => setTimeout(resolve, 25));
(async () => {
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('رادار بودجه‌بندی'));
  assert.ok(current.innerHTML.includes('br-planned'));
  assert.ok(current.innerHTML.includes('ثبت نشده'));
  assert.ok(!V5.pulseCardHtml().includes('رادار بودجه‌بندی'));
  g.state.curriculum.books.push({id:'science-book',grade:'سوم',subject:'علوم',nodes:[{id:'water',title:'آب'}]});
  g.state.curriculum.budget.entries.push({bookId:'science-book',nodeId:'water',startDate:g.plusDays(g.localISO(),-1),endDate:g.plusDays(g.localISO(),1)});
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('ریاضی') && current.innerHTML.includes('علوم') && current.innerHTML.includes('آب'), 'annual and approved dated budgets appear together on the original radar');
  g.state.curriculum.budget.entries = g.state.curriculum.budget.entries.filter(row=>row.bookId!=='science-book');
  g.state.curriculum.books = g.state.curriculum.books.filter(book=>book.id!=='science-book');
  const receipt = V5.applyActions([{tool:'syllabus',subject:'ریاضی',page:30,topic:'صفحه ۳۰',status:'in_progress'}]);
  assert.equal(receipt.items[0].ok,true);
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('br-actual'));
  assert.ok(current.innerHTML.includes('صفحه 30'));
  assert.ok(current.innerHTML.includes('در بازهٔ برنامه'));
  V5.undoActions(receipt);
  const ahead = V5.applyActions([{tool:'syllabus',subject:'ریاضی',page:55,topic:'صفحه ۵۵',status:'in_progress'}]);
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('br-ahead'));
  assert.ok(current.innerHTML.includes('جلوتر از بازهٔ برنامه'));
  V5.undoActions(ahead);
  const behind = V5.applyActions([{tool:'syllabus',subject:'ریاضی',page:10,topic:'صفحه ۱۰',status:'in_progress'}]);
  assert.equal(behind.items[0].ok, true);
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('br-warn'));
  assert.ok(current.innerHTML.includes('عقب از بازهٔ برنامه'));
  const style = fs.readFileSync('/workspaces/Uoakk/.mh/v5core/css.css','utf8');
  assert.match(style,/\.budget-radar \.br-warn\{[^}]*#fef2f2/,'behind uses the muted red background');
  assert.match(style,/\.budget-radar \.br-warn\{[^}]*#fecaca/,'behind uses the muted red border');
  assert.match(style,/html\[data-theme=dark\] \.budget-radar \.br-warn\{[^}]*#7f1d1d/,'the muted red survives dark mode');
  assert.match(style,/\.budget-radar \.br-ok\{[^}]*#21a756/,'on schedule stays green');
  assert.match(style,/\.budget-radar \.br-ahead\{[^}]*#1683e8/,'ahead stays blue');
  V5.undoActions(behind);
  context.renderPulse(); await wait();
  assert.ok(!current.innerHTML.includes('br-actual'), 'undo invalidates the radar cache');
  assert.ok(current.innerHTML.includes('ثبت نشده'));
  g.localStorage.setItem(`mehyar_budget_سوم_${year}-${year+1}`, JSON.stringify({grade:'سوم', academicYear:g.state.klass.year, months:[
    {monthName:earlierMonth, subjects:[{subjectTitle:'ریاضی', topics:['مرور']}]},
    {monthName:months[date.month-1], subjects:[{subjectTitle:'ریاضی', topics:['صفحه ۲۵ تا ۴۲']}]},
    {monthName:otherMonth, subjects:[{subjectTitle:'ریاضی', topics:['جمع‌بندی']}]}]}));
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('صفحه 25 تا 42'), 'use the actual page range even if other months have no page range');
  assert.ok(!current.innerHTML.includes('مبحث 2 تا 2'));
  assert.ok(!current.innerHTML.includes('سال بودجه ثبت نشده است'));
  yearAssumed = true;
  g.localStorage.setItem(`mehyar_budget_سوم_${year}-${year+1}`, JSON.stringify({grade:'سوم', academicYear:g.state.klass.year, months:[
    {monthName:months[date.month-1], subjects:[{subjectTitle:'ریاضی', topics:['صفحه ۴۴']}]}]}));
  context.renderPulse(); await wait();
  assert.ok(current.innerHTML.includes('سال بودجه ثبت نشده است؛ انطباق آن با سال فعال فقط یک فرض است.'), 'warn when the budget year is assumed');
  assert.ok(current.innerHTML.includes('left:99%;width:1%'), 'a range at the right edge remains visible within the track: ' + current.innerHTML);
  yearAssumed = false;
  g.localStorage.setItem(`mehyar_budget_سوم_${year}-${year+1}`, JSON.stringify({grade:'سوم', academicYear:g.state.klass.year, months:[
    {monthName:months[date.month-1], subjects:[{subjectTitle:'ریاضی', topics:['صفحه ۴۳ تا ۴۴']}]}]}));
  context.renderPulse(); await wait();
  assert.ok(!current.innerHTML.includes('سال بودجه ثبت نشده است'), 'a known year is not presented as assumed');
  console.log('ORIGINAL RADAR UI TEST PASSED');
})().catch(error => {console.error(error); process.exitCode=1;});