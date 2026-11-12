// تست رفتار ensureClassScope: دموی نمونه و جریان واقعی کاربر (اول اسامی، بعد اطلاعات کلاس)
const fs=require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const FILE=process.argv[2]||'/workspaces/Uoakk/mehryar-v4-final (10).html';
const OUT=process.argv[3]||'/workspaces/Uoakk/.mh/scope_test.txt';
const html=fs.readFileSync(FILE,'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function boot(){
  const vc=new VirtualConsole();const errs=[];
  vc.on('jsdomError',e=>errs.push(String(e.stack||e).slice(0,300)));
  vc.on('error',(...a)=>errs.push('CE '+a.join(' ').slice(0,300)));
  const dom=new JSDOM(html,{url:'https://mehryar.local/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;}});
  return {dom,w:dom.window,errs};
}
const ready=w=>new Promise(r=>w.document.readyState==='complete'?r():w.addEventListener('load',r));
(async()=>{
  const o=[];let fail=0;
  const check=(name,cond,extra='')=>{o.push((cond?'PASS ':'FAIL ')+name+(extra?'  '+extra:''));if(!cond)fail++;};
  // --- A: demo
  {
    const {w,errs}=boot();await ready(w);await sleep(400);
    w.eval('loadSample()');await sleep(500);
    w.location.hash='#/students';await sleep(300);
    const n=w.eval('state.students.length');
    const txt=(w.document.querySelector('.content')||w.document.body).textContent.replace(/\s+/g,' ').slice(0,80);
    check('A1 demo has 12 students after render',n===12,'n='+n+' | '+txt);
    o.push('A2 demo classScopeKey='+JSON.stringify(w.eval('state.classScopeKey')));
    check('A3 demo did not create stray class contexts',w.eval('Object.keys(state.classContexts||{}).length')===0,JSON.stringify(w.eval('Object.keys(state.classContexts||{})')));
    w.eval('exitDemo()');await sleep(300);
    check('A4 exitDemo restores real (empty) state',w.eval('state.students.length')===0&&w.eval('!demoMode'));
    check('A5 no runtime errors',errs.length===0,errs.join(' | '));
  }
  // --- B: real flow: paste names first, then type class info
  {
    const {w,errs}=boot();await ready(w);await sleep(400);
    o.push('B0 fresh key='+JSON.stringify(w.eval('state.classScopeKey')));
    w.eval("setState({students:['علی','رضا','زهرا'].map((name,i)=>({id:'t-'+i,no:i+1,name,data:{},shortage:{},assess:emptyAssess()}))})");await sleep(200);
    check('B1 students added',w.eval('state.students.length')===3);
    // تایپ حرف‌به‌حرف نام آموزگار مثل فرم واقعی (onInput → setState silent)
    for(const v of ['م','مر','مری','مریم']){w.eval(`setState({klass:{teacher:${JSON.stringify(v)}}},{silent:true})`);}
    await sleep(200);
    check('B2 students kept after first-time teacher name',w.eval('state.students.length')===3,'n='+w.eval('state.students.length')+' ctx='+JSON.stringify(w.eval('Object.keys(state.classContexts||{})')));
    w.eval("setState({klass:{school:'دبستان نمونه',grade:'دوم',className:'دوم'}})");await sleep(200);
    check('B3 students kept after completing class info',w.eval('state.students.length')===3,'n='+w.eval('state.students.length'));
    // ذخیره و بارگذاری مجدد
    w.eval('flushSave()');
    const saved=w.eval('JSON.stringify(state)');
    check('B4 persisted state still has students',JSON.parse(saved).students.length===3);
    // تعویض عمدی کلاس (کلاس واقعی دیگر با اطلاعات کامل) باید همچنان جدا شود
    w.eval("setState({klass:{className:'دوم ب'}})");await sleep(200);
    const nB=w.eval('state.students.length');
    check('B5 switching to a different complete class gives a separate (empty) roster',nB===0,'n='+nB);
    w.eval("setState({klass:{className:'دوم'}})");await sleep(200);
    check('B6 switching back restores the original roster',w.eval('state.students.length')===3,'n='+w.eval('state.students.length'));
    check('B7 no runtime errors',errs.length===0,errs.join(' | '));
  }
  o.push(fail?`RESULT: ${fail} FAILED`:'RESULT: ALL PASSED');
  fs.writeFileSync(OUT,o.join('\n'));process.exit(0);
})().catch(e=>{fs.writeFileSync(OUT,'FATAL '+(e.stack||e));process.exit(1);});
setTimeout(()=>{fs.appendFileSync(OUT,'\nTIMEOUT');process.exit(2);},150000);
