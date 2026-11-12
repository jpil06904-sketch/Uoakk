const fs=require('fs');
const { JSDOM, VirtualConsole } = require('/workspaces/Uoakk/.mh/env/node_modules/jsdom');
const html=fs.readFileSync('/workspaces/Uoakk/mehryar-v4-final (10).html','utf8');
const vc=new VirtualConsole();
const errs=[];vc.on('jsdomError',e=>errs.push(String(e.stack||e).slice(0,300)));
const dom=new JSDOM(html,{url:'https://mehryar.local/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.fetch=()=>Promise.reject(new TypeError('blocked'));w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};w.scrollTo=()=>{};w.Element.prototype.scrollIntoView=function(){};w.Element.prototype.scrollTo=function(){};w.HTMLCanvasElement.prototype.getContext=()=>null;}});
const w=dom.window;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await new Promise(r=>w.document.readyState==='complete'?r():w.addEventListener('load',r));await sleep(400);
const out=[];
const mode=process.argv[2];
if(mode==='seed'){w.eval('loadSample()');await sleep(300);}
for(const r of ['#/output/contacts','#/output/notebook','#/students','#/pulse/sessions','#/pulse/parent-meeting','#/pulse/assistant-preview','#/settings/list/agenda','#/curriculum/progress','#/curriculum/budget']){w.location.hash=r;await sleep(150);const c=w.document.getElementById('content')||w.document.getElementById('app');out.push(r+' => '+w.location.hash+' :: '+(c.textContent||'').replace(/\s+/g,' ').trim().slice(0,260));}
out.push('ERRS '+errs.length+'\n'+errs.join('\n'));
fs.writeFileSync('/workspaces/Uoakk/.mh/texts_'+(mode||'empty')+'.txt',out.join('\n'));process.exit(0);})();
setTimeout(()=>process.exit(2),120000);
