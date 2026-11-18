const fs = require('node:fs');
const assert = require('node:assert/strict');
const {JSDOM, VirtualConsole} = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const errors = [], vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message));
const dom = new JSDOM(fs.readFileSync('/workspaces/Uoakk/v5/mehryar-v5.html','utf8'), {
  url:'https://mehryar.local/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w) {
    w.fetch = () => Promise.reject(new Error('offline test'));
    w.matchMedia = q => ({matches:false,media:q,addEventListener(){},removeEventListener(){}});
    w.IntersectionObserver = w.ResizeObserver = class {observe(){} unobserve(){} disconnect(){}};
    w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => null;
  }
});
const w = dom.window;
(async () => {
  await new Promise(resolve => w.document.readyState === 'complete' ? resolve() : w.addEventListener('load',resolve));
  const v = w.MehryarV5;
  w.eval(`
    state.klass.grade='سوم';
    state.students=[{id:'p1',name:'علی'},{id:'p2',name:'زهرا'},{id:'p3',name:'مریم'},{id:'p4',name:'پایه دیگر'},{id:'p5',name:'بایگانی'}];
    state.learning.studentMeta=Object.fromEntries(state.students.map(s=>[s.id,{grade:s.id==='p4'?'دوم':'سوم',enrolledOn:plusDays(localISO(),-30),archived:s.id==='p5'}]));
    state.learning.skills=[{id:'math-test',label:'جمع',subject:'ریاضی'}];
    state.learning.followups=[];state.learning.sessions=[];state.learning.attendanceDays={};state.learning.evidenceLog=[];
    pulseDashboardView={grade:'سوم',anchor:localISO(),subject:''};
    const fixture=(id,student,status,date=localISO(),observed=true)=>({id,date,sequence:1,subject:'ریاضی',skillId:'math-test',skillLabel:'جمع',rosterIds:[student],records:{[student]:{status,observed,attendance:'present',note:'شاهد'}}});
    state.learning.sessions.push(fixture('old','p1','red'),fixture('second','p2','yellow'),fixture('other','p4','red'),fixture('archived','p5','red'),fixture('future','p3','green',plusDays(localISO(),1)));
    state.learning.drafts={new:fixture('draft','p3','green')};
  `);
  let snapshot = v.pulseSnapshot();
  assert.equal(snapshot.total,3); assert.equal(snapshot.seen,2);
  assert.deepEqual(Array.from(snapshot.unseen,s=>s.name),['مریم']);
  assert.deepEqual(Array.from(snapshot.colors.red,s=>s.name),['علی']);
  assert.deepEqual(Array.from(snapshot.colors.yellow,s=>s.name),['زهرا']);
  assert.equal(snapshot.seen,w.eval('pdStats(state,pdFilter()).seen'));
  const system = v.buildSystem('نبض کلاس را گزارش بده');
  for (const name of ['علی','زهرا','مریم']) assert.ok(system.includes(name));
  assert.ok(!v.buildSystem('وضع کلاس؟',{noData:true}).includes('math-test'));
  const absence = v.applyActions([{tool:'attendance',student:'علی',status:'absent'}]);
  assert.equal(absence.items[0].ok,true);
  assert.equal(v.pulseSnapshot().absences[0].name,'علی');
  assert.equal(w.eval('state.learning.sessions.find(s=>s.id==="old").records.p1.attendance'),'absent');
  assert.equal(v.pulseSnapshot().seen,1);
  v.undoActions(absence);
  assert.equal(v.pulseSnapshot().seen,2); assert.equal(v.pulseSnapshot().absences.length,0);
  const report = v.applyActions([{tool:'growth_log',student:'مریم',note:'گزارش معلم',level:'مستقل'}]);
  assert.equal(report.items[0].ok,true);assert.equal(v.pulseSnapshot().seen,2,'a reported note is not direct evidence');
  v.undoActions(report);
  const observation = {tool:'growth_log',student:'مریم',subject:'ریاضی',skillId:'math-test',status:'green',observed:true,note:'جمع را مستقل انجام داد'};
  assert.equal(v.verifiedActions([{...observation}],'برای مریم پیشنهادی بده')[0].observed,false);
  const verified = v.verifiedActions([{...observation}],'مشاهده کردم مریم در جمع سبز است؛ ثبت کن');
  const receipt = v.applyActions(verified);
  assert.equal(receipt.items[0].ok,true);assert.equal(v.pulseSnapshot().seen,3);
  assert.deepEqual(Array.from(v.pulseSnapshot().colors.green,s=>s.name),['مریم']);
  assert.equal(w.eval('pdStats(state,pdFilter()).seen'),3);
  v.undoActions(receipt);assert.equal(v.pulseSnapshot().seen,2);
  w.eval("pulseDashboardView.grade='دوم'");
  assert.equal(v.pulseSnapshot().total,1);assert.equal(v.pulseSnapshot().colors.red[0].name,'پایه دیگر');
  assert.deepEqual(errors,[]);
  console.log('LIVE PULSE / CHAT CONTEXT / ATTENDANCE / GROWTH / UNDO TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>dom.window.close());