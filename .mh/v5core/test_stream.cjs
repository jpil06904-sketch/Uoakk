const assert = require('node:assert/strict');
const {V5} = require('./test_env.cjs')();
const auth={key:'test'};
(async()=>{
  let calls=0;
  global.fetch = async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({})};};
  await assert.rejects(V5.ask({text:'سلام',auth}),e=>e.code==='NO_STREAM');assert.equal(calls,1,'no silent buffered fallback');
  calls=0;
  const panel={key:'MH-AAAA-BBBB',panel:{base:'https://panel.example',id:'device123'}};
  await assert.rejects(V5.ask({text:'سلام',auth:panel}),e=>e.code==='NO_STREAM');assert.equal(calls,1,'an empty old-panel response is not proof a retry is safe');
  const enc=new TextEncoder(); let ended=false;
  global.fetch=async()=>({ok:true,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({read:async()=>{
    if(ended)return {done:true};ended=true;return {done:false,value:enc.encode('data: {"candidates":[{"content":{"parts":[{"text":"ناقص"}]}}]}\n\n')};
  }})}});
  await assert.rejects(V5.ask({text:'سلام',auth}),e=>e.code==='STREAM_INCOMPLETE');
  assert.equal(V5.splitActions('متن<actions>[{"tool":"reminder"}]').actions.length,0);
  // Split UTF-8 Persian bytes and SSE lines across network chunks.
  const bytes=enc.encode('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'سلام فارسی'}]},finishReason:'STOP'}]})+'\n\n');let at=0;const deltas=[];
  global.fetch=async()=>({ok:true,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({read:async()=>at<bytes.length?{done:false,value:bytes.slice(at,at+=3)}:{done:true}})}});
  const r=await V5.ask({text:'سلام',auth,onDelta:t=>deltas.push(t)});assert.equal(r.text,'سلام فارسی');assert.ok(deltas.length);
  // A proxy can label SSE as JSON. Detect split field names and UTF-8 bytes,
  // deliver a delta before the stream finishes, and never send a second request.
  calls=0; at=0; const earlyDeltas=[];
  const mislabeledBytes=enc.encode('vendor: ignored\r\n: keepalive\r\ndata: '+JSON.stringify({candidates:[{content:{parts:[{text:'سلام فارسی'}]}}]})+'\r\n\r\ndata: '+JSON.stringify({candidates:[{finishReason:'STOP'}]})+'\r\n\r\n');
  let releaseEnd; const endGate=new Promise(resolve=>{releaseEnd=resolve;});
  let firstDelta; const deltaReady=new Promise(resolve=>{firstDelta=resolve;});
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},body:{getReader:()=>({read:async()=>{
    if(at<mislabeledBytes.length)return {done:false,value:mislabeledBytes.slice(at,at+=3)};
    await endGate;return {done:true};
  }})}};};
  const live=V5.ask({text:'سلام',auth,onDelta:t=>{earlyDeltas.push(t);firstDelta();}});
  let deltaTimer;
  try {
    await Promise.race([deltaReady,live,new Promise((_,reject)=>{deltaTimer=setTimeout(()=>reject(new Error('no incremental delta')),1000);})]);
    assert.deepEqual(earlyDeltas,['سلام فارسی'],'mislabeled SSE is delivered before response completion');
  } finally { clearTimeout(deltaTimer);releaseEnd(); }
  assert.equal((await live).text,'سلام فارسی');assert.equal(calls,1);
  // Reader-less WebViews must also inspect and consume the same mislabeled body.
  calls=0;
  const mislabeled='data: '+JSON.stringify({candidates:[{content:{parts:[{text:'پاسخ بافری'}]},finishReason:'STOP'}]})+'\n\n';
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},body:null,text:async()=>mislabeled};};
  assert.equal((await V5.ask({text:'سلام',auth})).text,'پاسخ بافری');assert.equal(calls,1);
  calls=0;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},body:null,text:async()=> 'data: '+JSON.stringify({error:{code:503,message:'خطای استریم'}})+'\n\n'};};
  await assert.rejects(V5.ask({mode:'briefing',auth}),e=>e.status===503 && e.message==='خطای استریم');assert.equal(calls,1);
  // A genuine JSON body remains JSON even when read incrementally or mislabeled SSE.
  calls=0; at=0;
  const jsonBytes=enc.encode('  '+JSON.stringify({candidates:[{content:{parts:[{text:'پاسخ JSON'}]},finishReason:'STOP'}]}));
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({read:async()=>at<jsonBytes.length?{done:false,value:jsonBytes.slice(at,at+=3)}:{done:true}})}};};
  assert.equal((await V5.ask({text:'سلام',auth})).text,'پاسخ JSON');assert.equal(calls,1);
  calls=0;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=>null},body:null,text:async()=>JSON.stringify({error:{code:503,message:'خطای بافری JSON'}})};};
  await assert.rejects(V5.ask({mode:'briefing',auth}),e=>e.status===503 && e.message==='خطای بافری JSON');assert.equal(calls,1);
  // A WebView without a streaming reader must consume the same response.
  calls=0;
  const sse='data: '+JSON.stringify({candidates:[{content:{parts:[{text:'پاسخ بافری'}]},finishReason:'STOP'}]})+'\n\n';
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'text/event-stream'},body:null,text:async()=>sse};};
  const buffered=await V5.ask({text:'سلام',auth});assert.equal(buffered.text,'پاسخ بافری');assert.equal(calls,1);
  calls=0;
  const noDecoder=require('./test_env.cjs')({TextDecoder:undefined}).V5;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'text/event-stream'},body:{getReader(){throw new Error('must buffer');}},text:async()=>sse};};
  assert.equal((await noDecoder.ask({text:'سلام',auth})).text,'پاسخ بافری');assert.equal(calls,1);
  // A complete JSON response is consumed as-is, without another request.
  calls=0;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({candidates:[{content:{parts:[{text:'پاسخ JSON'}]},finishReason:'STOP'}]})};};
  assert.equal((await V5.ask({text:'سلام',auth:panel})).text,'پاسخ JSON');assert.equal(calls,1);
  calls=0;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({error:{code:503,message:'خطای JSON'}})};};
  await assert.rejects(V5.ask({mode:'briefing',auth:panel}),e=>e.status===503 && e.message==='خطای JSON');assert.equal(calls,1);
  calls=0;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({candidates:[{content:{parts:[{text:'ناقص'}]}}]})};};
  await assert.rejects(V5.ask({text:'سلام',auth:panel}),e=>e.code==='STREAM_INCOMPLETE');assert.equal(calls,1);
  // An error in an accepted stream is surfaced, even before the first token.
  calls=0;
  global.fetch=async()=>{calls++;return {ok:true,headers:{get:()=> 'text/event-stream'},body:null,text:async()=> 'data: '+JSON.stringify({error:{code:503,message:'خطای واقعی'}})+'\n\n'};};
  await assert.rejects(V5.ask({mode:'briefing',auth}),e=>e.status===503 && e.message==='خطای واقعی');assert.equal(calls,1);
  // An explicitly rejected HTTP request can use the existing model fallback.
  calls=0;
  global.fetch=async()=>{calls++;return calls===1?{ok:false,status:404,json:async()=>({error:{message:'unavailable'}})}:{ok:true,headers:{get:()=> 'text/event-stream'},body:null,text:async()=>sse};};
  const fallback=await V5.ask({mode:'briefing',auth});assert.equal(fallback.modelFallback,true);assert.equal(calls,2);
  calls=0;
  global.fetch=async()=>{calls++;return {ok:false,status:504,json:async()=>({error:{message:'timeout'}})};};
  await assert.rejects(V5.ask({mode:'briefing',auth:panel}),e=>e.status===504);assert.equal(calls,1,'proxy timeout is not safe to retry');
  // Cancellation while buffering must not turn into a compatibility retry.
  calls=0;
  global.fetch=async(_url,init)=>{calls++;return {ok:true,headers:{get:()=> 'text/event-stream'},body:null,text:()=>new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))};};
  const ctl=new AbortController(), waiting=V5.ask({text:'سلام',auth,signal:ctl.signal});
  setTimeout(()=>ctl.abort(),20);await assert.rejects(waiting,e=>e.name==='AbortError');assert.equal(calls,1);
  // Accelerate only the stream watchdog, leaving normal browser timers intact.
  calls=0;
  const timed=require('./test_env.cjs')({setTimeout:(fn,ms,...args)=>setTimeout(fn,ms===30000?20:ms,...args)}).V5;
  await assert.rejects(timed.ask({mode:'briefing',auth}),e=>e.code==='MODEL_TIMEOUT');assert.equal(calls,1,'timeout must not launch another model request');
  // Real connection silence is independent of visible tokens. Drive a virtual
  // clock so a long reasoning pause with SSE heartbeats needs no wall-clock wait.
  let now=0, timerId=0, deliver, socketSignal;
  const timers=new Map(), stages=[], visible=[];
  const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
  const advance=async ms=>{
    const until=now+ms;
    for(;;){
      const next=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();
    }
    now=until;await flush();
  };
  const clocked=require('./test_env.cjs')({
    setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{at:now+ms,fn});return id;},
    clearTimeout:id=>timers.delete(id)
  }).V5;
  global.fetch=async(_url,init)=>{
    socketSignal=init.signal;
    return {ok:true,body:{getReader:()=>({read:()=>new Promise((resolve,reject)=>{
      const aborted=()=>reject(new DOMException('Aborted','AbortError'));
      init.signal.addEventListener('abort',aborted,{once:true});
      deliver=value=>{init.signal.removeEventListener('abort',aborted);resolve(value);};
    })})}};
  };
  const liveClocked=clocked.ask({text:'سلام',auth,onStage:s=>stages.push(s),onDelta:t=>visible.push(t)});
  await flush();
  const send=async text=>{deliver({done:false,value:enc.encode(text)});await flush();};
  await send('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'شروع پاسخ'}]}}]})+'\n\n');
  await advance(3000);assert.equal(stages.at(-1),'thinking','a pause after the first token shows thinking');
  for(let i=0;i<7;i++){await advance(5000);await send(': keepalive\n\n');}
  assert.equal(socketSignal.aborted,false,'heartbeats keep a 38-second token pause alive');
  assert.deepEqual(visible,['شروع پاسخ'],'SSE comments never become answer text');
  await send('data: '+JSON.stringify({candidates:[{content:{parts:[{text:' کامل'}]},finishReason:'STOP'}]})+'\n\n');
  assert.equal(stages.at(-1),'FAST','visible output clears thinking');
  deliver({done:true});assert.equal((await liveClocked).text,'شروع پاسخ کامل');
  assert.equal(timers.size,0,'completion clears all watchdogs');
  const silent=clocked.ask({text:'سلام',auth});
  const silenceRejected=assert.rejects(silent,e=>e.code==='MODEL_TIMEOUT');
  await flush();await advance(29999);assert.equal(socketSignal.aborted,false);
  await advance(1);await silenceRejected;assert.equal(timers.size,0);
  console.log('STREAM CONTRACT TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});