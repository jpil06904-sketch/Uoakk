  /* On-device index. Old localStorage exchanges are migrated on first use; never upload a whole archive. */
  let memoryDB, memoryEpoch = 0;
  function openMemory() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!memoryDB) memoryDB = new Promise(resolve => {
      const req = window.indexedDB.open('mehryar_chat_memory_v1',1);
      req.onupgradeneeded = () => { const s = req.result.createObjectStore('messages',{keyPath:'id'}); s.createIndex('terms','terms',{multiEntry:true}); };
      req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); memoryDB = null; }; resolve(req.result); };
      req.onerror = req.onblocked = () => { memoryDB = null; resolve(null); };
    });
    return memoryDB;
  }
  const STOP_WORDS = new Set(['امروز','فردا','قبلا','قبلاً','گفتم','هفته','پیش','الان','کجا','هستم','بود','شد','است','این','اون','برای','چطور','هایی','های','من','تو','به','را','از','که','هم','در','با']);
  function memoryTerms(text) {
    const terms = [];
    for (const word of norm(text).split(/[^\p{L}\p{N}]+/u)) {
      if (word.length <= 2 || STOP_WORDS.has(word)) continue;
      terms.push(word);
      const suffix = ['هایی','های','ها'].find(s => word.endsWith(s) && word.length - s.length >= 3);
      if (suffix) terms.push(word.slice(0, -suffix.length));
    }
    return [...new Set(terms)].slice(0,40);
  }
  function memoryRecord(m, profile) {
    const text = String(m.text || ''), scope = profile || scopeKey();
    return { id:JSON.stringify([scope,m.role,text]), scope, text:cut(text,900), role:m.role, terms:memoryTerms(text).map(w=>scope+'|'+w), time:m.time || Date.now() };
  }
  async function remember(history, profile) {
    if (typeof demoMode !== 'undefined' && demoMode) return;
    const epoch = memoryEpoch, db = await openMemory(); if (!db || epoch !== memoryEpoch) return;
    await new Promise(resolve => {
      const tx = db.transaction('messages','readwrite'), s = tx.objectStore('messages');
      // Idempotent migration: keys depend on scope + role + text, not array offsets.
      for (const m of history || []) if (m.role === 'user' && m.text && m.tools !== false) s.put(memoryRecord(m,profile));
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    });
  }
  async function clearMemory() {
    memoryEpoch++;
    if (!window.indexedDB) return true;
    const db = await openMemory(); if (!db) return false;
    return new Promise(resolve => {
      try {
        const tx = db.transaction('messages','readwrite');
        tx.objectStore('messages').clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch (_) { resolve(false); }
    });
  }
  function rankMemories(records, text, recent = []) {
    const terms = memoryTerms(text), exclude = new Set(recent.slice(-12).map(m=>cut(m.text,900)));
    return records.filter(r => r.role === 'user' && !exclude.has(r.text)).map(r=>({r, score:terms.filter(t=>memoryTerms(r.text).includes(t)).length}))
      .filter(x=>x.score).sort((a,b)=>b.score-a.score || b.r.time-a.r.time).slice(0,4).map(x=>cut(x.r.text,240));
  }
  async function recall(text, history, profile) {
    const scope = profile || scopeKey(), terms = memoryTerms(text).slice(0,10);
    // A bare reference can use the last user message's subject, not assistant guesses.
    if (/قبلا|قبلاً|هفته پیش|گفته بودم/.test(norm(text))) for (const m of history.slice(-6).filter(m=>m.role==='user' && m.tools !== false)) terms.push(...memoryTerms(m.text).slice(0,3));
    if (!terms.length) return [];
    const local = history.filter(m=>m.role === 'user' && m.tools !== false).map(m=>memoryRecord(m,scope));
    const work = async () => {
      const db = await openMemory(); if (!db) return rankMemories(local,text+' '+terms.join(' '),history);
      const records = new Map(local.map(r=>[r.id,r]));
      // Also find plural-only terms saved by older versions of the index.
      const lookups = [...new Set(terms.flatMap(term=>[term,term+'ها',term+'های',term+'هایی']))].slice(0,40);
      await Promise.all(lookups.map(term=>new Promise(resolve=>{
        const req = db.transaction('messages','readonly').objectStore('messages').index('terms').getAll(scope+'|'+term,60);
        req.onsuccess = () => { for (const r of req.result) if (r.scope === scope) records.set(r.id,r); resolve(); };
        req.onerror = () => resolve();
      })));
      return rankMemories([...records.values()],text+' '+terms.join(' '),history);
    };
    let timer;
    try { return await Promise.race([work(),new Promise(resolve=>{timer=setTimeout(()=>resolve(rankMemories(local,text,history)),250);})]); }
    catch (_) { return rankMemories(local,text,history); }
    finally { clearTimeout(timer); }
  }