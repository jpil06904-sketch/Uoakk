
/* دستیار فردای کلاس: شواهد، فرضیه‌ها، مأموریت‌های قابل سنجش و نقشهٔ وضعیت. */
window.addEventListener('DOMContentLoaded', () => {
  'use strict';
  if (window.__mehryarTomorrowAssistant) return;
  window.__mehryarTomorrowAssistant = true;

  const INFO_STATE = { confirmed:'قطعی', reported:'گزارش‌شده', probable:'احتمالی', needs_review:'نیازمند بررسی' };
  const HYPOTHESIS_STATE = { active:'فعال', strengthened:'تقویت‌شده', weakened:'تضعیف‌شده', needs_review:'نیازمند بررسی', closed:'بسته‌شده' };
  const CONFIDENCE = { low:'کم', medium:'متوسط', high:'زیاد' };
  const MISSION_TYPES = { observation:'مشاهده', intervention:'مداخلهٔ کوچک', conversation:'گفت‌وگو' };
  const RESULT_TEXT = { independent:'مستقل انجام داد', guided:'با یک راهنمایی انجام داد', helped:'با کمک زیاد انجام داد', unable:'نتوانست', avoided:'از انجام کار اجتناب کرد', absent:'غایب بود', access:'مانع دسترسی داشت', explained:'توضیح جدیدی ارائه کرد', unknown:'اطلاعات کافی نیست' };
  const RESULT_OPTIONS = Object.entries(RESULT_TEXT);

  function ensureInquiryData(data) {
    if (!data || typeof data !== 'object') return data;
    data.learning ||= learningDefaults();
    data.learning.evidenceLog = Array.isArray(data.learning.evidenceLog) ? data.learning.evidenceLog : [];
    data.learning.hypotheses = Array.isArray(data.learning.hypotheses) ? data.learning.hypotheses : [];
    data.learning.missions = Array.isArray(data.learning.missions) ? data.learning.missions : [];
    for (const e of data.learning.evidenceLog) {
      if (!e || typeof e !== 'object') continue;
      e.certainty = Object.hasOwn(INFO_STATE,e.certainty) ? e.certainty : 'needs_review';
      e.category ||= 'report'; e.text = String(e.text || '').slice(0,1200); e.history = Array.isArray(e.history) ? e.history : [];
    }
    for (const h of data.learning.hypotheses) {
      if (!h || typeof h !== 'object') continue;
      h.status = Object.hasOwn(HYPOTHESIS_STATE,h.status) ? h.status : 'active';
      h.confidence = Object.hasOwn(CONFIDENCE,h.confidence) ? h.confidence : 'low';
      h.evidenceIds = Array.isArray(h.evidenceIds) ? h.evidenceIds : [];
      h.history = Array.isArray(h.history) ? h.history : [];
    }
    for (const m of data.learning.missions) {
      if (!m || typeof m !== 'object') continue;
      m.type = Object.hasOwn(MISSION_TYPES,m.type) ? m.type : 'observation';
      m.targetStudentId ||= m.studentId || '';
      m.targetName ||= m.studentName || '';
      m.topicLabel ||= m.topicName || m.skillLabel || 'مبحث نامشخص';
      m.reason ||= 'علت اصلی هنوز روشن نیست و به یک مشاهدهٔ کوچک نیاز داریم.';
      m.timeMinutes = Number.isInteger(m.timeMinutes) ? m.timeMinutes : 5;
      m.observe ||= 'رفتار یا پاسخ قابل مشاهدهٔ دانش‌آموز را ثبت کن.';
      m.nextIfSuccess ||= 'یک مشاهدهٔ مستقیم تازه ثبت کن و سپس وضعیت را در پایش نگه دار.';
      m.alternativeIfFailed ||= 'روش را تغییر بده و علت را با یک مأموریت متفاوت بررسی کن.';
      m.resultOptions = Array.isArray(m.resultOptions) && m.resultOptions.length ? m.resultOptions : RESULT_OPTIONS.map(x=>x[0]);
      m.attemptNo = Number.isInteger(m.attemptNo) ? m.attemptNo : 1;
      m.history = Array.isArray(m.history) ? m.history : [];
      m.cycle ||= 'نیازمند بررسی';
      m.hypothesisIds = Array.isArray(m.hypothesisIds) ? m.hypothesisIds : [];
    }
     return data;
    }
  const migrateBeforeInquiry = migrate;
  migrate = saved => ensureInquiryData(migrateBeforeInquiry(saved));
  const validateBeforeInquiry = validateImport;
  validateImport = data => validateBeforeInquiry(ensureInquiryData(clone(data)));
  ensureInquiryData(state);

  function topicOf(row) {
    return { subject:row?.subject || row?.subjectId || 'عمومی', topicId:String(row?.topicId || row?.skillId || 'unknown'), topicLabel:row?.topicLabel || row?.skillLabel || 'مبحث نامشخص' };
  }
  function inquiryKey(row) { const t=topicOf(row); return `${row?.studentId || ''}|${t.subject}|${t.topicId}`; }
  function missionKey(m) { return inquiryKey({studentId:m.studentId || m.targetStudentId, ...m}); }
  function activeMissionsFor(id) { return state.learning.missions.filter(m=>m.status==='active' && (m.studentId||m.targetStudentId)===id); }
  function rowsForStudent(id) {
    const latest = new Map();
    for (const row of getDirectObservations(state,{studentId:id,to:localISO()})) if (row.observed !== false) latest.set(inquiryKey(row),row);
    return [...latest.values()].sort((a,b)=>({red:0,yellow:1,green:2}[a.status]||9)-({red:0,yellow:1,green:2}[b.status]||9)||b.date.localeCompare(a.date));
  }
  function homeworkForStudent(id) {
    const counts={complete:0,partial:0,missing:0,none:0};
    for (const s of state.learning.sessions) { const r=s.records?.[id]; if (r) counts[r.homework] = (counts[r.homework]||0)+1; }
    return counts;
  }
  function attendanceForStudent(id) {
    const counts={present:0,late:0,absent:0,unknown:0};
    for (const rows of Object.values(state.learning.attendanceDays||{})) { const x=rows?.[id]; counts[x||'unknown']=(counts[x||'unknown']||0)+1; }
    return counts;
  }
  function addEvidence(input) {
    ensureInquiryData(state);
    const t=topicOf(input), text=String(input.text||'').trim().slice(0,1200); if (!input.studentId || !text) return null;
    const duplicate=state.learning.evidenceLog.find(e=>e.studentId===input.studentId&&e.date===input.date&&e.text===text&&e.certainty===input.certainty);
    if (duplicate) return duplicate;
    const e={id:'evidence-'+uid(),studentId:input.studentId,studentName:studentById(input.studentId)?.name||input.studentName||'',subject:t.subject,subjectId:t.subject,topicId:t.topicId,topicLabel:t.topicLabel,date:input.date||localISO(),certainty:Object.hasOwn(INFO_STATE,input.certainty)?input.certainty:'needs_review',category:input.category||'report',source:input.source||'گزارش معلم',text,affectsLearning:input.affectsLearning===true,createdAt:new Date().toISOString(),history:[]};
    state.learning.evidenceLog.push(e); return e;
  }
  function addHypothesis(input) {
    ensureInquiryData(state);
    const t=topicOf(input), text=String(input.text||'').trim().slice(0,500); if (!input.studentId || !text) return null;
    const duplicate=state.learning.hypotheses.find(h=>h.studentId===input.studentId&&h.topicId===t.topicId&&normKey(h.text)===normKey(text)&&h.status!=='closed');
    if (duplicate) return duplicate;
    const h={id:'hyp-'+uid(),studentId:input.studentId,studentName:studentById(input.studentId)?.name||'',subject:t.subject,topicId:t.topicId,topicLabel:t.topicLabel,text,status:'active',confidence:Object.hasOwn(CONFIDENCE,input.confidence)?input.confidence:'low',certainty:'probable',evidenceIds:input.evidenceId?[input.evidenceId]:[],createdAt:localISO(),updatedAt:localISO(),history:[]};
    state.learning.hypotheses.push(h); return h;
  }
  function seedHypotheses(row,evidenceId) {
    const t=topicOf(row), items=['ممکن است مفهوم یا پیش‌نیاز نیاز به بررسی داشته باشد','ممکن است روش انجام یا نوع راهنمایی مناسب هنوز روشن نباشد'];
    const text=String(row.note||'');
    if (/تکلیف|خانه|اینترنت|دسترسی|امکانات/.test(text) || row.homework==='missing') items.push('ممکن است مانع دسترسی یا شرایط خانه بر انجام تکلیف اثر گذاشته باشد');
    if (/اضطراب|نگران|ترس|اجتناب/.test(text)) items.push('ممکن است موقعیت اجرا یا اضطراب بر پاسخ اثر گذاشته باشد');
    return items.map(text=>addHypothesis({studentId:row.studentId,...t,text,evidenceId})).filter(Boolean);
  }
  function captureDirectEvidence(data=state) {
    ensureInquiryData(data);
    for (const row of getDirectObservations(data,{to:localISO()})) {
      const t=topicOf(row), text=`مشاهدهٔ مستقیم: ${STATUS_TEXT[row.status] || row.status}${row.errors?.length?'؛ خطای ثبت‌شده: '+row.errors.slice(0,3).join('، '):''}`;
      const e=addEvidence({studentId:row.studentId,...t,date:row.date,certainty:'confirmed',category:'direct_observation',source:'مشاهدهٔ مستقیم معلم',text,affectsLearning:true});
      if (row.status!=='green' && row.causeReviewPending) seedHypotheses(row,e?.id);
    }
    for (const row of state.learning.evidenceLog) if (row.category==='report' && /تکلیف|درس خواند|آزمون|اینترنت|دسترسی/.test(row.text)) seedHypotheses(row,row.id);
  }
  const flushBeforeInquiry = flushSave;
  flushSave = function() { ensureInquiryData(state); captureDirectEvidence(state); return flushBeforeInquiry(); };
  const replaceBeforeInquiry = replaceState;
  replaceState = function(data) { ensureInquiryData(data); return replaceBeforeInquiry(data); };

  function suggestionFor(row) {
    const previous=state.learning.missions.filter(m=>missionKey(m)===inquiryKey(row)).sort((a,b)=>(a.attemptNo||0)-(b.attemptNo||0));
    const last=previous.at(-1), used=new Set(previous.map(m=>m.type)), attempt=previous.length+1;
    if (last && (!row.date || !last.resultAt || row.date<=last.resultAt)) return {blocked:true,attempt,last};
    let type=attempt===1?'observation':attempt===2?'intervention':'conversation';
    if (used.has(type)) type=['observation','intervention','conversation'].find(x=>!used.has(x))||'conversation';
    const t=topicOf(row), name=studentById(row.studentId)?.name||row.name||'دانش‌آموز', access=/تکلیف|خانه|اینترنت|دسترسی/.test(String(row.note||''));
    if (access && attempt>1) type='conversation';
    const details={
      observation:{goal:'فهمیدن محل و نوع توقف، بدون نسبت‌دادن علت',action:`از ${name} بخواه یک سؤال مشابه ${t.topicLabel} را در پنج دقیقه حل کند و روشش را با زبان خودش توضیح دهد.`,time:5,observe:'محل توقف، راهبرد، پاسخ و میزان راهنمایی لازم',success:'حل مستقل یا توضیح درست مفهوم با حداکثر یک راهنمایی'},
      intervention:{goal:'امتحان‌کردن یک حمایت کوچک و قابل مشاهده',action:`تمرین ${t.topicLabel} را به دو مرحله تقسیم کن؛ فقط مرحلهٔ اول را با یک راهنمایی کوتاه اجرا کن و سپس مرحلهٔ دوم را مستقل بسنج.`,time:8,observe:'آیا با کوچک‌شدن مرحله‌ها شروع و ادامه می‌دهد؟',success:'اجرای مرحلهٔ دوم با حداکثر یک راهنمایی'},
      conversation:{goal:'بررسی مانع پنهان با گفت‌وگوی خصوصی و غیرقضاوتی',action:`در گفت‌وگویی کوتاه و خصوصی بپرس انجام کار ${t.topicLabel} برای ${name} چه چیزی را دشوار کرده است؛ پاسخ او را عیناً و بدون برچسب ثبت کن.`,time:5,observe:'مانع گزارش‌شده، نیاز به دسترسی یا نیاز به حمایت بیشتر',success:'توضیح روشن و قابل پیگیری از مانع یا «هنوز مشخص نیست'}
    }[type];
    return {blocked:false,attempt,type,t,previous,name,access,...details,reason:`آخرین وضعیت این مبحث ${STATUS_TEXT[row.status]||row.status} است، اما علت هنوز قطعی نیست. این مأموریت فقط برای آزمودن یک فرضیهٔ کوچک انتخاب شده است.`,nextIfSuccess:type==='conversation'?'مانع گزارش‌شده را با یک حمایت کم‌هزینه امتحان کن و نتیجه را جدا ثبت کن.':'یک مشاهدهٔ مستقیم تازه در همین مبحث ثبت کن؛ رنگ یادگیری خودکار تغییر نمی‌کند.',alternativeIfFailed:attempt>=3?'پس از چند تلاش متفاوت، بررسی حمایتی با والدین یا مشاور را پیشنهاد کن؛ بدون برچسب‌زدن دربارهٔ دانش‌آموز.':`نوع مأموریت را عوض کن؛ ${type==='observation'?'مداخلهٔ کوچک یا گفت‌وگو':'مشاهدهٔ دقیق‌تر یا گفت‌وگوی خصوصی'} را امتحان کن.`};
  }
  function createMission(row) {
    ensureInquiryData(state);
    if (state.learning.missions.some(m=>m.status==='active'&&missionKey(m)===inquiryKey(row))) { ui.toast('برای این مبحث مأموریت فعال وجود دارد.'); return; }
    const p=suggestionFor(row); if (p.blocked) { ui.toast('برای مأموریت بعدی ابتدا مشاهدهٔ تازه ثبت کن.'); return; }
    const hypotheses=seedHypotheses(row);
    const m={id:'mission-'+uid(),type:p.type,studentId:row.studentId,studentName:p.name,targetStudentId:row.studentId,targetName:p.name,subject:p.t.subject,subjectId:p.t.subject,topicId:p.t.topicId,topicLabel:p.t.topicLabel,reason:p.reason,goal:p.goal,action:p.action,teacherAction:p.action,timeMinutes:p.time,observe:p.observe,successCriteria:p.success,nextIfSuccess:p.nextIfSuccess,alternativeIfFailed:p.alternativeIfFailed,resultOptions:RESULT_OPTIONS.map(x=>x[0]),createdAt:localISO(),dueAt:plusDays(localISO(),1),status:'active',cycle:p.type==='observation'?'نیازمند بررسی':'در حال حمایت',result:null,resultAt:'',resultNote:'',attemptNo:p.attempt,hypothesisIds:hypotheses.map(h=>h.id),strategyKey:p.type,history:[]};
    state.learning.missions.push(m); dirty=true; if (flushSave()) { ui.toast('مأموریت فردا ساخته شد',{icon:'check'}); rerender(); }
  }
  function updateHypotheses(m,result,note) {
    for (const h of state.learning.hypotheses.filter(x=>m.hypothesisIds.includes(x.id))) {
      const before=h.status;
      if (result==='access' && /دسترسی|خانه|اینترنت/.test(h.text)) { h.status='strengthened'; h.confidence='medium'; }
      else if (result==='independent' || result==='explained') { h.status=/مفهوم|پیش‌نیاز|راهبرد/.test(h.text)?'weakened':'active'; }
      else if (['unable','avoided','helped','guided'].includes(result)) { h.status='strengthened'; h.confidence=h.confidence==='low'?'medium':h.confidence; }
      else if (['absent','unknown'].includes(result)) h.status='needs_review';
      if (before!==h.status) h.history.push({date:localISO(),result,status:h.status,note:String(note||'').slice(0,300)});
      h.updatedAt=localISO();
    }
  }
  function recordMissionResult(id,result,note='') {
    const m=state.learning.missions.find(x=>x.id===id); if(!m || !RESULT_TEXT[result]) return;
    m.result=result; m.resultAt=localISO(); m.resultNote=String(note||'').trim().slice(0,800); m.status='completed';
    m.cycle=result==='independent'||result==='explained'?'بهبود یافته و وارد پایش شده':result==='access'?'در حال حمایت':['guided','helped'].includes(result)?'در حال حمایت':['unable','avoided'].includes(result)?(m.attemptNo>=3?'نیازمند حمایت والدین یا مشاور':'نیازمند بررسی بیشتر'):['absent','unknown'].includes(result)?'اطلاعات کافی نیست':'نیازمند بررسی';
    m.nextAction=result==='independent'||result==='explained'?m.nextIfSuccess:result==='access'?'تکلیف کاغذی یا زمان انجام تکلیف در مدرسه را امتحان کن؛ نتیجه را جدا ثبت کن.':m.alternativeIfFailed;
    m.history.push({result,date:m.resultAt,note:m.resultNote,cycle:m.cycle}); updateHypotheses(m,result,m.resultNote);
    addEvidence({studentId:m.studentId,subject:m.subject,topicId:m.topicId,topicLabel:m.topicLabel,date:m.resultAt,certainty:'confirmed',category:'mission_result',source:'نتیجهٔ ثبت‌شدهٔ مأموریت',text:`نتیجهٔ مأموریت «${MISSION_TYPES[m.type]}»: ${RESULT_TEXT[result]}${m.resultNote?'؛ '+m.resultNote:''}`,affectsLearning:false});
    dirty=true; if (flushSave()) { ui.toast('نتیجه ثبت شد؛ رنگ یادگیری تغییر نکرد.',{icon:'check'}); rerender(); }
  }
  function missionCard(m) {
    const name=studentById(m.studentId)?.name||m.targetName||'دانش‌آموز';
    const result=m.status==='active'?`${ui.field('نتیجهٔ مأموریت',ui.select({value:'',options:[['','نتیجه را انتخاب کنید'],...RESULT_OPTIONS],onChange:v=>{if(v)recordMissionResult(m.id,v,document.getElementById('inquiry-note-'+m.id)?.value||'');}}))}${ui.field('یادداشت نتیجه',ui.input({id:'inquiry-note-'+m.id,value:''}))}`:`<p><b>نتیجه:</b> ${esc(RESULT_TEXT[m.result]||'ثبت نشده')} · ${esc(m.cycle)}</p><p><b>اقدام بعدی:</b> ${esc(m.nextAction||'')}</p>`;
    return ui.card(`<div class="mission-head"><h2>${esc(name+' / '+m.subject+' / '+m.topicLabel)}</h2><span class="mission-type">${esc(MISSION_TYPES[m.type])}</span></div><p><b>چرا:</b> ${esc(m.reason)}</p><p><b>هدف:</b> ${esc(m.goal)}</p><p><b>اقدام معلم:</b> ${esc(m.action)}</p><p><b>زمان:</b> ${fa(m.timeMinutes)} دقیقه · <b>مشاهده:</b> ${esc(m.observe)}</p><p><b>معیار موفقیت:</b> ${esc(m.successCriteria)}</p><p><b>اگر موفق شد:</b> ${esc(m.nextIfSuccess)}</p><p><b>اگر موفق نشد:</b> ${esc(m.alternativeIfFailed)}</p>${result}`);
  }

  window.__mehryarTomorrowApi = { INFO_STATE, HYPOTHESIS_STATE, CONFIDENCE, MISSION_TYPES, RESULT_TEXT, RESULT_OPTIONS, ensureInquiryData, topicOf, inquiryKey, rowsForStudent, homeworkForStudent, attendanceForStudent, addEvidence, addHypothesis, seedHypotheses, captureDirectEvidence, suggestionFor, createMission, recordMissionResult, missionCard };

});
