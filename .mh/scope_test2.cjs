// سناریوهای تکمیلی ensureClassScope: اصلاح نام در کلاس کامل، بارگذاری مجدد، دادهٔ قدیمی، دمو
const fs=require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const FILE=process.argv[2]||'/workspaces/Uoakk/mehryar-v4-final (10).html';
const OUT=process.argv[3]||'/workspaces/Uoakk/.mh/scope_test2.txt';
const html=fs.readFileSync(FILE,'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(storage){
  const vc=new VirtualConsole();const errs=[];
  vc.on('jsdomError',e=>errs.push(String(e.stack||e).slice(0,300)));
  vc.on('error',(...a)=>errs.push('CE '+a.join(' ').slice(0,300)));
  const dom=new JSDOM(html,{url:'https://mehryar.local/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
    if(storage)for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
    w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;}});
  return {dom,w:dom.window,errs};
}
const ready=w=>new Promise(r=>w.document.readyState==='complete'?r():w.addEventListener('load',r));
const addStudents="setState({students:['علی','رضا','زهرا'].map((name,i)=>({id:'t-'+i,no:i+1,name,data:{},shortage:{},assess:emptyAssess()}))})";
(async()=>{
  const o=[];globalThis.__o=o;let fail=0;
  const check=(name,cond,extra='')=>{o.push((cond?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));if(!cond)fail++;};
  const info=(name,val)=>o.push('INFO '+name+'  '+val);
  let savedStorage=null;
  // --- C: کلاس کامل، بعد اصلاح نام معلم
  {
    const {w,errs}=boot();await ready(w);await sleep(400);
    w.eval("setState({klass:{teacher:'مریم رضوانی',school:'دبستان نمونه',grade:'دوم',className:'دوم'}})");
    w.eval(addStudents);await sleep(150);
    check('C1 complete class has 3 students',w.eval('state.students.length')===3);
    for(const v of ['مریم رضوان','مریم رضوانی','مریم رضوانیان']){w.eval(`setState({klass:{teacher:${JSON.stringify(v)}}},{silent:true})`);}
    await sleep(150);
    info('C2 after editing name of complete class: students=',w.eval('state.students.length')+' ctx='+JSON.stringify(w.eval('Object.keys(state.classContexts||{})')));
    w.eval("setState({klass:{teacher:'مریم رضوانی'}},{silent:true})");await sleep(150);
    check('C3 restoring exact old name brings roster back',w.eval('state.students.length')===3,'n='+w.eval('state.students.length'));
    w.eval('flushSave()');await sleep(100);
    savedStorage={};for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i);savedStorage[k]=w.localStorage.getItem(k);}
    info('C4 storage keys',JSON.stringify(Object.keys(savedStorage).map(k=>k+':'+savedStorage[k].length)));
    check('C5 no runtime errors',errs.length===0,errs.join(' | '));
  }
  // --- D: بارگذاری مجدد از localStorage
  {
    const {w,errs}=boot(savedStorage);await ready(w);await sleep(500);
    check('D1 reload keeps students',w.eval('state.students.length')===3,'n='+w.eval('state.students.length')+' key='+JSON.stringify(w.eval('state.classScopeKey')));
    check('D2 reload keeps teacher',w.eval('state.klass.teacher')==='مریم رضوانی');
    w.location.hash='#/students';await sleep(250);
    const txt=(w.document.querySelector('#content')||w.document.body).textContent.replace(/\s+/g,' ');
    check('D3 students page lists names',txt.includes('علی')&&txt.includes('زهرا'),txt.slice(0,90));
    w.location.hash='#/class';await sleep(250);
    check('D4 class page renders',!!w.document.querySelector('#f-teacher'));
    check('D5 no runtime errors',errs.length===0,errs.join(' | '));
  }
  // --- E: داده‌ای که با نسخهٔ باگ‌دار ذخیره شده
  {
    const {w,errs}=boot();await ready(w);await sleep(400);
    w.eval("setState({klass:{teacher:'م'}},{silent:true})");await sleep(100);const K=w.eval('state.classScopeKey');
    const legacy=w.eval(`(()=>{const d=migrate({});d.students=['علی','رضا'].map((name,i)=>({id:'l-'+i,no:i+1,name,data:{},shortage:{},assess:emptyAssess()}));const y=d.classScopeKey||'||||';const snap=JSON.parse(JSON.stringify(d));delete snap.classContexts;d.classContexts={[y]:snap};d.students=[];d.klass.teacher='م';d.classScopeKey=${JSON.stringify(K)};d.classScopeKlass=JSON.parse(JSON.stringify(d.klass));return JSON.stringify(d);})()`);
    let ok;try{ok=w.eval(`replaceState(${legacy})`);}catch(e){ok='ERR '+e.message;}
    info('E1 legacy replaceState ok='+ok+' students='+w.eval('state.students.length'),'ctx='+JSON.stringify(w.eval('Object.keys(state.classContexts||{})')));
    check('E2 no runtime errors on legacy data',errs.length===0,errs.join(' | '));
  }
  // --- F: دمو و خروج بعد از داشتن دادهٔ واقعی
  {
    const {w,errs}=boot();await ready(w);await sleep(400);
    w.eval("setState({klass:{teacher:'مریم',school:'دبستان',grade:'دوم',className:'دوم'}})");w.eval(addStudents);await sleep(150);
    w.eval('flushSave()');
    w.eval('loadSample()');await sleep(400);
    check('F1 demo shows 12 sample students',w.eval('state.students.length')===12,'n='+w.eval('state.students.length'));
    w.eval('exitDemo()');await sleep(300);
    check('F2 real roster back after exiting demo',w.eval('state.students.length')===3&&w.eval('state.klass.teacher')==='مریم','n='+w.eval('state.students.length'));
    check('F3 demo did not leak into real contexts',!JSON.stringify(w.eval('state.classContexts||{}')).includes('sample-'));
    check('F4 no runtime errors',errs.length===0,errs.join(' | '));
  }

  o.push(fail?`RESULT: ${fail} FAILED`:'RESULT: ALL PASSED');
  fs.writeFileSync(OUT,o.join('\n'));process.exit(0);
})().catch(e=>{fs.writeFileSync(OUT,(globalThis.__o||[]).join('\n')+'\nFATAL '+(e.stack||e));process.exit(1);});
setTimeout(()=>{fs.appendFileSync(OUT,'\nTIMEOUT');process.exit(2);},150000);
