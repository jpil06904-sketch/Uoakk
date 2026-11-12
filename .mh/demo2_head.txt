const fs=require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const html=fs.readFileSync('/workspaces/Uoakk/mehryar-v4-final (10).html','utf8');
const vc=new VirtualConsole();const errs=[];vc.on('jsdomError',e=>errs.push(String(e.stack||e).slice(0,300)));vc.on('error',(...a)=>errs.push('CE '+a.join(' ').slice(0,300)));
const dom=new JSDOM(html,{url:'https://mehryar.local/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;}});
const w=dom.window;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await new Promise(r=>w.document.readyState==='complete'?r():w.addEventListener('load',r));await sleep(400);
const o=[];const q=e=>{try{return JSON.stringify(w.eval(e))}catch(x){return 'ERR '+x.message}};
w.eval('loadSample()');await sleep(600);
o.push('scopeKey='+q('state.classScopeKey')+' klass='+q('state.klass')+' ctxKeys='+q('Object.keys(state.classContexts||{})'));
o.push('students='+q('state.students.length')+' archived?='+q('state.students.slice(0,2)'));
o.push('sample.scopeKey='+q('sampleState().classScopeKey')+' sample.ctx='+q('Object.entries(sampleState().classContexts||{}).map(([k,v])=>[k,Object.keys(v||{}),(v&&v.students||[]).length])')+' sample.student0='+q('sampleState().students[0]'));
for(const r of ['#/students','#/pulse/overview/roster','#/home']){w.location.hash=r;await sleep(250);const c=w.document.querySelector('.content')||w.document.getElementById('app');o.push(r+': '+(c.textContent||'').replace(/\s+/g,' ').trim().slice(0,500));}
o.push('ERRS '+errs.length+' '+errs.join(' | '));
fs.writeFileSync('/workspaces/Uoakk/.mh/demo2.txt',o.join('\n'));process.exit(0);})();
setTimeout(()=>process.exit(2),120000);
