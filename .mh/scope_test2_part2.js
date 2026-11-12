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
    const legacy=w.eval(`(()=>{const d=migrate({});d.students=['علی','رضا'].map((name,i)=>({id:'l-'+i,no:i+1,name,data:{},shortage:{},assess:emptyAssess()}));const y=d.classScopeKey;const snap=JSON.parse(JSON.stringify(d));delete snap.classContexts;d.classContexts={[y]:snap};d.students=[];d.klass.teacher='م';d.classScopeKey=curriculumScopeKey(d);d.classScopeKlass=JSON.parse(JSON.stringify(d.klass));return JSON.stringify(d);})()`);
    const ok=w.eval(`replaceState(${legacy})`);
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
