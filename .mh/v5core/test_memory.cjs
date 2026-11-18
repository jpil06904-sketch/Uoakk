// Small IndexedDB contract stub; no new runtime or test dependency.
const assert = require('node:assert/strict');
const {V5,g} = require('./test_env.cjs')();
const data = new Map(), lookups = [];
const db = {
  createObjectStore(){return {createIndex(name,path,opts){assert.equal(name,'terms'); assert.equal(opts.multiEntry,true);}};},
  transaction(name,mode){
    assert.equal(name,'messages');
    const tx = {objectStore(){return {put(r){data.set(r.id,r);},clear(){data.clear();},index(name){assert.equal(name,'terms');return {getAll(term,limit){
      lookups.push(term); const req={}; queueMicrotask(()=>{req.result=[...data.values()].filter(r=>r.terms.includes(term)).slice(0,limit);req.onsuccess();});return req;
    }};}};}};
    if(mode==='readwrite') queueMicrotask(()=>tx.oncomplete()); return tx;
  }
};
g.window.indexedDB = {open(name,version){assert.equal(name,'mehryar_chat_memory_v1');assert.equal(version,1);const req={result:db};queueMicrotask(()=>{req.onupgradeneeded();req.onsuccess();});return req;}};
(async()=>{
  const messages = Array.from({length:20},(_,i)=>({role:'user',text:'ریاضی جمع فرآیندی تجربه '+i}));
  await V5.remember(messages,'class-A'); await V5.remember(messages,'class-A'); assert.equal(data.size,20,'migration is idempotent');
  await V5.remember([{role:'user',text:'ریاضی دادهٔ کلاس دیگر'}],'class-B');
  await V5.remember([{role:'model',text:'ریاضی حدس مدل'}],'class-A'); assert.equal(data.size,21);
  let result = await V5.recall('قبلاً ریاضی چی گفتم',[],'class-A');
  assert.equal(result.length,4); assert.ok(result.every(x=>!x.includes('کلاس دیگر'))); assert.ok(lookups.length>0);
  result = await V5.recall('علوم',[],'class-A');assert.equal(result.length,0);
  await V5.remember([{role:'user',text:'کتابها را روی میز گذاشتم'}],'class-D');
  result = await V5.recall('کتاب',[],'class-D'); assert.ok(result.some(x=>x.includes('کتابها')),'singular query finds Persian plurals');
  const legacy = [...data.values()].find(x=>x.scope==='class-D'); legacy.terms = ['class-D|کتابها'];
  result = await V5.recall('کتاب',[],'class-D'); assert.ok(result.some(x=>x.includes('کتابها')),'old plural-only index entries remain searchable');
  assert.deepEqual(await V5.recall('کتاب',[],'class-E'),[],'plural lookup remains scoped');
  result = await V5.recall('ریاضی',messages.slice(-12),'class-A'); assert.ok(result.every(x=>!messages.slice(-12).some(m=>m.text===x)));
  const privateHistory = [{role:'user',text:'ریاضی رمز خصوصی معلم',tools:false},...Array.from({length:12},(_,i)=>({role:i%2?'model':'user',text:'بی‌ربط '+i}))];
  result = await V5.recall('ریاضی',privateHistory,'class-C'); assert.equal(result.length,0,'tools-off messages must not enter local fallback memory');
  // Exercise recall through the actual request builder, with all network mocked.
  const requests = [];
  global.fetch = async (url,init) => {
    const body = JSON.parse(init.body); requests.push({url,body});
    if (url.includes(':generateContent')) return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"route":"DEEP"}'}]}}]})};
    const chunk = new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"پاسخ آزمایشی"}]},"finishReason":"STOP"}]}\n\n');
    let sent = false;
    return {ok:true,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({read:async()=>sent ? {done:true} : (sent=true,{done:false,value:chunk})})}};
  };
  const auth = {key:'test',panel:null};
  await V5.ask({text:'برای ریاضی چه ایده‌ای داری؟',history:[],profile:'class-A',auth});
  let prompt = requests.at(-1).body.systemInstruction.parts[0].text;
  assert.ok(prompt.includes('یادآوری گفته‌های قدیمی معلم'));
  assert.ok(prompt.includes('ریاضی جمع فرآیندی تجربه'));
  assert.ok(!prompt.includes('دادهٔ کلاس دیگر'), 'another class must not be sent to the model');
  const lookupCount = lookups.length;
  await V5.ask({text:'برای ریاضی چه ایده‌ای داری؟',history:[],profile:'class-A',auth,noData:true});
  prompt = requests.at(-1).body.systemInstruction.parts[0].text;
  assert.ok(!prompt.includes('یادآوری گفته‌های قدیمی معلم'), 'tools-off requests must not include memory');
  assert.equal(lookups.length,lookupCount,'tools-off requests do not search the index');
  await V5.ask({text:'سلام',history:[],profile:'class-A',auth});
  assert.equal(lookups.length,lookupCount,'simple greetings do not search the index');
  const race = V5.remember([{role:'user',text:'ریاضی پیامی در حال ذخیره'}],'class-C');
  assert.equal(await V5.clearMemory(),true); await race;
  assert.equal(data.size,0,'clear removes the index and cancels queued migration');
  assert.deepEqual(await V5.recall('ریاضی',[],'class-A'),[]);
  console.log('INDEXEDDB CONTRACT TESTS PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});