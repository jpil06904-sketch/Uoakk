
window.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const A = window.__mehryarTomorrowApi;
  if (!A || window.__mehryarTomorrowUi) return;
  window.__mehryarTomorrowUi = true;
  if (typeof route === 'function' && !document.getElementById('view')?.innerHTML.trim()) {
    try { if (typeof init === 'function') init(); route(); if (typeof revealPhotoApplication === 'function') revealPhotoApplication(); } catch (error) { console.error('mehryar startup fallback failed', error); }
  }

  const label = (map,key) => map[key] || key || 'ثبت نشده';
  const latestMission = id => state.learning.missions.filter(m=>(m.studentId||m.targetStudentId)===id).sort((a,b)=>(b.resultAt||b.createdAt||'').localeCompare(a.resultAt||a.createdAt||''))[0];
  const studentHypotheses = id => state.learning.hypotheses.filter(h=>h.studentId===id);
  const studentEvidence = id => state.learning.evidenceLog.filter(e=>e.studentId===id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  function dossier(id) {
    const st=studentById(id), rows=A.rowsForStudent(id), missions=state.learning.missions.filter(m=>(m.studentId||m.targetStudentId)===id), active=missions.find(m=>m.status==='active'), ev=studentEvidence(id), hyps=studentHypotheses(id), homework=A.homeworkForStudent(id), attendance=A.attendanceForStudent(id);
    const participation=state.learning.sessions.flatMap(s=>{const r=s.records?.[id];return r?.participation?[{date:s.date,value:r.participation}]:[]}).at(-1)?.value||'ثبت نشده';
    return {id,name:st?.name||'',learningByTopic:rows.map(r=>({subject:r.subject,topicId:r.topicId||r.skillId,topicLabel:r.topicLabel||r.skillLabel,status:r.status,statusLabel:STATUS_TEXT[r.status],date:r.date,errors:r.errors||[]})),homework,attendance,participation,lastObservation:rows.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]||null,confirmed:ev.filter(e=>e.certainty==='confirmed'&&e.category!=='mission_result'),reported:ev.filter(e=>e.certainty==='reported'),needsReview:ev.filter(e=>e.certainty==='needs_review'),hypotheses:hyps,missions,activeMission:active||null,lastMission:latestMission(id)||null,cycle:active?.cycle||hyps.some(h=>h.status==='active')?'نیازمند بررسی':'اطلاعات کافی نیست',nextAction:active?.nextAction||'یک مشاهدهٔ کوتاه و مستقیم در مبحث انتخاب‌شده ثبت کن.'};
  }
  function topicOptions(id) { return state.learning.skills.map(s=>[s.id,`${s.subject} / ${s.topicLabel||s.label}`]); }
  function openEvidenceSheet(id) {
    let topic=topicOptions(id)[0]?.[0]||'', certainty='reported';
    const sh=ui.sheet({title:'ثبت گزارش امروز بدون قضاوت',body:()=>`${note('واقعیت مستقیم، گفتهٔ دانش‌آموز/معلم و موضوع نیازمند بررسی جدا می‌مانند. علت را قطعی ننویس.')}${ui.field('مبحث',ui.select({value:topic,options:topicOptions(id),onChange:v=>{topic=v;sh.refresh();}}))}${ui.field('وضعیت اطلاعات',ui.select({value:certainty,options:Object.entries(A.INFO_STATE),onChange:v=>{certainty=v;sh.refresh();}}))}${ui.field('متن گزارش',ui.textarea({id:'inquiry-evidence-text',value:'',style:'min-height:130px',placeholder:'مثلاً: محمد می‌گوید درس خوانده، اما تکلیف تحویل نشده و آزمون ضعیف بوده.'}))}<p class="sub">در صورت انتخاب «قطعی»، فقط چیزی را بنویس که مستقیماً دیده‌ای یا چند بار ثبت شده است.</p>`,footer:ui.btnPrimary('ثبت گزارش',()=>{const text=read('inquiry-evidence-text').trim();const sk=skillById(topic);if(!text||!sk){ui.toast('مبحث و متن گزارش لازم است');return;}const e=A.addEvidence({studentId:id,subject:sk.subject,topicId:sk.id,topicLabel:sk.topicLabel||sk.label,certainty,category:'report',source:certainty==='confirmed'?'مشاهدهٔ مستقیم معلم':'گزارش معلم یا دانش‌آموز',text});A.seedHypotheses({studentId:id,subject:sk.subject,topicId:sk.id,topicLabel:sk.topicLabel||sk.label,note:text},e?.id);dirty=true;if(flushSave()){sh.close();rerender();}})});
  }
  function openHypothesisSheet(id) {
    let topic=topicOptions(id)[0]?.[0]||'', confidence='low';
    const sh=ui.sheet({title:'ثبت فرضیهٔ قابل بررسی',body:()=>`${note('فرضیه پاسخ قطعی نیست؛ فقط چیزی است که مأموریت بعدی باید آن را روشن‌تر کند.')}${ui.field('مبحث',ui.select({value:topic,options:topicOptions(id),onChange:v=>{topic=v;sh.refresh();}}))}${ui.field('سطح اطمینان',ui.select({value:confidence,options:Object.entries(A.CONFIDENCE),onChange:v=>{confidence=v;sh.refresh();}}))}${ui.field('فرضیه',ui.textarea({id:'inquiry-hypothesis-text',value:'',style:'min-height:100px',placeholder:'ممکن است مانع دسترسی یا ضعف پیش‌نیاز اثر گذاشته باشد.'}))}`,footer:ui.btnPrimary('ثبت فرضیه',()=>{const text=read('inquiry-hypothesis-text').trim(),sk=skillById(topic);if(!text||!sk){ui.toast('مبحث و متن فرضیه لازم است');return;}A.addHypothesis({studentId:id,subject:sk.subject,topicId:sk.id,topicLabel:sk.topicLabel||sk.label,text,confidence});dirty=true;if(flushSave()){sh.close();rerender();}})});
  }
  function statusChips(rows) { return rows.length?rows.map(r=>`<span class="inquiry-chip ${r.status}">${esc(r.subject+' / '+r.topicLabel)} · ${esc(r.statusLabel)}</span>`).join(''):'<span class="sub">مشاهدهٔ مستقیم مرتبط ثبت نشده است.</span>'; }
  function appendStudentMap(id) {
    const root=document.getElementById('content'); if(!root || !studentById(id)) return;
    root.querySelector('.inquiry-student-map')?.remove();
    const d=dossier(id), active=d.activeMission, hRows=d.hypotheses.length?d.hypotheses.map(h=>`<li><b>${esc(h.text)}</b><small>${label(A.HYPOTHESIS_STATE,h.status)} · اطمینان ${label(A.CONFIDENCE,h.confidence)}</small></li>`).join(''):'<li>هنوز فرضیهٔ فعالی ثبت نشده است.</li>';
    const facts=d.confirmed.slice(0,8).map(e=>`<li><b>${esc(e.text)}</b><small>${displayDay(e.date)} · ${esc(e.source)}</small></li>`).join('')||'<li>واقعیت قطعی جداگانه ثبت نشده است.</li>';
    const reports=d.reported.slice(0,8).map(e=>`<li><b>${esc(e.text)}</b><small>${displayDay(e.date)} · گزارش‌شده</small></li>`).join('')||'<li>گزارش تأییدنشده‌ای ثبت نشده است.</li>';
    const missions=d.missions||[];
    const section=document.createElement('section'); section.className='inquiry-student-map';
    section.innerHTML=`<div class="pd-panel"><div class="pd-section-head"><div><h2>نقشهٔ وضعیت و چرخهٔ اقدام</h2><p>رنگ یادگیری با تکلیف، حضور، گزارش یا نتیجهٔ مأموریت قاطی نمی‌شود.</p></div><span class="pd-eyebrow">${esc(d.cycle)}</span></div><div class="inquiry-actions">${ui.btnPrimary('ثبت گزارش امروز',()=>openEvidenceSheet(id),{sm:true})}${ui.btnTinted('افزودن فرضیه',()=>openHypothesisSheet(id),{sm:true})}${active?ui.btnGray('مأموریت فعال',()=>location.hash='#/pulse/missions',{sm:true}):''}</div><div class="inquiry-grid"><article><h3>یادگیری به تفکیک درس و مبحث</h3><div class="inquiry-chips">${statusChips(d.learningByTopic)}</div></article><article><h3>تکلیف / حضور / مشارکت</h3><p>تکلیف: کامل ${fa(d.homework.complete)} · ناقص ${fa(d.homework.partial)} · انجام‌نشده ${fa(d.homework.missing)}</p><p>حضور: حاضر ${fa(d.attendance.present)} · تأخیر ${fa(d.attendance.late)} · غیبت ${fa(d.attendance.absent)}</p><p>آخرین مشارکت: ${esc(d.participation)}</p></article></div><div class="inquiry-grid"><article><h3>واقعیت‌های قطعی</h3><ul class="inquiry-list">${facts}</ul></article><article><h3>گزارش‌های تأییدنشده</h3><ul class="inquiry-list">${reports}</ul></article></div><article><h3>فرضیه‌های فعال و سطح اطمینان</h3><ul class="inquiry-list">${hRows}</ul></article><article><h3>چرخهٔ مأموریت</h3>${active?A.missionCard(active):'<p class="sub">مأموریت فعالی وجود ندارد؛ برای وضعیت قرمز یا زرد از برگهٔ مأموریت فردا یک اقدام کوچک بساز.</p>'}${missions.length?`<details><summary>نتیجه‌های قبلی (${fa(missions.length)})</summary>${missions.filter(m=>m.status!=='active').slice().reverse().map(A.missionCard).join('')}</details>`:''}</article><p class="pd-footnote">اقدام پیشنهادی بعدی: ${esc(d.nextAction)} نتیجهٔ مأموریت به‌تنهایی وضعیت یادگیری را تغییر نمی‌دهد.</p></div>`;
    root.append(section);
  }
  function classPriority() {
    const groups=new Map();
    for (const st of activeStudents()) for (const row of A.rowsForStudent(st.id)) if(['red','yellow'].includes(row.status)) { const t=A.topicOf(row),key=`${t.subject}|${t.topicId}`,g=groups.get(key)||{subject:t.subject,topicId:t.topicId,topicLabel:t.topicLabel,red:0,yellow:0,students:[]};g[row.status]++;if(!g.students.includes(row.studentId))g.students.push(row.studentId);groups.set(key,g); }
    return [...groups.values()].sort((a,b)=>b.red*3+b.yellow-a.red*3-a.yellow||b.students.length-a.students.length)[0]||null;
  }
  function missionCandidates() {
    const rows=[]; for (const st of activeStudents()) for (const row of A.rowsForStudent(st.id)) if(['red','yellow'].includes(row.status)&&!state.learning.missions.some(m=>m.status==='active'&&A.inquiryKey(m)===A.inquiryKey(row))&&!A.suggestionFor(row).blocked) rows.push(row); return rows;
  }
  function renderMissionDesk() {
    const active=state.learning.missions.filter(m=>m.status==='active'), candidates=missionCandidates();
    pulseMount('مأموریت فردا',`<div class="pd-dashboard"><section class="pd-hero"><div><p>گزارش امروز → فرضیه → اقدام کوچک → نتیجه</p><h1>فردا یک چیز را روشن‌تر کن</h1><span>هیچ مأموریتی دربارهٔ شخصیت یا نیت دانش‌آموز قضاوت نمی‌کند.</span></div><div class="pd-hero-symbol">${icon('sparkles')}</div></section>${active.length?`<section class="pd-panel"><div class="pd-section-head"><h2>مأموریت‌های امروز</h2><span class="pd-count">${fa(active.length)}</span></div>${active.map(A.missionCard).join('')}</section>`:note('مأموریت فعالی وجود ندارد.')}${candidates.length?`<section class="pd-panel"><h2>پیشنهاد ساخت مأموریت</h2><p class="pd-footnote">نوع مأموریت بر اساس سابقهٔ تلاش‌ها تغییر می‌کند؛ راهکار تکراری با نام تازه ساخته نمی‌شود.</p>${candidates.map(row=>{const p=A.suggestionFor(row);return ui.card(`<h3>${esc((studentById(row.studentId)?.name||'')+' / '+row.subject+' / '+row.topicLabel)}</h3><p>${esc(p.reason||'')}</p><p class="sub">نوع پیشنهادی: ${esc(A.MISSION_TYPES[p.type]||'')}</p>${ui.btnPrimary('ساخت مأموریت',()=>A.createMission(row),{sm:true})}`);}).join('')}</section>`:note('برای وضعیت‌های قرمز و زردِ بدون مأموریت موردی پیدا نشد؛ نبود مشاهده به معنی ضعف نیست.')}${state.learning.missions.some(m=>m.status!=='active')?`<details class="pd-panel"><summary>تاریخچهٔ مأموریت‌ها</summary>${state.learning.missions.filter(m=>m.status!=='active').slice().reverse().map(A.missionCard).join('')}</details>`:''}</div>`);
  }
  function appendTomorrowBrief() {
    const root=document.getElementById('content'); if(!root) return; root.querySelector('.tomorrow-inquiry-brief')?.remove();
    const day=plusDays(localISO(),1), missions=state.learning.missions.filter(m=>m.status==='active'&&(!m.dueAt||m.dueAt<=day)), top=classPriority(), activity=top&&allActivities().find(a=>(a.topicId||a.skillId)===top.topicId&&a.subject===top.subject), common=top&&top.students.length>=2;
    const classHtml=top&&common?`<p><b>موضوع اصلی فردا:</b> ${esc(top.subject+' / '+top.topicLabel)}</p><p><b>دلیل انتخاب:</b> در آخرین مشاهدهٔ این مبحث، ${fa(top.red)} نفر قرمز و ${fa(top.yellow)} نفر زرد بوده‌اند؛ این فقط یک الگوی مشترک است، نه قضاوت کل کلاس.</p><p><b>مرور کوتاه:</b> ${esc(activity?.steps?.[0]||'یک مثال هم‌سطح را با زبان ساده و بدون زمان‌گیری مرور کن.')}</p><p><b>فعالیت پیشنهادی:</b> ${esc(activity?.steps?.slice(0,2).join('؛ ')||'یک سؤال مشابه را ابتدا با راهنمایی کوتاه و سپس مستقل اجرا کن.')}</p><p><b>توجه بیشتر:</b> ${esc(top.students.map(id=>studentById(id)?.name).filter(Boolean).join('، '))}</p><p><b>سنجش سریع پایان:</b> ${esc(activity?.exitCheck||'حداقل دو دانش‌آموز روش خود را توضیح دهند؛ نتیجهٔ مشاهده‌شده را ثبت کن.')}</p><p><b>راهکار جایگزین:</b> اگر پاسخ‌ها بهتر نشد، مرحله‌ها را کوچک‌تر کن و پیش‌نیاز را جدا بررسی کن.</p>`:note('برای پیشنهاد کل کلاس هنوز دست‌کم دو مشاهدهٔ مرتبط در یک مبحث نداریم؛ فردا یک سنجش کوتاه بگذار و نتیجه را ثبت کن.');
    const section=document.createElement('section');section.className='tomorrow-inquiry-brief pd-panel';section.innerHTML=`<div class="pd-section-head"><div><h2>دستیار فردای کلاس</h2><p>دو خروجی جدا: برای هر دانش‌آموز و برای کل کلاس</p></div><span class="pd-eyebrow">${displayDay(day)}</span></div><h3>مأموریت‌های امروز</h3>${missions.length?missions.map(A.missionCard).join(''):note('مأموریت موعددار برای فردا ثبت نشده است.')}${classHtml}<div class="pulse-actions">${link('#/pulse/missions','مدیریت همهٔ مأموریت‌ها','sparkles')}${link('#/pulse/quick','ثبت مشاهدهٔ نتیجه','pencil')}</div>`;
    root.querySelector('.pd-controls')?.insertAdjacentElement('afterend',section)||root.prepend(section);
  }

  const oldStudentRender=renderStudentLearning;
  renderStudentLearning=function(id){const result=oldStudentRender(id);appendStudentMap(id);return result;};
  function appendParticipation() {
    if (!/^#\/pulse\/(quick|session\/)/.test(location.hash) || typeof quickDraft==='undefined' || !quickDraft) return;
    for (const st of quickDraft.rosterIds.map(id=>studentById(id)).filter(Boolean)) {
      const row=document.getElementById('qr-'+st.id); if (!row || row.querySelector('.inquiry-participation')) continue;
      const r=quickDraft.records[st.id] ||= {}; const wrap=document.createElement('div'); wrap.className='inquiry-participation';
      wrap.innerHTML=ui.field('مشارکت کلاسی',ui.select({value:r.participation||'none',options:[['none','ثبت نشود'],['engaged','مشارکت داشت'],['quiet','کم‌حرف یا مشاهده‌نشده'],['needs_support','نیازمند فرصت کم‌فشار']],onChange:v=>{r.participation=v;draftChanged();}}));
      row.querySelector('details')?.append(wrap);
    }
  }
  const oldQuickRender=renderQuick;
  renderQuick=function(){const result=oldQuickRender.apply(this,arguments);appendParticipation();return result;};
  const oldTomorrowRender=renderTomorrow;
  renderTomorrow=function(){const result=oldTomorrowRender();appendTomorrowBrief();return result;};
  ROUTES.unshift([/^#\/pulse\/missions$/,renderMissionDesk]);
  if (typeof pdToolLinks==='function') { const oldLinks=pdToolLinks; pdToolLinks=()=>oldLinks().replace('<div class="pd-tools">','<div class="pd-tools"><a href="#/pulse/missions">'+icon('sparkles')+'<span>مأموریت فردا</span></a>'); }

  const baseRead=MehryarTools.read;
  MehryarTools.read=function(args={}) {
    const section=args.section;
    if (['evidence','hypotheses','missions','studentMap'].includes(section)) {
      const id=args.studentId ? studentById(args.studentId)?.id : null, rows=id?[dossier(id)]:activeStudents().slice(0,12).map(s=>dossier(s.id));
      if (section==='studentMap') return {section,items:rows,total:rows.length};
      const all=section==='evidence'?state.learning.evidenceLog:section==='hypotheses'?state.learning.hypotheses:state.learning.missions;
      const filtered=all.filter(x=>!id||(x.studentId||x.targetStudentId)===id).slice(-60); return {section,total:filtered.length,items:clone(filtered),rules:'قطعی، گزارش‌شده، احتمالی و نیازمند بررسی از هم جدا هستند؛ فرضیه هرگز مشاهدهٔ قطعی نیست.'};
    }
    const out=baseRead(args); if (out && ['summary','lessonContext'].includes(out.section)) out.inquiryCycle={evidenceStates:Object.values(A.INFO_STATE),activeMissions:state.learning.missions.filter(m=>m.status==='active').length,activeHypotheses:state.learning.hypotheses.filter(h=>h.status==='active').length,rules:'گزارش را به واقعیت‌های جدا، ابهام‌ها و فرضیه‌های ممکن تبدیل کن؛ علت و شخصیت را قطعی نکن. نتیجهٔ مأموریت رنگ یادگیری را تغییر نمی‌دهد مگر مشاهدهٔ مستقیم تازه ثبت شود.'}; return out;
  };
  const readDecl=MehryarTools.declarations?.find(x=>x.name==='read_class_data');
  if (readDecl) { for (const s of ['evidence','hypotheses','missions','studentMap']) if (!readDecl.parameters.properties.section.enum.includes(s)) readDecl.parameters.properties.section.enum.push(s); readDecl.description+=' داده‌های چرخهٔ دستیار فردای کلاس نیز در بخش‌های evidence/hypotheses/missions/studentMap موجودند؛ قطعی را با گزارش یا فرضیه قاطی نکن.'; }
  const commitBefore=MehryarTools.commit;
  MehryarTools.commit=function(){const result=commitBefore();A.captureDirectEvidence(state);flushSave();return result;};
  A.captureDirectEvidence(state); dirty=true; flushSave();
  const style=document.createElement('style');style.textContent='.inquiry-student-map,.tomorrow-inquiry-brief{margin-top:14px}.inquiry-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.inquiry-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.inquiry-grid>article{border:1px solid var(--sep);border-radius:14px;padding:12px}.inquiry-grid h3{font-size:14px;margin-bottom:8px}.inquiry-list{margin:0;padding:0 20px 0 0}.inquiry-list li{margin:7px 0}.inquiry-list small{display:block;color:var(--muted);font-size:11px}.inquiry-chips{display:flex;gap:6px;flex-wrap:wrap}.inquiry-chip,.mission-type{display:inline-block;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:700;background:var(--card2)}.inquiry-chip.red{color:var(--red)}.inquiry-chip.yellow{color:var(--orange)}.inquiry-chip.green{color:var(--primary)}.mission-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.mission-head h2{margin:0}.tomorrow-inquiry-brief h3{margin-top:16px}@media(max-width:700px){.inquiry-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
});
setTimeout(() => {
  if (typeof init === 'function' && document.getElementById('view') && !document.getElementById('view').innerHTML.trim()) {
    try { init(); route(); revealPhotoApplication(); } catch (error) { console.error('mehryar delayed startup failed', error); }
  }
}, 250);
