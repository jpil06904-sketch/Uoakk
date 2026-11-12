
(() => {
  'use strict';
  if (window.__mehryarCurriculum) return;
  window.__mehryarCurriculum = true;

  const CURRICULUM_VERSION = 2;
  const OFFICIAL_SOURCE = 'http://chap.sch.ir/school-books';
  const BOOK_STATUS = { metadata_only:'فقط مشخصات', outline_ready:'فهرست آماده', content_ready:'محتوا آماده', needs_completion:'نیازمند تکمیل' };
  const CURRICULUM_SOURCE = { official:'official_catalog', teacher:'teacher_imported' };
   const CURRICULUM_SOURCE_LABEL = { official:'کاتالوگ رسمی', teacher:'واردشده توسط معلم؛ تطبیق رسمی بررسی‌نشده' };
  const STATUS_TEXT = { not_started:'شروع‌نشده', in_progress:'در حال تدریس', taught:'تدریس‌شده' };
  const DAY_NAMES = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const OFFICIAL_BOOKS = [
    { id:'g2-201-1405-1406', code:'201', title:'آموزش قرآن (دوم)', subject:'آموزش قرآن', grade:'دوم', academicYear:'1405-1406', officialPage:'http://chap.sch.ir/books/14147', pdfUrl:'http://chap.sch.ir/sites/default/files/lbooks/1405-1406/9/C201.pdf' },
    { id:'g2-202-1405-1406', code:'202', title:'هدیه آسمان (دوم)', subject:'هدیه آسمان', grade:'دوم', academicYear:'1405-1406', officialPage:'http://chap.sch.ir/books/14148', pdfUrl:'http://chap.sch.ir/sites/default/files/lbooks/1405-1406/9/C202.pdf' },
    { id:'g2-203-1405-1406', code:'203', title:'فارسی (دوم)', subject:'فارسی', grade:'دوم', academicYear:'1405-1406', officialPage:'http://chap.sch.ir/books/14149', pdfUrl:'http://chap.sch.ir/sites/default/files/lbooks/1405-1406/9/C203.pdf' },
    { id:'g2-204-1405-1406', code:'204', title:'نگارش فارسی (دوم)', subject:'نگارش فارسی', grade:'دوم', academicYear:'1405-1406', officialPage:'http://chap.sch.ir/books/14150', pdfUrl:'http://chap.sch.ir/sites/default/files/lbooks/1405-1406/9/C204.pdf' },
    { id:'g2-205-1405-1406', code:'205', title:'ریاضی (دوم)', subject:'ریاضی', grade:'دوم', academicYear:'1405-1406', officialPage:'http://chap.sch.ir/books/14151', pdfUrl:'http://chap.sch.ir/sites/default/files/lbooks/1405-1406/9/C205.pdf' },
    { id:'g2-206-1405-1406', code:'206', title:'علوم تجربی (دوم)', subject:'علوم تجربی', grade:'دوم', academicYear:'1405-1406', officialPage:'http://chap.sch.ir/books/14152', pdfUrl:'http://chap.sch.ir/sites/default/files/lbooks/1405-1406/9/C206.pdf' }
  ];
  const officialById = id => OFFICIAL_BOOKS.find(book => book.id === id);
  const slug = value => normKey(value).replace(/[^\u0600-\u06ff\w]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70) || 'node';
   const academicYearKey = value => String(value || '').replace(/[۰-۹]/g,d=>FA_DIGITS.indexOf(d)).replace(/[–—]/g,'-').replace(/\s+/g,'');
   const curriculumScopeKey = data => { const k=data?.klass||{}; const parts=['school','teacher','className','grade','year'].map(name=>normKey(String(k[name]||''))); return parts.some(Boolean)?parts.join('|'):'unassigned'; };
   const curriculumContextSnapshot = value => { const out=clone(value||{}); delete out.contexts; return out; };
   const classScopedKeys = ['klass','classContexts','fields','students','lists','meeting','plan7','messages','outputSettings','progress','learning','curriculum'];
   const classScopeSnapshot = data => { const out={}; for(const key of classScopedKeys) if(Object.hasOwn(data,key)) out[key]=data[key]===undefined?undefined:clone(data[key]); delete out.classContexts; return out; };
   function ensureClassScope(data) {
     if(!data||typeof data!=='object')return data;
     const contexts=isObj(data.classContexts)?data.classContexts:{},activeKey=curriculumScopeKey(data),currentKey=String(data.classScopeKey||'');
     if(!currentKey){data.classContexts=contexts;data.classScopeKey=activeKey;data.classScopeKlass=clone(data.klass);return data;}
     if(currentKey===activeKey){data.classContexts=contexts;data.classScopeKlass=clone(data.klass);return data;}
     const snapshot=classScopeSnapshot(data);snapshot.klass=clone(data.classScopeKlass||data.klass);contexts[currentKey]=snapshot;
     const target=contexts[activeKey];
     if(target){for(const key of classScopedKeys)if(key!=='classContexts'&&Object.hasOwn(target,key))data[key]=clone(target[key]);}
     else if(currentKey!=='unassigned'){
       const blank=migrate({klass:clone(data.klass)});
       for(const key of classScopedKeys)if(key!=='classContexts'&&Object.hasOwn(blank,key))data[key]=clone(blank[key]);
     }
     data.klass=target?.klass?clone(target.klass):clone(data.klass);data.classContexts=contexts;data.classScopeKey=activeKey;data.classScopeKlass=clone(data.klass);return data;
   }
    const curriculumDefaults = () => ({
      schemaVersion: CURRICULUM_VERSION,
      scopeKey:'',
      contexts:{},
      catalog: { grade:'', academicYear:'', source:'', sourceLabel:'کاتالوگ پایهٔ کلاس هنوز مشخص نشده است' },
     books: OFFICIAL_BOOKS.map(book => ({...book,sourceType:CURRICULUM_SOURCE.official,sourceLabel:CURRICULUM_SOURCE_LABEL.official,nodes:[],contentStatus:'metadata_only',contentRef:null,contentExcerpt:'',contentLength:0,contentFileName:'',importedAt:''})),
      budget: { version:0, history:[], schoolDays:[6,0,1,2,3], weekStart:6, holidays:[], entries:[], source:'', sourceText:'', importedAt:'', approvedAt:'', pending:null, draft:null },
    teachingProgress: {},
    assets: {}
  });
  const normalizeNode = (node, bookId, index, parentId='') => {
    if (!node || typeof node !== 'object') return null;
    const title = String(node.title || node.name || '').trim(); if (!title) return null;
    const id = String(node.id || `${bookId}-${slug(title)}-${index+1}`);
    const children = Array.isArray(node.children) ? node.children.map((child,i)=>normalizeNode(child,bookId,i,id)).filter(Boolean) : [];
     const sourceType=node.sourceType===CURRICULUM_SOURCE.official?CURRICULUM_SOURCE.official:CURRICULUM_SOURCE.teacher;
     const out = { id, type:String(node.type || node.kind || 'item'), title, parentId:String(node.parentId || parentId || ''), pageStart:node.pageStart ?? node.from ?? '', pageEnd:node.pageEnd ?? node.to ?? '', pages:String(node.pages || ''), content:String(node.content || '').slice(0,12000), sourceType, sourceLabel:String(node.sourceLabel || CURRICULUM_SOURCE_LABEL[sourceType===CURRICULUM_SOURCE.official?'official':'teacher']), sourceText:String(node.sourceText || '').slice(0,2000) };
    if (children.length) out.children = children;
    return out;
  };
  const flattenNodes = (nodes, out=[]) => { for (const node of Array.isArray(nodes)?nodes:[]) { out.push(node); if (node.children) flattenNodes(node.children,out); } return out; };
  const normalizeBook = (book, fallback) => {
    const source = {...fallback,...(book || {})};
    const nodes = Array.isArray(source.nodes) ? source.nodes.map((node,i)=>normalizeNode(node,source.id,i)).filter(Boolean) : [];
     const sourceType=source.sourceType===CURRICULUM_SOURCE.official?CURRICULUM_SOURCE.official:CURRICULUM_SOURCE.teacher;
     return {...fallback,...source,id:fallback?.id || source.id,nodes,sourceType,sourceLabel:String(source.sourceLabel || CURRICULUM_SOURCE_LABEL[sourceType===CURRICULUM_SOURCE.official?'official':'teacher']),contentStatus:BOOK_STATUS[source.contentStatus]?source.contentStatus:(nodes.length?'outline_ready':source.contentRef||source.contentExcerpt?'content_ready':'metadata_only'),contentRef:source.contentRef||null,contentExcerpt:String(source.contentExcerpt||'').slice(0,16000),contentLength:Number(source.contentLength)||0,contentFileName:String(source.contentFileName||''),importedAt:String(source.importedAt||'')};
   };
   function ensureCurriculum(data) {
     if (!data || typeof data !== 'object') return data;
      const base = curriculumDefaults(), raw = data.curriculum && typeof data.curriculum === 'object' ? data.curriculum : {}, activeScope=curriculumScopeKey(data), activeGrade=String(data.klass?.grade||'').trim(), activeYear=academicYearKey(data.klass?.year||''), contexts=isObj(raw.contexts)?clone(raw.contexts):{};
      let current=raw;
      if(raw.scopeKey&&raw.scopeKey!==activeScope) { contexts[raw.scopeKey]=curriculumContextSnapshot(raw); current=contexts[activeScope]||{...base,scopeKey:activeScope}; }
      current=curriculumContextSnapshot(current);
      data.curriculum = {...base,...current,scopeKey:activeScope,contexts,catalog:{...base.catalog,...(current.catalog||{}),grade:activeGrade,academicYear:activeYear,source:activeGrade==='دوم'?OFFICIAL_SOURCE:'',sourceLabel:activeGrade==='دوم'?'پایگاه کتاب‌های درسی، اداره کل نظارت بر نشر و توزیع مواد آموزشی':activeGrade?`کاتالوگ رسمی پایهٔ ${activeGrade} در این مرحله وارد نشده است`:'کاتالوگ پایهٔ کلاس هنوز مشخص نشده است'},budget:{...base.budget,...(current.budget||{})},teachingProgress:{...(current.teachingProgress||{})},assets:{...(current.assets||{})}};
    const existing = new Map((Array.isArray(current.books)?current.books:[]).map(book=>[book.id,book]));
     const official = OFFICIAL_BOOKS.map(book=>normalizeBook(existing.get(book.id),{...book,sourceType:CURRICULUM_SOURCE.official,sourceLabel:CURRICULUM_SOURCE_LABEL.official}));
     const extras = (Array.isArray(current.books)?current.books:[]).filter(book=>!officialById(book.id)).map(book=>normalizeBook(book,{id:String(book.id||'custom-'+slug(book.title)),title:String(book.title||'کتاب واردشده'),subject:String(book.subject||''),grade:String(book.grade||data.klass?.grade||''),academicYear:String(book.academicYear||data.klass?.year||''),officialPage:'',pdfUrl:'',sourceType:CURRICULUM_SOURCE.teacher,sourceLabel:CURRICULUM_SOURCE_LABEL.teacher}));
       data.curriculum.books = [...official,...extras];
     for (const book of data.curriculum.books) data.curriculum.teachingProgress[book.id] ||= {currentNodeId:'',statuses:{},exceptions:[],updatedAt:''};
     data.curriculum.budget.version=Math.max(0,Number(data.curriculum.budget.version)||0);
     data.curriculum.budget.history=Array.isArray(data.curriculum.budget.history)?data.curriculum.budget.history.slice(-12):[];
     data.curriculum.budget.schoolDays = Array.isArray(data.curriculum.budget.schoolDays) && data.curriculum.budget.schoolDays.length ? data.curriculum.budget.schoolDays.map(Number).filter(x=>x>=0&&x<=6) : [6,0,1,2,3];
      data.curriculum.budget.holidays = Array.isArray(data.curriculum.budget.holidays) ? data.curriculum.budget.holidays.filter(validDay) : [];
      data.curriculum.budget.entries = Array.isArray(data.curriculum.budget.entries) ? data.curriculum.budget.entries.filter(entry=>entry&&entry.bookId) : [];
      data.curriculum.budget.sourceText=String(data.curriculum.budget.sourceText||'');
     if(data.curriculum.budget.draft!==null&&!isObj(data.curriculum.budget.draft))data.curriculum.budget.draft=null;
     data.curriculum.schemaVersion = CURRICULUM_VERSION;
     return data;
    }
    function validateCurriculumData(data) {
      ensureCurriculum(data);const c=data.curriculum,b=c.budget,books=new Map(c.books.map(book=>[book.id,book]));
       if(c.scopeKey!==curriculumScopeKey(data))throw Error('زمینهٔ کتاب و بودجه با کلاس فعال یکسان نیست؛ ثبت متوقف شد.');if(b.sourceText.length>MAX_BUDGET_IMPORT_CHARS)throw Error('متن منبع بودجه از حد مجاز بزرگ‌تر است؛ هیچ بخشی ذخیره نشد.');
      for(const book of c.books){if(!book.id||!book.title)throw Error('کتاب آموزشی بدون شناسه یا عنوان است؛ ثبت متوقف شد.');for(const node of curriculumNodes(book))if(!node.id||!node.title)throw Error('مبحث آموزشی بدون شناسه یا عنوان است؛ ثبت متوقف شد.');}
      for(const entry of b.entries){const book=books.get(entry.bookId),node=entry.nodeId&&book&&curriculumNodes(book).find(item=>item.id===entry.nodeId);if(!book||entry.nodeId&&!node||!validDay(entry.startDate)||!validDay(entry.endDate)||entry.endDate<entry.startDate||!Number.isInteger(entry.sessions)||entry.sessions<1||entry.sessions>99)throw Error('ردیف بودجه‌بندی معتبر نیست؛ هیچ بخشی ثبت نشد.');}
      return true;
    }
    window.__mehryarValidateCurriculum=validateCurriculumData;
      const activeCurriculumGrade = () => String(state.klass?.grade||'').trim();
      const isMultiGrade = grade => normKey(grade)==='چندپایه';
      const isLearnerGrade = grade => PD_GRADES.some(value=>normKey(value)===normKey(String(grade||'')));
      const curriculumBookMatchesGrade = (book,activeGrade,targetGrade='') => {
        const active=String(activeGrade||'').trim(), target=String(targetGrade||'').trim(); if(!active)return false;
        if(!isMultiGrade(active))return !book?.grade||normKey(book.grade)===normKey(active);
        if(target&&normKey(target)!==normKey(active))return !book?.grade||normKey(book.grade)===normKey(target);
        return !book?.grade||isLearnerGrade(book.grade)||normKey(book.grade)===normKey(active);
      };
      const activeCurriculumBooksFor = data => { ensureCurriculum(data); const grade=String(data.klass?.grade||'').trim(); return data.curriculum.books.filter(book=>curriculumBookMatchesGrade(book,grade)); };
      const getActiveClassContext = (data=state) => { ensureCurriculum(data); return {scopeKey:curriculumScopeKey(data),school:String(data.klass?.school||''),teacher:String(data.klass?.teacher||''),className:String(data.klass?.className||''),grade:String(data.klass?.grade||''),academicYear:String(data.klass?.year||'')}; };
      const listBooksByGrade = (data=state,grade='') => { ensureCurriculum(data); const active=String(data.klass?.grade||'').trim(),requested=String(grade||active).trim(),different=requested&&active&&normKey(requested)!==normKey(active); if(different&&!(isMultiGrade(active)&&isLearnerGrade(requested)))return []; return data.curriculum.books.filter(book=>curriculumBookMatchesGrade(book,active,different?requested:'')); };
      const matchesActiveCurriculumGrade = book => curriculumBookMatchesGrade(book,activeCurriculumGrade());
    const activeCurriculumBooks = () => activeCurriculumBooksFor(state);
   const activeCurriculumBudgetEntries = () => { const ids=new Set(activeCurriculumBooks().map(book=>book.id)); return ensureCurriculum(state).curriculum.budget.entries.filter(entry=>ids.has(entry.bookId)); };
   const curriculumBook = id => ensureCurriculum(state).curriculum.books.find(book=>book.id===id);
  const curriculumNodes = book => flattenNodes(book?.nodes || []);
  const currentProgress = id => ensureCurriculum(state).curriculum.teachingProgress[id] || {currentNodeId:'',statuses:{},exceptions:[],updatedAt:''};
  const statusOfBook = book => BOOK_STATUS[book?.contentStatus] || (curriculumNodes(book).length?'فهرست آماده':'فقط مشخصات');
  const statusClass = status => status === 'content_ready' ? 'green' : status === 'outline_ready' ? 'blue' : status === 'needs_completion' ? 'orange' : 'gray';
  const pageLabel = node => node?.pages || (node?.pageStart || node?.pageEnd ? `صفحه ${node.pageStart || '?'} تا ${node.pageEnd || '?'}` : 'صفحه ثبت نشده');
  const curriculumDate = value => {
    if (value === undefined || value === '') return '';
    const raw = String(value).trim();
    if (validDay(raw)) return raw;
     try { const parsed=parsePersianDate(raw); return parsed.kind==='valid' ? parsed.iso : ''; } catch (_) { return ''; }
  };
  const dateFa = value => value ? displayDay(value) : 'تاریخ نامشخص';
  const compactBook = (book, options={}) => {
    const nodes = curriculumNodes(book), progress = currentProgress(book.id), budget = ensureCurriculum(state).curriculum.budget.entries.filter(entry=>entry.bookId===book.id);
     return {id:book.id,code:book.code||'',title:book.title,subject:book.subject,grade:book.grade,academicYear:book.academicYear,sourceType:book.sourceType||CURRICULUM_SOURCE.teacher,sourceLabel:book.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher,contentStatus:book.contentStatus,contentStatusText:statusOfBook(book),officialSource:book.officialPage||'',pdfUrl:book.pdfUrl||'',nodeCount:nodes.length,currentNodeId:progress.currentNodeId||null,currentNode:nodes.find(node=>node.id===progress.currentNodeId)?.title||null,budgetEntries:budget.length,contentAvailable:!!(book.contentRef||book.contentExcerpt||nodes.some(node=>node.content)),...(options.nodes?{nodes:nodes.slice(0,options.limit||40).map(node=>({id:node.id,type:node.type,title:node.title,parentId:node.parentId,pages:pageLabel(node),sourceType:node.sourceType||CURRICULUM_SOURCE.teacher,sourceLabel:node.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher,hasContent:!!node.content,content:options.content?node.content:''}))}:{})};
  };

  const DB_NAME = 'mehryar_curriculum_assets_v1', DB_STORE = 'assets';
  const assetCache = new Map();
  let dbPromise = null;
  function openAssetDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(resolve => { const request=indexedDB.open(DB_NAME,1); request.onupgradeneeded=()=>request.result.createObjectStore(DB_STORE,{keyPath:'id'}); request.onsuccess=()=>resolve(request.result); request.onerror=()=>resolve(null); });
    return dbPromise;
  }
  async function putAsset(asset) { const db=await openAssetDb(); if(!db){assetCache.set(asset.id,asset);return false;} return new Promise(resolve=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(asset);tx.oncomplete=()=>{assetCache.set(asset.id,asset);resolve(true)};tx.onerror=()=>{assetCache.set(asset.id,asset);resolve(false)};}); }
  async function readAssets() { const db=await openAssetDb(); if(!db)return; return new Promise(resolve=>{const tx=db.transaction(DB_STORE,'readonly'),request=tx.objectStore(DB_STORE).getAll();request.onsuccess=()=>{for(const asset of request.result||[])assetCache.set(asset.id,asset);resolve(request.result||[])};request.onerror=()=>resolve([]);}); }
  readAssets();
  const assetFor = book => book?.contentRef ? assetCache.get(book.contentRef) : null;
  const fullBookText = book => assetFor(book)?.text || book?.contentExcerpt || curriculumNodes(book).map(node=>node.content).filter(Boolean).join('\n') || '';
  const updateBook = (bookId, patch) => { ensureCurriculum(state); const index=state.curriculum.books.findIndex(book=>book.id===bookId); if(index<0)return false; Object.assign(state.curriculum.books[index],patch); state.curriculum.books[index].contentStatus=patch.contentStatus||statusOfBook(state.curriculum.books[index]); dirty=true; return true; };

  function parseCsv(text) {
    const lines=String(text||'').split(/\r?\n/).filter(line=>line.trim()); if(!lines.length)return [];
    const cells=line=>{const out=[];let current='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&line[i+1]==='"'){current+='"';i++;continue}if(ch==='"'){quoted=!quoted;continue}if(ch===','&&!quoted){out.push(current.trim());current='';continue}current+=ch;}out.push(current.trim());return out;};
     const headers=cells(lines[0]).map(x=>normKey(x)); return lines.slice(1).map(line=>{const values=cells(line);return {...Object.fromEntries(headers.map((header,i)=>[header,values[i]||''])),originalText:line,...(values.length!==headers.length?{__parseIssue:true}:{})}});
  }
  function parseBookInput(text, selectedId) {
    const raw=String(text||'').trim(); if(!raw)return {error:'متن کتاب خالی است.'};
    if(/^\s*[\[{]/.test(raw)) { try { const json=JSON.parse(raw); const book=json.books?.find(x=>x.id===selectedId)||json.book||json; const nodes=Array.isArray(book.nodes)?book.nodes:Array.isArray(book.items)?book.items:[]; return {nodes,note:String(book.content||json.content||'').trim(),format:'JSON'}; } catch(e){return {error:'JSON کتاب معتبر نیست؛ قالب نمونه را بررسی کن.'};} }
    if(/\.csv/i.test(selectedId)||/^\s*(id|شناسه|type|نوع)\s*[,;]/i.test(raw)) return {nodes:parseCsv(raw).map(row=>({id:row.id||row.شناسه,type:row.type||row.نوع||'item',title:row.title||row.عنوان||'',parentId:row.parentid||row.parent||'',pageStart:row.pagestart||row.from||'',pageEnd:row.pageend||row.to||'',pages:row.pages||row.صفحه||'',content:row.content||row.محتوا||''})),note:'',format:'CSV'};
    const nodes=[]; let active=null; for(const line of raw.split(/\r?\n/)){const heading=line.match(/^(#{1,3})\s+(.+)$/);if(heading){active={type:heading[1].length===1?'section':heading[1].length===2?'lesson':'topic',title:heading[2].trim(),content:''};nodes.push(active);}else if(active){active.content=(active.content+'\n'+line).trim();}}
    return {nodes,note:nodes.length?'':raw,format:'متن/Markdown'};
  }
  function normalizeImportedNodes(nodes, bookId) { return (Array.isArray(nodes)?nodes:[]).map((node,i)=>normalizeNode(node,bookId,i)).filter(Boolean); }
  const BUDGET_MATCH_STATUS = { matched:'تطبیق دقیق', ambiguous:'چند گزینهٔ ممکن', unresolved:'بدون تطبیق', needs_review:'نیازمند بررسی' };
  const budgetRowValue = (row, names) => {
    if (!isObj(row)) return '';
    for (const name of names) if (row[name] !== undefined && row[name] !== null && String(row[name]).trim()) return String(row[name]).trim();
    const keys = Object.keys(row), found = keys.find(key => names.some(name => normKey(key) === normKey(name)));
    return found ? String(row[found] ?? '').trim() : '';
  };
  const budgetLabelValue = (text, labels) => {
    const names = labels.map(label => String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const match = String(text || '').match(new RegExp(`(?:^|[|,،;؛\\n])\\s*(?:${names})\\s*[:：=]\\s*([^|,،;؛\\n]+)`, 'i'));
    return match ? match[1].trim() : '';
  };
   const budgetGradeValue = value => {
     const raw = normalizeName(value).replace(/^(?:پایه|کلاس|مقطع|grade)[ٔ‌:\s-]*/i,'').replace(/\s+ابتدایی$/i,'').trim();
     if (!raw) return '';
     const direct = GRADES.find(grade => normKey(grade) === normKey(raw)); if (direct) return direct;
     const latin = en(raw).match(/^[1-6]$/)?.[0] || '';
     const names = ['','اول','دوم','سوم','چهارم','پنجم','ششم'];
     return latin ? names[Number(latin)] : '';
   };
   const budgetGradeFromText = value => {
     const raw = normalizeName(value); if (!raw) return '';
     const tokens = raw.split(/[^\u0600-\u06ff0-9]+/).filter(Boolean), labels = new Set(['پایه','کلاس','مقطع','grade']);
     const labelIndex = tokens.findIndex(token => labels.has(normKey(token)));
     if (labelIndex >= 0 && tokens[labelIndex + 1]) return budgetGradeValue(tokens[labelIndex + 1]);
     const tail = budgetGradeValue(tokens.at(-1) || '');
     return tail && !['درس','فصل','مبحث','موضوع'].includes(normKey(tokens.at(-2) || '')) ? tail : '';
   };
  const budgetDatesFromText = text => (String(text || '').replace(/[۰-۹]/g, digit => FA_DIGITS.indexOf(digit)).match(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/g) || []).map(curriculumDate).filter(Boolean);
  const budgetNumber = value => { const raw = en(value).replace(/[^0-9]/g, ''); return raw ? Number(raw) : null; };
  const budgetTokens = value => normalizeName(value).toLowerCase().split(/[^\u0600-\u06ff\w]+/).filter(token => token.length > 1);
   const budgetTextScore = (query, target) => {
     const q=normKey(query), t=normKey(target); if (!q || !t) return {score:0,exact:false};
     if (q===t) return {score:100,exact:true};
     if (t.includes(q)) return {score:82,exact:false};
     if (q.includes(t) && t.length>2) return {score:72,exact:false};
     const qt=budgetTokens(query), tt=new Set(budgetTokens(target)), overlap=qt.filter(token=>tt.has(token)).length;
     return {score:overlap ? Math.round(35+(overlap/Math.max(qt.length,1))*35) : 0,exact:false};
   };
   const BUDGET_TOPIC_ALIASES = {
     'عددخوانی':['عددنویسی','خواندن عدد','خواندن اعداد','نوشتن عدد'],
     'خواندنعدد':['عددنویسی','عدد خوانی','خواندن اعداد'],
     'خواندن اعداد':['عددنویسی','عددخوانی'],
     'عددخواندن':['عددنویسی','عددخوانی'],
     'نوشتنعدد':['عددنویسی','عددخوانی'],
     'جمع و تفریق':['جمعوتفریق','جمع تفریق'],
     'جمعوتفریق':['جمع و تفریق'],
     'اندازهگیری':['اندازه‌گیری','اندازه گیری'],
     'اندازه‌گیری':['اندازهگیری','اندازه گیری']
   };
   const budgetEditDistance = (a,b) => {
     const left=String(a||''),right=String(b||'');
     if(!left||!right)return Math.max(left.length,right.length);
     let previous=Array.from({length:right.length+1},(_,i)=>i);
     for(let i=1;i<=left.length;i++){
       const current=[i];
       for(let j=1;j<=right.length;j++) current[j]=Math.min(current[j-1]+1,previous[j]+1,previous[j-1]+(left[i-1]===right[j-1]?0:1));
       previous=current;
     }
     return previous[right.length];
   };
   const budgetTopicScore = (query,target) => {
     const direct=budgetTextScore(query,target),q=normKey(query),t=normKey(target);
     if(!q||!t)return direct;
     let best={...direct,fuzzy:false};
     const variants=[q,...(BUDGET_TOPIC_ALIASES[q]||[]).map(normKey)];
     for(const variant of variants){
       const score=budgetTextScore(variant,target);
       if(score.score>best.score)best={score:score.score,exact:false,fuzzy:variant!==q};
       const similarity=1-budgetEditDistance(variant,t)/Math.max(variant.length,t.length);
       if(similarity>=.58){
         const fuzzyScore=Math.round(42+similarity*48);
         if(fuzzyScore>best.score)best={score:fuzzyScore,exact:false,fuzzy:true};
       }
     }
     return best;
   };
   const budgetDelimitedCells = text => { const raw=String(text||'').trim(); if(!/[|,\t;؛]/.test(raw))return []; return raw.replace(/^\||\|$/g,'').split(/[|,\t;؛]/).map(value=>value.trim()).filter(Boolean); };
   const budgetRowFromInput = input => {
     const row=isObj(input)?input:{rawText:String(input||'')}, rawFallback=[budgetRowValue(row,['bookTitle','bookName','book','کتاب']),budgetRowValue(row,['chapter','فصل']),budgetRowValue(row,['nodeTitle','topic','lesson','مبحث','موضوع','عنوان']),budgetRowValue(row,['startDate','from','شروع']),budgetRowValue(row,['endDate','to','پایان'])].filter(Boolean).join(' / '), rawText=budgetRowValue(row,['originalText','originaltext','rawText','rawtext','sourceText','text','description','متن اولیه','متن']) || rawFallback || (isObj(input)?'':String(input||'').trim()), cells=budgetDelimitedCells(rawText), datedCells=cells.map((value,index)=>({index,date:curriculumDate(value)})).filter(item=>item.date), firstDateIndex=datedCells[0]?.index??-1, positionalBook=cells[0]&&!/[:：=]/.test(cells[0])?cells[0]:'', positionalTopic=cells[1]&&!curriculumDate(cells[1])&&!/[:：=]/.test(cells[1])?cells[1]:'', positionalSession=cells.slice(firstDateIndex<0?0:firstDateIndex+1).find(value=>/^\s*[۰-۹0-9]{1,2}\s*$/.test(value)), sessionIndex=positionalSession?cells.indexOf(positionalSession):-1;
     const dates=[];
     for (const value of [budgetRowValue(row,['startDate','from','شروع','تاریخ شروع']),budgetRowValue(row,['endDate','to','پایان','تاریخ پایان'])]) if(value){const date=curriculumDate(value);if(date&&!dates.includes(date))dates.push(date);}
     for (const date of budgetDatesFromText(rawText)) if(!dates.includes(date)) dates.push(date);
     for (const item of datedCells) if(!dates.includes(item.date))dates.push(item.date);
     const rawSessions=budgetRowValue(row,['sessions','session','جلسات','جلسه','تعداد جلسه','تعدادجلسه']), sessionMatch=rawText.match(/(?:جلسه|جلسات|session(?:s)?)\s*[:=]?\s*([۰-۹0-9]+)/i), sessions=rawSessions ? budgetNumber(rawSessions) : sessionMatch ? budgetNumber(sessionMatch[1]) : positionalSession ? budgetNumber(positionalSession) : null;
      const explicitBook=budgetRowValue(row,['bookTitle','bookName','book','کتاب','نام کتاب']) || budgetLabelValue(rawText,['کتاب','نام کتاب','book']),bookTitle=explicitBook||positionalBook;
      const subject=budgetRowValue(row,['subject','درس','نام درس']) || budgetLabelValue(rawText,['درس','نام درس','subject']);
      const chapter=budgetRowValue(row,['chapter','فصل']) || budgetLabelValue(rawText,['فصل','chapter']);
      const lesson=budgetRowValue(row,['lesson','درس']) || budgetLabelValue(rawText,['درس','lesson']);
      const explicitTopic=budgetRowValue(row,['topic','nodeTitle','node','مبحث','موضوع']) || budgetLabelValue(rawText,['مبحث','موضوع','عنوان']),topic=explicitTopic||positionalTopic;
      const grade=budgetGradeValue(budgetRowValue(row,['grade','پایه'])) || budgetGradeValue(budgetLabelValue(rawText,['پایه','grade'])) || budgetGradeFromText(bookTitle);
     const month=budgetRowValue(row,['month','ماه']) || budgetLabelValue(rawText,['ماه','month']),week=budgetRowValue(row,['week','هفته']) || budgetLabelValue(rawText,['هفته','week']),period=budgetRowValue(row,['period','بازه','دوره','زمان‌بندی']) || budgetLabelValue(rawText,['بازه','دوره','زمان‌بندی','period']),positionalActivity=sessionIndex>=0?cells[sessionIndex+1]||'':'',activity=budgetRowValue(row,['activity','فعالیت','نوع فعالیت']) || budgetLabelValue(rawText,['فعالیت','نوع فعالیت']) || positionalActivity,programType=budgetRowValue(row,['programType','type','kind','نوع','نوع برنامه','برنامه']) || budgetLabelValue(rawText,['نوع فعالیت','نوع برنامه','نوع','برنامه']) || activity;
      return {...row,originalText:rawText,grade,bookTitle,subject,chapter,lesson,topic,nodeTitle:topic||lesson||chapter||'',month,week,period,activity,programType,startDate:dates[0]||'',endDate:dates[1]||dates[0]||'',sessions,sourceText:rawText,sessionIndex};
   };
      const MONTHLY_BUDGET_MONTHS=['مهر','آبان','آذر','دی','بهمن','اسفند','فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور'];
       const MAX_BUDGET_IMPORT_ROWS=5000,MAX_BUDGET_IMPORT_CHARS=1000000;
      const monthlyBudgetMonth=value=>{const q=normKey(String(value||'').replace(/ـ/g,'')),exact=MONTHLY_BUDGET_MONTHS.find(month=>q===normKey(month));return exact||[...MONTHLY_BUDGET_MONTHS].sort((a,b)=>normKey(b).length-normKey(a).length).find(month=>q.includes(normKey(month)))||'';};
      const monthlyBudgetYearInfo=text=>{const normalized=en(String(text||'')).replace(/[–—−﹣－]/g,'-'),pair=normalized.match(/((?:13|14)\d{2})\s*-\s*((?:13|14)\d{2})/);if(pair){const [start,end]=[Number(pair[1]),Number(pair[2])].sort((a,b)=>a-b);return {start,end,label:`${fa(start)}–${fa(end)}`};}const single=normalized.match(/(?:13|14)\d{2}/);if(single){const year=Number(single[0]);return {start:year,end:year,label:fa(year)};}return null;};
      const monthlyBudgetSchoolYear=text=>monthlyBudgetYearInfo(text)||monthlyBudgetYearInfo(state.klass?.year)||{start:null,end:null,label:''};
       const monthlyBudgetRange=(month,schoolYear,slot={})=>{const index=MONTHLY_BUDGET_MONTHS.indexOf(month)+1;if(index<1||!Number(schoolYear?.start))return {startDate:'',endDate:''};const jalaliMonth=index<=6?index+6:index-6,year=Number(schoolYear.start)+(index>6?1:0),lastDay=jalaliMonth<=6?31:jalaliMonth===12?(curriculumDate(`${year}/12/30`)?30:29):30,first=slot.firstDay??1,last=slot.lastDay??lastDay;if(first<1||last<first||last>lastDay)return {startDate:'',endDate:''};return {startDate:curriculumDate(`${year}/${String(jalaliMonth).padStart(2,'0')}/${String(first).padStart(2,'0')}`),endDate:curriculumDate(`${year}/${String(jalaliMonth).padStart(2,'0')}/${String(last).padStart(2,'0')}`)};};
    const monthlyBudgetDelimiter=line=>String(line||'').includes('|')?'|':String(line||'').includes('\t')?'\t':'';
    const monthlyBudgetCells=(line,delimiter)=>{const value=String(line||'').trim(),body=delimiter==='|'?value.replace(/^\|/,'').replace(/\|$/,''):value;return body.split(delimiter).map(cell=>cell.trim());};
    const monthlyBudgetHeaderKey=value=>normKey(String(value||'').replace(/\[[0-9۰-۹٠-٩]+\]/g,'').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,''));
    const monthlyBudgetSubject=header=>String(header||'').replace(/\[[0-9۰-۹٠-٩]+\]/g,'').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,'').replace(/\([^)]*\)/g,'').replace(/\*\*/g,'').replace(/\s+/g,' ').trim()||String(header||'').trim();
     const monthlyBudgetSessions=topic=>{const match=String(topic||'').match(/(?:جلسات?|session(?:s)?)\s*[:=]?\s*([۰-۹٠-٩0-9]{1,2})|([۰-۹٠-٩0-9]{1,2})\s*جلسه/i);return match?budgetNumber(match[1]||match[2]):null;};
     const monthlyBudgetTopic=topic=>String(topic||'').replace(/[,،;؛]?\s*(?:تعداد\s*)?(?:[۰-۹٠-٩0-9]{1,2}\s*جلسه|جلسات?\s*[:=]?\s*[۰-۹٠-٩0-9]{1,2})\s*$/i,'').trim();
      const monthlyBudgetPeriod=(header,month)=>{const raw=String(header||''),key=normKey(raw),monthKey=normKey(month),at=key.indexOf(monthKey),rest=at>=0?key.slice(at+monthKey.length):key,periodText=en(raw).replace(/[–—−﹣－]/g,'-').replace(/\b(?:13|14)\d{2}(?:\s*-\s*(?:13|14)\d{2})?\b/g,' '),dayRange=periodText.match(/(?:روز\s*)?(\d{1,2})\s*(?:تا|-)\s*(\d{1,2})/),weekMatch=raw.match(/(?:هفته|week)\s*([۰-۹٠-٩0-9]+)/i);if(/نیمه.*(?:اول|۱|1)|نوبت.*(?:اول|۱|1)/.test(rest))return {label:raw,firstDay:1,lastDay:15};if(/نیمه.*(?:دوم|۲|2)|نوبت.*(?:دوم|۲|2)/.test(rest))return {label:raw,firstDay:16};if(dayRange)return {label:raw,firstDay:Number(dayRange[1]),lastDay:Number(dayRange[2])};return {label:raw,week:weekMatch?fa(budgetNumber(weekMatch[1])):''};};
     const monthlyBudgetPeriodYear=(month,schoolYear)=>Number(schoolYear?.start)?Number(schoolYear.start)+(MONTHLY_BUDGET_MONTHS.indexOf(month)>5?1:0):null;
     function parseMonthlyBudgetTable(text) {
       const raw=String(text||''),lines=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),gradeMatch=raw.match(/(?:پایه|کلاس|مقطع|grade)(?:\s*تحصیلی)?[ٔ‌\s:：-]*(اول|دوم|سوم|چهارم|پنجم|ششم|[۰-۹0-9]+)/i),grade=budgetGradeValue(gradeMatch?.[1]||activeCurriculumGrade())||activeCurriculumGrade(),schoolYear=monthlyBudgetSchoolYear(raw),rows=[],issues=[],skippedCells=0;
        for(let headerIndex=0;headerIndex<lines.length;headerIndex++){
          const delimiter=monthlyBudgetDelimiter(lines[headerIndex]);if(!delimiter)continue;const headers=monthlyBudgetCells(lines[headerIndex],delimiter);if(headers.length<3||!/^(?:ماه|month)/i.test(monthlyBudgetHeaderKey(headers[0])))continue;
          const subjects=headers.map((header,index)=>({header:monthlyBudgetSubject(header),index})).filter(item=>item.index>0&&item.header&&!/^[-–—]+$/.test(item.header));if(!subjects.length)continue;
          for(let lineIndex=headerIndex+1;lineIndex<lines.length;lineIndex++){
            const line=lines[lineIndex],rowDelimiter=monthlyBudgetDelimiter(line);if(rowDelimiter!==delimiter)break;const cells=monthlyBudgetCells(line,delimiter);if(!cells.length||cells.every(cell=>/^:?-{2,}:?$/.test(cell)))continue;
            if(/^(?:ماه|month)/i.test(monthlyBudgetHeaderKey(cells[0])))break;
            if(cells.length!==headers.length)issues.push(`ردیف ${fa(lineIndex+1)}: تعداد خانه‌ها با سرستون‌های جدول برابر نیست؛ ردیف کامل بررسی شود.`);
            const month=monthlyBudgetMonth(cells[0]);if(!month){if(cells.slice(1).some(cell=>cell&&!/^[-–—]+$/.test(cell)))issues.push(`ردیف ${fa(lineIndex+1)}: ماه تشخیص داده نشد؛ این ردیف وارد نشد.`);continue;}
           const range=monthlyBudgetRange(month,schoolYear),year=monthlyBudgetPeriodYear(month,schoolYear),period=`${month}${year?` ${fa(year)}`:''}`;
            for(const {header,index} of subjects){const rawTopic=String(cells[index]||'').replace(/<br\s*\/?>/gi,' / ').replace(/\*\*/g,'').trim();if(!rawTopic||/^[-–—]+$/.test(rawTopic)){skippedCells++;continue;}const topic=monthlyBudgetTopic(rawTopic),sessions=monthlyBudgetSessions(rawTopic),originalText=`${month} | ${header}: ${rawTopic}`;rows.push({originalText,grade,academicYear:schoolYear.label,bookTitle:header,subject:header,topic,nodeTitle:topic,month,period,startDate:range.startDate,endDate:range.endDate,sessions,programType:'بودجه‌بندی ماهانه',note:sessions?'':'تعداد جلسه در منبع مشخص نشده است؛ معلم باید بررسی کند.'});}
         }
       }
        return rows.length||issues.length?{rows,format:'MONTHLY_TABLE',issues:[...new Set(issues)],notes:skippedCells?[`${fa(skippedCells)} خانهٔ خالی یا خط‌تیره بود و به‌عنوان ردیف زمان‌بندی ساخته نشد.`]:[]}:null;
     }
     // Annual tables commonly put months and halves in columns, with one lesson per row.
     function parseMonthlyBudgetMatrix(text) {
       const raw=String(text||''),lines=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),gradeMatch=raw.match(/(?:پایه|کلاس|مقطع|grade)(?:\s*تحصیلی)?[ٔ‌\s:：-]*(اول|دوم|سوم|چهارم|پنجم|ششم|[۰-۹0-9]+)/i),grade=budgetGradeValue(gradeMatch?.[1]||activeCurriculumGrade())||activeCurriculumGrade(),schoolYear=monthlyBudgetSchoolYear(raw),rows=[],issues=[],skippedCells=0;let foundHeader=false;
       const isHeader=cells=>/(?:نام)?(?:درس|کتاب|subject|lesson|book)/i.test(monthlyBudgetHeaderKey(cells[0]||''));
       for(let headerIndex=0;headerIndex<lines.length;headerIndex++){
          const delimiter=monthlyBudgetDelimiter(lines[headerIndex]);if(!delimiter)continue;const headers=monthlyBudgetCells(lines[headerIndex],delimiter);if(headers.length<3||!isHeader(headers))continue;
          const periods=headers.map((header,index)=>({header,index,month:monthlyBudgetMonth(header)})).filter(item=>item.index>0&&item.month);if(!periods.length)continue;foundHeader=true;
         for(let lineIndex=headerIndex+1;lineIndex<lines.length;lineIndex++){
            const line=lines[lineIndex],rowDelimiter=monthlyBudgetDelimiter(line);if(rowDelimiter!==delimiter)break;const cells=monthlyBudgetCells(line,delimiter);if(!cells.length||cells.every(cell=>/^:?-{2,}:?$/.test(cell)))continue;
            if(isHeader(cells))break;
            if(cells.length!==headers.length)issues.push(`ردیف ${fa(lineIndex+1)}: تعداد خانه‌ها با سرستون‌های جدول برابر نیست؛ ردیف کامل بررسی شود.`);
           const subject=String(cells[0]||'').trim();if(!subject||/^[-–—]+$/.test(subject)){if(cells.slice(1).some(cell=>cell&&!/^[-–—]+$/.test(cell)))issues.push(`ردیف ${fa(lineIndex+1)}: نام درس خالی است؛ محتوای آن ردیف وارد نشد.`);continue;}
           for(let col=1;col<headers.length;col++){
             const rawTopic=String(cells[col]||'').replace(/<br\s*\/?>/gi,' / ').replace(/\*\*/g,'').trim();if(!rawTopic||/^[-–—]+$/.test(rawTopic)){skippedCells++;continue;}
             const slot=periods.find(item=>item.index===col);if(!slot){issues.push(`ردیف ${fa(lineIndex+1)}: مقدار زیر ستون «${headers[col]}» زمان‌بندی ماهانهٔ قابل تشخیص ندارد.`);continue;}
              const periodInfo=monthlyBudgetPeriod(slot.header,slot.month),range=monthlyBudgetRange(slot.month,schoolYear,periodInfo),year=monthlyBudgetPeriodYear(slot.month,schoolYear),period=[String(slot.header||'').trim(),year?fa(year):''].filter(Boolean).join(' '),topic=monthlyBudgetTopic(rawTopic),sessions=monthlyBudgetSessions(rawTopic),originalText=`${subject} | ${slot.header}: ${rawTopic}`;
             if(schoolYear.start&&periodInfo.firstDay&&!range.startDate)issues.push(`ردیف ${fa(lineIndex+1)}: بازهٔ روزهای ستون «${slot.header}» با ماه معتبر نیست.`);
             rows.push({originalText,grade,academicYear:schoolYear.label,bookTitle:subject,subject,topic,nodeTitle:topic,month:slot.month,week:periodInfo.week||'',period,startDate:range.startDate,endDate:range.endDate,sessions,programType:'بودجه‌بندی ماهانه',note:sessions?'':'تعداد جلسه در منبع مشخص نشده است؛ معلم باید بررسی کند.'});
           }
         }
       }
        return foundHeader?{rows,format:'MONTHLY_MATRIX',issues:[...new Set(issues)],notes:skippedCells?[`${fa(skippedCells)} خانهٔ خالی یا خط‌تیره بود و به‌عنوان ردیف زمان‌بندی ساخته نشد.`]:[]}:null;
     }
     function parseMonthlyBudgetProse(text) {
       const raw=String(text||''),lines=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),gradeMatch=raw.match(/(?:پایه|کلاس|مقطع|grade)(?:\s*تحصیلی)?[ٔ‌\s:：-]*(اول|دوم|سوم|چهارم|پنجم|ششم|[۰-۹0-9]+)/i),grade=budgetGradeValue(gradeMatch?.[1]||activeCurriculumGrade())||activeCurriculumGrade(),schoolYear=monthlyBudgetSchoolYear(raw),rows=[],issues=[];
       const addRow=(month,subject,topic)=>{
         const source=String(topic||'').replace(/[-–—]{6,}\s*$/,'').trim();if(!month||!subject||!source)return;
         const range=monthlyBudgetRange(month,schoolYear),year=monthlyBudgetPeriodYear(month,schoolYear),sessions=monthlyBudgetSessions(source),cleanTopic=monthlyBudgetTopic(source),originalText=`${month} / ${subject}: ${source}`;
         rows.push({originalText,grade,academicYear:schoolYear.label,bookTitle:subject,subject,topic:cleanTopic,nodeTitle:cleanTopic,month,period:`${month}${year?` ${fa(year)}`:''}`,startDate:range.startDate,endDate:range.endDate,sessions,programType:'بودجه‌بندی ماهانه',note:sessions?'':'تعداد جلسه در منبع مشخص نشده است؛ معلم باید بررسی کند.'});
       };
       const headingPattern=/(?:🍁|🍂|❄️|🌱|🌸|🌿)\s*(مهر|آبان|آذر|دی|بهمن|اسفند|فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور)(?:‌?\s*ماه)?/gu,headings=[...raw.matchAll(headingPattern)];let foundMonthSection=headings.length>0;
      // Month emojis delimit sections even when pasted text has collapsed to one line.
      for(let index=0;index<headings.length;index++){
        const heading=headings[index],end=headings[index+1]?.index??raw.length,section=raw.slice(heading.index+heading[0].length,end);
        for(const bullet of section.split('🔹').slice(1)){
           const clean=bullet.replace(/^[\s\-–—]+/,'').trim(),match=clean.match(/^(.+?)\s*[:：]\s*([\s\S]+)$/);if(!match){if(clean)issues.push(`بخش ${heading[1]}: «${clean.slice(0,60)}» با جداکنندهٔ درس و مبحث تشخیص داده نشد.`);continue;}
          addRow(heading[1],match[1].trim().replace(/\s+/g,' '),match[2]);
        }
      }
        let docMonthFound=false,carriedDoc=0;
        if(!rows.length){
          const monthRe=new RegExp('^('+MONTHLY_BUDGET_MONTHS.join('|')+')(?:\\u200c?\\s*ماه)?(?:\\s*[\\(（][^)）]*[\\)）])?\\s*[:：]?$');
          let month='',subject='';
          for(const line of lines){
            if(/^[\s=\-–—_*•·]{4,}$/.test(line))continue;
            const bulletDash=/^\s*[-–—]\s+/.test(line),t=line.replace(/^[\s*•·\-–—]+/,'').trim();if(!t)continue;
            const heading=t.replace(/^[\d۰-۹]+\s*[\.\)\-–:]\s*/,'').trim().match(monthRe);
            if(heading){month=heading[1];subject='';docMonthFound=true;continue;}
            if(!month)continue;
            if(/^اهداف\s*[:：]/.test(t)){const last=rows[rows.length-1];if(last&&last.month===month&&last.subject===subject){last.note='اهداف: '+t.replace(/^اهداف\s*[:：]\s*/,'')+(last.sessions?'':' · '+last.note);}continue;}
            if(!bulletDash&&/[:：]\s*$/.test(t)&&t.length<=90){subject=t.replace(/\s*[:：]\s*$/,'').replace(/\s+/g,' ');continue;}
            const kv=!bulletDash?t.match(/^(.{2,60}?)\s*[:：]\s*(.+)$/):null;
            if(kv){subject=kv[1].trim().replace(/\s+/g,' ');addRow(month,subject,kv[2]);continue;}
            if(subject){addRow(month,subject,t);if(!bulletDash)carriedDoc++;continue;}
            issues.push(`بخش ${month}: «${t.slice(0,60)}» خوانا نشد؛ هر مورد باید به شکل «درس: مبحث» باشد.`);
          }
          if(docMonthFound)foundMonthSection=true;
        }
        let carried=0;if(!rows.length){let month='',lastSubject='';for(const line of lines){const clean=line.replace(/^[^\u0600-\u06FF0-9۰-۹A-Za-z]+/,'').trim(),key=normKey(clean).replace(/[:：]+$/,'');const monthHeading=MONTHLY_BUDGET_MONTHS.find(name=>key===normKey(name)||key===normKey(name)+'ماه');if(monthHeading){month=monthHeading;lastSubject='';foundMonthSection=true;continue;}if(!month)continue;const match=clean.match(/^(.+?)\s*[:：]\s*(.+)$/);if(match){lastSubject=match[1].trim().replace(/\s+/g,' ');addRow(month,lastSubject,match[2]);}else if(clean){if(lastSubject&&rows.length&&rows[rows.length-1].month===month){addRow(month,lastSubject,clean);carried++;}else issues.push(`بخش ${month}: «${clean.slice(0,60)}» خوانا نشد؛ هر مورد باید به شکل «درس: مبحث» باشد.`);}}}
        return foundMonthSection?{rows,format:'MONTHLY_TEXT',issues:[...new Set(issues)],notes:(carried+carriedDoc)?[`${fa(carried+carriedDoc)} خط بدون «درس:» به درس قبلی همان ماه نسبت داده شد؛ در پیش‌نمایش بررسی کن.`]:[]}:null;
    }
   const budgetNodePath = (book,node,nodes) => { const byId=new Map(nodes.map(item=>[item.id,item])); const path=[]; let current=node,guard=0; while(current&&guard++<20){path.unshift(current.title);current=byId.get(current.parentId);} return path.join(' / '); };
  const budgetBookMatches = (book,row,rawKey) => {
    let score=0,exact=false,explicit=false;
    for(const value of [row.bookTitle,row.bookName,row.book]) if(value){explicit=true;const match=budgetTextScore(value,book.title);score=Math.max(score,match.score);exact ||= match.exact;}
    if(row.subject){const match=budgetTextScore(row.subject,book.subject);score=Math.max(score,match.score-4);exact ||= match.exact;}
    if(rawKey.includes(normKey(book.title))){score=Math.max(score,96);exact=true;}
    else if(rawKey.includes(normKey(book.subject))){score=Math.max(score,76);}
    return {score,exact,explicit};
  };
  function matchBudgetRowsToCurriculum(data, sourceRows) {
     ensureCurriculum(data); const activeGrade=String(data.klass?.grade||'').trim(),activeBooks=listBooksByGrade(data),inputRows=Array.isArray(sourceRows)?sourceRows:[],matched=[];if(inputRows.length>MAX_BUDGET_IMPORT_ROWS)throw new Error(`بودجه بیش از حد مجاز ردیف دارد (${fa(MAX_BUDGET_IMPORT_ROWS)} ردیف). چیزی وارد نشد؛ آن را در چند بخش کوچک‌تر بفرست.`);const rows=inputRows.map(budgetRowFromInput);
    rows.forEach((row,index)=>{
       const rawKey=normKey(row.originalText), rowGrade=row.grade, out={...row,grade:row.grade||activeGrade,academicYear:row.academicYear||String(data.klass?.year||''),id:String(row.id||`budget-draft-row-${uid()}`),rowIndex:index,status:'unresolved',bookId:'',nodeId:'',bookName:'',nodeTitle:row.nodeTitle||row.topic||row.lesson||'',candidates:[],reason:''};
       const rowGradeMismatch=rowGrade&&activeGrade&&(isMultiGrade(activeGrade)?(!isMultiGrade(rowGrade)&&!isLearnerGrade(rowGrade)):normKey(rowGrade)!==normKey(activeGrade));
       if(rowGradeMismatch){out.reason=`پایهٔ ردیف «${rowGrade}» با پایهٔ فعال «${activeGrade}» سازگار نیست؛ تطبیق انجام نشد.`;matched.push(out);return;}
       if(isMultiGrade(activeGrade)&&(!rowGrade||isMultiGrade(rowGrade))){out.reason='کلاس چندپایه است؛ پایهٔ اول تا ششم هر ردیف بودجه را صریح بنویس.';matched.push(out);return;}
      if(!activeGrade){out.reason='پایهٔ کلاس فعال مشخص نیست؛ ابتدا پایهٔ کلاس را ثبت کن.';matched.push(out);return;}
      if(!activeBooks.length){out.reason=`برای پایهٔ ${activeGrade} هنوز کتابی در کاتالوگ فعال وجود ندارد.`;matched.push(out);return;}
      const internalBook=activeBooks.find(book=>book.id===row.bookId),internalNode=internalBook&&curriculumNodes(internalBook).find(node=>node.id===row.nodeId);
        if(row.bookId||row.nodeId){
          if(internalBook&&(!row.nodeId||!internalNode)&&(row.nodeTitle||row.topic||row.lesson||row.chapter)){row.bookTitle ||= internalBook.title;row.subject ||= internalBook.subject;row.bookId='';row.nodeId='';}
          else if(!internalBook|| (row.nodeId&&!internalNode)){out.reason='شناسهٔ داخلی به کتاب یا مبحثی خارج از پایهٔ فعال اشاره می‌کند؛ تطبیق انسانی دوباره لازم است.';matched.push(out);return;}
          if(row.bookId||row.nodeId){
           out.status='matched';out.bookId=internalBook.id;out.nodeId=internalNode?.id||'';out.bookName=internalBook.title;out.bookTitle=internalBook.title;out.nodeTitle=internalNode?.title||'';out.sourceType=internalBook.sourceType;out.sourceLabel=internalBook.sourceLabel;out.matchPath=row.matchPath||'';out.fuzzyMatched=!!row.fuzzyMatched;out.candidates=[];
          const missing=[];if(!out.startDate||!out.endDate)missing.push('بازهٔ زمانی');if(!Number.isInteger(out.sessions)||out.sessions<1||out.sessions>99)missing.push('تعداد جلسه');
           if(missing.length){out.status='needs_review';out.reason=`${row.fuzzyMatched?'تطبیق هوشمند':'تطبیق کتاب'}${internalNode?' و مبحث':''} انجام شد، اما ${missing.join(' و ')} باید از معلم تکمیل شود.`;}else out.reason=row.fuzzyMatched?`تطبیق هوشمند با «${row.matchPath||internalNode?.title||internalBook.title}» انجام شد؛ تأیید یک‌بارهٔ معلم لازم است.`:internalNode?'تطبیق دقیق با ساختار کتاب پایهٔ فعال.':'تطبیق کتاب انجام شد؛ مبحث در متن معلم مشخص نشده است.';matched.push(out);return;
          }
       }
       const gradeBooks=isMultiGrade(activeGrade)&&rowGrade?activeBooks.filter(book=>!book.grade||normKey(book.grade)===normKey(rowGrade)):activeBooks;
       const books=gradeBooks.map(book=>({...book,...budgetBookMatches(book,row,rawKey)})).filter(book=>book.score>0||(!row.bookTitle&&!row.subject&&gradeBooks.length===1));
       if(row.bookTitle&& !books.length){out.reason=`کتاب «${row.bookTitle}» در کاتالوگ پایهٔ ${activeGrade} پیدا نشد.`;matched.push(out);return;}
       const pool=books.length?books:gradeBooks.map(book=>({...book,score:0,exact:false})),nodeCandidates=[];
      const nodeQueries=[row.nodeTitle,row.topic,row.lesson,row.chapter].filter(Boolean),cleanRaw=rawKey.replace(/\d{4}\d{2}\d{2}/g,'').replace(/جلسه\w*\d*/g,'');
       for(const book of pool){const nodes=curriculumNodes(book);for(const node of nodes){const path=budgetNodePath(book,node,nodes),values=nodeQueries.length?nodeQueries:[cleanRaw];let nodeScore=0,nodeExact=false,nodeFuzzy=false;for(const query of values){const titleMatch=budgetTopicScore(query,node.title),pathMatch=budgetTopicScore(query,path);nodeScore=Math.max(nodeScore,titleMatch.score,pathMatch.score-8);nodeExact ||= titleMatch.exact;nodeFuzzy ||= !!titleMatch.fuzzy||!!pathMatch.fuzzy;}if(rawKey.includes(normKey(node.title))){nodeScore=Math.max(nodeScore,96);nodeExact=true;}if(row.chapter&&normKey(path).includes(normKey(row.chapter)))nodeScore=Math.max(nodeScore,82);if(nodeScore>0)nodeCandidates.push({bookId:book.id,bookTitle:book.title,bookSubject:book.subject,nodeId:node.id,nodeTitle:node.title,path,score:nodeScore+Math.min(book.score,35),exact:nodeExact&&book.exact,fuzzy:nodeFuzzy});}}
      nodeCandidates.sort((a,b)=>b.score-a.score||a.bookTitle.localeCompare(b.bookTitle,'fa')||a.nodeTitle.localeCompare(b.nodeTitle,'fa'));
      const top=nodeCandidates[0],second=nodeCandidates[1],ambiguous=!!top&&!!second&&(top.score===second.score||(!top.exact&&second.score>=top.score-12)),strong=!!top&&(!second||!ambiguous)&&(top.exact||top.score>=68);
       out.candidates=nodeCandidates.slice(0,8).map(candidate=>({bookId:candidate.bookId,bookTitle:candidate.bookTitle,subject:candidate.bookSubject,nodeId:candidate.nodeId,nodeTitle:candidate.nodeTitle,path:candidate.path,fuzzy:!!candidate.fuzzy}));
       const rankedBooks=pool.slice().sort((a,b)=>b.score-a.score||Number(b.exact)-Number(a.exact)),bookTop=rankedBooks[0],bookSecond=rankedBooks[1],bookAmbiguous=!!bookTop&&!!bookSecond&&bookTop.score===bookSecond.score,bookStrong=!!bookTop&&(!bookSecond||!bookAmbiguous)&&(bookTop.exact||bookTop.score>=68);
       if(!nodeQueries.length&&bookStrong){
         out.status='matched';out.bookId=bookTop.id;out.nodeId='';out.bookName=bookTop.title;out.bookTitle=bookTop.title;out.nodeTitle='';out.sourceType=bookTop.sourceType;out.sourceLabel=bookTop.sourceLabel;out.candidates=[];
         const missing=[];if(!out.startDate||!out.endDate)missing.push('بازهٔ زمانی');if(!Number.isInteger(out.sessions)||out.sessions<1||out.sessions>99)missing.push('تعداد جلسه');
         if(missing.length){out.status='needs_review';out.reason=`تطبیق کتاب انجام شد، اما ${missing.join(' و ')} باید از معلم تکمیل شود.`;}else out.reason='تطبیق کتاب انجام شد؛ این ردیف در سطح کتاب ثبت می‌شود.';matched.push(out);return;
       }
       if(!top){out.reason=books.length&&books.every(book=>!curriculumNodes(book).length)?`ساختار کتاب ${books.map(book=>`«${book.title}»`).join('، ')} هنوز وارد نشده است.`:'عنوان کتاب یا مبحث در ساختار پایهٔ فعال پیدا نشد.';matched.push(out);return;}
      if(ambiguous||!strong){out.status='ambiguous';out.reason='چند مبحث یا کتاب با این عنوان ممکن است؛ یکی را انتخاب کن.';matched.push(out);return;}
        out.status='matched';out.bookId=top.bookId;out.nodeId=top.nodeId;out.bookName=top.bookTitle;out.bookTitle=top.bookTitle;out.sourceType=pool.find(book=>book.id===top.bookId)?.sourceType;out.sourceLabel=pool.find(book=>book.id===top.bookId)?.sourceLabel;out.nodeTitle=top.nodeTitle;out.matchPath=top.path;out.fuzzyMatched=!!top.fuzzy||!!row.fuzzyMatched;out.candidates=[];
      const missing=[];if(!out.startDate||!out.endDate)missing.push('بازهٔ زمانی');if(!Number.isInteger(out.sessions)||out.sessions<1||out.sessions>99)missing.push('تعداد جلسه');
       if(missing.length){out.status='needs_review';out.reason=`${top.fuzzy||row.fuzzyMatched?'تطبیق هوشمند':'تطبیق'} انجام شد، اما ${missing.join(' و ')} باید از معلم تکمیل شود.`;}else out.reason=top.fuzzy||row.fuzzyMatched?`تطبیق هوشمند با «${top.path}» انجام شد؛ تأیید یک‌بارهٔ معلم لازم است.`:'تطبیق دقیق با ساختار کتاب پایهٔ فعال.';
      matched.push(out);
    });
    return {rows:matched,counts:budgetDraftCounts(matched),activeGrade,activeBooks:activeBooks.map(book=>({id:book.id,title:book.title,subject:book.subject,grade:book.grade}))};
  }
     const budgetDraftCounts = (rows,dependencies={}) => {const ready=row=>row.status==='matched'&&row.bookId&&validDay(row.startDate)&&validDay(row.endDate)&&row.endDate>=row.startDate&&Number.isInteger(row.sessions)&&row.sessions>=1&&row.sessions<=99;return {total:rows.length,ready:rows.filter(ready).length,matched:rows.filter(row=>row.status==='matched').length,ambiguous:rows.filter(row=>row.status==='ambiguous').length,unresolved:rows.filter(row=>row.status==='unresolved').length,needsReview:rows.filter(row=>row.status==='needs_review'||row.status==='matched'&&!ready(row)).length,missingBooks:Array.isArray(dependencies.books)?dependencies.books.length:0,missingNodes:Array.isArray(dependencies.nodes)?dependencies.nodes.length:0};};
   const budgetEntryKey = entry => JSON.stringify([entry.bookId||'',entry.nodeId||'',entry.startDate||'',entry.endDate||'',Number(entry.sessions)||0,entry.programType||'']);
   const budgetEntriesFingerprint = entries => (Array.isArray(entries)?entries:[]).map(budgetEntryKey).sort().join('|');
   const budgetSettingsFingerprint = settings => JSON.stringify([settings?.schoolDays||[],Number(settings?.weekStart),settings?.holidays||[],String(settings?.source||'')]);
   function restoreBudgetDependencyRecords(data,dependencies={}) {
     ensureCurriculum(data);const books=data.curriculum.books||[];
     for(const item of dependencies.books||[])if(!books.some(book=>book.id===item.id))books.push({id:item.id,code:'',title:item.title,subject:item.subject||item.title,grade:item.grade||data.klass?.grade||'',academicYear:String(data.klass?.year||''),officialPage:'',pdfUrl:'',sourceType:CURRICULUM_SOURCE.teacher,sourceLabel:CURRICULUM_SOURCE_LABEL.teacher,nodes:[],contentStatus:'metadata_only',contentRef:null,contentExcerpt:'',contentLength:0,contentFileName:'',importedAt:''});
     for(const item of dependencies.nodes||[]){const book=books.find(value=>value.id===item.bookId);if(book&&!curriculumNodes(book).some(node=>node.id===item.id))book.nodes.push({id:item.id,type:item.type||'topic',title:item.title,parentId:'',pageStart:'',pageEnd:'',pages:'',content:'',sourceType:CURRICULUM_SOURCE.teacher,sourceLabel:CURRICULUM_SOURCE_LABEL.teacher,sourceText:item.sourceText||''});if(book)book.contentStatus='outline_ready';}
     ensureCurriculum(data);return data;
   }
   function parseBudgetRows(text) {
     const input=String(text??''),raw=input.trim(),maxRows=MAX_BUDGET_IMPORT_ROWS;
     const invalid=(format,error)=>({rows:[],format,issues:[error],notes:[],error});
     if(!raw)return invalid('','متن بودجه‌بندی خالی است.');
     if(input.length>MAX_BUDGET_IMPORT_CHARS)return invalid('',`متن بودجه بیش از حد مجاز است (${fa(MAX_BUDGET_IMPORT_CHARS)} نویسه). چیزی پردازش نشد؛ آن را در چند بخش جداگانه بفرست.`);
       const finish=result=>{
         if(!result)return null;
         const rows=Array.isArray(result.rows)?result.rows:[],issues=Array.isArray(result.issues)?[...new Set(result.issues)]:[],notes=Array.isArray(result.notes)?[...new Set(result.notes)]:[];
         if(rows.length>maxRows)return invalid(result.format,`بودجه بیش از حد مجاز ردیف دارد (${fa(maxRows)} ردیف). چیزی وارد نشد؛ آن را در چند بخش کوچک‌تر بفرست.`);
         if(!rows.length&&!result.error)return invalid(result.format,issues[0]||'از متن، ردیف بودجه‌بندی قابل پیش‌نمایش استخراج نشد.');
         return {...result,rows,issues:result.error?[...new Set([...issues,result.error])]:issues,notes};
       };
       if(raw[0]==='{'||raw[0]==='['){
         try{
           const parsed=JSON.parse(raw),rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.rows)?parsed.rows:Array.isArray(parsed?.entries)?parsed.entries:Array.isArray(parsed?.items)?parsed.items:[parsed];
           return finish({rows,format:'JSON',issues:[],notes:[]});
         }catch(_){return invalid('JSON','JSON بودجه‌بندی معتبر نیست.');}
       }
       const monthly=parseMonthlyBudgetTable(raw);if(monthly)return finish(monthly);
      const matrix=parseMonthlyBudgetMatrix(raw);if(matrix)return finish(matrix);
      const prose=parseMonthlyBudgetProse(raw);if(prose)return finish(prose);
      const lines=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),first=normKey(lines[0]||''),headerIndex=lines.findIndex(line=>{
        const delimiter=monthlyBudgetDelimiter(line);if(!delimiter)return false;const cells=monthlyBudgetCells(line,delimiter),labels=/کتاب|درس|مبحث|موضوع|شروع|پایان|جلسه|ماه|هفته|book|subject|topic|start|end|session|month|week/i.test(cells.map(normKey).join(' '));
        return cells.length>1&&!cells.some(cell=>/[:：=]/.test(cell))&&labels;
      });
      if(headerIndex>=0){
        const header=lines[headerIndex],delimiter=monthlyBudgetDelimiter(header),headers=monthlyBudgetCells(header,delimiter).map(normKey),rows=[],issues=[];
        for(let lineIndex=headerIndex+1;lineIndex<lines.length;lineIndex++){
          const line=lines[lineIndex];if(/^[\s|]*:?-{2,}/.test(line))continue;
          if(monthlyBudgetDelimiter(line)!==delimiter){issues.push(`ردیف ${fa(lineIndex+1)} پس از سرستون‌های جدول از قالب ستون‌ها پیروی نمی‌کند؛ متن آن برای بررسی حفظ شد.`);rows.push({rawText:line,originalText:line});continue;}
          const values=monthlyBudgetCells(line,delimiter);if(values.length!==headers.length)issues.push(`ردیف ${fa(lineIndex+1)}: تعداد خانه‌ها با سرستون‌های جدول برابر نیست؛ ردیف کامل بررسی شود.`);
          rows.push({...Object.fromEntries(headers.map((name,index)=>[name,values[index]||''])),originalText:line});
        }
        return finish({rows,format:'TABLE',issues,notes:[]});
      }
      if(lines.length>1&&/کتاب|مبحث|موضوع|شروع|پایان|جلسه|book|topic|start|end|session/i.test(first)&&/,/.test(lines[0])){
        const rows=parseCsv(raw),issues=rows.flatMap((row,index)=>row.__parseIssue?[`ردیف ${fa(index+2)}: تعداد خانه‌ها با سرستون‌های CSV برابر نیست.`]:[]);
        return finish({rows:rows.map(({__parseIssue,...row})=>row),format:'CSV',issues:[...new Set(issues)],notes:[]});
      }
      const rows=lines.map(line=>({rawText:line.replace(/^[-*•]\s*/,''),originalText:line}));
      return finish({rows,format:lines.length>1&&/[|\t,]/.test(lines[0])?'TEXT_TABLE':'TEXT',issues:[],notes:[]});
   }
   function prepareMissingBudgetDependencies(data,draft) {
     ensureCurriculum(data);
       const activeGrade=String(data.klass?.grade||'').trim(),multi=isMultiGrade(activeGrade),dependencies={books:[],nodes:[]},proposedBooks=[],proposedNodes=[];
      if(!activeGrade)return {...draft,dependencies,counts:budgetDraftCounts(draft.rows,dependencies)};
      const books=listBooksByGrade(data),bookByKey=new Map(),sourceText=row=>String(row.originalText||'').slice(0,2000),bookKey=(value,grade)=>normKey([multi?grade:'',value].filter(Boolean).join('|'));
      for(const book of books) { if(book.title)bookByKey.set(bookKey(book.title,book.grade),book); if(book.subject&&!bookByKey.has(bookKey(book.subject,book.grade)))bookByKey.set(bookKey(book.subject,book.grade),book); }
      const bookHint=row=>String(row.bookTitle||row.bookName||row.book||row.subject||'').trim(),topicHint=row=>String(row.nodeTitle||row.topic||row.lesson||row.chapter||'').trim();
      for(const row of draft.rows||[]) {
        const compatibleGrade=row.grade&&(!multi?normKey(row.grade)===normKey(activeGrade):isLearnerGrade(row.grade));
        if(row.status!=='unresolved'||!compatibleGrade)continue;
        const hint=bookHint(row);if(!hint)continue;
        let book=bookByKey.get(bookKey(row.bookTitle||row.bookName||row.book||'',row.grade))||bookByKey.get(bookKey(row.subject||'',row.grade));
        if(!book) {
          const probable=books.filter(item=>!multi||normKey(item.grade)===normKey(row.grade)).map(item=>({...item,...budgetBookMatches(item,row,normKey(row.originalText))})).sort((a,b)=>b.score-a.score)[0];
          if(probable?.score>=86)book=probable;
        }
        if(!book) {
          const key=bookKey(hint,row.grade),id='teacher-book-'+uid();
          book={id,code:'',title:hint,subject:String(row.subject||hint),grade:row.grade||activeGrade,academicYear:String(data.klass?.year||''),officialPage:'',pdfUrl:'',sourceType:CURRICULUM_SOURCE.teacher,sourceLabel:CURRICULUM_SOURCE_LABEL.teacher,nodes:[],contentStatus:'metadata_only',contentRef:null,contentExcerpt:'',contentLength:0,contentFileName:'',importedAt:''};
           data.curriculum.books.push(book);books.push(book);proposedBooks.push(book);bookByKey.set(key,book);if(book.subject&&!bookByKey.has(bookKey(book.subject,book.grade)))bookByKey.set(bookKey(book.subject,book.grade),book);
         dependencies.books.push({id,title:book.title,subject:book.subject,grade:book.grade,sourceType:book.sourceType,sourceLabel:book.sourceLabel,sourceText:sourceText(row),reason:row.bookTitle?'عنوان کتاب در کاتالوگ فعال پیدا نشد.':'عنوان کتاب از درس صریح ردیف ساخته می‌شود؛ رسمی نیست.'});
       }
       const topic=topicHint(row);if(!topic)continue;
       const existing=curriculumNodes(book).find(node=>normKey(node.title)===normKey(topic));if(existing)continue;
       const node={id:'teacher-node-'+uid(),type:row.topic?'topic':row.lesson?'lesson':'section',title:topic,parentId:'',pageStart:'',pageEnd:'',pages:'',content:'',sourceType:CURRICULUM_SOURCE.teacher,sourceLabel:CURRICULUM_SOURCE_LABEL.teacher,sourceText:sourceText(row)};
        book.nodes.push(node);book.contentStatus='outline_ready';proposedNodes.push({bookId:book.id,node});dependencies.nodes.push({id:node.id,bookId:book.id,bookTitle:book.title,title:node.title,type:node.type,sourceType:node.sourceType,sourceLabel:node.sourceLabel,sourceText:node.sourceText,reason:'مبحث در ساختار موجود پیدا نشد؛ به‌عنوان ساختار واردشدهٔ معلم پیشنهاد شده است.'});
      }
      for(const book of proposedBooks)if(!data.curriculum.books.some(item=>item.id===book.id))data.curriculum.books.push(book);
      for(const item of proposedNodes){const book=data.curriculum.books.find(value=>value.id===item.bookId);if(book&&!curriculumNodes(book).some(node=>node.id===item.node.id))book.nodes.push(item.node);}
      let rematched=matchBudgetRowsToCurriculum(data,draft.rows);restoreBudgetDependencyRecords(data,dependencies);rematched=matchBudgetRowsToCurriculum(data,rematched.rows);
        for(const row of rematched.rows){const dependency=dependencies.nodes.find(node=>normKey(node.title)===normKey(row.nodeTitle||row.topic||row.lesson||row.chapter)&&(!row.bookTitle||normKey(node.bookTitle)===normKey(row.bookTitle)));if(dependency&&(!row.bookId||row.nodeId===dependency.id)){row.bookId=dependency.bookId;row.nodeId=dependency.id;row.bookName=dependency.bookTitle;row.bookTitle=dependency.bookTitle;row.nodeTitle=dependency.title;row.sourceType=dependency.sourceType;row.sourceLabel=dependency.sourceLabel;row.candidates=[];row.status='matched';row.autoCreatedTopic=true;const missing=[];if(!row.startDate||!row.endDate)missing.push('بازهٔ زمانی');if(!Number.isInteger(row.sessions)||row.sessions<1||row.sessions>99)missing.push('تعداد جلسه');row.reason=missing.length?'تطبیق با ساختار معلمی انجام شد، اما '+missing.join(' و ')+' باید تکمیل شود.':'مبحث ناموجود برای این درس آمادهٔ ساخت خودکار است؛ تطبیق رسمی بررسی‌نشده.';if(missing.length)row.status='needs_review';}}
       return {...draft,rows:rematched.rows,dependencies,counts:budgetDraftCounts(rematched.rows,dependencies)};
    }
    function stageBudgetDependencies(data,draft) {
      const shadow=clone(data);
      restoreBudgetDependencyRecords(shadow,draft?.dependencies||{});
      const prepared=prepareMissingBudgetDependencies(shadow,clone(draft||{}));
      const previous=draft?.dependencies||{},next=prepared.dependencies||{};
      prepared.dependencies={books:[...(previous.books||[]),...(next.books||[])].filter((item,index,array)=>array.findIndex(value=>value.id===item.id)===index),nodes:[...(previous.nodes||[]),...(next.nodes||[])].filter((item,index,array)=>array.findIndex(value=>value.id===item.id)===index)};
      prepared.counts=budgetDraftCounts(prepared.rows,prepared.dependencies);
      restoreBudgetDependencyRecords(shadow,prepared.dependencies||{});
      return {data:shadow,draft:prepared};
    }
   function createBudgetDraft(data,input={}) {
     ensureCurriculum(data);const parsed=input.text!==undefined?parseBudgetRows(input.text):{rows:Array.isArray(input.rows)?input.rows:Array.isArray(input.entries)?input.entries:[],format:'ROWS',issues:[],notes:[]},rawText=String(input.rawText!==undefined&&String(input.rawText)?input.rawText:input.text??'');if(parsed.error)throw new Error(parsed.error);if(rawText.length>MAX_BUDGET_IMPORT_CHARS)throw new Error(`متن بودجه بیش از حد مجاز است (${fa(MAX_BUDGET_IMPORT_CHARS)} نویسه). چیزی پردازش نشد؛ آن را در چند بخش جداگانه بفرست.`);const sourceRows=Array.isArray(parsed.rows)?parsed.rows:[],rowTextSize=sourceRows.reduce((total,row)=>total+String(row?.originalText||row?.rawText||'').length,0);if(rowTextSize>MAX_BUDGET_IMPORT_CHARS)throw new Error(`متن ردیف‌های بودجه بیش از حد مجاز است (${fa(MAX_BUDGET_IMPORT_CHARS)} نویسه). چیزی وارد نشد.`);const result=matchBudgetRowsToCurriculum(data,sourceRows),now=new Date().toISOString(),parseIssues=[...(parsed.issues||[]),...(input.parseIssues||[])],parseNotes=[...(parsed.notes||[]),...(input.parseNotes||[])];return {schemaVersion:1,id:String(input.id||`budget-draft-${uid()}`),scopeKey:curriculumScopeKey(data),grade:String(data.klass?.grade||''),academicYear:String(data.klass?.year||''),mode:['append','replace'].includes(input.mode)?input.mode:'append',source:String(input.source||'teacher').trim().slice(0,200),rawText,format:parsed.format,parseIssues:[...new Set(parseIssues)],parseNotes:[...new Set(parseNotes)],createdAt:String(input.createdAt||now),updatedAt:now,rows:result.rows,counts:result.counts};
   }
  function validateBudgetDraft(data,draft) {
     ensureCurriculum(data);const currentScope=curriculumScopeKey(data),rows=Array.isArray(draft?.rows)?draft.rows:[],scopeMatch=!draft?.scopeKey||draft.scopeKey===currentScope,readyRows=[],issues=Array.isArray(draft?.parseIssues)?draft.parseIssues.map(issue=>`استخراج بودجه‌بندی: ${issue}`):[];
    if(!scopeMatch)issues.push('این پیش‌نویس مربوط به کلاس یا پایهٔ دیگری است؛ برای جلوگیری از اتصال اشتباه، تطبیق متوقف شد.');
    const activeIds=new Set(listBooksByGrade(data).map(book=>book.id));
     for(const row of rows){const book=activeIds.has(row.bookId)?curriculumBookFor(data,row.bookId):null,node=row.nodeId&&book&&curriculumNodes(book).find(item=>item.id===row.nodeId);if(row.status==='matched'&&scopeMatch&&book&&(!row.nodeId||node)&&validDay(row.startDate)&&validDay(row.endDate)&&row.endDate>=row.startDate&&Number.isInteger(row.sessions)&&row.sessions>=1&&row.sessions<=99)readyRows.push(toBudgetEntry(row));else if(row.status==='matched'&&(!book||(row.nodeId&&!node)))issues.push(`ردیف ${fa((row.rowIndex??rows.indexOf(row))+1)}: کتاب یا مبحث دیگر در پایهٔ فعال وجود ندارد.`);}
     return {scopeMatch,readyRows,rows,counts:budgetDraftCounts(rows,draft?.dependencies),issues};
  }
  const curriculumBookFor = (data,id) => { ensureCurriculum(data); return data.curriculum.books.find(book=>book.id===id); };
     const toBudgetEntry = row => ({id:String(row.id||`budget-${uid()}`),bookId:row.bookId,nodeId:String(row.nodeId||''),nodeTitle:String(row.nodeTitle||''),bookTitle:String(row.bookTitle||row.bookName||''),grade:String(row.grade||''),academicYear:String(row.academicYear||''),chapter:String(row.chapter||''),lesson:String(row.lesson||''),month:String(row.month||''),week:String(row.week||''),period:String(row.period||''),activity:String(row.activity||''),programType:String(row.programType||''),originalText:String(row.originalText||''),startDate:row.startDate,endDate:row.endDate,sessions:Number(row.sessions),note:String(row.note||'').trim().slice(0,500),source:String(row.source||'teacher').slice(0,100),sourceType:String(row.sourceType||CURRICULUM_SOURCE.teacher),sourceLabel:String(row.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher),approvedAt:''});
   function refreshBudgetDraft(data,draft) { const previewData=budgetDraftPreviewData(data,draft),result=matchBudgetRowsToCurriculum(previewData,(draft?.rows||[]).map(row=>({...row,bookId:row.status==='matched'?row.bookId:'',nodeId:row.status==='matched'?row.nodeId:'',id:row.id})));return {...draft,...result,counts:budgetDraftCounts(result.rows,draft?.dependencies),updatedAt:new Date().toISOString()}; }
   function selectBudgetDraftCandidate(data,draft,rowIndex,candidateIndex) { const next=clone(draft),row=next.rows?.[Number(rowIndex)],candidate=row?.candidates?.[Number(candidateIndex)];if(!row||!candidate)return next;row.bookId=candidate.bookId;row.nodeId=candidate.nodeId;row.bookTitle=candidate.bookTitle;row.bookName=candidate.bookTitle;row.nodeTitle=candidate.nodeTitle;row.status='matched';row.reason='تطبیق توسط معلم از میان گزینه‌های پیشنهادی انتخاب شد.';row.candidates=[];return {...next,counts:budgetDraftCounts(next.rows,next.dependencies),updatedAt:new Date().toISOString()};}
  function saveBudgetDraft(data,draft) { ensureCurriculum(data);data.curriculum.budget.draft=clone(draft);if(data===state){dirty=true;return flushSave();}return true; }
  function rematchBudgetDraft(data=state) { ensureCurriculum(data);const draft=data.curriculum.budget.draft;if(!draft)return null;const next=refreshBudgetDraft(data,draft);if(data===state)saveBudgetDraft(data,next);return next; }
    function saveApprovedBudget(data,draft) {
        ensureCurriculum(data);const candidate=clone(draft||data.curriculum.budget.draft);candidate.mode=['append','replace'].includes(candidate.mode)?candidate.mode:'append';if(candidate.parseIssues?.length)return {saved:0,counts:candidate.counts||budgetDraftCounts(candidate.rows||[],candidate.dependencies),remaining:(candidate.rows||[]).length,detail:'ذخیره متوقف شد؛ ابتدا خطاهای استخراج متن بودجه را برطرف کن.'};const stagedValidation=validateBudgetDraft(budgetDraftPreviewData(data,candidate),candidate);if(candidate.mode==='replace'&&stagedValidation.readyRows.length!==stagedValidation.rows.length)return {saved:0,counts:stagedValidation.counts,remaining:stagedValidation.rows.length,detail:'جایگزینی متوقف شد؛ همهٔ ردیف‌ها باید کامل و بدون ابهام باشند. بودجهٔ فعلی دست‌نخورده ماند.'};restoreBudgetDependencyRecords(data,candidate.dependencies||{});const baseValidation=validateBudgetDraft(data,candidate),activeBooks=listBooksByGrade(data),budget=data.curriculum.budget,activeIds=new Set(activeBooks.map(book=>book.id)),previousActive=budget.entries.filter(entry=>activeIds.has(entry.bookId)),previousKeys=new Set(previousActive.map(budgetEntryKey)),readyIds=new Set(baseValidation.readyRows.map(row=>row.id));
     const rows=baseValidation.rows.map(row=>{if(candidate.mode==='append'&&readyIds.has(row.id)&&previousKeys.has(budgetEntryKey(toBudgetEntry(row))))return {...row,status:'needs_review',reason:'این ردیف قبلاً در بودجه‌بندی ثبت شده است؛ برای افزودن، بازهٔ دیگری انتخاب کن.'};return row;});
     const validation={...baseValidation,rows,readyRows:rows.filter(row=>row.status==='matched'&&readyIds.has(row.id)).map(toBudgetEntry),counts:budgetDraftCounts(rows,candidate.dependencies)};
     candidate.counts=validation.counts;const readyRowIds=new Set(validation.readyRows.map(row=>row.id));candidate.rows=rows.filter(row=>!readyRowIds.has(row.id));candidate.counts=budgetDraftCounts(candidate.rows,candidate.dependencies);candidate.updatedAt=new Date().toISOString();
     if(!validation.readyRows.length){if(data===state)saveBudgetDraft(data,{...candidate,rows,counts:validation.counts});return {saved:0,counts:validation.counts,remaining:rows.length,detail:'هیچ ردیف آمادهٔ ثبت نیست؛ پیش‌نویس بدون تطبیق حفظ شد.'};}
     const now=new Date().toISOString(),approvedRows=validation.readyRows.map(row=>({...row,approvedAt:now})),nextActive=candidate.mode==='append'?[...previousActive,...approvedRows]:approvedRows,nextSource=String(candidate.source||budget.source||'teacher').trim().slice(0,200),sameSchedule=budgetEntriesFingerprint(previousActive)===budgetEntriesFingerprint(nextActive)&&String(budget.source||'')===nextSource;
     if(candidate.mode==='replace'&&sameSchedule){if(data===state)saveBudgetDraft(data,null);return {saved:0,version:budget.version,counts:budgetDraftCounts(rows,candidate.dependencies),remaining:rows.length,detail:'این بودجه‌بندی قبلاً با همین ردیف‌ها ثبت شده است؛ ثبت تکراری انجام نشد.'};}
     const version=Math.max(0,Number(budget.version)||0)+1;
     budget.history=(Array.isArray(budget.history)?budget.history:[]).concat([{version:Math.max(0,Number(budget.version)||0),capturedAt:now,grade:String(data.klass?.grade||''),academicYear:String(data.klass?.year||''),entries:clone(previousActive),schoolDays:clone(budget.schoolDays),weekStart:Number(budget.weekStart),holidays:clone(budget.holidays),source:String(budget.source||''),approvedAt:String(budget.approvedAt||'')}]).slice(-12);
       budget.entries=[...budget.entries.filter(entry=>!activeIds.has(entry.bookId)),...nextActive];budget.version=version;budget.source=nextSource;budget.sourceText=String(candidate.rawText||budget.sourceText||'');budget.importedAt=now;budget.approvedAt=now;budget.draft=candidate.rows.length?{...candidate,counts:budgetDraftCounts(candidate.rows,candidate.dependencies)}:null;budget.pending=null;if(data===state&&typeof budgetEditor!=='undefined')budgetEditor.entries=null;
      if(data===state){dirty=true;flushSave();}
     return {saved:approvedRows.length,version,counts:budget.draft?.counts||budgetDraftCounts(candidate.rows,candidate.dependencies),remaining:candidate.rows.length,detail:`${fa(approvedRows.length)} ردیف ثبت شد؛ ${fa(candidate.rows.length)} ردیف همچنان برای بررسی باقی ماند.`};
   }
   function budgetAutoTopicRows(draft) { const dependencyIds=new Set((draft?.dependencies?.nodes||[]).map(node=>node.id)); return (draft?.rows||[]).filter(row=>row.autoCreatedTopic||dependencyIds.has(row.nodeId)); }
   function budgetDraftPreviewData(data,draft) { const shadow=clone(data); restoreBudgetDependencyRecords(shadow,draft?.dependencies||{}); return shadow; }
   function budgetDraftSummary(draft) { const counts=draft?.counts||budgetDraftCounts(draft?.rows||[]);return `پیش‌نویس بودجه‌بندی: ${fa(counts.ready)} آمادهٔ ثبت، ${fa(counts.ambiguous)} نیازمند انتخاب، ${fa(counts.unresolved)} بدون تطبیق و ${fa(counts.needsReview)} نیازمند بررسی. هنوز هیچ ردیف نامنطبق ثبت نشده است.`; }
      const budgetDraftPayload = draft => draft ? {id:draft.id,scopeKey:draft.scopeKey,grade:draft.grade,academicYear:draft.academicYear,mode:draft.mode,counts:draft.counts,parseIssues:draft.parseIssues||[],parseNotes:draft.parseNotes||[],rawTextLength:String(draft.rawText||'').length,dependencies:{books:(draft.dependencies?.books||[]).slice(0,40).map(book=>({title:book.title,subject:book.subject,grade:book.grade,sourceType:book.sourceType,sourceLabel:book.sourceLabel,sourceText:book.sourceText,reason:book.reason})),nodes:(draft.dependencies?.nodes||[]).slice(0,80).map(node=>({bookTitle:node.bookTitle,title:node.title,type:node.type,sourceType:node.sourceType,sourceLabel:node.sourceLabel,sourceText:node.sourceText,reason:node.reason}))},rows:(draft.rows||[]).slice(0,80).map(row=>({originalText:row.originalText,grade:row.grade,academicYear:row.academicYear||draft.academicYear||'',bookTitle:row.bookTitle,subject:row.subject,chapter:row.chapter,lesson:row.lesson,nodeTitle:row.nodeTitle,month:row.month||'',week:row.week||'',period:row.period||'',activity:row.activity||'',startDate:row.startDate,endDate:row.endDate,sessions:row.sessions,programType:row.programType,status:row.status,bookId:row.bookId||'',nodeId:row.nodeId||'',candidates:row.candidates||[],reason:row.reason||'',autoCreatedTopic:!!row.autoCreatedTopic,fuzzyMatched:!!row.fuzzyMatched,matchPath:row.matchPath||''}))} : null;
   function budgetEntryValidationFor(data,entries) { const result=matchBudgetRowsToCurriculum(data,entries);const validation={entries:result.rows.filter(row=>row.status==='matched'&&validDay(row.startDate)&&validDay(row.endDate)&&row.endDate>=row.startDate&&Number.isInteger(row.sessions)&&row.sessions>=1&&row.sessions<=99).map(toBudgetEntry),issues:result.rows.filter(row=>row.status!=='matched').map(row=>`ردیف ${fa((row.rowIndex??0)+1)}: ${row.reason}`),rows:result.rows,counts:result.counts};return validation; }
    function parseBudgetText(text) { const parsed=parseBudgetRows(text);if(parsed.error)return {entries:[],rows:[],issues:[parsed.error],format:parsed.format,counts:{total:0,ready:0,matched:0,ambiguous:0,unresolved:0,needsReview:0}};const baseDraft=createBudgetDraft(state,{rows:parsed.rows,mode:'replace',source:'teacher',rawText:text,parseIssues:parsed.issues,parseNotes:parsed.notes}),staged=stageBudgetDependencies(state,baseDraft),draft=staged.draft,validation=validateBudgetDraft(staged.data,draft);return {entries:validation.readyRows,rows:draft.rows,draft,issues:[...draft.parseIssues,...validation.issues,...draft.rows.filter(row=>row.status!=='matched').map(row=>`ردیف ${fa((row.rowIndex??0)+1)}: ${row.reason}`)],notes:draft.parseNotes,format:parsed.format,counts:validation.counts}; }

  ensureCurriculum(state);
  const curriculumBudgetSnapshot = () => { ensureCurriculum(state); const c=state.curriculum,b=c.budget; return {scopeKey:c.scopeKey,version:Number(b.version)||0,entries:clone(b.entries),schoolDays:clone(b.schoolDays),weekStart:Number(b.weekStart),holidays:clone(b.holidays),source:String(b.source||''),approvedAt:String(b.approvedAt||'')}; };
  let curriculumBudgetBaseline=curriculumBudgetSnapshot();
   function preserveDirectBudgetVersion() {
    ensureCurriculum(state); const now=curriculumBudgetSnapshot(),current=state.curriculum,b=current.budget;
    if(!curriculumBudgetBaseline||curriculumBudgetBaseline.scopeKey!==now.scopeKey){curriculumBudgetBaseline=now;return;}
    const changed=JSON.stringify(curriculumBudgetBaseline.entries)!==JSON.stringify(now.entries)||JSON.stringify(curriculumBudgetBaseline.schoolDays)!==JSON.stringify(now.schoolDays)||curriculumBudgetBaseline.weekStart!==now.weekStart||JSON.stringify(curriculumBudgetBaseline.holidays)!==JSON.stringify(now.holidays)||curriculumBudgetBaseline.source!==now.source;
    if(changed&&now.version<=curriculumBudgetBaseline.version){const grade=String(state.klass?.grade||''),activeIds=new Set(current.books.filter(book=>!!grade&&(!book?.grade||normKey(book.grade)===normKey(grade))).map(book=>book.id)),previousActive=curriculumBudgetBaseline.entries.filter(entry=>activeIds.has(entry.bookId));b.history=(Array.isArray(b.history)?b.history:[]).concat([{version:curriculumBudgetBaseline.version,capturedAt:new Date().toISOString(),grade,academicYear:String(state.klass?.year||''),entries:clone(previousActive),schoolDays:clone(curriculumBudgetBaseline.schoolDays),weekStart:curriculumBudgetBaseline.weekStart,holidays:clone(curriculumBudgetBaseline.holidays),source:curriculumBudgetBaseline.source,approvedAt:curriculumBudgetBaseline.approvedAt}]).slice(-12);b.version=curriculumBudgetBaseline.version+1;b.approvedAt=b.approvedAt||new Date().toISOString();b.importedAt=new Date().toISOString();}
     curriculumBudgetBaseline=curriculumBudgetSnapshot();
   }
   window.__mehryarSyncCurriculumBudgetBaseline=()=>{curriculumBudgetBaseline=curriculumBudgetSnapshot();};
   const migrateBeforeCurriculum = migrate;
   migrate = saved => ensureCurriculum(migrateBeforeCurriculum(saved));
  const flushBeforeCurriculum = flushSave;
  flushSave = function() { ensureCurriculum(state); preserveDirectBudgetVersion(); return flushBeforeCurriculum(); };
  ensureClassScope(state);
  const flushBeforeClassScope = flushSave;
  flushSave = function() { ensureClassScope(state); return flushBeforeClassScope(); };
  const replaceBeforeCurriculum = replaceState;
   replaceState = function(data) {
    const incoming = data && typeof data === 'object' ? clone(data) : data, assets = incoming?.curriculumAssets;
    if (incoming && typeof incoming === 'object') delete incoming.curriculumAssets;
    const ok = replaceBeforeCurriculum(incoming);
     if (ok && Array.isArray(assets)) assets.forEach(asset => { if(asset?.id&&typeof asset.text==='string') putAsset(asset); });
     if (ok) curriculumBudgetBaseline=curriculumBudgetSnapshot();
     return ok;
   };
   const migrateBeforeClassScope = migrate;
   migrate = saved => ensureClassScope(migrateBeforeClassScope(saved));
   const persistBeforeClassScope = persist;
   persist = (...args) => { ensureClassScope(state); return persistBeforeClassScope(...args); };
   const setStateBeforeClassScope = setState;
   setState = function(patch, opts = {}) { const result=setStateBeforeClassScope(patch,opts); ensureClassScope(state); return result; };
   const replaceBeforeClassScope = replaceState;
   replaceState = function(data) { const ok=replaceBeforeClassScope(data); if(ok) ensureClassScope(state); return ok; };
  const exportBeforeCurriculum = exportJSON;
  exportJSON = async function() {
    ensureCurriculum(state);
    const payload=clone(state), assets=[];
    for (const book of payload.curriculum.books||[]) { const asset=assetFor(book); if(asset) assets.push({id:asset.id,name:asset.name||'',mime:asset.mime||'text/plain',text:asset.text||'',updatedAt:asset.updatedAt||''}); }
    if (assets.length) payload.curriculumAssets=assets;
    try { const text=JSON.stringify(payload,null,2); downloadJSONText(text,backupFilename()); ui.toast('پشتیبان کتاب‌ها و نقشهٔ آموزشی آماده شد',{icon:'check'}); }
    catch (_) { exportBeforeCurriculum(); }
  };

  const curriculumOverview = () => {
     ensureCurriculum(state); const entries=activeCurriculumBudgetEntries();
      return {scopeKey:state.curriculum.scopeKey||curriculumScopeKey(state),grade:state.klass.grade||'',className:className()||'',academicYear:state.klass.year||'',catalog:state.curriculum.catalog,books:activeCurriculumBooks().map(book=>compactBook(book)),budget:{version:state.curriculum.budget.version,historyVersions:(state.curriculum.budget.history||[]).map(item=>item.version),entries:entries.length,approvedAt:entries.length?state.curriculum.budget.approvedAt||'':'',schoolDays:state.curriculum.budget.schoolDays,holidays:state.curriculum.budget.holidays}};
  };
  const weekRange = (date=localISO()) => { const d=new Date(`${date}T12:00:00`), start=Number(ensureCurriculum(state).curriculum.budget.weekStart)||6, diff=(d.getDay()-start+7)%7, from=plusDays(date,-diff); return {from,to:plusDays(from,6)}; };
   const weekBudget = (range=weekRange()) => activeCurriculumBudgetEntries().filter(entry=>entry.startDate<=range.to&&entry.endDate>=range.from).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.bookId.localeCompare(b.bookId));
   const budgetEntryText = entry => { const book=curriculumBook(entry.bookId), node=entry.nodeId&&curriculumNodes(book).find(item=>item.id===entry.nodeId); return {book,node,title:node?.title||entry.nodeTitle||'کل کتاب'}; };
  const bookProgressSummary = book => { const nodes=curriculumNodes(book), progress=currentProgress(book.id), statuses=progress.statuses||{}, taught=nodes.filter(node=>statuses[node.id]==='taught'), active=nodes.find(node=>statuses[node.id]==='in_progress')||nodes.find(node=>node.id===progress.currentNodeId), started=nodes.some(node=>statuses[node.id]&&statuses[node.id]!=='not_started'); return {nodes,progress,statuses,taught,active,started}; };
  const formatIssues = issues => issues.length ? `<div class="curriculum-issues"><b>موارد نیازمند اصلاح</b><ul>${issues.map(issue=>`<li>${esc(issue)}</li>`).join('')}</ul></div>` : '';
  const curriculumNav = active => `<div class="curriculum-tabs">${[['curriculum','نمای کلی'],['curriculum/books','کتاب‌ها'],['curriculum/budget','بودجه‌بندی'],['curriculum/progress','جایگاه تدریس'],['curriculum/week','برنامهٔ این هفته']].map(([routeName,label])=>`<a class="${active===routeName?'active':''}" href="#/${routeName}">${label}</a>`).join('')}</div>`;
   const classCurriculumNotice = () => state.klass.grade==='دوم' ? '' : ui.banner({icon:'info',gradient:'blue',color:'blue',title:`پایهٔ کلاس: ${state.klass.grade||'ثبت‌نشده'}`,text:state.klass.grade?`پایهٔ ثبت‌شدهٔ کلاس معتبر است. کتاب‌های فعال باید برای پایهٔ ${esc(state.klass.grade)} باشند؛ اگر کاتالوگ رسمی این پایه آماده نیست، از بخش «کتاب‌ها» کتاب واقعی کلاس را اضافه کن. اگر پایهٔ کلاس اشتباه ثبت شده، از ${link('#/class','اطلاعات کلاس','pencil')} اصلاحش کن.`:`برای ادامه، پایهٔ کلاس را در «اطلاعات کلاس» مشخص کن. پایه‌های مختلف معتبرند؛ سپس از بخش «کتاب‌ها» منابع همان پایه را اضافه کن. ${link('#/class','اطلاعات کلاس','pencil')}`});
  function renderCurriculumHome() {
     ensureCurriculum(state); const activeBooks=activeCurriculumBooks(), activeBudgetEntries=activeCurriculumBudgetEntries(), range=weekRange(), entries=weekBudget(range), c=state.curriculum;
     mount({title:'نقشهٔ آموزشی',backHref:'#/pulse',content:`${curriculumNav('curriculum')}${classCurriculumNotice()}${ui.card(`<div class="curriculum-identity"><div><span class="sub">کلاس فعال</span><h2>${esc(className()||'نام کلاس ثبت نشده')}</h2><p>${esc([state.klass.grade?'پایهٔ '+state.klass.grade:'پایه ثبت نشده',state.klass.year?'سال '+state.klass.year:'سال ثبت نشده'].join(' · '))}</p></div><span class="curriculum-source">${esc(c.catalog.sourceLabel)}</span></div>`)}<section class="curriculum-summary-grid"><a href="#/curriculum/books" class="curriculum-summary-card"><b>کتاب‌ها</b><strong>${fa(activeBooks.length)}</strong><small>فقط کتاب‌های پایهٔ فعال و داده‌های واردشدهٔ معلم</small></a><a href="#/curriculum/budget" class="curriculum-summary-card"><b>بودجه‌بندی تأییدشده</b><strong>${fa(activeBudgetEntries.length)}</strong><small>${activeBudgetEntries.length&&c.budget.approvedAt?'آخرین تأیید: '+dateFa(c.budget.approvedAt):'هنوز تأیید نشده'}</small></a><a href="#/curriculum/week" class="curriculum-summary-card"><b>این هفته</b><strong>${fa(entries.length)}</strong><small>${dateFa(range.from)} تا ${dateFa(range.to)}</small></a></section><section class="curriculum-book-grid">${activeBooks.map(book=>{const p=bookProgressSummary(book);return `<article class="curriculum-book-card"><div class="book-card-head"><div><span class="book-code">کد ${esc(book.code||'بدون کد')}</span><h3>${esc(book.title)}</h3></div><span class="status-pill ${statusClass(book.contentStatus)}">${esc(statusOfBook(book))}</span></div><p class="sub">${p.active?`در حال تدریس: ${esc(p.active.title)}`:p.started?`تا ${fa(p.taught.length)} بخش تدریس‌شده`: 'جایگاه واقعی نامشخص'}</p><a class="btn btn-tinted btn-sm" href="#/curriculum/books">جزئیات کتاب ${icon('arrowLeft')}</a></article>`;}).join('')}</section>${!activeBooks.length?ui.card(`<h2>هنوز کتابی برای این پایه ثبت نشده است</h2><p class="sub">از بخش «کتاب‌ها» یک کتاب واقعی کلاس را اضافه کن؛ پایهٔ کتاب باید با پایهٔ کلاس یکی باشد.</p>`):''}<p class="curriculum-footnote">عنوان‌ها و لینک‌های رسمی یا داده‌های واردشدهٔ معلم در این فهرست دیده می‌شوند. نبود فهرست یا متن به معنی دسترسی به محتوای کتاب نیست.</p>`});
  }
  async function saveImportedBook(bookId, text, fileName='دادهٔ واردشده') {
    const parsed=parseBookInput(text,bookId); if(parsed.error){ui.toast(parsed.error,{duration:6000});return false;}
    const nodes=normalizeImportedNodes(parsed.nodes,bookId), noteText=String(parsed.note||'').trim(), book=curriculumBook(bookId); if(!book)return false;
    if(!nodes.length&&!noteText){ui.toast('فهرست یا متن قابل بازیابی پیدا نشد؛ محتوای حدسی ذخیره نشد.');return false;}
    if(!await ui.confirm('تأیید ورود دادهٔ کتاب',{message:`برای «${book.title}» ${nodes.length?fa(nodes.length)+' ردیف ساختار':''}${nodes.length&&noteText?' و ':''}${noteText?fa(noteText.length)+' نویسه متن':''} پیدا شد. دادهٔ رسمی قبلی حذف نمی‌شود و این ورود جای دادهٔ معلم را می‌گیرد.`,ok:'ورود و ذخیره'}))return false;
    const ref=`book-${bookId}-${Date.now()}`, hasContent=!!noteText||nodes.some(node=>node.content), asset=noteText?{id:ref,name:fileName,mime:'text/plain',text:noteText,updatedAt:new Date().toISOString()}:null;
     if(asset) await putAsset(asset); updateBook(bookId,{nodes,contentRef:asset?.id||book.contentRef,contentExcerpt:(noteText||nodes.map(node=>node.content).filter(Boolean).join('\n')).slice(0,16000),contentLength:noteText.length||nodes.reduce((n,node)=>n+node.content.length,0),contentFileName:fileName,contentStatus:hasContent?'content_ready':'outline_ready',importedAt:localISO()}); if(state.curriculum.budget.draft)state.curriculum.budget.draft=refreshBudgetDraft(state,state.curriculum.budget.draft);
    if(flushSave()){ui.toast('دادهٔ کتاب ذخیره شد',{icon:'check'});rerender();return true;} return false;
  }
  function renderBooks() {
     ensureCurriculum(state); let target=activeCurriculumBooks()[0]?.id||'', pasted='';
      const bookCards=()=>activeCurriculumBooks().map(book=>{const nodes=curriculumNodes(book),preview=nodes.slice(0,4),hasText=!!(book.contentRef||book.contentExcerpt);return `<article class="curriculum-book-detail"><div class="book-card-head"><div><span class="book-code">کد ${esc(book.code||'بدون کد')} · نسخه ${esc(book.academicYear||'نامشخص')}</span><h2>${esc(book.title)}</h2><p class="sub">پایهٔ ${esc(book.grade||'نامشخص')} · ${esc(book.subject||'درس نامشخص')}</p></div><span class="status-pill ${statusClass(book.contentStatus)}">${esc(statusOfBook(book))}</span></div>${book.officialPage?`<p class="curriculum-source-note">منبع رسمی مشخصات: <a href="${esc(book.officialPage)}" target="_blank" rel="noreferrer">صفحهٔ کتاب</a> · <a href="${esc(book.pdfUrl)}" target="_blank" rel="noreferrer">PDF رسمی</a></p>`:'<p class="curriculum-source-note">کتاب واردشدهٔ کلاس؛ منبع را معلم مشخص می‌کند.</p>'}${nodes.length?`<details><summary>فهرست واردشده (${fa(nodes.length)} مورد)</summary><ul class="curriculum-node-list">${preview.map(node=>`<li><b>${esc(node.title)}</b><small>${esc(node.type)} · ${esc(pageLabel(node))}${node.content?' · متن دارد':''}</small></li>`).join('')}${nodes.length>preview.length?`<li class="sub">و ${fa(nodes.length-preview.length)} مورد دیگر…</li>`:''}</ul></details>`:hasText?'<p class="curriculum-empty">متن واردشده قابل بازیابی است؛ فهرست ساختاری کتاب هنوز وارد نشده است.</p>':'<p class="curriculum-empty">فهرست و محتوای قابل بازیابی هنوز وارد نشده است. عنوان کتاب به‌تنهایی محتوای کتاب نیست.</p>'}<input type="file" accept=".json,.txt,.md,.csv,text/plain,application/json,text/csv" data-curriculum-file="${esc(book.id)}"><button type="button" class="btn btn-tinted btn-sm" data-curriculum-target="${esc(book.id)}">انتخاب برای ورود متن/فهرست</button></article>`;}).join('');
     const customBookCard=ui.card(`<h2>افزودن کتاب کلاس</h2><p class="sub">برای هر پایه می‌توانی کتاب واقعی کلاس را اضافه کنی. عنوان به‌تنهایی محتوای کتاب نیست؛ بعد از افزودن، فهرست یا متن واقعی را وارد کن.</p><div class="grid2">${ui.field('عنوان کتاب',ui.input({id:'custom-book-title',placeholder:'مثلاً فارسی سوم'}))}${ui.field('درس',ui.input({id:'custom-book-subject',placeholder:'مثلاً فارسی'}))}${ui.field('پایه',ui.input({id:'custom-book-grade',value:activeCurriculumGrade(),placeholder:'پایهٔ کلاس'}))}${ui.field('سال تحصیلی',ui.input({id:'custom-book-year',value:state.klass.year||''}))}</div><div class="pulse-actions">${ui.btnPrimary('افزودن کتاب',()=>{const title=read('custom-book-title').trim(),grade=read('custom-book-grade').trim()||activeCurriculumGrade(),subject=read('custom-book-subject').trim()||title,academicYear=read('custom-book-year').trim()||state.klass.year||'';if(!title||!grade){ui.toast('عنوان کتاب و پایه لازم است');return;}if(activeCurriculumGrade()&&normKey(grade)!==normKey(activeCurriculumGrade())){ui.toast('پایهٔ کتاب باید با پایهٔ کلاس یکی باشد');return;}if(activeCurriculumBooks().some(book=>normKey(book.title)===normKey(title))){ui.toast('این کتاب برای این پایه قبلاً ثبت شده است');return;}const id='custom-'+uid();state.curriculum.books.push({id,code:'',title,subject,grade,academicYear,officialPage:'',pdfUrl:'',sourceType:CURRICULUM_SOURCE.teacher,sourceLabel:CURRICULUM_SOURCE_LABEL.teacher,nodes:[],contentStatus:'metadata_only',contentRef:null,contentExcerpt:'',contentLength:0,contentFileName:'',importedAt:''});state.curriculum.teachingProgress[id]={currentNodeId:'',statuses:{},exceptions:[],updatedAt:''};if(flushSave()){ui.toast('کتاب کلاس اضافه شد',{icon:'check'});rerender();}})}</div>`);
     const importCard=ui.card(`<h2>ورود فهرست یا متن کتاب</h2><p class="sub">کتاب مقصد را انتخاب کن. JSON و CSV ساختار را نگه می‌دارند؛ TXT و Markdown با عنوان‌های #، ## و ### به‌عنوان بخش/درس/مبحث خوانده می‌شوند. متن بدون عنوان فقط به‌صورت متن قابل جست‌وجو می‌ماند و درس مصنوعی ساخته نمی‌شود.</p>${ui.field('کتاب مقصد',ui.select({id:'curriculum-book-target',value:target,options:activeCurriculumBooks().map(book=>[book.id,book.title]),onChange:v=>{target=v;}}))}${ui.field('متن یا JSON/CSV',ui.textarea({id:'curriculum-book-import',value:pasted,style:'min-height:180px',placeholder:'JSON پیشنهادی:\n{"nodes":[{"id":"...","type":"lesson","title":"...","pageStart":"...","pageEnd":"...","content":"..."}]}',onInput:v=>{pasted=v;}}))}<div class="pulse-actions">${ui.btnPrimary('پیش‌نمایش و ورود',async()=>{await saveImportedBook(target,document.getElementById('curriculum-book-import')?.value||pasted,'متن چسبانده‌شده');},{icon:'upload',disabled:!target})}</div><p class="curriculum-footnote">فرمت قابل پشتیبانی فایل: JSON، CSV، TXT و Markdown. PDF رسمی برای مطالعه در لینک منبع باز می‌شود، اما این نسخه ادعای استخراج متن PDF ندارد.</p>`);
     const formatHelp=`<details class="curriculum-format-help"><summary>قالب JSON و CSV پشتیبانی‌شده</summary><pre>${esc('{"bookId":"custom-book-id","nodes":[{"id":"lesson-1","type":"lesson","title":"عنوان واقعی درس","pageStart":"۱","pageEnd":"۸","content":"متن واردشدهٔ واقعی"}]}\n\nCSV: id,type,title,pageStart,pageEnd,parentId,content')}</pre></details>`;
     mount({title:'کتاب‌ها و منابع آموزشی',backHref:'#/curriculum',content:curriculumNav('curriculum/books')+classCurriculumNotice()+ui.banner({icon:'book',gradient:'blue',color:'blue',title:'وضعیت دسترسی صادقانه',text:'کاتالوگ فعال از پایهٔ کلاس خوانده می‌شود. برای پایه‌هایی که کاتالوگ رسمی‌شان هنوز در این مرحله نیست، کتاب کلاس را اضافه کن و فهرست یا متن واقعی را وارد کن؛ فصل، درس، صفحه یا متن حدس زده نمی‌شود.'})+`<section class="curriculum-book-grid detail">${bookCards()}</section>`+customBookCard+importCard+formatHelp});
    document.querySelectorAll('[data-curriculum-file]').forEach(input=>input.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const text=await file.text();await saveImportedBook(input.dataset.curriculumFile,text,file.name);}));
    document.querySelectorAll('[data-curriculum-target]').forEach(button=>button.addEventListener('click',()=>{target=button.dataset.curriculumTarget;const select=document.getElementById('curriculum-book-target');if(select)select.value=target;document.getElementById('curriculum-book-import')?.focus();}));
  }
   const budgetEditor = { scopeKey:'', entries:null, schoolDays:null, holidays:null, importText:'', preview:null, newBookId:'' };
  function budgetEntryValidation(entries) {
     return budgetEntryValidationFor(state,entries);
  }
  const budgetDaysHtml = days => `<div class="budget-days">${DAY_NAMES.map((label,index)=>`<label><input type="checkbox" data-budget-day="${index}" ${days.includes(index)?'checked':''}>${label}</label>`).join('')}</div>`;
  function renderBudget() {
     ensureCurriculum(state); const activeBooks=activeCurriculumBooks(), c=state.curriculum, activeIds=new Set(activeBooks.map(book=>book.id)), existing=c.budget.entries.filter(entry=>activeIds.has(entry.bookId));
      const scopeKey=state.curriculum.scopeKey||curriculumScopeKey(state);if(budgetEditor.scopeKey!==scopeKey){budgetEditor.scopeKey=scopeKey;budgetEditor.entries=clone(existing);budgetEditor.schoolDays=clone(c.budget.schoolDays);budgetEditor.holidays=clone(c.budget.holidays);budgetEditor.newBookId=activeBooks.find(book=>curriculumNodes(book).length)?.id||activeBooks[0]?.id||'';budgetEditor.preview=null;}else{if(!budgetEditor.entries)budgetEditor.entries=clone(existing);if(!budgetEditor.schoolDays)budgetEditor.schoolDays=clone(c.budget.schoolDays);if(!budgetEditor.holidays)budgetEditor.holidays=clone(c.budget.holidays);if(!budgetEditor.newBookId)budgetEditor.newBookId=activeBooks.find(book=>curriculumNodes(book).length)?.id||activeBooks[0]?.id||'';}
    const book=curriculumBook(budgetEditor.newBookId), nodes=curriculumNodes(book), validation=budgetEntryValidation(budgetEditor.entries), range=weekRange();
      const entryRows=budgetEditor.entries.map((entry,index)=>{const selectedBook=curriculumBook(entry.bookId), selectedNodes=curriculumNodes(selectedBook),nodeOptions=`<option value="" ${!entry.nodeId?'selected':''}>کل کتاب</option>`+selectedNodes.map(node=>`<option value="${esc(node.id)}" ${node.id===entry.nodeId?'selected':''}>${esc(node.title)}</option>`).join('');return `<tr><td><select data-budget-book="${index}">${activeBooks.map(item=>`<option value="${esc(item.id)}" ${item.id===entry.bookId?'selected':''}>${esc(item.title)}</option>`).join('')}</select></td><td><select data-budget-node="${index}">${nodeOptions}</select></td><td><input type="date" data-budget-start="${index}" value="${esc(entry.startDate||'')}"></td><td><input type="date" data-budget-end="${index}" value="${esc(entry.endDate||'')}"></td><td><input type="number" min="1" max="99" data-budget-sessions="${index}" value="${esc(entry.sessions||1)}"></td><td><button type="button" class="btn btn-plain btn-sm" data-budget-delete="${index}">حذف</button></td></tr>`;}).join('');
     mount({title:'بودجه‌بندی معلم',backHref:'#/curriculum',content:`${curriculumNav('curriculum/budget')}${ui.banner({icon:'calendar',gradient:'blue',color:'blue',title:'بودجه‌بندی برنامه است، نه نتیجهٔ یادگیری',text:'تاریخ یا بودجه‌بندی هیچ رنگ یادگیری را تغییر نمی‌دهد. فقط پس از دیدن پیش‌نمایش و تأیید معلم ذخیره می‌شود.'})}${ui.card(`<h2>جلسات و تعطیلات</h2><p class="sub">روزهای مدرسه برای محاسبهٔ نمای هفتگی استفاده می‌شوند؛ تعطیلی فقط برنامه را توضیح می‌دهد و وضعیت تدریس را تغییر نمی‌دهد.</p><label class="field-label">روزهای مدرسه</label>${budgetDaysHtml(budgetEditor.schoolDays)}${ui.field('تعطیلات، جداشده با خط جدید یا ویرگول',ui.input({value:budgetEditor.holidays.join('\n'),placeholder:'۱۴۰۵/۰۷/۰۸\n۱۴۰۵/۰۷/۲۲',onInput:v=>{budgetEditor.holidays=v.split(/[\n,،]+/).map(curriculumDate).filter(Boolean);}}))}`)}${ui.card(`<h2>ورود بودجه‌بندی موجود</h2><p class="sub">فقط JSON یا CSV پشتیبانی می‌شود. JSON: آرایهٔ entries با bookId یا عنوان دقیق کتاب، nodeId یا عنوان دقیق مبحث، startDate، endDate، sessions و note. CSV: bookId,nodeId,startDate,endDate,sessions,note.</p>${ui.textarea({id:'budget-import-text',value:budgetEditor.importText,style:'min-height:140px',placeholder:'[{"bookId":"...","nodeId":"...","startDate":"1405/07/01","endDate":"1405/07/05","sessions":2}]',onInput:v=>{budgetEditor.importText=v;}})}<input type="file" id="budget-import-file" accept=".json,.csv,application/json,text/csv"><div class="pulse-actions">${ui.btnTinted('پیش‌نمایش ورود',()=>{const parsed=parseBudgetText(document.getElementById('budget-import-text')?.value||budgetEditor.importText);budgetEditor.preview=parsed;rerender();},{icon:'eye'})}</div>${budgetEditor.preview?`${formatIssues(budgetEditor.preview.issues)}<p class="sub">${budgetEditor.preview.entries.length?`پیش‌نمایش ${fa(budgetEditor.preview.entries.length)} ردیف معتبر آماده است.`:'ردیف معتبر پیدا نشد.'}</p>${budgetEditor.preview.entries.length&&!budgetEditor.preview.issues.length?ui.btnPrimary('جایگزینی پیش‌نویس جدول',()=>{budgetEditor.entries=clone(budgetEditor.preview.entries);budgetEditor.preview=null;rerender();},{sm:true}):''}`:''}`)}${ui.card(`<div class="card-title">جدول پیش‌نویس بودجه‌بندی</div><p class="sub">تغییرات این جدول هنوز ذخیره نشده‌اند.</p><div class="table-scroll"><table class="curriculum-table"><thead><tr><th>کتاب</th><th>مبحث/درس</th><th>شروع</th><th>پایان</th><th>جلسه</th><th></th></tr></thead><tbody>${entryRows||'<tr><td colspan="6" class="sub">هنوز ردیفی نیست؛ ابتدا ساختار واقعی کتاب را وارد کن.</td></tr>'}</tbody></table></div><div class="budget-add-row">${ui.select({value:budgetEditor.newBookId,options:c.books.filter(item=>curriculumNodes(item).length).map(item=>[item.id,item.title]),onChange:v=>{budgetEditor.newBookId=v;rerender();}})}${ui.select({id:'budget-new-node',value:'',options:[['','یک مبحث انتخاب کن'],...nodes.map(node=>[node.id,node.title])]} )}${ui.input({id:'budget-new-start',type:'date',value:range.from})}${ui.input({id:'budget-new-end',type:'date',value:range.to})}${ui.btnTinted('+ افزودن ردیف',()=>{const node=document.getElementById('budget-new-node')?.value,start=document.getElementById('budget-new-start')?.value,end=document.getElementById('budget-new-end')?.value;if(!node||!start||!end){ui.toast('کتاب، مبحث و بازه لازم است');return;}const match=nodes.find(item=>item.id===node);budgetEditor.entries.push({id:`budget-${uid()}`,bookId:budgetEditor.newBookId,nodeId:node,nodeTitle:match?.title||'',startDate:start,endDate:end,sessions:1,note:'',source:'teacher',approvedAt:''});rerender();},{sm:true})}</div><div class="budget-validation">${formatIssues(validation.issues)}${!validation.issues.length&&budgetEditor.entries.length?`<p class="sub">${fa(validation.entries.length)} ردیف قابل تأیید است.</p>`:''}</div><div class="pulse-actions">${ui.btnPrimary('پیش‌نمایش و تأیید بودجه‌بندی',async()=>{const check=budgetEntryValidation(budgetEditor.entries);if(check.issues.length){ui.toast('ابتدا موارد مبهم یا نامنطبق را اصلاح کن',{duration:6000});rerender();return;}if(!await ui.confirm('تأیید بودجه‌بندی',{message:`${fa(check.entries.length)} ردیف و ${fa(budgetEditor.schoolDays.length)} روز مدرسه ذخیره می‌شود. وضعیت تدریس خودکار تغییر نمی‌کند.`,ok:'تأیید و ذخیره'}))return;const current=ensureCurriculum(state).curriculum;current.budget.entries=check.entries.map(entry=>({...entry,approvedAt:localISO()}));current.budget.schoolDays=budgetEditor.schoolDays.slice();current.budget.holidays=budgetEditor.holidays.slice();current.budget.approvedAt=localISO();current.budget.source='teacher';current.budget.pending=null;if(flushSave()){budgetEditor.entries=null;budgetEditor.preview=null;ui.toast('بودجه‌بندی تأیید و ذخیره شد',{icon:'check'});rerender();}})}</div>`)}<p class="curriculum-footnote">مبحثی که در فهرست رسمی یا دادهٔ واردشده پیدا نشود وارد بودجه نمی‌شود؛ تطبیق حدسی انجام نمی‌شود.</p>`});
    document.querySelectorAll('[data-budget-day]').forEach(input=>input.addEventListener('change',()=>{budgetEditor.schoolDays=[...document.querySelectorAll('[data-budget-day]:checked')].map(el=>Number(el.dataset.budgetDay));}));
     document.querySelectorAll('[data-budget-book]').forEach(input=>input.addEventListener('change',()=>{const i=Number(input.dataset.budgetBook),entry=budgetEditor.entries[i];entry.bookId=input.value;entry.nodeId='';entry.nodeTitle='';rerender();}));
     document.querySelectorAll('[data-budget-node]').forEach(input=>input.addEventListener('change',()=>{const i=Number(input.dataset.budgetNode),entry=budgetEditor.entries[i],node=curriculumNodes(curriculumBook(entry.bookId)).find(item=>item.id===input.value);entry.nodeId=input.value;entry.nodeTitle=node?.title||'';}));
    document.querySelectorAll('[data-budget-start]').forEach(input=>input.addEventListener('change',()=>{budgetEditor.entries[Number(input.dataset.budgetStart)].startDate=input.value;}));
    document.querySelectorAll('[data-budget-end]').forEach(input=>input.addEventListener('change',()=>{budgetEditor.entries[Number(input.dataset.budgetEnd)].endDate=input.value;}));
    document.querySelectorAll('[data-budget-sessions]').forEach(input=>input.addEventListener('change',()=>{budgetEditor.entries[Number(input.dataset.budgetSessions)].sessions=Number(input.value)||1;}));
    document.querySelectorAll('[data-budget-delete]').forEach(input=>input.addEventListener('click',()=>{budgetEditor.entries.splice(Number(input.dataset.budgetDelete),1);rerender();}));
     document.getElementById('budget-import-file')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;budgetEditor.importText=await file.text();const textarea=document.getElementById('budget-import-text');if(textarea)textarea.value=budgetEditor.importText;budgetEditor.preview=parseBudgetText(budgetEditor.importText);rerender();});
   }
   function renderBudgetDraftPanel() {
     const root=document.getElementById('content');if(!root||!/^#\/curriculum\/budget$/.test(location.hash))return;
      ensureCurriculum(state);const c=state.curriculum;
       if(budgetEditor.preview?.draft){saveBudgetDraft(state,budgetEditor.preview.draft);}
       const draft=c.budget.draft||budgetEditor.preview?.draft;if(!draft)return;
        const validation=validateBudgetDraft(budgetDraftPreviewData(state,draft),draft),counts=validation.counts,rows=draft.rows||[],autoTopicRows=budgetAutoTopicRows(draft),autoTopicCount=autoTopicRows.length,statusText=row=>row?.autoCreatedTopic?'مبحث ناموجود؛ ساخت خودکار':row?.fuzzyMatched?'تطبیق هوشمند؛ تأیید معلم':BUDGET_MATCH_STATUS[row?.status]||'نیازمند بررسی',dependencies=draft.dependencies||{books:[],nodes:[]},dependencyHtml=(dependencies.books.length||dependencies.nodes.length)?`<section class="budget-dependencies"><h3>موارد مفقود که با همین تأیید ساخته می‌شوند</h3><p class="sub">این موارد رسمی نیستند؛ منبع آن‌ها «واردشده توسط معلم؛ تطبیق رسمی بررسی‌نشده» است و قبل از ثبت نهایی فقط در همین پیش‌نمایش قرار دارند.</p><ul>${dependencies.books.map(book=>`<li><b>کتاب مفقود: ${esc(book.title)}</b><small>${esc(book.subject||'درس نامشخص')} · ${esc(book.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher)}${book.sourceText?' · ردیف: '+esc(book.sourceText):''}</small></li>`).join('')}${dependencies.nodes.map(node=>`<li><b>مبحث مفقود: ${esc(node.bookTitle)} / ${esc(node.title)}</b><small>${esc(node.type||'مبحث')} · ${esc(node.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher)}${node.sourceText?' · ردیف: '+esc(node.sourceText):''}</small></li>`).join('')}</ul></section>`:'';
        const rowsHtml=rows.map((row,index)=>`<article class="budget-draft-row ${esc(row.status||'unresolved')}"><div class="budget-draft-row-head"><strong>ردیف ${fa(index+1)} · ${esc(statusText(row))}</strong><span>${esc(row.bookTitle||row.bookName||'کتاب نامشخص')} ${row.nodeTitle?'· '+esc(row.nodeTitle):'· کل کتاب'}</span></div><p class="budget-draft-source">${esc(row.originalText||'متن اولیه ثبت نشده')}</p><div class="budget-draft-fields"><label>مبحث/درس انسانی (اختیاری)<input type="text" data-budget-draft-topic="${index}" value="${esc(row.nodeTitle||row.topic||row.lesson||'')}" placeholder="برای بودجهٔ سطح کتاب خالی بگذار"></label><label>شروع<input type="date" data-budget-draft-start="${index}" value="${esc(row.startDate||'')}"></label><label>پایان<input type="date" data-budget-draft-end="${index}" value="${esc(row.endDate||'')}"></label><label>جلسه<input type="number" min="1" max="99" data-budget-draft-sessions="${index}" value="${row.sessions??''}"></label></div>${row.candidates?.length?`<label class="budget-draft-choice">انتخاب تطبیق انسانی<select data-budget-draft-choice="${index}"><option value="">یک گزینه را انتخاب کن</option>${row.candidates.map((candidate,candidateIndex)=>`<option value="${candidateIndex}">${esc(candidate.bookTitle+' · '+candidate.nodeTitle+(candidate.path&&candidate.path!==candidate.nodeTitle?' · '+candidate.path:''))}</option>`).join('')}</select></label>`:''}<p class="budget-draft-reason">${esc(row.reason||'')}${row.matchPath?` · مسیر پیشنهادی: ${esc(row.matchPath)}`:''}</p></article>`).join('');
       const autoTopicNote=autoTopicCount?`<div class="budget-auto-topic-note"><b>${fa(autoTopicCount)} ردیف مبحث ناموجود دارد.</b><span>با یک تأیید، برای هر ردیف مبحث مرتبط ساخته می‌شود و کل بودجه‌بندی یکجا ثبت خواهد شد؛ قبل از آن هیچ کتاب یا مبحثی ذخیره نشده است.</span></div>`:'';
        const section=document.createElement('section');section.className='budget-draft-panel';section.innerHTML=ui.card(`<div class="pd-section-head"><div><h2>پیش‌نویس تطبیق بودجه‌بندی</h2><p>شناسه‌های فنی پنهان‌اند؛ فقط عنوان انسانی و وضعیت تطبیق را می‌بینی.</p></div><span class="pd-eyebrow">${esc(draft.grade||state.klass.grade||'پایه نامشخص')}</span></div><div class="budget-draft-summary"><b>${fa(counts.ready)} آمادهٔ ثبت</b><b>${fa(counts.ambiguous)} نیازمند انتخاب</b><b>${fa(counts.unresolved)} بدون تطبیق</b><b>${fa(counts.needsReview)} نیازمند بررسی</b>${counts.missingBooks?`<b>${fa(counts.missingBooks)} کتاب مفقود</b>`:''}${counts.missingNodes?`<b>${fa(counts.missingNodes)} مبحث مفقود</b>`:''}</div>${dependencyHtml}${autoTopicNote}<p class="sub">ردیف‌های بدون تطبیق حذف نمی‌شوند و هنوز وارد بودجهٔ تأییدشده نشده‌اند. تطبیق‌های هوشمند فقط پیشنهادند و با تأیید یک‌بارهٔ معلم ثبت می‌شوند.</p><div class="budget-draft-list">${rowsHtml||'<p class="sub">پیش‌نویس ردیفی ندارد.</p>'}</div><div class="pulse-actions"><button type="button" class="btn btn-tinted" data-budget-draft-rematch>تطبیق دوباره با کتاب‌ها</button>${autoTopicCount?`<button type="button" class="btn btn-blue" data-budget-draft-auto-save>تأیید و ساخت خودکار مباحث ناموجود (${fa(autoTopicCount)} مورد)</button>`:counts.ready?`<button type="button" class="btn btn-primary" data-budget-draft-save>تأیید و ثبت ردیف‌های آماده</button>`:''}<button type="button" class="btn btn-plain" data-budget-draft-clear>کنار گذاشتن پیش‌نویس</button></div>`);root.append(section);
        const parseIssues=Array.isArray(draft.parseIssues)?draft.parseIssues:[],parseNotes=Array.isArray(draft.parseNotes)?draft.parseNotes:[],card=section.querySelector('.card')||section;
        if(parseIssues.length){const box=document.createElement('div');box.className='budget-parse-issues';box.setAttribute('role','alert');box.style.cssText='margin:10px 0;padding:10px 12px;border:1px solid var(--red);border-radius:10px;background:var(--card2);font-size:12px;line-height:1.8';box.innerHTML='<b>خطای استخراج؛ تا رفع موارد زیر چیزی ثبت نمی‌شود.</b><ul>'+parseIssues.map(issue=>`<li>${esc(issue)}</li>`).join('')+'</ul>';card.prepend(box);}
        if(parseNotes.length){const box=document.createElement('div');box.className='budget-parse-notes';box.style.cssText='margin:10px 0;padding:10px 12px;border:1px solid var(--sep);border-radius:10px;font-size:12px;line-height:1.8';box.innerHTML='<b>یادداشت استخراج</b><ul>'+parseNotes.map(note=>`<li>${esc(note)}</li>`).join('')+'</ul>';card.prepend(box);}
        if(draft.mode==='replace'&&counts.ready!==counts.total){const box=document.createElement('div');box.className='budget-parse-issues';box.style.cssText='margin:10px 0;padding:10px 12px;border:1px solid var(--red);border-radius:10px;background:var(--card2);font-size:12px;line-height:1.8';box.textContent='جایگزینی تا زمانی که همهٔ ردیف‌ها کامل و آماده نشوند غیرفعال است؛ بودجهٔ فعلی دست‌نخورده می‌ماند.';card.prepend(box);}
        if(parseIssues.length||draft.mode==='replace'&&counts.ready!==counts.total)section.querySelectorAll('[data-budget-draft-save],[data-budget-draft-auto-save]').forEach(button=>button.disabled=true);
      const refreshDraft=next=>{const refreshed=refreshBudgetDraft(state,next);saveBudgetDraft(state,refreshed);budgetEditor.preview={...(budgetEditor.preview||{}),draft:refreshed,rows:refreshed.rows,entries:validateBudgetDraft(state,refreshed).readyRows,counts:refreshed.counts};rerender();};
      document.querySelectorAll('[data-budget-draft-choice]').forEach(select=>select.addEventListener('change',()=>{if(select.value==='')return;const current=state.curriculum.budget.draft,next=selectBudgetDraftCandidate(state,current,Number(select.dataset.budgetDraftChoice),Number(select.value));saveBudgetDraft(state,next);budgetEditor.preview={...(budgetEditor.preview||{}),draft:next,rows:next.rows,entries:validateBudgetDraft(state,next).readyRows,counts:next.counts};rerender();}));
      document.querySelectorAll('[data-budget-draft-topic]').forEach(input=>input.addEventListener('change',()=>{const next=clone(state.curriculum.budget.draft),row=next.rows[Number(input.dataset.budgetDraftTopic)];if(!row)return;row.topic=input.value.trim();row.nodeTitle=input.value.trim();row.bookId='';row.nodeId='';row.status='unresolved';row.candidates=[];refreshDraft(next);}));
      document.querySelectorAll('[data-budget-draft-start]').forEach(input=>input.addEventListener('change',()=>{const next=clone(state.curriculum.budget.draft),row=next.rows[Number(input.dataset.budgetDraftStart)];if(!row)return;row.startDate=input.value;refreshDraft(next);}));
      document.querySelectorAll('[data-budget-draft-end]').forEach(input=>input.addEventListener('change',()=>{const next=clone(state.curriculum.budget.draft),row=next.rows[Number(input.dataset.budgetDraftEnd)];if(!row)return;row.endDate=input.value;refreshDraft(next);}));
      document.querySelectorAll('[data-budget-draft-sessions]').forEach(input=>input.addEventListener('change',()=>{const next=clone(state.curriculum.budget.draft),row=next.rows[Number(input.dataset.budgetDraftSessions)];if(!row)return;row.sessions=input.value?Number(input.value):null;refreshDraft(next);}));
      root.querySelector('[data-budget-draft-rematch]')?.addEventListener('click',()=>{const next=rematchBudgetDraft(state);if(next){budgetEditor.preview={...(budgetEditor.preview||{}),draft:next,rows:next.rows,entries:validateBudgetDraft(state,next).readyRows,counts:next.counts};ui.toast('تطبیق دوباره انجام شد',{icon:'check'});rerender();}});
      root.querySelector('[data-budget-draft-auto-save]')?.addEventListener('click',async()=>{const current=state.curriculum.budget.draft;if(!current)return;const staged=stageBudgetDependencies(state,current),check=validateBudgetDraft(staged.data,staged.draft);if(check.readyRows.length!==check.rows.length){ui.toast(`بعد از ساخت خودکار، ${fa(check.rows.length-check.readyRows.length)} ردیف هنوز نیازمند بررسی است.`);return;}if(!await ui.confirm('تأیید و ساخت خودکار مباحث ناموجود',{message:`${fa(check.rows.length)} ردیف آماده است. با یک تأیید، مباحث ناموجود ساخته و کل بودجه‌بندی یکجا ثبت می‌شود.`,ok:'ساخت و ثبت همه'}))return;const committed=stageBudgetDependencies(state,current);restoreBudgetDependencyRecords(state,current.dependencies||{});const result=saveApprovedBudget(state,committed.draft);budgetEditor.preview=null;ui.toast(result.detail,{icon:'check'});rerender();});
       root.querySelector('[data-budget-draft-save]')?.addEventListener('click',async()=>{const current=state.curriculum.budget.draft,check=validateBudgetDraft(state,current);if(!check.readyRows.length){ui.toast('هنوز ردیف آمادهٔ ثبت وجود ندارد.');return;}if(!await ui.confirm('تأیید و ثبت بودجه‌بندی',{message:`${fa(check.readyRows.length)} ردیف آمادهٔ ثبت است. ردیف‌های مبهم یا بدون تطبیق جداگانه حفظ می‌شوند و ثبت نمی‌شوند.`,ok:'تأیید و ثبت'}))return;const result=saveApprovedBudget(state,current);budgetEditor.preview=null;ui.toast(result.detail,{icon:'check'});rerender();});
     root.querySelector('[data-budget-draft-clear]')?.addEventListener('click',async()=>{if(!await ui.confirm('کنار گذاشتن پیش‌نویس',{message:'ردیف‌های تأییدنشده حذف می‌شوند؛ بودجهٔ ثبت‌شده تغییر نمی‌کند.',ok:'کنار بگذار'}))return;state.curriculum.budget.draft=null;budgetEditor.preview=null;flushSave();rerender();});
   }
    function enhanceBudgetEditor(){
      const file=document.getElementById('budget-import-file');if(file)file.accept='.json,.csv,.txt,.md,application/json,text/csv,text/plain';
      const text=document.getElementById('budget-import-text');if(!text)return;
      text.placeholder='درس: الگوهای عددی و عددنویسی | از: ۱۴۰۵/۰۷/۰۱ | تا: ۱۴۰۵/۰۷/۰۵ | جلسه: ۲';
      const card=text.closest('.card');if(!card)return;
      const description=[...card.querySelectorAll('p.sub')].find(node=>node.textContent.includes('فقط JSON'));
      if(description)description.textContent='متن، JSON، CSV، جدول جداشده با | یا فایل متنی پذیرفته می‌شود. شناسهٔ فنی لازم نیست؛ عنوان کتاب، درس، فصل، مبحث، تاریخ و تعداد جلسه را اگر می‌دانی وارد کن.';
      const previewButton=[...card.querySelectorAll('button')].find(button=>button.textContent.includes('پیش‌نمایش ورود'));
      if(previewButton)previewButton.textContent='پیش‌نمایش و تطبیق';
      const mismatches=(state.curriculum?.budget?.draft?.rows||[]).filter(row=>String(row.reason||'').includes('با پایهٔ فعال'));
      if(mismatches.length){
        const pastedGrade=mismatches[0].grade||'نامشخص',activeGrade=state.klass?.grade||'نامشخص',notice=document.createElement('div');
        notice.className='budget-grade-mismatch-notice';notice.setAttribute('role','alert');
        notice.style.cssText='margin-top:12px;padding:12px;border:1px solid rgba(180,83,9,.38);border-radius:12px;background:rgba(245,158,11,.09);line-height:1.8';
        notice.innerHTML=`<strong>بودجه ثبت نشد: پایهٔ متن با پایهٔ کلاس یکی نیست.</strong><p style="margin:5px 0 0">پایهٔ متن: ${esc(pastedGrade)}؛ پایهٔ کلاس فعال: ${esc(activeGrade)}. هر ${fa(mismatches.length)} ردیف رد شد تا بودجه در کلاس اشتباه ثبت نشود. پایهٔ درست کلاس را انتخاب کن یا متن بودجهٔ پایهٔ فعال را وارد کن.</p>`;
        card.append(notice);
      }
    }
    const renderBudgetWithoutDraftPanel=renderBudget;
    renderBudget=function(){renderBudgetWithoutDraftPanel();renderBudgetDraftPanel();enhanceBudgetEditor();};
   const progressEditor = {bookId:'',selectedNodeId:'',exceptions:[],preview:null};
  function progressPreview(bookId,nodeId,exceptions=[]) { const book=curriculumBook(bookId),nodes=curriculumNodes(book),at=nodes.findIndex(node=>node.id===nodeId),skip=new Set(exceptions),changes=nodes.map((node,index)=>({id:node.id,title:node.title,old:currentProgress(bookId).statuses?.[node.id]||'not_started',next:skip.has(node.id)?(currentProgress(bookId).statuses?.[node.id]||'not_started'):index<at?'taught':index===at?'in_progress':'not_started'})); return {bookId,nodeId,changes,changed:changes.filter(change=>change.old!==change.next)}; }
  function renderProgress() {
     ensureCurriculum(state); const books=activeCurriculumBooks(), selected=books.find(book=>book.id===progressEditor.bookId)||books.find(book=>curriculumNodes(book).length)||books[0], bookId=selected?.id||''; progressEditor.bookId=bookId; const nodes=curriculumNodes(selected), progress=currentProgress(bookId), summary=bookProgressSummary(selected);
    mount({title:'جایگاه واقعی تدریس',backHref:'#/curriculum',content:`${curriculumNav('curriculum/progress')}${ui.banner({icon:'range',gradient:'orange',color:'orange',title:'پیشرفت تدریس جدا از یادگیری است',text:'«تدریس‌شده» فقط می‌گوید معلم جایگاه تدریس را مشخص کرده است؛ رنگ‌ها و مشاهده‌های دانش‌آموز تغییر نمی‌کنند.'})}${ui.card(`<div class="grid2">${ui.field('کتاب',ui.select({value:bookId,options:books.map(item=>[item.id,item.title]),onChange:v=>{progressEditor.bookId=v;progressEditor.selectedNodeId='';progressEditor.preview=null;rerender();}}))}${ui.field('تا اینجا تدریس شده',ui.select({value:progressEditor.selectedNodeId||progress.currentNodeId||'',options:[['','هنوز شروع نشده'],...nodes.map(node=>[node.id,`${node.title} · ${pageLabel(node)}`])],onChange:v=>{progressEditor.selectedNodeId=v;progressEditor.preview=null;}}))}</div><p class="sub">وضعیت فعلی ذخیره‌شده: ${summary.active?`در حال تدریس «${esc(summary.active.title)}»`:summary.taught.length?`${fa(summary.taught.length)} بخش تدریس‌شده`:'نامشخص'}</p>${nodes.length?`<details><summary>استثناها؛ مواردی که نباید با محدوده تغییر کنند</summary><div class="progress-exceptions">${nodes.map(node=>`<label><input type="checkbox" data-progress-exception="${esc(node.id)}" ${progressEditor.exceptions.includes(node.id)?'checked':''}>${esc(node.title)}</label>`).join('')}</div></details>`:'<p class="curriculum-empty">برای این کتاب ساختار واقعی وارد نشده است؛ وضعیت تدریس بدون فهرست قابل حدس نیست.</p>'}<div class="pulse-actions">${ui.btnTinted('پیش‌نمایش محدوده',()=>{progressEditor.preview=progressPreview(bookId,progressEditor.selectedNodeId||progress.currentNodeId||'',progressEditor.exceptions);rerender();},{icon:'eye'})}</div>`)}${progressEditor.preview?ui.card(`<h2>پیش‌نمایش تغییرات</h2><p>${fa(progressEditor.preview.changed.length)} مورد تغییر می‌کند؛ قبل از ثبت اصلاح کن.</p><div class="progress-change-list">${progressEditor.preview.changed.slice(0,30).map(change=>`<div><b>${esc(change.title)}</b><span>${esc(STATUS_TEXT[change.old])} ← ${esc(STATUS_TEXT[change.next])}</span></div>`).join('')||'<p class="sub">تغییری لازم نیست.</p>'}</div>${ui.btnPrimary('تأیید و ثبت جایگاه',async()=>{if(!await ui.confirm('ثبت جایگاه تدریس',{message:`${fa(progressEditor.preview.changed.length)} تغییر برای «${selected.title}» ثبت می‌شود. هیچ رنگ یادگیری تغییر نمی‌کند.`,ok:'ثبت جایگاه'}))return;const item=state.curriculum.teachingProgress[bookId]||{currentNodeId:'',statuses:{},exceptions:[],updatedAt:''};item.statuses=Object.fromEntries(progressEditor.preview.changes.map(change=>[change.id,change.next]));item.currentNodeId=progressEditor.preview.nodeId||'';item.exceptions=progressEditor.exceptions.slice();item.updatedAt=localISO();state.curriculum.teachingProgress[bookId]=item;if(flushSave()){progressEditor.preview=null;ui.toast('جایگاه تدریس ذخیره شد',{icon:'check'});rerender();}})}</div>`):''}<section class="curriculum-node-status">${nodes.map(node=>`<div><span class="status-dot ${progress.statuses?.[node.id]||'not_started'}"></span><span><b>${esc(node.title)}</b><small>${esc(STATUS_TEXT[progress.statuses?.[node.id]||'not_started'])} · ${esc(pageLabel(node))}</small></span></div>`).join('')||'<p class="sub">موردی برای نمایش نیست.</p>'}</section>`});
    document.querySelectorAll('[data-progress-exception]').forEach(input=>input.addEventListener('change',()=>{const id=input.dataset.progressException;if(input.checked&&!progressEditor.exceptions.includes(id))progressEditor.exceptions.push(id);if(!input.checked)progressEditor.exceptions=progressEditor.exceptions.filter(item=>item!==id);}));
  }
  const weekProgressLabel = entry => { const book=curriculumBook(entry.bookId), summary=bookProgressSummary(book), status=summary.statuses?.[entry.nodeId]||''; if(status==='taught')return ['تدریس‌شده','green']; if(status==='in_progress')return ['در حال تدریس','blue']; if(!summary.started)return ['نامشخص','gray']; return ['نیازمند پیگیری','orange']; };
  async function shiftCurrentWeek() { const range=weekRange(), entries=weekBudget(range); if(!entries.length){ui.toast('برای این هفته بودجه‌بندی ثبت نشده است.');return;} if(!await ui.confirm('جابه‌جایی بودجهٔ این هفته',{message:`بازهٔ ${dateFa(range.from)} تا ${dateFa(range.to)} و ${fa(entries.length)} ردیف، یک هفته جلو می‌رود. وضعیت تدریس تغییر نمی‌کند.`,ok:'پیش‌نمایش جابه‌جایی'}))return;const moved=state.curriculum.budget.entries.map(entry=>entries.includes(entry)?{...entry,startDate:plusDays(entry.startDate,7),endDate:plusDays(entry.endDate,7),approvedAt:''}:entry);state.curriculum.budget.entries=moved;state.curriculum.budget.approvedAt='';if(flushSave()){ui.toast('بودجهٔ این هفته یک هفته جابه‌جا شد',{icon:'check'});rerender();}}
  function renderWeek() {
       ensureCurriculum(state); const activeBooks=activeCurriculumBooks(), range=weekRange(), entries=weekBudget(range), c=state.curriculum, booksWithNodes=activeBooks.filter(book=>curriculumNodes(book).length), unscheduled=booksWithNodes.filter(book=>!c.budget.entries.some(entry=>entry.bookId===book.id)), cards=entries.map(entry=>{const info=budgetEntryText(entry),[label,color]=weekProgressLabel(entry),location=info.node?pageLabel(info.node):'سطح کتاب';return `<article class="week-plan-row"><div><span class="book-code">${esc(info.book?.title||'کتاب نامشخص')}</span><h3>${esc(info.title)}</h3><small>${dateFa(entry.startDate)} تا ${dateFa(entry.endDate)} · ${fa(entry.sessions)} جلسه · ${esc(location)}</small></div><span class="status-pill ${color}">${label}</span><a class="btn btn-plain btn-sm" href="#/curriculum/progress">اصلاح جایگاه</a></article>`;}).join('');
       mount({title:'برنامهٔ این هفته',backHref:'#/curriculum',content:`${curriculumNav('curriculum/week')}${ui.card(`<div class="week-heading"><div><span class="sub">بازهٔ این هفته</span><h2>${dateFa(range.from)} تا ${dateFa(range.to)}</h2><p>${c.budget.schoolDays.map(day=>DAY_NAMES[day]).join('، ')||'روز مدرسه ثبت نشده'} · ${c.budget.holidays.length?`تعطیلات: ${c.budget.holidays.map(dateFa).join('، ')}`:'تعطیلی ثبت نشده'}</p></div><div class="pulse-actions">${ui.btnTinted('جابه‌جایی یک‌هفته‌ای',shiftCurrentWeek,{icon:'swap',sm:true})}${ui.btnPlain('بودجه‌بندی',()=>location.hash='#/curriculum/budget',{sm:true})}</div></div>`)}<section class="week-plan-list">${cards||'<div class="curriculum-empty">برای این هفته ردیف بودجه‌بندیِ تطبیق‌پذیر وجود ندارد.</div>'}</section>${unscheduled.length?ui.card(`<h2>کتاب‌های دارای فهرست اما بدون زمان‌بندی</h2><ul class="curriculum-node-list">${unscheduled.map(book=>`<li><b>${esc(book.title)}</b><small>هیچ ردیف تأییدشده‌ای در بودجه‌بندی ندارد · <a href="#/curriculum/budget">زمان‌بندی کن</a></small></li>`).join('')}</ul>`):''}${booksWithNodes.length<activeBooks.length?ui.banner({icon:'info',gradient:'gray',color:'gray',title:'وضعیت بعضی کتاب‌ها نامشخص است',text:'برای کتاب‌هایی که فهرست واقعی ندارند، برنامهٔ هفتگی نمی‌تواند عقب‌ماندگی یا پیشرفت را حدس بزند؛ ابتدا دادهٔ کتاب را وارد کن.'}):''}<p class="curriculum-footnote">«تدریس‌شده» از جایگاه واقعی ثبت‌شده می‌آید. اگر جایگاه ثبت نشده باشد «نامشخص» می‌بینی، نه «عقب‌مانده».</p>`});
  }
  function ideaAnnualBudget(grade,year){
    const D=v=>String(v==null?'':v).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[–—−﹣－]/g,'-').replace(/\s+/g,'');
    const F=v=>String(v==null?'':v).replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d\s]/g,'').replace(/(?:پایه|کلاس|ابتدایی)/g,'');
    const yr=v=>{const m=D(v).match(/((?:13|14)\d{2})-?((?:13|14)\d{2})/);return m?[Number(m[1]),Number(m[2])].sort((a,b)=>a-b).join('-'):D(v);};
    const wantG=F(grade),wantY=yr(year);let found=null,idx='';
    try{idx=localStorage.getItem('mehyar_last_budget_key')||'';}catch(_){}
    const keys=[];try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('mehyar_budget_'))keys.push(k);}}catch(_){}
    if(idx&&keys.includes(idx)){keys.splice(keys.indexOf(idx),1);keys.unshift(idx);}
    for(const k of keys){
      try{const b=JSON.parse(localStorage.getItem(k)||'null');if(!b||!Array.isArray(b.months)||!b.months.length)continue;
        const g=F(b.grade),y=yr(b.academicYear);
        if(wantG&&g&&g!==wantG)continue;
        if(wantY&&y&&y!==wantY)continue;
        found=b;break;}catch(_){}
    }
    if(!found)return null;
    let month='';try{month=new Intl.DateTimeFormat('fa-IR',{month:'long'}).format(new Date());}catch(_){}
    const mk=v=>F(v).replace(/ماه$/,'');
    const cur=found.months.filter(m=>mk(m.monthName||m.month)===mk(month));
    const rows=m=>(m.subjects||[]).flatMap(sub=>(sub.topics||[]).map(t=>({subject:sub.subjectTitle||'',topic:String(t||'')}))).filter(r=>r.topic);
    return {source:'annual_budget_storage',grade:found.grade||'',academicYear:found.academicYear||'',currentMonth:month,currentMonthRows:cur.flatMap(rows),months:found.months.map(m=>({month:m.monthName||m.month||'',topics:rows(m).length})),note:'بودجهٔ سالانهٔ تأییدشدهٔ معلم؛ ردیف‌ها ماهانه‌اند و تاریخ دقیق روز ندارند. مبحث ماه جاری را از currentMonthRows بردار و چیزی حدس نزن.'};
  }
  function scopedCurriculumRead(args={}) {
      ensureCurriculum(state); const activeBooks=activeCurriculumBooks(), section=args.section||'curriculum', range=weekRange(), c=state.curriculum, subject=String(args.subject||''), query=String(args.query||'').trim(), requestedBook=args.bookId?activeBooks.find(book=>book.id===args.bookId):null;
     let books=requestedBook?[requestedBook]:activeBooks.filter(book=>!subject||book.subject===subject||book.title.includes(subject));
     if(!books.length&&subject)books=activeBooks.filter(book=>book.title.includes(subject)||book.subject.includes(subject));
     const bookPayloads=books.slice(0,6).map(book=>{const nodes=curriculumNodes(book), progress=currentProgress(book.id), matched=query?nodes.filter(node=>normKey(`${node.title} ${node.content}`).includes(normKey(query))).slice(0,6):nodes.slice(0,Math.min(Number(args.limit)||12,24)), entries=c.budget.entries.filter(entry=>entry.bookId===book.id).slice(0,20);return {...compactBook(book,{nodes:false}),currentNodeId:progress.currentNodeId||null,currentNode:nodes.find(node=>node.id===progress.currentNodeId)?.title||null,progress:progress.statuses||{},budgetEntries:entries.map(entry=>({...entry,nodeTitle:curriculumNodes(book).find(node=>node.id===entry.nodeId)?.title||entry.nodeTitle})),nodes:matched.map(node=>({id:node.id,type:node.type,title:node.title,pages:pageLabel(node),sourceType:node.sourceType||CURRICULUM_SOURCE.teacher,sourceLabel:node.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher,content:node.content||''}))};});
       const output={section,class:{scopeKey:c.scopeKey||curriculumScopeKey(state),grade:state.klass.grade||'',className:className()||'',academicYear:state.klass.year||''},catalog:c.catalog,books:bookPayloads,budget:{version:c.budget.version,historyVersions:(c.budget.history||[]).map(item=>item.version),week:{from:range.from,to:range.to},entries:weekBudget(range).map(entry=>({...entry,bookTitle:curriculumBook(entry.bookId)?.title||'',nodeTitle:budgetEntryText(entry).title})),approvedAt:activeCurriculumBudgetEntries().length?c.budget.approvedAt||'':'',schoolDays:c.budget.schoolDays,holidays:c.budget.holidays,draft:budgetDraftPayload(c.budget.draft)},rules:'فهرست و متن فقط وقتی وجود دارند که منبع رسمی یا ورود واقعی معلم ثبت شده باشد. عنوان کتاب به معنی دسترسی به متن نیست. بودجه‌بندی و جایگاه تدریس ثبت معلم‌اند، نه نتیجهٔ یادگیری. «نامشخص» به معنی نبود داده است، نه عقب‌ماندگی.'};
     const today=localISO(), approved=activeCurriculumBudgetEntries(), current=approved.filter(entry=>validDay(entry.startDate)&&validDay(entry.endDate)&&entry.startDate<=today&&entry.endDate>=today).map(entry=>({...entry,bookTitle:curriculumBook(entry.bookId)?.title||'',nodeTitle:budgetEntryText(entry).title}));
     output.budget.approvedEntries=approved.length;
     output.budget.current=current;
      try{const annual=ideaAnnualBudget(state.klass?.grade,state.klass?.year);if(annual)output.budget.annual=annual;}catch(_){}
     if(section==='weekPlan') return output;
    if(args.onlyUnscheduled) output.books=output.books.filter(book=>!book.budgetEntries.length);
    return output;
  }
   function localCurriculumAnswer(prompt) {
     const raw=String(prompt||''), q=normKey(raw), isWeek=/این\s*هفته|برنامه.?هفته|طبق\s*برنامه/.test(raw)||/این?هفته|برنامه.?هفته|طبقبرنامه/.test(q), isBudget=/بودجه.?بندی|نسبت\s*به\s*برنامه|کجا\s*هستیم/.test(raw)||/بودجه.?بندی|نسبتبهبرنامه|کجاهستیم/.test(q), isContent=/محتوای\s*کتاب|از\s*کتاب|درس\s*فعلی|در\s*دسترس|کتاب\s*در\s*دسترس/.test(raw)||/محتوایکتاب|ازکتاب|درسفعلی|دردسترس|کتابدردسترس/.test(q), isUnscheduled=/زمان.?بندی\s*نشده|برنامه\s*ندارد/.test(raw)||/زمان.?بندی?نشده|برنامهندارد/.test(q);
     if(!isWeek&&!isBudget&&!isContent&&!isUnscheduled)return null;
     if(isBudget&&state.curriculum?.budget?.draft)return budgetDraftSummary(state.curriculum.budget.draft);
    if(isWeek){const entries=weekBudget();if(!entries.length)return `برای ${dateFa(weekRange().from)} تا ${dateFa(weekRange().to)} ردیف بودجه‌بندی تأییدشده‌ای ندارم؛ بنابراین درس این هفته نامشخص است و چیزی را حدس نمی‌زنم.`;return `برنامهٔ ثبت‌شدهٔ این هفته:\n${entries.map(entry=>{const info=budgetEntryText(entry),status=weekProgressLabel(entry)[0];return `• ${info.book?.title||'کتاب نامشخص'} / ${info.title} · ${dateFa(entry.startDate)} تا ${dateFa(entry.endDate)} · وضعیت واقعی: ${status}`;}).join('\n')}\nاین پاسخ فقط از بودجه‌بندی و جایگاه ثبت‌شدهٔ معلم خوانده شد.`;}
     if(isUnscheduled){const books=activeCurriculumBooks().filter(book=>curriculumNodes(book).length&&!state.curriculum.budget.entries.some(entry=>entry.bookId===book.id));return books.length?`این کتاب‌ها فهرست دارند اما هنوز در بودجه‌بندی زمان‌بندی نشده‌اند:\n${books.map(book=>`• ${book.title}`).join('\n')}`:'در کتاب‌های دارای فهرست، موردی بدون زمان‌بندی پیدا نشد؛ کتاب‌های بدون فهرست «نامشخص» هستند.';}
     if(isContent){const subject=['ریاضی','فارسی','نگارش فارسی','علوم تجربی','آموزش قرآن','هدیه آسمان'].find(item=>q.includes(normKey(item)));if(!subject)return 'برای پیدا کردن محتوای کتاب، نام درس را مشخص کن؛ مثلاً «ریاضی» یا «علوم تجربی». عنوان کتاب به‌تنهایی محتوای آن نیست.';const book=activeCurriculumBooks().find(item=>item.subject===subject||item.title.includes(subject));if(!book)return `برای پایهٔ ${state.klass.grade||'فعال'} کتاب این درس هنوز ثبت نشده است؛ عنوان کتاب به‌تنهایی محتوای آن نیست.`;if(!book.contentRef&&!book.contentExcerpt&&!curriculumNodes(book).some(node=>node.content))return `برای «${book.title}» فقط مشخصات رسمی و لینک PDF در دسترس است؛ متن یا فهرست واقعی کتاب وارد نشده، پس پاسخ عمومی را به کتاب نسبت نمی‌دهم.`;const text=fullBookText(book).slice(0,1800);return `محتوای قابل بازیابی برای «${book.title}» از ${book.contentRef?'دادهٔ واردشدهٔ معلم':'ساختار واردشده'}:\n${text}\n\nاین متن به‌عنوان محتوای رسمی کتاب تأیید نشده مگر اینکه منبع آن را خودت وارد کرده باشی.`;}
    return null;
  }

  function prepareBudgetChange(data,p) {
     ensureCurriculum(data);
     const reject=text=>{throw new Error(text);};
     if(!isObj(p))reject('برای بودجه‌بندی، اطلاعات انسانی ردیف‌ها لازم است.');
      const mode=String(p.mode||p.draft?.mode||'append').trim();if(!['replace','append'].includes(mode))reject('حالت بودجه‌بندی معتبر نیست.');
         const rawBudgetText=[p.text,p.table,p.rawText].find(value=>value!==undefined&&String(value).trim()!=='');
         let draft=p.draft?.rows?clone(p.draft):createBudgetDraft(data,{...p,mode,text:rawBudgetText,rows:Array.isArray(p.rows)?p.rows:p.entries});
      if(!Array.isArray(draft.rows)||!draft.rows.length)reject(draft.parseIssues?.[0]||'حداقل یک ردیف متن یا جدول بودجه‌بندی لازم است.');
      if(draft.rows.length>MAX_BUDGET_IMPORT_ROWS||String(draft.rawText||'').length>MAX_BUDGET_IMPORT_CHARS)reject('ورودی بودجه بیش از حد مجاز است؛ آن را در چند بخش کوچک‌تر بفرست.');
      draft.parseIssues=Array.isArray(draft.parseIssues)?[...new Set(draft.parseIssues)]:[];draft.parseNotes=Array.isArray(draft.parseNotes)?[...new Set(draft.parseNotes)]:[];
      draft.mode=mode;draft.source=String(p.source||draft.source||'teacher-chat').trim().slice(0,200);draft=prepareMissingBudgetDependencies(data,draft);restoreBudgetDependencyRecords(data,draft.dependencies);draft.counts=budgetDraftCounts(draft.rows,draft.dependencies);
       const validation=validateBudgetDraft(data,draft),activeBooks=listBooksByGrade(data),budget=data.curriculum.budget,activeIds=new Set(activeBooks.map(book=>book.id)),previousActive=budget.entries.filter(entry=>activeIds.has(entry.bookId)),previousKeys=new Set(previousActive.map(budgetEntryKey)),readyIds=new Set(validation.readyRows.map(row=>row.id));
     const schoolDays=p.schoolDays===undefined?clone(budget.schoolDays):p.schoolDays;
     if(!Array.isArray(schoolDays)||!schoolDays.length||schoolDays.length>7||new Set(schoolDays).size!==schoolDays.length||schoolDays.some(day=>!Number.isInteger(day)||day<0||day>6))reject('روزهای مدرسه باید فهرستی غیرخالی و بدون تکرار از عددهای ۰ تا ۶ باشد.');
     const weekStart=p.weekStart===undefined?Number(budget.weekStart):p.weekStart;
     if(!Number.isInteger(weekStart)||weekStart<0||weekStart>6)reject('شروع هفته باید عدد صحیح ۰ تا ۶ باشد.');
     const holidays=p.holidays===undefined?clone(budget.holidays):p.holidays;
     if(!Array.isArray(holidays)||holidays.length>366)reject('تعطیلات باید فهرستی حداکثر ۳۶۶تایی باشد.');
     const normalizedHolidays=holidays.map(curriculumDate);
     if(normalizedHolidays.some(day=>!day)||new Set(normalizedHolidays).size!==normalizedHolidays.length)reject('همهٔ تعطیلات باید تاریخ معتبر و بدون تکرار باشند.');
      for(const row of draft.rows)if(mode==='append'&&readyIds.has(row.id)&&previousKeys.has(budgetEntryKey(toBudgetEntry(row)))){row.status='needs_review';row.reason='این ردیف قبلاً در بودجه‌بندی ثبت شده است؛ برای افزودن، بازهٔ دیگری انتخاب کن.';}
      let effectiveReady=draft.rows.filter(row=>row.status==='matched'&&readyIds.has(row.id)).map(toBudgetEntry);
      const nextSource=String(draft.source||budget.source||'teacher').trim().slice(0,200),nextActive=mode==='append'?[...previousActive,...effectiveReady]:effectiveReady,sameSchedule=mode==='replace'&&budgetEntriesFingerprint(previousActive)===budgetEntriesFingerprint(nextActive)&&String(budget.source||'')===nextSource&&JSON.stringify(budget.schoolDays||[])===JSON.stringify(schoolDays)&&Number(budget.weekStart)===Number(weekStart)&&JSON.stringify(budget.holidays||[])===JSON.stringify(normalizedHolidays);
       let duplicateSchedule=false;
        if(sameSchedule&&draft.rows.length>0&&effectiveReady.length===draft.rows.length){duplicateSchedule=true;effectiveReady=[];draft.rows=[];}
      draft.counts=budgetDraftCounts(draft.rows,draft.dependencies);
      const now=new Date().toISOString();
     if(effectiveReady.length){
       budget.history=(Array.isArray(budget.history)?budget.history:[]).concat([{version:Math.max(0,Number(budget.version)||0),capturedAt:now,grade:String(data.klass?.grade||''),academicYear:String(data.klass?.year||''),entries:clone(previousActive),schoolDays:clone(budget.schoolDays),weekStart:Number(budget.weekStart),holidays:clone(budget.holidays),source:String(budget.source||''),approvedAt:String(budget.approvedAt||'')}]).slice(-12);
        budget.entries=[...budget.entries.filter(entry=>!activeIds.has(entry.bookId)),...nextActive];budget.version=Math.max(0,Number(budget.version)||0)+1;budget.schoolDays=schoolDays.slice();budget.weekStart=weekStart;budget.holidays=normalizedHolidays;budget.source=nextSource;budget.importedAt=now;budget.approvedAt='';
     }
     budget.draft=draft;budget.pending=null;
        const counts=draft.counts,dependencies=draft.dependencies||{books:[],nodes:[]},dependencyDetails=[...dependencies.books.map(book=>`کتاب مفقود: ${book.title} · ${book.sourceLabel}`),...dependencies.nodes.map(node=>`مبحث مفقود: ${node.bookTitle} / ${node.title} · ${node.sourceLabel}`)].slice(0,8).join('\n'),details=draft.rows.filter(row=>row.status!=='matched').slice(0,8).map(row=>`ردیف ${fa((row.rowIndex??0)+1)}: ${row.reason}`).join('\n'),parseDetails=draft.parseIssues.slice(0,8).join('\n'),duplicateDetail=duplicateSchedule?'\nاین بودجه‌بندی قبلاً با همین مشخصات ثبت شده است؛ ثبت تکراری انجام نشد.':'';
        return {detail:`بودجه‌بندی پایهٔ ${data.klass?.grade||'فعال'} دریافت شد؛ ${fa(counts.ready)} ردیف آمادهٔ ثبت، ${fa(counts.ambiguous)} ردیف نیازمند انتخاب، ${fa(counts.unresolved)} ردیف بدون تطبیق و ${fa(counts.needsReview)} ردیف نیازمند بررسی. ${dependencyDetails?'\nوابستگی‌های پیشنهادی در همین پیش‌نمایش:\n'+dependencyDetails+'\n':''}${parseDetails?'\nخطاهای استخراج؛ تأیید تا رفع آن‌ها غیرفعال است:\n'+parseDetails+'\n':''}${duplicateDetail}${details?'\n'+details+'\n':''}پیش‌نویس نگه داشته شد و هنوز ثبت نهایی نشده است.`,href:'#/curriculum/budget',draft,counts,ready:effectiveReady.length,dependencies};
  }

  const readBeforeCurriculumTools = MehryarTools.read;
  function getCurriculumBudget({grade='',year=''}={}) {
    ensureCurriculum(state);
    const requestedGrade=budgetGradeValue(grade)||String(grade||activeCurriculumGrade()).trim(),activeYear=academicYearKey(state.klass?.year),requestedYear=academicYearKey(year||state.klass?.year);
    if(!requestedGrade||requestedYear&&activeYear&&requestedYear!==activeYear)return [];
    const books=new Map(listBooksByGrade(state,requestedGrade).map(book=>[book.id,book]));
    return state.curriculum.budget.entries.filter(entry=>books.has(entry.bookId)&&(!requestedYear||!entry.academicYear||academicYearKey(entry.academicYear)===requestedYear)).map(entry=>({...entry,subject:entry.subject||books.get(entry.bookId)?.subject||entry.bookTitle||''}));
  }
  MehryarTools.getCurriculumBudget=getCurriculumBudget;
  MehryarTools.read = function(args={}) { if(args.section==='curriculum'||args.section==='weekPlan')return scopedCurriculumRead(args); const result=readBeforeCurriculumTools(args); if(result&&['summary','lessonContext'].includes(result.section))result.curriculum=scopeCurriculumForChat(); return result; };
    function scopeCurriculumForChat() { ensureCurriculum(state); const books=activeCurriculumBooks(), approvedEntries=activeCurriculumBudgetEntries(), week=weekBudget(), c=state.curriculum; return {scopeKey:c.scopeKey||curriculumScopeKey(state),grade:state.klass.grade||'',academicYear:state.klass.year||'',books:books.map(book=>compactBook(book)),budgetVersion:c.budget.version,previousBudgetVersions:(c.budget.history||[]).map(item=>item.version),approvedBudgetEntries:approvedEntries.length,week:week.map(entry=>({...entry,bookTitle:curriculumBook(entry.bookId)?.title||'',nodeTitle:budgetEntryText(entry).title})),draft:budgetDraftPayload(c.budget.draft),rules:'منبع رسمی فقط مشخصات و لینک‌هایی است که وضعیت دسترسی آن‌ها را نشان می‌دهد؛ متن عمومی را به کتاب نسبت نده. جایگاه تدریس و بودجه‌بندی از ثبت معلم‌اند و رنگ یادگیری نیستند.'}; }
  const localAnswerBeforeCurriculum = MehryarTools.localAnswer;
  MehryarTools.localAnswer = prompt => localCurriculumAnswer(prompt) || localAnswerBeforeCurriculum(prompt);
  const readDeclaration = MehryarTools.declarations?.find(item=>item.name==='read_class_data');
   if(readDeclaration){for(const section of ['curriculum','weekPlan'])if(!readDeclaration.parameters.properties.section.enum.includes(section))readDeclaration.parameters.properties.section.enum.push(section);readDeclaration.parameters.properties.bookId={type:'STRING',description:'فیلتر داخلی اختیاری برای خواندن؛ هرگز از معلم درخواست نشود'};readDeclaration.parameters.properties.query={type:'STRING',description:'عبارت انسانی برای بازیابی مبحث یا محتوای مرتبط'};readDeclaration.parameters.properties.onlyUnscheduled={type:'BOOLEAN',description:'فقط کتاب‌های دارای فهرست اما بدون بودجه‌بندی را برگردان'};readDeclaration.description+=' بخش curriculum فقط کتاب و مبحث مرتبط را با وضعیت دسترسی می‌خواند؛ weekPlan فقط برنامهٔ هفته و جایگاه واقعی ثبت‌شده را می‌خواند. شناسه‌های bookId و nodeId داخلی‌اند و از معلم درخواست نمی‌شوند؛ برای تطبیق بودجه‌بندی، ردیف انسانی را به ابزار تطبیق بده. محتوای کتاب را از عنوان حدس نزن.';}

  ROUTES.unshift([/^#\/curriculum$/,renderCurriculumHome],[/^#\/curriculum\/books$/,renderBooks],[/^#\/curriculum\/budget$/,renderBudget],[/^#\/curriculum\/progress$/,renderProgress],[/^#\/curriculum\/week$/,renderWeek]);
  if(typeof pdToolLinks==='function'){const oldLinks=pdToolLinks;pdToolLinks=()=>oldLinks().replace('<div class="pd-tools">','<div class="pd-tools"><a href="#/curriculum">'+icon('book')+'<span>کتاب و نقشهٔ آموزشی</span></a>');}
   if(typeof renderClass==='function'){const oldClass=renderClass;renderClass=function(){oldClass.apply(this,arguments);const root=document.getElementById('content');if(root&&!root.querySelector('.curriculum-class-link')){const section=document.createElement('section');section.className='curriculum-class-link';section.innerHTML=ui.card(`<div class="card-title">${ui.tile('book','blue',32)}کتاب‌ها و نقشهٔ آموزشی</div><p class="sub">${state.klass.grade==='دوم'?'شش عنوان رسمی پایهٔ دوم آماده است؛ فهرست و متن واقعی را فقط با منبع وارد کن.':state.klass.grade?`پایهٔ ${esc(state.klass.grade)} معتبر است؛ از نقشهٔ آموزشی کتاب واقعی این پایه را اضافه کن.`:'پس از انتخاب پایه، کتاب‌ها و نقشهٔ آموزشی کلاس را ادامه می‌دهیم.'}</p><a class="btn btn-tinted btn-block" href="#/curriculum">باز کردن نقشهٔ آموزشی ${icon('arrowLeft')}</a>`);root.append(section);}};}
  const style=document.createElement('style');style.textContent=`.curriculum-tabs{display:flex;gap:7px;overflow:auto;padding:4px 0 14px;margin-bottom:4px}.curriculum-tabs a{white-space:nowrap;padding:8px 11px;border:1px solid var(--sep);border-radius:999px;color:var(--text2);font-size:12px}.curriculum-tabs a.active{background:var(--primary);border-color:var(--primary);color:#fff}.curriculum-identity,.week-heading,.book-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}.curriculum-identity h2,.week-heading h2{margin:3px 0}.curriculum-source,.book-code{font-size:11px;color:var(--muted)}.curriculum-source{max-width:240px;line-height:1.8}.curriculum-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.curriculum-summary-card{border:1px solid var(--sep);border-radius:16px;padding:14px;background:var(--card);color:inherit}.curriculum-summary-card b,.curriculum-summary-card strong,.curriculum-summary-card small{display:block}.curriculum-summary-card strong{font-size:26px;margin:5px 0;color:var(--primary)}.curriculum-summary-card small{font-size:11px;color:var(--muted);line-height:1.7}.curriculum-book-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.curriculum-book-grid.detail{grid-template-columns:1fr}.curriculum-book-card,.curriculum-book-detail,.week-plan-row{border:1px solid var(--sep);border-radius:16px;padding:14px;background:var(--card)}.curriculum-book-card h3,.curriculum-book-detail h2,.week-plan-row h3{margin:4px 0}.curriculum-book-detail input[type=file]{display:block;max-width:100%;margin-top:12px;font-size:12px}.status-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:700;white-space:nowrap}.status-pill.green{background:rgba(52,199,89,.14);color:#16853b}.status-pill.blue{background:rgba(10,132,255,.12);color:#1264bb}.status-pill.orange{background:rgba(255,159,10,.16);color:#a85a00}.status-pill.gray{background:var(--card2);color:var(--muted)}.curriculum-source-note,.curriculum-footnote{font-size:12px;line-height:1.9;color:var(--muted)}.curriculum-empty{padding:14px;border:1px dashed var(--sep);border-radius:12px;color:var(--muted);line-height:1.9}.curriculum-node-list{padding:0 20px 0 0}.curriculum-node-list li{margin:8px 0}.curriculum-node-list small{display:block;color:var(--muted);font-size:11px}.curriculum-format-help pre{white-space:pre-wrap;direction:ltr;text-align:left;font-size:11px;line-height:1.7;background:var(--card2);padding:10px;border-radius:10px;overflow:auto}.curriculum-issues{border:1px solid var(--red);background:rgba(255,59,48,.08);border-radius:12px;padding:10px;margin:10px 0;line-height:1.8}.curriculum-issues ul{margin:4px 0;padding-right:20px}.budget-days,.progress-exceptions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px}.budget-days label,.progress-exceptions label{display:flex;gap:5px;align-items:center;border:1px solid var(--sep);border-radius:10px;padding:7px 9px;font-size:12px}.table-scroll{overflow:auto}.curriculum-table{width:100%;border-collapse:collapse;min-width:720px}.curriculum-table th,.curriculum-table td{border-bottom:1px solid var(--sep);padding:8px;text-align:right;vertical-align:middle;font-size:12px}.curriculum-table input,.curriculum-table select{min-width:100px;max-width:190px}.budget-add-row{display:grid;grid-template-columns:1.3fr 1.5fr 1fr 1fr auto;gap:7px;align-items:end;margin-top:14px}.progress-change-list{max-height:260px;overflow:auto;border:1px solid var(--sep);border-radius:12px;padding:8px}.progress-change-list div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--sep);padding:7px 0;font-size:12px}.progress-change-list span{color:var(--muted)}.curriculum-node-status{margin-top:14px;display:grid;gap:6px}.curriculum-node-status>div{display:flex;gap:9px;align-items:flex-start;border-bottom:1px solid var(--sep);padding:8px 0}.curriculum-node-status small{display:block;color:var(--muted);font-size:11px}.status-dot{width:10px;height:10px;border-radius:50%;margin-top:7px;background:#bbb}.status-dot.taught{background:var(--primary)}.status-dot.in_progress{background:#0a84ff}.status-dot.not_started{background:#bbb}.week-plan-list{display:grid;gap:10px;margin-top:14px}.week-plan-row{display:grid;grid-template-columns:1fr auto auto;align-items:center}.week-plan-row small{display:block;color:var(--muted);line-height:1.8}.curriculum-class-link{margin-top:14px}@media(max-width:760px){.curriculum-summary-grid,.curriculum-book-grid{grid-template-columns:1fr}.budget-add-row{grid-template-columns:1fr 1fr}.week-plan-row{grid-template-columns:1fr auto}.week-plan-row .btn{grid-column:1/-1;width:max-content}}@media(max-width:480px){.budget-add-row{grid-template-columns:1fr}.curriculum-tabs a{font-size:11px;padding:7px 9px}}`;
  document.head.appendChild(style);
    window.__mehryarCurriculumRuntime={prepareBudgetChange,saveBudgetDraft};
     window.__mehryarCurriculumApi={ensureCurriculum,getActiveClassContext,listBooksByGrade,getBookStructure:(data=state,bookId='')=>{const book=curriculumBookFor(data,bookId);return book?{...compactBook(book,{nodes:true,limit:200,content:true}),nodes:curriculumNodes(book).map(node=>({id:node.id,title:node.title,type:node.type,parentId:node.parentId,pages:pageLabel(node),sourceType:node.sourceType||CURRICULUM_SOURCE.teacher,sourceLabel:node.sourceLabel||CURRICULUM_SOURCE_LABEL.teacher,content:node.content||''}))}:null;},getCurriculumBudget,matchBudgetRowsToCurriculum,createBudgetDraft,validateBudgetDraft,saveBudgetDraft,saveApprovedBudget,rematchBudgetDraft,selectBudgetDraftCandidate,parseBookInput,parseBudgetText,budgetDraftPayload,scopedCurriculumRead,localCurriculumAnswer,weekRange,weekBudget,bookProgressSummary,saveImportedBook,prepareCurriculumBudget:budget=>MehryarTools.prepare([{type:'curriculumBudget',budget}]),pendingProposal:()=>MehryarTools.proposal?clone(MehryarTools.proposal):null,cancelCurriculumProposal:()=>MehryarTools.dismiss()};
  if(location.hash==='#/curriculum')scheduleRender();
})();
