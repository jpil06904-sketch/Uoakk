
/* Topic identity, legacy safety and small next-day missions. */
(() => {
  'use strict';
  if (window.__mehryarMissionLayer) return;
  window.__mehryarMissionLayer = true;

  const RESULT_TEXT = {
    independent:'مستقل انجام داد', guided:'با راهنمایی انجام داد', helped:'با کمک زیاد انجام داد',
    unable:'نتوانست انجام دهد', avoided:'از انجام کار اجتناب کرد', access:'مانع دسترسی وجود داشت',
    absent:'غایب بود', unknown:'اطلاعات کافی نیست', other:'نتیجهٔ دیگر'
  };
  const canonicalTopic = item => ({
    subject: String(item?.subject || item?.subjectId || 'عمومی'),
    topicId: String(item?.topicId || item?.skillId || 'unknown'),
    topicLabel: String(item?.topicLabel || item?.skillLabel || item?.topicName || 'مبحث نامشخص')
  });
  const topicKey = item => { const t=canonicalTopic(item); return `${item?.studentId||''}|${t.subject}|${t.topicId}`; };
  const groupKey = item => { const t=canonicalTopic(item); return `${t.subject}|${t.topicId}`; };
  const validStatus = value => ['red','yellow','green'].includes(value);

  function normalizeLegacyShape(data) {
    if (!data || typeof data !== 'object') return data;
    const out = data;
    if (!out.learning) out.learning = learningDefaults();
    const base = learningDefaults();
    out.learning = {...base, ...out.learning};
    const l = out.learning;
    for (const key of ['skills','sessions','followups','customActivities','dailyPlans','teachingReports']) if (!Array.isArray(l[key])) l[key]=[];
    l.schemaVersion = 1;
    const skillByKey = new Map(l.skills.map(s => [`${s.subject||'عمومی'}|${s.id}`, s]));
    let unknown = 0;
    const ensureSkill = (subject,id,label) => {
      const key=`${subject}|${id}`;
      if (!skillByKey.has(key)) { const skill={id,label,subject,topicId:id,topicLabel:label}; l.skills.push(skill); skillByKey.set(key,skill); }
      return skillByKey.get(key);
    };
    for (const session of l.sessions) {
      const subject=session.subject||session.subjectId||'عمومی';
      const id=String(session.topicId||session.skillId||`legacy-unknown-${++unknown}`);
      const skill=ensureSkill(subject,id,session.topicLabel||session.skillLabel||'مبحث نامشخص');
      session.subject=subject; session.subjectId=session.subjectId||subject; session.topicId=id; session.skillId=session.skillId||id;
      session.topicLabel=session.topicLabel||skill.topicLabel||skill.label; session.skillLabel=session.skillLabel||session.topicLabel;
      session.rosterIds=Array.isArray(session.rosterIds)?session.rosterIds:out.students.map(s=>s.id); session.records=session.records&&typeof session.records==='object'?session.records:{};
      for (const id of session.rosterIds) {
        const record=session.records[id]; if (!record||typeof record!=='object') continue;
        if (!validStatus(record.status)) { record.status='green'; record.observed=false; }
        else if (record.observed===undefined) record.observed=true;
        if (!record.attendance) record.attendance='none'; if (!record.homework) record.homework='none'; if (!Array.isArray(record.errors)) record.errors=[];
        record.type=record.type||'learning_observation'; record.studentId=record.studentId||id; record.studentName=record.studentName||(out.students.find(s=>s.id===id)?.name||''); record.subjectId=record.subjectId||subject; record.topicId=record.topicId||session.topicId; record.topicName=record.topicName||session.topicLabel; record.observedAt=record.observedAt||session.date; record.source=record.source||session.source||'manual'; record.confidence=record.confidence||'confirmed';
      }
    }
    for (const row of [...l.followups,...l.teachingReports]) {
      if (!row||typeof row!=='object') continue;
      const subject=row.subject||row.subjectId||'عمومی', id=String(row.topicId||row.skillId||`legacy-unknown-${++unknown}`), skill=ensureSkill(subject,id,row.topicLabel||row.skillLabel||'مبحث نامشخص');
      row.subject=subject; row.subjectId=row.subjectId||subject; row.topicId=id; row.skillId=row.skillId||id; row.topicLabel=row.topicLabel||skill.topicLabel||skill.label; row.skillLabel=row.skillLabel||row.topicLabel;
    }
    return out;
  }
  const validateBeforeLegacyLayer = validateImport;
  validateImport = function(data) { return validateBeforeLegacyLayer(normalizeLegacyShape(clone(data))); };
  const migrateBeforeLegacyLayer = migrate;
  migrate = function(saved) { return normalizeLegacyShape(migrateBeforeLegacyLayer(saved)); };
  normalizeLegacyShape(state);

  const ensureMissions = data => {
    if (!data.learning) data.learning=learningDefaults();
    if (!Array.isArray(data.learning.missions)) data.learning.missions=[];
    for (const mission of data.learning.missions) {
      if (!mission||typeof mission!=='object') continue;
      const t=canonicalTopic(mission); mission.subject=t.subject; mission.subjectId=mission.subjectId||t.subject; mission.topicId=t.topicId; mission.topicLabel=t.topicLabel; mission.topicName=mission.topicName||t.topicLabel;
      mission.type=mission.type||'learning_mission'; mission.status=mission.status||'active'; mission.history=Array.isArray(mission.history)?mission.history:[];
    }
    return data;
  };
  const migrateBeforeMissions = migrate;
  migrate = function(saved) { return ensureMissions(migrateBeforeMissions(saved)); };
  ensureMissions(state);

  const observationsBeforeCanonical = getDirectObservations;
  getDirectObservations = function(data=state, f={}) {
    return observationsBeforeCanonical(data,f).map(row => { const t=canonicalTopic(row); return {...row,subjectId:row.subjectId||t.subject,topicId:t.topicId,topicLabel:t.topicLabel}; });
  };
  const latestRecordBeforeCanonical = latestRecord;
  latestRecord = function(id, f=filter) {
    const sessions=selectSessions(state,f);
    for(let i=sessions.length-1;i>=0;i--) {
      const session=sessions[i], record=session.records?.[id];
      if(!session.rosterIds.includes(id)||!record?.observed||record.attendance==='absent') continue;
      const t=canonicalTopic(session);
      return {...record,date:session.date,sequence:session.sequence,subject:session.subject,subjectId:session.subjectId||session.subject,skillId:session.skillId,skillLabel:session.skillLabel,topicId:t.topicId,topicLabel:t.topicLabel};
    }
    return null;
  };

  const pdStatsBeforeCanonical = pdStats;
  pdStats = function(data=state, f={}) {
    const result=pdStatsBeforeCanonical(data,f), latest=new Map();
    for(const row of result.obs||[]) if(row.observed!==false) latest.set(topicKey(row),row);
    const grouped=new Map();
    for(const row of latest.values()) {
      const t=canonicalTopic(row), key=`${t.subject}|${t.topicId}`;
      const out=grouped.get(key)||{topicId:t.topicId,topicLabel:t.topicLabel,subject:t.subject,red:0,yellow:0,green:0,observedStudents:0};
      if(out[row.status]!==undefined) out[row.status]++; out.observedStudents++; grouped.set(key,out);
    }
    result.latestTopicObservations=[...latest.values()]; result.topicStatus=[...grouped.values()].sort((a,b)=>a.subject.localeCompare(b.subject,'fa')||a.topicLabel.localeCompare(b.topicLabel,'fa')); return result;
  };

  function latestRows(studentId) {
    const latest=new Map();
    for(const row of getDirectObservations(state,{studentId,to:localISO()})) if(row.observed!==false) latest.set(topicKey(row),row);
    return [...latest.values()].sort((a,b)=>({red:0,yellow:1,green:2}[a.status]||9)-({red:0,yellow:1,green:2}[b.status]||9)||b.date.localeCompare(a.date));
  }
  function activeMissionFor(row) { return state.learning.missions.find(m=>m.status==='active'&&topicKey({...m,studentId:row.studentId})===topicKey(row)); }
  function missionBlocks(row) { return state.learning.missions.some(m=>topicKey({...m,studentId:row.studentId})===topicKey(row)&&(m.status==='active'||!m.resultAt||!row.date||row.date<=m.resultAt)); }
  function missionSuggestion(row) {
    const t=canonicalTopic(row), activity=allActivities().find(a=>(a.topicId||a.skillId)===t.topicId&&a.subject===t.subject);
    return {goal:row.status==='red'?'تشخیص مانع مفهوم با یک بررسی کوتاه':'تمرین هدفمند و سنجش مستقل',action:activity?.diagnosticPrompt||activity?.steps?.[0]||'یک سؤال مشابه را حل کند و راه‌حلش را با زبان خودش توضیح دهد.',successCriteria:activity?.exitCheck||'حل با حداکثر یک راهنمایی',activityId:activity?.id||'',t};
  }
  function saveMission(row) {
    if(activeMissionFor(row)){ui.toast('برای این مبحث مأموریت فعال وجود دارد.');return;}
    if(missionBlocks(row)){ui.toast('نتیجهٔ مأموریت قبلی ثبت شده؛ پس از مشاهدهٔ تازه مأموریت بعدی بساز.');return;}
    const s=studentById(row.studentId), p=missionSuggestion(row), m={id:'mission-'+uid(),type:'learning_mission',studentId:row.studentId,studentName:s?.name||row.name||'',subject:p.t.subject,subjectId:p.t.subject,topicId:p.t.topicId,topicLabel:p.t.topicLabel,topicName:p.t.topicLabel,goal:p.goal,action:p.action,successCriteria:p.successCriteria,activityId:p.activityId,createdAt:localISO(),dueAt:plusDays(localISO(),1),status:'active',cycle:'در حال حمایت',result:null,resultAt:'',resultNote:'',history:[]};
    ensureMissions(state).learning.missions.push(m); dirty=true; if(flushSave()){ui.toast('مأموریت فردا ساخته شد',{icon:'check'});rerender();}
  }
  function completeMission(id,result,note='') {
    const m=state.learning.missions.find(x=>x.id===id); if(!m||!RESULT_TEXT[result]) return;
    const cycle=result==='independent'?'بهبود یافته / وارد پایش':['guided','helped'].includes(result)?'در حال حمایت':['unable','avoided','access'].includes(result)?'نیازمند حمایت':result==='absent'||result==='unknown'?'اطلاعات کافی نیست':'در حال بررسی';
    m.result=result; m.resultAt=localISO(); m.resultNote=String(note||'').trim(); m.status='completed'; m.cycle=cycle; m.nextAction=result==='independent'?'مشاهدهٔ سبز جدید برای همین مبحث ثبت کن؛ سپس در پایش نگه دار.':result==='access'?'مانع دسترسی را با تکلیف کاغذی یا زمان مدرسه بررسی کن.':'روش را کوچک‌تر یا متفاوت کن و یک مشاهدهٔ مستقیم تازه ثبت کن.'; m.history.push({result,date:m.resultAt,note:m.resultNote}); dirty=true; if(flushSave()){ui.toast('نتیجهٔ مأموریت ذخیره شد',{icon:'check'});rerender();}
  }
  const missionResultOptions=[['','نتیجه را انتخاب کنید'],...Object.entries(RESULT_TEXT)];
  function missionCard(m) {
    const student=studentById(m.studentId), title=`${student?.name||m.studentName||'دانش‌آموز'} / ${m.subject} / ${m.topicLabel}`;
    return ui.card(`<h2>${esc(title)}</h2><p><b>هدف:</b> ${esc(m.goal)}</p><p><b>اقدام:</b> ${esc(m.action)}</p><p><b>معیار موفقیت:</b> ${esc(m.successCriteria)}</p>${m.status==='active'?`${ui.field('نتیجهٔ مأموریت',ui.select({value:'',options:missionResultOptions,onChange:v=>completeMission(m.id,v,document.getElementById('mission-note-'+m.id)?.value||'')}))}${ui.field('یادداشت نتیجه',ui.input({id:'mission-note-'+m.id,value:''}))}`:`<p><b>نتیجه:</b> ${esc(RESULT_TEXT[m.result]||'ثبت نشده')}؛ ${esc(m.cycle||'')}</p><p>${esc(m.nextAction||'')}</p>`}`);
  }
  function renderMissions() {
    const active=state.learning.missions.filter(m=>m.status==='active'), done=state.learning.missions.filter(m=>m.status!=='active'), suggestions=[];
    for(const st of activeStudents()) for(const row of latestRows(st.id)) if(['red','yellow'].includes(row.status)&&!missionBlocks(row)) suggestions.push(row);
    pulseMount('مأموریت فردا',note('هر مأموریت هدف، اقدام کوتاه، معیار موفقیت و نتیجهٔ قابل ثبت دارد. نتیجهٔ مأموریت به‌تنهایی جای مشاهدهٔ یادگیری را نمی‌گیرد.')+`${active.map(missionCard).join('')}${suggestions.length?`<section class="mission-suggestions"><h2>پیشنهاد ساخت مأموریت</h2>${suggestions.map(row=>ui.card(`<h3>${esc((studentById(row.studentId)?.name||'')+' / '+row.subject+' / '+row.topicLabel)}</h3><p>${STATUS_TEXT[row.status]}؛ آخرین مشاهده ${displayDay(row.date)}</p>${ui.btnPrimary('ساخت مأموریت فردا',()=>saveMission(row),{sm:true})}`)).join('')}</section>`:note('برای وضعیت‌های قرمز یا زردِ بدون مأموریت، موردی پیدا نشد.')}${done.length?`<details class="mission-history"><summary>تاریخچهٔ مأموریت‌ها (${fa(done.length)})</summary>${done.map(missionCard).join('')}</details>`:''}`);
  }
  function appendStudentMissions(id) {
    const root=document.getElementById('content'); if(!root)return; root.querySelector('.student-missions')?.remove();
    const rows=latestRows(id), missions=state.learning.missions.filter(m=>m.studentId===id), suggestions=rows.filter(r=>['red','yellow'].includes(r.status)&&!missionBlocks(r));
    const section=document.createElement('section');section.className='student-missions';section.innerHTML=`<h2>مأموریت فردا و نتیجه</h2><p class="sub">برای هر مبحث قرمز یا زرد یک اقدام کوچک و قابل سنجش بساز؛ نتیجه را جدا از مشاهدهٔ یادگیری نگه دار.</p>${missions.map(missionCard).join('')}${suggestions.map(row=>ui.card(`<h3>${esc(row.subject+' / '+row.topicLabel)}</h3><p>${STATUS_TEXT[row.status]} · آخرین مشاهده ${displayDay(row.date)}</p>${ui.btnTinted('ساخت مأموریت فردا',()=>saveMission(row),{sm:true})}`)).join('')||(!missions.length?'<p class="pd-empty-inline">مأموریت فعالی برای این دانش‌آموز ثبت نشده است.</p>':'')}`;root.append(section);
  }
  const renderStudentBeforeMissions=renderStudentLearning;
  renderStudentLearning=function(id){const result=renderStudentBeforeMissions.apply(this,arguments);appendStudentMissions(id);return result;};
  const oldToolLinks=pdToolLinks;
  pdToolLinks=function(){const html=oldToolLinks();return html.replace('<div class="pd-tools">','<div class="pd-tools"><a href="#/pulse/missions">'+icon('sparkles')+'<span>مأموریت فردا</span></a>');};
  ROUTES.unshift([/^#\/pulse\/missions$/,renderMissions]);

  function classProposal() {
    const obs=getDirectObservations(state,{from:plusDays(localISO(),-41),to:localISO()}), latest=new Map(), groups=new Map();
    for(const row of obs) if(row.observed!==false) latest.set(topicKey(row),row);
    for(const row of latest.values()) { const key=groupKey(row), g=groups.get(key)||{subject:row.subject,topicId:row.topicId||row.skillId,topicLabel:row.topicLabel||row.skillLabel,red:0,yellow:0,students:new Set(),history:0}; if(['red','yellow'].includes(row.status)){g[row.status]++;g.students.add(row.studentId);} groups.set(key,g); }
    const rows=[...groups.values()].filter(g=>g.red||g.yellow).sort((a,b)=>b.red*3+b.yellow-a.red*3-a.yellow||b.students.size-a.students.size); if(!rows.length)return null;
    const top=rows[0], activity=allActivities().find(a=>(a.topicId||a.skillId)===top.topicId&&a.subject===top.subject), names=[...top.students].map(id=>studentById(id)?.name).filter(Boolean); return {top,rows,activity,names};
  }
  function appendClassProposal() {
    const root=document.getElementById('content');if(!root)return;root.querySelector('.class-nextday-proposal')?.remove();const p=classProposal();if(!p)return;
    const {top,rows,activity,names}=p, action=activity?.steps?.slice(0,2).join('؛ ')||'۱۰ دقیقه مفهوم را با یک نمونهٔ تصویری مرور کن؛ سپس یک سؤال مشابه را مستقل بررسی کن.', success=activity?.exitCheck||'حداقل ۳ دانش‌آموز سؤال مشابه را با حداکثر یک راهنمایی حل کنند.';
    const section=document.createElement('section');section.className='class-nextday-proposal pd-panel';section.innerHTML=`<div class="pd-section-head"><div><h2>پیشنهاد تدریس فردا</h2><p>بر اساس آخرین مشاهدهٔ مستقیم، نه نبود داده</p></div><span class="pd-eyebrow">${fa(top.red)} قرمز · ${fa(top.yellow)} زرد</span></div><p><b>موضوع اصلی:</b> ${esc(top.subject+' / '+top.topicLabel)}</p><p><b>دلیل انتخاب:</b> ${fa(top.students.size)} دانش‌آموز در آخرین مشاهدهٔ این مبحث نیاز به حمایت دارند.</p><p><b>رویکرد پیشنهادی:</b> ${esc(action)}</p><p><b>دانش‌آموزان نیازمند توجه:</b> ${esc(names.join('، ')||'ثبت نشده')}</p><p><b>معیار سنجش:</b> ${esc(success)}</p><p><b>رویکرد جایگزین:</b> اگر این روش جواب نداد، مرحله‌ها را کوچک‌تر کن، پیش‌نیاز را بررسی کن و با سؤال ساده‌تر بازسنجی کن.</p>${rows.length>1?`<details><summary>مباحث بعدی برای اولویت‌بندی (${fa(rows.length-1)})</summary>${rows.slice(1,4).map(x=>`<p>${esc(x.subject+' / '+x.topicLabel)} — ${fa(x.red)} قرمز، ${fa(x.yellow)} زرد</p>`).join('')}</details>`:''}<div class="pulse-actions">${link('#/pulse/missions','ساخت مأموریت‌های فردا','sparkles')}</div>`;root.querySelector('.pd-controls')?.insertAdjacentElement('afterend',section)||root.prepend(section);
  }
  const renderTomorrowBeforeMissions=renderTomorrow;
  renderTomorrow=function(){const result=renderTomorrowBeforeMissions.apply(this,arguments);appendClassProposal();return result;};
  ROUTES.unshift([/^#\/pulse\/tomorrow$/,()=>renderTomorrow()]);
  const style=document.createElement('style');style.textContent='.student-missions{margin-top:14px}.student-missions>h2{margin:0 0 6px}.mission-suggestions h2{margin:18px 0 8px}.mission-history{margin-top:14px}.class-nextday-proposal{margin-top:14px}.class-nextday-proposal p{line-height:1.9}.mission-suggestions .card h3{margin:0 0 6px;font-size:15px}';document.head.appendChild(style);
 })();
