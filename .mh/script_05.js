
/* Mehryar tool bridge, September 2026. No credentials or executable model output. */
const MehryarTools = (() => {
  'use strict';
  const validateBeforeReports=validateImport;
  validateImport=function(data){
    validateBeforeReports(data);
    const rows=data.learning?.teachingReports;if(rows===undefined)return true;
    if(!Array.isArray(rows))throw Error('ساختار گزارش تدریس معتبر نیست.');
    const ids=new Set();for(const r of rows){if(!isObj(r)||typeof r.id!=='string'||!/^[\w-]+$/.test(r.id)||ids.has(r.id)||!validDay(r.date)||typeof r.text!=='string'||!r.text.trim()||r.text.length>2000||!data.learning.skills.some(s=>s.id===r.skillId&&s.subject===r.subject)||r.grade&&!PD_GRADES.includes(r.grade))throw Error('گزارش تدریس نامعتبر است.');ids.add(r.id);for(const k of ['worked','difficulty','nextStep'])if(r[k]!==undefined&&(typeof r[k]!=='string'||r[k].length>2000))throw Error('متن گزارش تدریس معتبر نیست.');}
    return true;
  };
  let proposal = null, undoRecord = null;
  const labels = {observation:'مشاهدهٔ یادگیری',homework:'تکلیف',attendance:'حضور و غیاب',followup:'پیگیری',shortage:'وسایل',assessment:'سنجش آغازین',responsibility:'مسئولیت',agreement:'قول کلاس',parentMeeting:'جلسهٔ اولیا',studentNote:'یادداشت معلم',studentAdd:'افزودن دانش‌آموز',studentUpdate:'ویرایش دانش‌آموز',followupUpdate:'اصلاح پیگیری',parentMeetingUpdate:'اصلاح جلسهٔ اولیا',skillAdd:'افزودن مهارت',plan7Task:'کار برنامهٔ هفت‌روزه'};
  const sections = ['summary','students','skills','observations','latestLearning','attendance','followups','shortages','assessments','studentNotes','activities','plans','responsibilities','agreements','parentMeetings','lists','messages','tools','sessions','lessonContext','teachingReports','homework'];
  Object.assign(labels,{dailyPlan:'طرح درس و برنامهٔ فردا',activity:'فعالیت آموزشی',teachingReport:'گزارش تجربهٔ تدریس'});
  const routes = [['#/students','دانش‌آموزان'],['#/pulse','نبض‌کلاس'],['#/pulse/quick','ثبت مشاهده'],['#/pulse/attendance','حضور و غیاب روزانه'],['#/pulse/att-stats','آمار ماهانه'],['#/pulse/followups','پیگیری'],['#/pulse/activities','بانک فعالیت'],['#/pulse/tomorrow','برنامهٔ فردا'],['#/pulse/paths','گروه‌های یادگیری'],['#/pulse/radar','فرصت توجه'],['#/pulse/sessions','جلسه‌ها'],['#/pulse/week','گزارش هفته'],['#/pulse/actions','کارتابل اقدام'],['#/pulse/plan','برنامهٔ جلسهٔ بعد'],['#/pulse/week-digest','خلاصهٔ هفته'],...EXTRA_LINKS.map(([r,t])=>['#/pulse/'+r,t])];
  const catalog = () => [...routes.map(([href,title])=>({href,title})),...OUTPUTS.map(t=>({href:'#/output/'+t.key,title:t.title}))];
  const fail = text => { throw new Error(text); };
  const text = (value, title, optional=false) => {
    if (optional && (value === undefined || value === '')) return '';
    if (typeof value !== 'string' || !value.trim() || value.length > 2000) fail(title+' را روشن و حداکثر ۲۰۰۰ نویسه وارد کن.');
    return value.trim();
  };
  const choice = (value, values, title) => values.includes(value) ? value : fail(title+' معتبر نیست.');
  function day(value, fallback) {
    let d = value === undefined || value === '' ? fallback : value;
    if(typeof d==='string'){
      const relative={امروز:0,دیروز:-1,پریروز:-2,فردا:1,پسفردا:2},key=normKey(d);
      if(Object.hasOwn(relative,key))d=plusDays(localISO(),relative[key]);
      else {d=persianDigitsToLatin(d);if(/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(d))d=parsePersianDate(d).iso;}
    }
    if (!validDay(d) || +d.slice(0,4)<1900 || +d.slice(0,4)>2200) fail('تاریخ روشن لازم است: میلادی YYYY-MM-DD، شمسی YYYY/MM/DD یا امروز/دیروز/پریروز/فردا/پس‌فردا. تاریخ مبهم را از معلم بپرس.');
    return d;
  }
  function student(value, data=state) {
    const query = text(value,'دانش‌آموز');
    const exact=data.students.find(s=>s.id===query);if(exact)return exact;
    const hits = data.students.filter(s=>normKey(s.name)===normKey(query));
    if (hits.length !== 1) fail(hits.length ? 'نام تکراری است؛ شناسهٔ دانش‌آموز را از فهرست بگیر و از معلم بپرس کدام نفر.' : 'دانش‌آموز پیدا نشد؛ نام کامل یا شناسهٔ واقعی لازم است.');
    return hits[0];
  }
  function skill(value, subject, data=state) {
    const query = text(value,'مهارت');
    const hits = data.learning.skills.filter(s=>(s.id===query || normKey(s.label)===normKey(query))&&(!subject||s.subject===subject));
    if (hits.length!==1) fail('مهارت پیدا نشد یا مبهم است؛ از فهرست مهارت‌ها شناسهٔ دقیق را بگیر. مهارت تازه فقط با درخواست روشن معلم ساخته شود.');
    return hits[0];
  }
   const domain = data => JSON.stringify({klass:data.klass,curriculum:data.curriculum,students:data.students,fields:data.fields,lists:data.lists,learning:data.learning,meeting:data.meeting,messages:data.messages,plan7:data.plan7,outputSettings:data.outputSettings});
  // Complete counts, bounded evidence samples. Teacher reports never become measured outcomes.
  function lessonContext(f,roster,observations,page) {
    const from=f.from||plusDays(f.to,-41), obs=observations.filter(o=>o.date>=from);
     const ids=new Set(roster.map(s=>s.id)), bySkill=new Map(), clipped=v=>String(v||'').slice(0,500), topicKey=o=>o.studentId+'|'+(o.subject||'')+'|'+(o.topicId||o.skillId);
    const groups=new Map();
     for(const o of obs){const key=topicKey(o);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o);}
    for(const history of groups.values()) {
      const last=history.at(-1), days=[...new Map(history.map(o=>[o.date,o])).values()];
       const rowKey=(last.subject||'')+'|'+(last.topicId||last.skillId);if(!bySkill.has(rowKey))bySkill.set(rowKey,{skillId:last.skillId,topicId:last.topicId||last.skillId,skill:last.topicLabel||last.skillLabel,subject:last.subject,students:[],errors:new Map()});
       const row=bySkill.get(rowKey);
      row.students.push({studentId:last.studentId,name:student(last.studentId).name,grade:pdStudentGrade(state,last.studentId),latestStatus:last.status,lastDate:last.date,observedDays:days.length,trend:getStudentTrend(days).key,evidence:days.slice(-3).map(o=>({sessionId:o.sessionId,date:o.date,status:o.status,errors:o.errors.slice(0,4).map(clipped),note:clipped(o.note)}))});
      for(const o of history)for(const error of new Set(o.errors)){if(!row.errors.has(error))row.errors.set(error,{ids:new Set(),days:new Set(),sessions:new Set()});const e=row.errors.get(error);e.ids.add(o.studentId);e.days.add(o.date);e.sessions.add(o.sessionId);}
    }
    const followups=state.learning.followups.filter(x=>ids.has(x.studentId)&&(!f.skillId||x.skillId===f.skillId)&&(!f.subject||x.subject===f.subject)&&(!x.createdOn||x.createdOn<=f.to));
    const reports=(state.learning.teachingReports||[]).filter(x=>x.date>=from&&x.date<=f.to&&(!f.skillId||x.skillId===f.skillId)&&(!f.subject||x.subject===f.subject)&&(!f.grade||!x.grade||x.grade===f.grade));
     for(const x of [...followups,...reports]){const sk=skill(x.skillId),rowKey=(x.subject||sk.subject||'')+'|'+(x.topicId||sk.id);if(!bySkill.has(rowKey))bySkill.set(rowKey,{skillId:sk.id,topicId:x.topicId||sk.id,skill:x.topicLabel||sk.label,subject:x.subject||sk.subject,students:[],errors:new Map()});}
    const activities=allActivities(), rows=[];
    for(const row of bySkill.values()) {
      const colors={red:0,yellow:0,green:0}, trends={improved:0,declined:0,unchanged:0,unknown:0};
      for(const s of row.students){colors[s.latestStatus]++;trends[s.trend]++;}
      const fs=followups.filter(x=>x.skillId===row.skillId), due=fs.filter(x=>x.dueOn<=f.to&&x.status!=='closed'&&(x.status!=='done'||x.outcome==='unchecked'));
      const latestDate=row.students.map(s=>s.lastDate).sort().at(-1);
      const evidenceSummary=row.skill+': از '+fa(roster.length)+' دانش‌آموز، '+fa(row.students.length)+' نفر مشاهدهٔ مرتبط دارند؛ '+fa(colors.red)+' نفر نیازمند آموزش دوباره، '+fa(colors.yellow)+' نفر نیازمند تمرین و '+fa(colors.green)+' نفر در آخرین مشاهده یاد گرفته‌اند. جمع نیازمند آموزش یا تمرین: '+fa(colors.red+colors.yellow)+' نفر. بدون مشاهدهٔ مرتبط: '+fa(roster.length-row.students.length)+' نفر، نه الزاماً ضعیف. آخرین مشاهده: '+(latestDate?displayDay(latestDate):'ندارد')+'. روند روزهای متفاوت: بهبود '+fa(trends.improved)+'، افت '+fa(trends.declined)+'، بدون تغییر '+fa(trends.unchanged)+'، نامعلوم '+fa(trends.unknown)+'.';
      const evidence=row.students.sort((a,b)=>({red:0,yellow:1,green:2}[a.latestStatus]-{red:0,yellow:1,green:2}[b.latestStatus])||b.lastDate.localeCompare(a.lastDate)).slice(0,8);
      const rs=reports.filter(x=>x.skillId===row.skillId).sort((a,b)=>b.date.localeCompare(a.date));
       rows.push({skillId:row.skillId,topicId:row.topicId,skill:row.skill,subject:row.subject,evidenceSummary,needsPracticeStudents:colors.red+colors.yellow,lastObservationDate:latestDate||null,lastObservationDatePersian:latestDate?displayDay(latestDate):null,observedStudents:row.students.length,unobservedStudents:roster.length-row.students.length,coverage:roster.length?Math.round(row.students.length/roster.length*100):0,colors,trends,dueFollowups:due.length,
        evidence,evidenceSampled:row.students.length>evidence.length,
        recurringErrors:[...row.errors].map(([error,e])=>({error:clipped(error),students:e.ids.size,days:e.days.size,sessionIds:[...e.sessions].slice(-3)})).sort((a,b)=>b.students-a.students||b.days-a.days).slice(0,5),
        followupTotal:fs.length,followups:[...due,...fs.filter(x=>!due.includes(x)).sort((a,b)=>(b.completedOn||b.createdOn||'').localeCompare(a.completedOn||a.createdOn||''))].slice(0,5).map(x=>({id:x.id,studentId:x.studentId,action:clipped(x.action),createdOn:x.createdOn,dueOn:x.dueOn,dueOnPersian:displayDay(x.dueOn),timing:x.dueOn===f.to?'موعد امروز':x.dueOn<f.to?'موعد گذشته':'موعد آینده',status:x.status,statusText:FOLLOW_STATUS[x.status],outcome:x.outcome,outcomeText:FOLLOW_OUTCOME[x.outcome],recheckSessionId:x.recheckSessionId||null,note:clipped(x.note)})),
        teacherReportTotal:rs.length,teacherReports:rs.slice(0,4).map(x=>({...x,text:clipped(x.text),worked:clipped(x.worked),difficulty:clipped(x.difficulty),nextStep:clipped(x.nextStep),evidenceType:'teacher_report_not_independent_measurement'})),
        activities:activities.filter(a=>a.skillId===row.skillId&&(f.grade?a.grades.includes(f.grade):roster.some(s=>a.grades.includes(pdStudentGrade(state,s.id))))).slice(0,2).map(a=>({id:a.id,title:a.title,grades:a.grades,materials:a.materials,durationMinutes:a.durationMinutes,diagnosticPrompt:a.diagnosticPrompt,practice:a.practice,exitCheck:a.exitCheck})),
        priority:colors.red*3+colors.yellow+trends.declined*2+due.length*2});
    }
    rows.sort((a,b)=>b.priority-a.priority||b.teacherReportTotal-a.teacherReportTotal||b.observedStudents-a.observedStudents||a.skillId.localeCompare(b.skillId));
    const plans=state.learning.dailyPlans.filter(x=>(!f.skillId||x.skillId===f.skillId)&&(!f.subject||x.subject===f.subject)&&(!f.grade||x.grade===f.grade)).sort((a,b)=>b.date.localeCompare(a.date));
    return {section:'lessonContext',range:{from,to:f.to},demo:demoMode,activeStudents:roster.length,grades:[...new Set(roster.map(s=>pdStudentGrade(state,s.id)))],
      ...page(rows),recentPlans:plans.slice(0,4).map(p=>({id:p.id,date:p.date,skillId:p.skillId,grade:p.grade,minutes:p.minutes,materials:clipped(p.materials),activityText:clipped(p.activityText),exitCheck:clipped(p.exitCheck)})),totalPlans:plans.length,
      rules:'ترتیب اولویت، قاعدهٔ قابل توضیح برای توجه آموزشی است نه پیش‌بینی آماری. شمارش‌ها کامل؛ شواهد، گزارش‌ها و فعالیت‌ها نمونهٔ محدودند. برای جزئیات از observations/teachingReports/followups/plans/paths بخوان. روند فقط از آخرین مشاهدهٔ روزهای متفاوت است. نبود مشاهده ضعف نیست. گزارش معلم و برنامهٔ اجرا نشده نتیجهٔ اثبات‌شده نیستند. پوشش کم یا سابقهٔ قدیمی را صریح بگو. غیبت امروز پیش‌بینی غیبت فردا نیست.'};
  }
  function read(args={}) {
    assertSafeTree(args);
    const section=choice(args.section||'summary',sections,'بخش'), f={};
    if (args.from) f.from=day(args.from);
    f.to=args.to?day(args.to):localISO();
    if (f.to>localISO()) f.to=localISO();
    if (f.from && f.from>f.to) fail('ابتدای بازه بعد از انتهای آن است.');
    if (args.grade) f.grade=choice(args.grade,PD_GRADES,'پایه');
    if (args.subject) f.subject=choice(args.subject,SUBJECTS,'درس');
    if (args.skillId) f.skillId=skill(args.skillId,f.subject).id;
    if (args.studentId) {
      f.studentId=student(args.studentId).id;
      if(['lessonContext','teachingReports'].includes(section)){
        const grade=pdStudentGrade(state,f.studentId);
        if(f.grade&&grade!==f.grade)fail('پایه با دانش‌آموز انتخاب‌شده سازگار نیست.');
        if(grade)f.grade=grade;
      }
    }
    const roster=pdRoster(state,f).filter(s=>!f.studentId||s.id===f.studentId), ids=new Set(roster.map(s=>s.id));
    const inRange=d=>(!f.from||d>=f.from)&&d<=f.to;
    const observations=()=>getDirectObservations(state,f).filter(o=>ids.has(o.studentId)&&(!validDay(state.learning.studentMeta[o.studentId]?.enrolledOn)||o.date>=state.learning.studentMeta[o.studentId].enrolledOn));
    const page = rows => {
      const offset=Number.isInteger(args.offset)&&args.offset>=0?args.offset:0, limit=Number.isInteger(args.limit)?clamp(args.limit,1,100):40;
      return {section,total:rows.length,offset,items:clone(rows.slice(offset,offset+limit)),nextOffset:offset+limit<rows.length?offset+limit:null};
    };
    if(section==='lessonContext')return lessonContext(f,roster,observations(),page);
    if(section==='teachingReports')return page((state.learning.teachingReports||[]).filter(x=>inRange(x.date)&&(!f.grade||!x.grade||x.grade===f.grade)&&(!f.subject||x.subject===f.subject)&&(!f.skillId||x.skillId===f.skillId)).sort((a,b)=>b.date.localeCompare(a.date)));
    if(section==='homework')return page(selectSessions(state,f).reverse().flatMap(s=>s.rosterIds.filter(id=>ids.has(id)&&(!validDay(state.learning.studentMeta[id]?.enrolledOn)||s.date>=state.learning.studentMeta[id].enrolledOn)).flatMap(id=>{const r=s.records[id];return r&&r.homework!=='none'?[{sessionId:s.id,date:s.date,studentId:id,skillId:s.skillId,homework:r.homework,note:r.note||'',observed:r.observed}]:[];})));
    if (section==='summary') {
      const obs=observations(), latest=new Map();
       for(const o of obs) latest.set(o.studentId+'|'+(o.subject||'')+'|'+(o.topicId||o.skillId),o);
      const rows=[...latest.values()], colors={}, perSkill=Object.create(null);
      for(const c of ['red','yellow','green']) {
        const colored=rows.filter(r=>r.status===c), colorIds=new Set(colored.map(r=>r.studentId));
        colors[c]={students:colorIds.size,skillRecords:colored.length};
      }
      for(const r of rows) {
         const key=(r.subject||'')+'|'+(r.topicId||r.skillId),k=perSkill[key] ||= {skillId:r.skillId,topicId:r.topicId||r.skillId,skill:r.topicLabel||r.skillLabel,subject:r.subject,red:0,yellow:0,green:0};
        k[r.status]++;
      }
      const att={present:0,absent:0,late:0,unrecorded:0};
      for(const s of roster) att[state.learning.attendanceDays?.[f.to]?.[s.id]||'unrecorded']++;
      return {section,asOf:localISO(),range:f,demo:demoMode,activeStudents:roster.length,totalStoredStudents:state.students.length,archived:state.students.filter(s=>state.learning.studentMeta[s.id]?.archived).length,observations:obs.length,observedStudents:new Set(obs.map(r=>r.studentId)).size,unobservedStudents:roster.length-new Set(obs.map(r=>r.studentId)).size,colors,perSkill:Object.values(perSkill),attendanceOnEndDate:att,dueFollowups:state.learning.followups.filter(x=>ids.has(x.studentId)&&x.dueOn<=f.to&&x.status!=='closed'&&(x.status!=='done'||x.outcome==='unchecked')).length,definition:'رنگ‌ها از آخرین مشاهدهٔ مستقیم هر دانش‌آموز در هر مهارت در بازه‌اند. یک نفر ممکن است در دو مهارت دو رنگ داشته باشد؛ جمع رنگ‌ها تعداد کلاس نیست. روز آینده، بایگانی و مشاهده‌نشده حذف‌اند. بدون from یعنی کل سابقه تا امروز. حضور مستقل از یادگیری است.'};
    }
    if(section==='students') {
      if(args.includeArchived!==undefined&&typeof args.includeArchived!=='boolean')fail('انتخاب بایگانی معتبر نیست.');
      const students=args.includeArchived?state.students.filter(s=>(!f.grade||pdStudentGrade(state,s.id)===f.grade)&&(!f.studentId||s.id===f.studentId)):roster;
      return page(students.map(s=>({id:s.id,no:s.no,name:s.name,grade:pdStudentGrade(state,s.id),enrolledOn:state.learning.studentMeta[s.id]?.enrolledOn,archived:!!state.learning.studentMeta[s.id]?.archived})));
    }
    if(section==='skills') return page(state.learning.skills.filter(s=>!f.subject||s.subject===f.subject));
    if(section==='observations') return page(observations().reverse());
    if(section==='sessions') return page(selectSessions(state,f).filter(s=>s.rosterIds.some(id=>ids.has(id))).reverse().map(s=>({id:s.id,date:s.date,subject:s.subject,skillId:s.skillId,skillLabel:s.skillLabel,lessonTitle:s.lessonTitle,rosterIds:s.rosterIds.filter(id=>ids.has(id))})));
    if(section==='latestLearning') {
      if(args.status)choice(args.status,['red','yellow','green'],'رنگ');
       const latest=new Map();for(const o of observations())latest.set(o.studentId+'|'+(o.subject||'')+'|'+(o.topicId||o.skillId),o);
      return page([...latest.values()].filter(o=>!args.status||o.status===args.status).map(o=>({...o,name:studentById(o.studentId).name})));
    }
     if(section==='attendance') return page(Object.entries(state.learning.attendanceDays||{}).filter(([d])=>inRange(d)).sort(([a],[b])=>b.localeCompare(a)).flatMap(([date,records])=>Object.entries(records).filter(([id])=>ids.has(id)).map(([studentId,status])=>({date,studentId,name:studentById(studentId)?.name||'نامشخص',grade:pdStudentGrade(state,studentId),status}))));
    if(section==='followups') return page(state.learning.followups.filter(x=>ids.has(x.studentId)&&(!f.skillId||x.skillId===f.skillId)&&(!f.subject||x.subject===f.subject)));
    if(section==='shortages') return page(roster.map(s=>({studentId:s.id,name:s.name,items:s.shortage})));
    if(section==='assessments') return {levels:LEVELS,skills:ASSESS_SKILLS,...page(roster.map(s=>({studentId:s.id,name:s.name,assess:s.assess})))};
    if(section==='studentNotes') return page(roster.map(s=>({studentId:s.id,note:s.data.note||''})));
    if(section==='activities') return page(allActivities().filter(x=>(!f.grade||x.grades.includes(f.grade))&&(!f.skillId||x.skillId===f.skillId)&&(!f.subject||x.subject===f.subject)));
    if(section==='plans') return page(state.learning.dailyPlans.filter(x=>(!f.grade||x.grade===f.grade)&&(!f.skillId||x.skillId===f.skillId)));
    if(section==='responsibilities') return {roles:state.learning.responsibilityRoles,...page(state.learning.responsibilityHistory.filter(x=>ids.has(x.studentId)&&inRange(x.date)))};
    if(section==='agreements') return page(state.learning.classAgreements);
    if(section==='parentMeetings') return page(state.learning.parentMeetings.filter(x=>ids.has(x.studentId)&&inRange(x.date)));
    if(section==='lists') return {section,lists:clone(state.lists),plan7:clone(state.plan7)};
    if(section==='messages') return page(state.messages.filter(x=>!x.deleted));
    if(section==='outputSettings') {
      if(!args.outputKey)return page(OUTPUTS.map(t=>({outputKey:t.key,title:t.title,perStudent:!!t.perStudent})));
      const s=outputConfig(args.outputKey);return {section,outputKey:args.outputKey,settings:Object.fromEntries([...printBools,'fontSize','sortBy','extraBlank','selectedIds'].map(k=>[k,s[k]])),customizedTextKeys:Object.keys(s.texts||{}),textKeys:printTextKeys(args.outputKey),notice:'متن آزاد عنوان، امضا و چاپ فقط محلی است و به مدل ارسال نمی‌شود.'};
    }
    if(['settings','paths','bag'].includes(section))return extraRead(section,args,f,page);
    return page(catalog());
  }
  // These operations share the original preview, validation and atomic commit.
  const extraTypes = ['classSettings','learningSettings','listItem','pathMove','bagCheck','messageTemplate','curriculumBudget'];
  Object.assign(labels,{classSettings:'تنظیمات کلاس',learningSettings:'تنظیمات یادگیری',listItem:'ویرایش فهرست',pathMove:'گروه یادگیری',bagCheck:'کیف فردا',messageTemplate:'قالب پیام',curriculumBudget:'بودجه‌بندی آموزشی'});
  sections.push('settings','paths','bag','outputSettings');
  extraTypes.push('outputSettings');labels.outputSettings='تنظیمات چاپ';
  const weekdays=['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const listLabels={books:'کتاب‌ها',firstDayItems:'وسایل روز اول',weekItems:'وسایل هفته',responsibilityRoles:'نقش‌های کلاس'};
  function bagItems(data,date) {
    const activities=ACTIVITY_BANK.map(a=>data.learning.customActivities.find(x=>x.overrides===a.id)||a).concat(data.learning.customActivities.filter(a=>!a.overrides));
    return [...new Set(data.learning.dailyPlans.filter(p=>p.date===date).flatMap(p=>[...p.materials.split(/[،,]/).map(x=>x.trim()).filter(Boolean),...p.activityIds.map(id=>'فعالیت: '+(activities.find(a=>a.id===id)?.title||id))]))].concat(data.learning.followups.filter(f=>f.dueOn===date&&f.status!=='closed').map(f=>'اقدام: '+(data.students.find(s=>s.id===f.studentId)?.name||'')+' — '+f.action));
  }
  function extraRead(section,args,f,page) {
    if(section==='settings')return {section,klass:Object.fromEntries(['teacher','school','grade','className','year'].map(k=>[k,state.klass[k]])),trackingStartedOn:state.learning.trackingStartedOn,settings:clone(state.learning.settings),lists:clone(state.lists),roles:clone(state.learning.responsibilityRoles),weekdays};
    if(section==='paths') {
      if(!f.skillId)fail('برای گروه‌های یادگیری، شناسهٔ مهارت لازم است.');
      const sk=skill(f.skillId),groups=buildLearningPaths({...f,subject:sk.subject});
      return page(Object.entries(groups).flatMap(([group,rows])=>rows.filter(x=>!f.studentId||x.student.id===f.studentId).map(x=>{const attendance=state.learning.attendanceDays?.[f.to]?.[x.student.id];return {studentId:x.student.id,name:x.student.name,group:attendance==='absent'?'absent':group,manual:attendance==='absent'?false:x.manual,reason:attendance==='absent'?'غیبت روزانه در تاریخ بررسی':x.reason,skillId:sk.id,asOf:f.to};})));
    }
    if(section==='bag') {
      const date=day(args.date,plusDays(localISO(),1));
      return {date,...page(bagItems(state,date).map(item=>({item,done:!!state.learning.bagChecks[date]?.[item]})))};
    }
  }
  function extraPrepare(c,next,st,date) {
    const l=next.learning,fields=[];
    const bounded=(v,min,max,title)=>Number.isInteger(v)&&v>=min&&v<=max?v:fail(title+' باید عدد صحیح '+min+' تا '+max+' باشد.');
    const bool=v=>typeof v==='boolean'?v:fail('وضعیت باید بله یا خیر باشد.');
    const patch=(p,keys)=>{if(!isObj(p)||!Object.keys(p).length||Object.keys(p).some(k=>!keys.includes(k)))fail('تنظیمات خالی یا دارای گزینهٔ پشتیبانی‌نشده است.');return p;};
    const set=(obj,k,v,title)=>{fields.push(title+': '+(Array.isArray(obj[k])?obj[k].join('، '):obj[k]??'خالی')+' ← '+(Array.isArray(v)?v.join('، '):v));obj[k]=v;};
    let href='#/settings/learning';
    if(c.type==='curriculumBudget') {
      const runtime=window.__mehryarCurriculumRuntime,result=runtime?.prepareBudgetChange(next,c.budget);
      if(!result)fail('ابزار نقشهٔ آموزشی هنوز آماده نیست؛ پیشنهاد را دوباره ارسال کن.');
      fields.push(result.detail);href=result.href;
    } else if(c.type==='outputSettings') {
      const key=choice(c.outputKey,outputKeys,'ابزار چاپ'),p=printOptions(c.printSettings||{}),ids=selectedForOutput(c,next);
      const tool=OUTPUTS.find(t=>t.key===key);
      if(ids!==undefined&&!tool.perStudent)fail('این ابزار انتخاب فردی دائمی ندارد؛ برای پیام از پیش‌نمایش پیام استفاده کن.');
      if(p.texts){const allowed=printTextKeys(key);if(Object.keys(p.texts).some(k=>!allowed.includes(k)))fail('شناسهٔ متن چاپ موجود نیست؛ بخش outputSettings را بخوان.');}
      if(ids===undefined&&!Object.keys(p).length)fail('تنظیم چاپ را مشخص کن.');
      const old=outputConfig(key,next),names={showSchool:'نام مدرسه',showTeacher:'نام معلم',showYear:'سال تحصیلی',footer:'پاورقی',landscape:'کاغذ افقی',fillEmpty:'پرکردن جای خالی',title:'عنوان',deadline:'مهلت',signature:'امضا',fontSize:'اندازهٔ قلم',sortBy:'ترتیب',extraBlank:'ردیف خالی'};
      const value=v=>typeof v==='boolean'?(v?'بله':'خیر'):({sm:'کوچک',md:'معمولی',lg:'بزرگ',no:'شماره',name:'نام'}[v]||v||'خالی');
      for(const [k,v] of Object.entries(p))if(k==='texts'){for(const [id,t] of Object.entries(v))fields.push('متن '+id+': (متن محلی قبلی) ← '+t);}else fields.push(names[k]+': '+(printStrings.includes(k)?'(متن محلی قبلی)':value(old[k]))+' ← '+value(v));
      if(ids!==undefined){p.selectedIds=ids;fields.push('افراد انتخاب‌شده: '+ids.map(id=>student(id,next).name).join('، '));}
      next.outputSettings[key]={...next.outputSettings[key],...p,...(p.texts?{texts:{...old.texts,...p.texts}}:{})};
      fields.push('تنظیمات '+tool.title+' ذخیره می‌شود؛ چاپ واقعی انجام نمی‌شود.');href='#/output/'+key;
    } else if(c.type==='classSettings') {
      const p=patch(c.settings,['teacher','school','grade','className','year']);
      const names={teacher:'معلم',school:'مدرسه',grade:'پایه',className:'نام کلاس',year:'سال تحصیلی'};
      if(p.grade!==undefined&&p.className===undefined&&(!next.klass.className||GRADES.includes(next.klass.className)))set(next.klass,'className',choice(p.grade,GRADES,'پایه'),'نام کلاس');
      for(const [k,v] of Object.entries(p))set(next.klass,k,k==='grade'?choice(v,GRADES,'پایه'):text(v,names[k]),names[k]);
      fields.push('پایهٔ تک‌تک دانش‌آموزان تغییر نمی‌کند.');href='#/class';
    } else if(c.type==='learningSettings') {
      const p=patch(c.settings,['trackingStartedOn','weekStart','schoolDays','unseenThreshold','radarLimit']);
      for(const [k,v] of Object.entries(p)) {
        if(k==='trackingStartedOn'){const d=day(v);if(d>localISO())fail('شروع ردیابی نمی‌تواند آینده باشد.');fields.push('شروع ردیابی: '+displayDay(l.trackingStartedOn)+' ← '+displayDay(d));l.trackingStartedOn=d;}
        else if(k==='schoolDays'){if(!Array.isArray(v)||!v.length||v.length>7||new Set(v).size!==v.length)fail('روزهای کاری باید غیرخالی و بدون تکرار باشند.');v.forEach(d=>bounded(d,0,6,'روز هفته'));fields.push('روزهای کاری: '+l.settings.schoolDays.map(d=>weekdays[d]).join('، ')+' ← '+v.map(d=>weekdays[d]).join('، '));l.settings.schoolDays=[...v];}
        else if(k==='weekStart'){bounded(v,0,6,'روز هفته');fields.push('شروع هفته: '+weekdays[l.settings.weekStart]+' ← '+weekdays[v]);l.settings.weekStart=v;}
        else set(l.settings,k,bounded(v,1,k==='radarLimit'?7:60,'حد تنظیم'),k==='radarLimit'?'حداکثر افراد رادار':'روزهای بدون مشاهده');
      }
    } else if(c.type==='listItem') {
      const key=choice(c.listKey,Object.keys(listLabels),'فهرست'),action=choice(c.action,['add','update','delete'],'عملیات فهرست');
      const rows=key==='responsibilityRoles'?l.responsibilityRoles:next.lists[key];
      const old=action==='add'?'':text(c.item,'عنوان موجود');
      if(old&&!rows.includes(old))fail('عنوان موجود را دقیقاً از فهرست بخوان.');
      const value=action==='delete'?'':text(c.text,'عنوان جدید');
      if(value&&rows.some(x=>x!==old&&normKey(x)===normKey(value)))fail('این عنوان از قبل در فهرست است.');
      if(key==='responsibilityRoles'&&old&&l.responsibilityHistory.some(r=>r.role===old))fail('این نقش سابقه دارد؛ برای حفظ سابقه، نقش تازه اضافه کن.');
      if(key==='firstDayItems'&&old)for(const s of next.students) {
        if(action==='delete'&&Object.hasOwn(s.shortage,old))fail('این وسیله وضعیت ثبت‌شده دارد؛ حذف از چت مجاز نیست.');
        if(action==='update'&&old!==value&&Object.hasOwn(s.shortage,old)) {
          if(Object.hasOwn(s.shortage,value))fail('عنوان جدید سابقهٔ مستقل دارد؛ تغییر نام باعث تداخل می‌شود.');
          s.shortage[value]=s.shortage[old];delete s.shortage[old];
        }
      }
      if(action==='add'){if(rows.length>=200)fail('فهرست بیش از حد بزرگ است.');rows.push(value);}
      else if(action==='delete')rows.splice(rows.indexOf(old),1);else rows[rows.indexOf(old)]=value;
      fields.push(listLabels[key]+'؛ '+({add:'افزودن: ',update:'تغییر نام: ',delete:'حذف: '})[action]+(old?old+(value?' ← ':''):'')+value);
      if(key==='firstDayItems'&&action==='update')fields.push('وضعیت وسایل همهٔ دانش‌آموزان با نام جدید حفظ می‌شود.');
      href=key==='responsibilityRoles'?'#/pulse/responsibilities':'#/settings/list/'+key;
    } else if(c.type==='pathMove') {
      const sk=skill(c.skillId,c.subject,next),group=choice(c.group,['teacher','practice','independent','auto'],'گروه');
      if(c.date!==undefined&&date!==localISO())fail('جابه‌جایی مسیر برای وضعیت فعلی است، نه تاریخ گذشته یا آینده.');
      if(group!=='auto') {
        const f={subject:sk.subject,skillId:sk.id,to:localISO()},history=getSkillHistory(st.id,sk.subject,sk.id,next,f);
        const latest=selectSessions(next,f).filter(s=>s.rosterIds.includes(st.id)).at(-1);
        if(!history.length||latest?.records[st.id]?.attendance==='absent'||l.attendanceDays?.[localISO()]?.[st.id]==='absent')fail('فرد غایب یا بدون مشاهدهٔ مرتبط را نمی‌توان به گروه یادگیری منتقل کرد.');
      }
      l.pathOverrides[sk.id] ||= {};
      if(group==='auto')delete l.pathOverrides[sk.id][st.id];else l.pathOverrides[sk.id][st.id]=group;
      fields.push(sk.label+'؛ '+(group==='auto'?'بازگشت به گروه‌بندی خودکار':PATH_LABEL[group]+'، انتخاب معلم')+'؛ رنگ و مشاهدات تغییر نمی‌کنند.');href='#/pulse/paths';
    } else if(c.type==='bagCheck') {
      if(c.date===undefined||date!==plusDays(localISO(),1))fail('تاریخ کیف باید فردا باشد؛ ابتدا بخش bag را بخوان.');
      const item=text(c.item,'مورد کیف');if(!bagItems(next,date).includes(item))fail('این مورد در کیف فردا نیست؛ ابتدا برنامه و فهرست واقعی را بخوان.');
      l.bagChecks[date] ||= {};l.bagChecks[date][item]=bool(c.done);fields.push(item+'؛ '+(c.done?'آماده شد':'هنوز آماده نیست'));href='#/pulse/tomorrow-bag';
    } else if(c.type==='messageTemplate') {
      const action=choice(c.action,['add','update','delete'],'عملیات قالب'),p=c.message;
      const existing=action==='add'?null:next.messages.find(m=>m.key===text(c.recordId,'شناسهٔ قالب')&&!m.deleted);
      if(action!=='add'&&!existing)fail('قالب فعال پیدا نشد؛ بخش messages را بخوان.');
      if(action==='delete') {
        if(existing.builtin)existing.deleted=true;else next.messages.splice(next.messages.indexOf(existing),1);
        fields.push('حذف قالب: '+existing.title);
      } else {
        patch(p,['title','scope','template']);
        const out={...(existing||{key:'custom-'+uid(),builtin:false,deleted:false}),...p};
        out.title=text(out.title,'عنوان قالب');out.scope=choice(out.scope,['general','individual'],'نوع قالب');out.template=text(out.template,'متن قالب');
        const placeholders=['آموزگار','پایه','کلاس','مدرسه','تلفن','تاریخ','ساعت','مکان','توضیح','وسایل','قوانین','موارد','مهلت','نام'];
        for(const m of out.template.matchAll(/\{([^{}]+)\}/g))if(!placeholders.includes(m[1]))fail('جای‌نگهدار ناشناخته در قالب: '+m[0]);
        if(existing)next.messages[next.messages.indexOf(existing)]=out;else next.messages.push(out);
        fields.push((existing?'ویرایش: ':'قالب جدید: ')+out.title+'؛ '+(out.scope==='general'?'عمومی':'فردی')+'\n'+out.template);
      }
      fields.push('فقط قالب ذخیره می‌شود؛ پیامی ارسال نمی‌شود.');href='#/settings/messages';
    }
    return {detail:fields.join('\n'),href};
  }

  let outputPreview=null;
  const outputKeys=OUTPUTS.map(t=>t.key);
  const printBools=['showSchool','showTeacher','showYear','footer','landscape','fillEmpty'];
  const printStrings=['title','deadline','signature'];
  function printOptions(p={}) {
    if(!isObj(p)||Object.keys(p).some(k=>![...printBools,...printStrings,'fontSize','sortBy','extraBlank','texts'].includes(k)))fail('تنظیم چاپ پشتیبانی نمی‌شود؛ از تنظیمات خود ابزار استفاده کن.');
    const out={};
    for(const [k,v] of Object.entries(p)) {
      if(printBools.includes(k)){if(typeof v!=='boolean')fail('گزینهٔ چاپ باید بله یا خیر باشد.');out[k]=v;}
      else if(printStrings.includes(k))out[k]=text(v,'متن چاپ',true);
      else if(k==='fontSize')out[k]=choice(v,['sm','md','lg'],'اندازهٔ قلم');
      else if(k==='sortBy')out[k]=choice(v,['no','name'],'ترتیب افراد');
      else if(k==='extraBlank'){if(!Number.isInteger(v)||v<0||v>40)fail('تعداد ردیف خالی باید ۰ تا ۴۰ باشد.');out[k]=v;}
      else {
        if(!Array.isArray(v)||v.length>30)fail('اصلاح متن چاپ باید فهرستی از حداکثر ۳۰ متن باشد.');
        out.texts={};for(const e of v){if(!isObj(e)||typeof e.key!=='string'||!/^[\w-]+$/.test(e.key)||Object.hasOwn(out.texts,e.key))fail('شناسهٔ متن چاپ معتبر نیست.');out.texts[e.key]=text(e.text,'متن چاپ',true);}
      }
    }
    return out;
  }
  function outputConfig(key,data=state) {
    const tool=OUTPUTS.find(t=>t.key===choice(key,outputKeys,'ابزار چاپ'));
    return {...COMMON_DEFAULTS(),...tool.defaults(),...data.outputSettings[key]};
  }
  function printTextKeys(key) {
    const tool=OUTPUTS.find(t=>t.key===key),s=outputConfig(key),pages=tool.renderPages(state,{...s,selectedIds:activeStudents().slice(0,1).map(s=>s.id),extraBlank:0,fillEmpty:false});
    return [...new Set(pages.flatMap(p=>[...new DOMParser().parseFromString(p,'text/html').querySelectorAll('[data-edit]')].map(el=>el.dataset.edit)))];
  }
  function selectedForOutput(args,data=state,required=false) {
    if(args.allStudents!==undefined&&typeof args.allStudents!=='boolean')fail('انتخاب همه باید روشن باشد.');
    if(args.allStudents&&args.studentIds!==undefined)fail('همهٔ افراد و فهرست انتخابی را هم‌زمان نده.');
    if(args.allStudents)return data.students.filter(s=>!data.learning.studentMeta[s.id]?.archived).map(s=>s.id);
    if(args.studentIds===undefined){if(required)fail('برای پیش‌نمایش، افراد یا انتخاب همه را صریح مشخص کن.');return undefined;}
    if(!Array.isArray(args.studentIds)||!args.studentIds.length||args.studentIds.length>500)fail('۱ تا ۵۰۰ نفر را روشن انتخاب کن.');
    const ids=args.studentIds.map(id=>student(id,data).id);
    if(new Set(ids).size!==ids.length||ids.some(id=>data.learning.studentMeta[id]?.archived))fail('انتخاب تکراری یا بایگانی مجاز نیست.');
    return ids;
  }
  function prepareOutput(args={}) {
    outputPreview=null;assertSafeTree(args);
    if(proposal)fail('ابتدا پیشنهاد ثبت را تأیید یا لغو کن.');
    const key=choice(args.outputKey,outputKeys,'ابزار'),tool=OUTPUTS.find(t=>t.key===key),settings=printOptions(args.printSettings||{});
    if(settings.texts){const allowed=printTextKeys(key);if(Object.keys(settings.texts).some(k=>!allowed.includes(k)))fail('شناسهٔ متن چاپ موجود نیست؛ ابتدا outputSettings را بخوان.');}
    const old=outputConfig(key),s={...old,...settings,...(settings.texts?{texts:{...old.texts,...settings.texts}}:{})},ids=selectedForOutput(args,state,tool.perStudent);
    if(ids!==undefined)s.selectedIds=ids;
    let pages,texts=[];
    if(key==='messages') {
      const m=state.messages.find(m=>m.key===args.messageKey&&!m.deleted);if(!m)fail('قالب پیام را با messageKey واقعی مشخص کن.');
      const recipients=m.scope==='individual'?selectedForOutput(args,state,true):[null];
      texts=recipients.map(id=>buildMessage(m,s,id?student(id):null));
      pages=texts.map(t=>P.page(P.head(s,m.title)+'<div class="msg-block"><div class="msg-body">'+esc(t).replace(/\n/g,'<br>')+'</div></div>',s));
    } else {
      if(!tool.perStudent&&ids!==undefined)fail('این ابزار انتخاب فردی ندارد؛ انتخاب افراد را حذف کن.');
      pages=tool.renderPages(state,s);
    }
    if(!pages.length||pages.length>100)fail('پیش‌نمایش باید ۱ تا ۱۰۰ صفحه باشد؛ افراد یا ابزار کوچک‌تری انتخاب کن.');
    if(pages.join('').length>3000000)fail('پیش‌نمایش خیلی بزرگ است؛ انتخاب را کوچک‌تر کن.');
    outputPreview={base:domain(state),demo:demoMode,title:tool.title,pages,texts,settings:s};
    return {status:'preview_ready',title:tool.title,pages:pages.length,recipients:ids?.length??null,nothingSaved:true,notice:'پیش‌نمایش فقط محلی آماده شد. چاپ، کپی یا ارسال نشده و تنظیمات دائمی تغییر نکرده‌اند.'};
  }
  function viewOutput() {
    const p=outputPreview;
    const current=()=>{if(!p||p.demo!==demoMode)fail('پیش‌نمایش منقضی شده؛ از چت دوباره درخواست کن.');ensureCurrent(p.base);};
    try {
      current();
      mount({title:p.title,backHref:'#/pulse/assistant',content:note('پیش‌نمایش محلی؛ هیچ پیامی ارسال نشده است. چاپ فقط با دکمهٔ زیر انجام می‌شود.')+p.pages.map(page=>ui.paper(page)).join(''),bottom:ui.btnPrimary('چاپ همین پیش‌نمایش',()=>{try{current();printPages(p.pages,{landscape:!!p.settings.landscape});}catch(e){ui.toast(e.message);}},{icon:'print'})+(p.texts.length?ui.btnTinted('کپی متن',()=>{try{current();copyText(p.texts.join('\n\n'));}catch(e){ui.toast(e.message);}},{icon:'copy'}):''),after:fitPapers});
    } catch(e) {mount({title:'پیش‌نمایش در دسترس نیست',backHref:'#/pulse/assistant',content:note(e.message)+link('#/pulse/assistant','بازگشت به چت')});}
  }
  function currentUndo() {
    const r=demoMode?undoRecord:state.assistantUndo;
    return r&&r.version===1&&r.demo===demoMode&&typeof r.after==='string'&&isObj(r.previous)&&!r.previous.assistantUndo?r:null;
  }

  function draftContext() {
     const budgetPayload=draft=>window.__mehryarCurriculumApi?.budgetDraftPayload?window.__mehryarCurriculumApi.budgetDraftPayload(draft):draft, curriculumDraft=state.curriculum?.budget?.draft,extra=curriculumDraft?{curriculumBudgetDraft:budgetPayload(curriculumDraft)}:{};
     if(!proposal)return curriculumDraft?extra:null;
      try {
       if(proposal.demo!==demoMode||proposal.planDraft!==JSON.stringify(planDraft))fail('حالت یا پیش‌نویس دستی تغییر کرده؛ پیش‌نویس چت را از نو درخواست کن.');
       ensureCurrent(proposal.base);
       const pendingBudget=proposal.next?.curriculum?.budget?.draft;
       return {version:proposal.version,changes:clone(proposal.changes),nothingSaved:true,...extra,...(pendingBudget?{curriculumBudgetDraft:budgetPayload(pendingBudget)}:{})};
     } catch(error){proposal=null;throw error;}
   }
  function isClassWideRecord(c, forced=false) {
    if (!['observation','attendance','homework','assessment'].includes(c.type)) return false;
     if (forced && !c.studentId) return true;
    if (c.allStudents === true || c.scope === 'class') return true;
    const source = [c.note,c.text,c.status,c.assessmentSkill,c.level,...(Array.isArray(c.errors)?c.errors:[])].filter(Boolean).join(' ');
    return /(?:کل|همه|تمام|سراسر)\s*(?:کلاس|بچه|پچه|دانش[‌\s-]*آموز)/.test(source) || /(?:کلکلاس|کل(?:بچه|پچه|دانشآموز)|همهبچه|همهپچه|همهدانشآموز|تمامکلاس|تمام(?:بچه|پچه))/.test(normKey(source));
  }
  function expandClassWideRecords(changes, data, options={}) {
    const expanded = [];
    const attendanceOverrides = new Map(changes.filter(c=>c.type==='attendance'&&c.studentId).map(c=>[day(c.date,localISO())+'|'+c.studentId,c.status]));
    const sameDate = (value,date) => {
      if (value===undefined || value==='') return date===localISO();
      if (String(value)===date) return true;
      try { return day(value,localISO())===date; } catch (_) { return false; }
    };
    const explicitAbsence = (date,id) => changes.some(c=>c.type==='attendance'&&c.status==='absent'&&c.studentId===id&&sameDate(c.date,date));
    const absentOn = (date,id) => {
      const override=attendanceOverrides.get(date+'|'+id);
      return explicitAbsence(date,id) || (override!==undefined ? override==='absent' : data.learning.attendanceDays?.[date]?.[id]==='absent');
    };
    for (const c of changes) {
      if (!isClassWideRecord(c,options.classWide)) { expanded.push(c); continue; }
      const date = day(c.date,localISO()), grade=c.grade||options.grade||'', roster = pdRoster(data,{grade,to:date});
      if (!roster.length) fail('برای گزارش گروهی، دانش‌آموز فعال پیدا نشد.');
      for (const st of roster) {
        if (c.type==='observation' && absentOn(date,st.id)) continue;
        expanded.push({...c,studentId:st.id,grade,allStudents:false,scope:'student'});
      }
    }
    return expanded;
  }
  function forceExplicitClasswideColor(changes, options={}) {
    const color=options.classWideColor;
    if (!color || !options.classWide) return changes;
    const reports=changes.filter(c=>c.type==='teachingReport'&&c.skillId);
    const observations=changes.filter(c=>c.type==='observation');
    const keep=changes.filter(c=>c.type!=='teachingReport');
    if (observations.length) return keep.map(c=>c.type==='observation'?{...c,status:color}:c);
    if (!reports.length) return changes;
    return keep.concat(reports.map(report=>({type:'observation',skillId:report.skillId,subject:report.subject,date:report.date,grade:report.grade||options.grade,status:color,errors:Array.isArray(report.errors)?report.errors:[],note:report.text||'گزارش مستقیم معلم دربارهٔ یادگیری کلاس'})));
  }
  function prepare(changes, options={}) {
    draftContext();
    if(planDraft)fail('ابتدا پیش‌نویس دستی طرح درس را ذخیره یا لغو کن؛ سپس درخواست ثبت را دوباره بده.');
    assertSafeTree(changes);
    if(!Array.isArray(changes)||!changes.length||changes.length>50) fail('هر گزارش باید ۱ تا ۵۰ تغییر روشن داشته باشد.');
    if(savingBlocked||!storageOk) fail('ابتدا مشکل حافظهٔ برنامه را رفع و از اطلاعات پشتیبان بگیر.');
    const base=domain(state), next=clone(state), items=[], sessions=new Map(), touched=new Set(),canonical=[];
    changes=forceExplicitClasswideColor(changes,options);
    changes=expandClassWideRecords(changes,next,options);
    const stamp=new Date().toISOString();
    for(const c of changes) {
      if(!isObj(c)) fail('ساختار تغییر معتبر نیست.');
      const type=choice(c.type,Object.keys(labels),'نوع ثبت'), l=next.learning;
      const st=['agreement','studentAdd','skillAdd','plan7Task','dailyPlan','activity',...extraTypes.filter(t=>t!=='pathMove')].includes(type)||(type==='teachingReport'&&!c.studentId)?null:student(c.studentId,next);
      if(st&&type!=='studentUpdate'&&l.studentMeta[st.id]?.archived) fail(st.name+' بایگانی است؛ ابتدا از بایگانی خارج شود.');
      let date=day(c.date,localISO());
      if(st&&type!=='studentUpdate'&&validDay(l.studentMeta[st.id]?.enrolledOn)&&date<l.studentMeta[st.id].enrolledOn) fail('تاریخ گزارش قبل از ورود '+st.name+' است.');
      if(['observation','attendance','homework','assessment','parentMeeting'].includes(type)&&date>localISO()) fail('گزارش انجام‌شده را نمی‌توان برای آینده ثبت کرد.');
      const sk=['observation','homework','followup','teachingReport'].includes(type)?skill(c.skillId,c.subject,next):null;
      const normalized=clone(c);canonical.push(normalized);
      if(st)normalized.studentId=st.id;if(sk)normalized.skillId=sk.id;
      if(c.date!==undefined||['observation','homework','attendance','followup','teachingReport','dailyPlan','activity','studentNote','assessment','shortage','responsibility','agreement','parentMeeting','studentAdd'].includes(type))normalized.date=date;
      if(c.dueOn!==undefined)normalized.dueOn=day(c.dueOn);
      if(type==='teachingReport'){
        const reportKey=JSON.stringify([type,date,sk.id,c.grade||'',c.planId||'',c.activityId||'']);
        if(touched.has(reportKey))fail('گزارش تدریس تکراری در یک بسته است.');touched.add(reportKey);
      }
      const duplicateKey=JSON.stringify(extraTypes.includes(type)?[type,st?.id,c.skillId,c.listKey,c.item||c.text,c.recordId,c.outputKey]:type.endsWith('Update')?[type,st?.id,c.recordId]:type==='studentAdd'?[type,normKey(c.name||'')]:type==='skillAdd'?[type,c.subject,normKey(c.text||'')]:type==='plan7Task'?[type,c.recordId||[c.dayIndex,c.text]]:['dailyPlan','activity'].includes(type)?[type,c.recordId||[date,c.skillId,c.activity?.title]]:[type,st?.id,date,sk?.id,c.item,c.assessmentSkill,c.role]);
      if(type!=='teachingReport'){
        if(touched.has(duplicateKey)) fail('دو تغییر تکراری یا متناقض در یک گزارش است؛ گزارش را جدا یا اصلاح کن.');
        touched.add(duplicateKey);
      }
      let detail='', href=st?'#/pulse/student/'+st.id:'#/pulse/class-agreements';
      if(extraTypes.includes(type)) { ({detail,href}=extraPrepare(c,next,st,date));
      } else if(type==='studentAdd') {
        const name=normalizeName(text(c.name,'نام کامل')),grade=choice(c.grade,PD_GRADES,'پایه');
        if(next.students.some(s=>normKey(s.name)===normKey(name)))fail('این نام از قبل موجود است؛ برای جلوگیری از ثبت تکراری، هم‌نام جدید را در فهرست دانش‌آموزان اضافه کن.');
        if(date>localISO())fail('تاریخ ورود دانش‌آموز نمی‌تواند آینده باشد.');
        const id=uid();next.students.push({id,no:Math.max(0,...next.students.map(s=>s.no||0))+1,name,data:{},shortage:{},assess:emptyAssess()});
        l.studentMeta[id]={enrolledOn:date,grade,tags:[],archived:false};
        detail=name+'؛ پایهٔ '+grade+'؛ ورود '+displayDay(date);href='#/students/'+id;
      } else if(type==='studentUpdate') {
        const fields=[];const meta=l.studentMeta[st.id] ||= {enrolledOn:localISO(),grade:'',tags:[],archived:false};
        if(c.name!==undefined){const name=normalizeName(text(c.name,'نام کامل'));if(next.students.some(s=>s.id!==st.id&&normKey(s.name)===normKey(name)))fail('نام جدید با دانش‌آموز دیگری یکسان است؛ اصلاح هم‌نام را در فهرست انجام بده.');fields.push('نام: '+st.name+' ← '+name);st.name=name;}
        if(c.grade!==undefined){const grade=choice(c.grade,PD_GRADES,'پایه');fields.push('پایه: '+(meta.grade||'نامشخص')+' ← '+grade);meta.grade=grade;}
        if(c.archived!==undefined){if(typeof c.archived!=='boolean')fail('وضعیت بایگانی باید روشن باشد.');fields.push(c.archived?'بایگانی؛ همهٔ سوابق حفظ می‌شوند':'بازگرداندن از بایگانی');meta.archived=c.archived;}
        if(!fields.length)fail('نام، پایه یا وضعیت بایگانی را مشخص کن.');
        detail=fields.join('؛ ');href='#/students/'+st.id;
      } else if(type==='followupUpdate'||type==='parentMeetingUpdate') {
        const rows=type==='followupUpdate'?l.followups:l.parentMeetings;
        const record=rows.find(x=>x.id===text(c.recordId,'شناسهٔ سابقه'));
        if(!record||record.studentId!==st.id)fail('سابقه متعلق به این دانش‌آموز نیست یا پیدا نشد؛ فهرست واقعی را بخوان.');
        const fields=[];
        const edit=(key,value,title)=>{fields.push(title+': '+(record[key]||'خالی')+' ← '+(value||'خالی'));record[key]=value;};
        if(c.dueOn!==undefined){const value=day(c.dueOn),start=type==='followupUpdate'?record.createdOn:c.date!==undefined?date:record.date;if(value<start)fail('موعد پیش از تاریخ ایجاد سابقه است.');fields.push('موعد: '+displayDay(record.dueOn)+' ← '+displayDay(value));record.dueOn=value;}
        if(c.text!==undefined)edit(type==='followupUpdate'?'action':'agreement',text(c.text,'اقدام یا توافق'),'اقدام / توافق');
        if(type==='followupUpdate') {
          if(c.note!==undefined)edit('note',text(c.note,'یادداشت',true),'یادداشت');
          if(c.status!==undefined){const value=choice(c.status,Object.keys(FOLLOW_STATUS),'وضعیت پیگیری');fields.push('وضعیت: '+FOLLOW_STATUS[record.status]+' ← '+FOLLOW_STATUS[value]);record.status=value;}
          if(['done','closed'].includes(record.status)&&(c.status!==undefined||c.date!==undefined)){
            const completed=c.date!==undefined?date:record.completedOn||localISO();
            if(completed<record.createdOn||completed>localISO())fail('تاریخ انجام باید پس از ایجاد پیگیری و حداکثر امروز باشد.');
            record.completedOn=completed;fields.push('تاریخ انجام: '+displayDay(completed));
          }else if(c.date!==undefined)fail('تاریخ اصلاح پیگیری فقط برای انجام‌شده یا بسته‌شده قابل ثبت است.');
          if(c.outcome!==undefined){const value=choice(c.outcome,Object.keys(FOLLOW_OUTCOME),'نتیجه');fields.push('نتیجه: '+FOLLOW_OUTCOME[record.outcome]+' ← '+FOLLOW_OUTCOME[value]);record.outcome=value;if(value==='unchecked')delete record.recheckSessionId;}
          if(c.recheckSessionId!==undefined){record.recheckSessionId=text(c.recheckSessionId,'شناسهٔ سنجش دوباره');fields.push('جلسهٔ شاهد: '+record.recheckSessionId);}
          if(c.outcome!==undefined||c.recheckSessionId!==undefined){
            if(record.outcome!=='unchecked'||record.recheckSessionId){
              const check=l.sessions.find(s=>s.id===record.recheckSessionId),r=check?.records[st.id];
              if(!check||check.skillId!==record.skillId||check.date>localISO()||check.date<record.createdOn||!r?.observed||r.attendance==='absent'||l.attendanceDays?.[check.date]?.[st.id]==='absent')fail('نتیجه به یک مشاهدهٔ واقعی و مرتبط پس از ایجاد پیگیری نیاز دارد.');
              const history=getSkillHistory(st.id,record.subject,record.skillId,next,{to:check.date}),index=history.findIndex(o=>o.sessionId===check.id);
              if(record.outcome==='improved'&&getStudentTrend(history.slice(0,index+1)).key!=='improved')fail('دو مشاهدهٔ مرتبط تا جلسهٔ شاهد بهبود را نشان نمی‌دهند؛ نتیجه را حدس نزن.');
            }
          }
          href='#/pulse/followups';
        } else {
          for(const [key,title] of [['question','پرسش'],['owner','مسئول'],['nextResult','نتیجهٔ جلسهٔ بعد']])if(c[key]!==undefined)edit(key,text(c[key],title,key!=='owner'),title);
          if(c.date!==undefined){if(date>localISO()||date>record.dueOn)fail('تاریخ جلسه باید تا امروز و حداکثر برابر موعد باشد.');fields.push('تاریخ جلسه: '+displayDay(record.date)+' ← '+displayDay(date));record.date=date;}
          href='#/pulse/parent-meeting';
        }
        if(!fields.length)fail('حداقل یک اصلاح روشن لازم است.');
        detail='سابقهٔ '+record.id+'؛ '+fields.join('؛ ');
      } else if(type==='skillAdd') {
        const label=normalizeName(text(c.text,'نام مهارت')),subject=choice(c.subject,SUBJECTS,'درس');
        if(l.skills.some(s=>s.subject===subject&&normKey(s.label)===normKey(label)))fail('این مهارت قبلاً ثبت شده است.');
        l.skills.push({id:uid(),subject,label});detail=subject+' / '+label;href='#/settings/learning';
      } else if(type==='plan7Task') {
        const action=choice(c.action,['add','update','delete'],'عملیات برنامه');
        if(action==='add'){
          if(!Number.isInteger(c.dayIndex)||c.dayIndex<1||c.dayIndex>7)fail('شمارهٔ روز برنامه باید از ۱ تا ۷ باشد.');
          const task={id:uid(),text:text(c.text,'کار برنامه'),done:false,link:c.link===undefined?'':choice(c.link,['',...OUTPUTS.map(x=>x.key)],'پیوند ابزار')};
          next.plan7[c.dayIndex-1].tasks.push(task);detail='افزودن به روز '+fa(c.dayIndex)+': '+task.text;
        }else{
          const id=text(c.recordId,'شناسهٔ کار'),entry=next.plan7.find(d=>d.tasks.some(t=>t.id===id)),task=entry?.tasks.find(t=>t.id===id);
          if(!task)fail('کار برنامه پیدا نشد؛ فهرست را بخوان.');
          const fields=[];
          if(action==='delete'){entry.tasks=entry.tasks.filter(t=>t.id!==id);fields.push('حذف کار: '+task.text);}
          else{
            if(c.text!==undefined){const value=text(c.text,'کار');fields.push('متن: '+task.text+' ← '+value);task.text=value;}
            if(c.done!==undefined){if(typeof c.done!=='boolean')fail('انجام‌شدن باید روشن باشد.');task.done=c.done;fields.push(c.done?'انجام‌شده':'انجام‌نشده');}
            if(c.link!==undefined){task.link=choice(c.link,['',...OUTPUTS.map(x=>x.key)],'پیوند ابزار');fields.push('پیوند: '+(task.link||'ندارد'));}
          }
          if(!fields.length)fail('اصلاح کار را مشخص کن.');detail=entry.day+' / '+task.text+'؛ '+fields.join('؛ ');
        }
        href='#/output/plan7';
      } else if(type==='teachingReport') {
        if(date>localISO())fail('تجربهٔ تدریس انجام‌شده نمی‌تواند برای آینده باشد.');
         const sk=skill(c.skillId,c.subject,next),grade=c.grade===undefined?'':choice(c.grade,PD_GRADES,'پایه');
         const r={id:uid(),date,skillId:sk.id,subject:sk.subject,grade,...(st?{studentId:st.id}:{}),text:text(c.text,'گزارش واقعی معلم'),worked:text(c.worked,'بخش مؤثر',true),difficulty:text(c.difficulty,'دشواری',true),nextStep:text(c.nextStep,'پیشنهاد بعدی معلم',true)};
        for(const [key,rows] of [['planId',l.dailyPlans],['activityId',allActivities()]])if(c[key]){const source=rows.find(x=>x.id===c[key]);if(!source||source.skillId!==sk.id)fail('برنامه یا فعالیت مرتبط پیدا نشد؛ شناسهٔ واقعی همین مهارت را بخوان.');r[key]=source.id;}
        l.teachingReports ||= [];l.teachingReports.push(r);
         detail=sk.label+'؛ گزارش معلم، نه نتیجهٔ سنجش مستقل\n'+r.text+(r.worked?'\nمؤثر بود: '+r.worked:'')+(r.difficulty?'\nدشواری: '+r.difficulty:'')+(r.nextStep?'\nپیشنهاد بعدی معلم: '+r.nextStep:'');href='#/pulse/assistant';
      } else if(type==='dailyPlan') {
        const p=c.plan;if(!isObj(p))fail('جزئیات طرح درس لازم است.');
        const keys=['grade','materials','activityText','board','exitCheck','slots','groups','activityIds'];
        if(!Object.keys(p).length||Object.keys(p).some(k=>!keys.includes(k)))fail('بخش ناشناخته یا خالی در طرح درس است.');
        const existing=c.recordId?l.dailyPlans.find(x=>x.id===text(c.recordId,'شناسهٔ طرح درس')):null;
        if(c.recordId&&!existing)fail('طرح درس پیدا نشد؛ فهرست برنامه‌ها را بخوان.');
        if(existing&&planDraft?.id===existing.id)fail('ویرایش دستی این طرح درس باز است؛ ابتدا آن را ذخیره یا لغو کن.');
        if(!existing&&c.date===undefined)fail('تاریخ برنامه را مشخص کن.');
        const sk=skill(c.skillId||existing?.skillId,c.subject,next);
        const out={...(existing||{id:uid(),createdOn:localISO(),activityIds:[],advice:'پیشنهاد آموزشی؛ نتیجهٔ اجرا هنوز مشاهده نشده است.'}),...p,subject:sk.subject,skillId:sk.id,date:c.date===undefined&&existing?existing.date:date};
        date=out.date;
        normalized.date=date;normalized.skillId=sk.id;
        out.grade=choice(out.grade,['',...GRADES],'پایهٔ طرح درس');
        for(const key of ['activityText','board','exitCheck'])out[key]=text(out[key],key);
        out.materials=text(out.materials,'وسایل',true);
        if(!Array.isArray(out.slots)||!out.slots.length||out.slots.length>12)fail('طرح درس باید ۱ تا ۱۲ بازه داشته باشد.');
        out.slots=out.slots.map(s=>{
          if(!isObj(s)||!Number.isInteger(s.minutes)||s.minutes<1||s.minutes>180)fail('مدت بازه باید عدد صحیح ۱ تا ۱۸۰ دقیقه باشد.');
          return {minutes:s.minutes,...Object.fromEntries(['teacher','teacherGroup','practiceGroup','independentGroup','unknownGroup'].map(k=>[k,text(s[k],'کار گروه در هر بازه')]))};
        });
        out.minutes=out.slots.reduce((n,s)=>n+s.minutes,0);if(out.minutes>480)fail('مدت کل طرح درس بیش از ۴۸۰ دقیقه است.');
        if(existing&&p.grade!==undefined&&p.grade!==existing.grade&&p.groups===undefined)fail('برای تغییر پایهٔ طرح درس، گروه‌های جدید را هم مشخص کن.');
        const regroup=!existing||p.groups!==undefined;
        const roster=regroup?pdRoster(next,{grade:out.grade==='چندپایه'?'':out.grade,to:out.date}):next.students,eligible=new Set(roster.map(s=>s.id)),seen=new Set(),groups={teacher:[],practice:[],independent:[],unknown:[],absent:[]};
        if(out.groups!==undefined){
          if(!isObj(out.groups)||Object.keys(out.groups).some(k=>!Object.hasOwn(groups,k)))fail('گروه‌های طرح درس معتبر نیستند.');
          for(const key of Object.keys(groups)){
            const members=out.groups[key]||[];if(!Array.isArray(members))fail('اعضای گروه باید فهرست باشند.');
            groups[key]=members.map(value=>{const id=student(value,next).id;if(!eligible.has(id)||seen.has(id))fail('عضو طرح درس تکراری، بایگانی یا خارج از پایه است.');seen.add(id);return id;});
          }
        }
        if(regroup)groups.unknown.push(...roster.filter(s=>!seen.has(s.id)).map(s=>s.id));out.groups=groups;
        if(!Array.isArray(out.activityIds)||out.activityIds.some(id=>!l.customActivities.some(a=>a.id===id)&&!ACTIVITY_BANK.some(a=>a.id===id)))fail('شناسهٔ فعالیت برنامه معتبر نیست.');
        detail=(existing?'ویرایش طرح '+existing.id:'طرح جدید')+'؛ '+sk.subject+' / '+sk.label+'؛ پایهٔ '+(out.grade||'همه')+'؛ '+displayDay(out.date)+'؛ '+fa(out.minutes)+' دقیقه\n'+Object.entries(groups).map(([key,ids])=>PATH_LABEL[key]+': '+(ids.map(id=>student(id,next).name).join('، ')||'ندارد')).join('\n');
        detail+='\n'+out.slots.map((s,i)=>'بازهٔ '+fa(i+1)+' / '+fa(s.minutes)+' دقیقه\n'+['teacher','teacherGroup','practiceGroup','independentGroup','unknownGroup'].map((key,j)=>['معلم','همراه معلم','تمرین هدفمند','مستقل','مشاهده‌نشده'][j]+': '+s[key]).join('\n')).join('\n');
        detail+='\nوسایل: '+(out.materials||'ندارد')+'\nفعالیت: '+out.activityText+'\nفعالیت‌های بانک: '+(out.activityIds.join('، ')||'ندارد')+'\nتخته: '+out.board+'\nسنجش خروجی: '+out.exitCheck+'\n'+out.advice;
        if(existing)l.dailyPlans[l.dailyPlans.indexOf(existing)]=out;else l.dailyPlans.push(out);
        href='#/pulse/tomorrow';
      } else if(type==='activity') {
        const p=c.activity;if(!isObj(p))fail('جزئیات فعالیت لازم است.');
        const keys=['title','grades','materials','steps','durationMinutes','practice','diagnosticPrompt','observationGuide','independentInstructions','exitCheck','teacherNote'];
        if(!Object.keys(p).length||Object.keys(p).some(k=>!keys.includes(k)))fail('بخش ناشناخته یا خالی در فعالیت است.');
        const existing=c.recordId?(l.customActivities.find(a=>a.id===c.recordId||a.overrides===c.recordId)||ACTIVITY_BANK.find(a=>a.id===c.recordId)):null;
        if(c.recordId&&!existing)fail('فعالیت پیدا نشد؛ فهرست فعالیت‌ها را بخوان.');
        const sk=skill(c.skillId||existing?.skillId,c.subject,next),builtIn=existing&&ACTIVITY_BANK.some(a=>a.id===existing.id);
        normalized.skillId=sk.id;
        const out={...(existing||{}),...p,id:existing&&!builtIn?existing.id:'custom-'+uid(),skillId:sk.id,skillLabel:sk.label,subject:sk.subject};
        if(builtIn)out.overrides=existing.id;
        for(const key of ['title','diagnosticPrompt','observationGuide','independentInstructions','exitCheck','teacherNote'])out[key]=text(out[key],key);
        for(const key of ['grades','materials','steps']){
          if(!Array.isArray(out[key])||out[key].length>30||(key!=='materials'&&!out[key].length))fail('پایه‌ها، وسایل و مراحل فعالیت را به‌صورت فهرست روشن بده.');
          out[key]=out[key].map(x=>key==='grades'?choice(x,PD_GRADES,'پایه'):text(x,key));
        }
        if(!Number.isInteger(out.durationMinutes)||out.durationMinutes<1||out.durationMinutes>120)fail('مدت فعالیت باید ۱ تا ۱۲۰ دقیقه باشد.');
        if(p.practice!==undefined&&(!isObj(p.practice)||Object.keys(p.practice).some(k=>!['simple','medium','challenge'].includes(k))))fail('سه سطح تمرین معتبر نیست.');
        const practice={...existing?.practice,...p.practice};out.practice=Object.fromEntries(['simple','medium','challenge'].map(k=>[k,text(practice[k],'تمرین '+k)]));
        out.purpose=out.title;out.errorKey=sk.label;
        const index=l.customActivities.findIndex(a=>a.id===out.id);if(index>=0)l.customActivities[index]=out;else l.customActivities.push(out);
        detail=(existing?'ویرایش فعالیت: ':'فعالیت جدید: ')+out.title+'؛ '+sk.subject+' / '+sk.label+'؛ پایه‌های '+out.grades.join('، ')+'؛ '+fa(out.durationMinutes)+' دقیقه\nوسایل: '+(out.materials.join('، ')||'ندارد')+'\nبررسی اولیه: '+out.diagnosticPrompt+'\nراهنمای مشاهده: '+out.observationGuide+'\nمراحل: '+out.steps.join('\n')+'\nتمرین ساده: '+out.practice.simple+'\nمتوسط: '+out.practice.medium+'\nچالشی: '+out.practice.challenge+'\nدستور مستقل: '+out.independentInstructions+'\nسنجش خروجی: '+out.exitCheck+'\nراهنمای معلم: '+out.teacherNote;
        href='#/pulse/activities/'+out.id;
      } else if(type==='observation'||type==='homework') {
        const k=date+'|'+sk.id;
         let s=sessions.get(k);
         if(!s) {s={id:uid(),date,sequence:Date.now()+sessions.size,subject:sk.subject,skillId:sk.id,skillLabel:sk.label,lessonTitle:'گزارش معلم از چت‌بات',rosterIds:[],records:{},createdAt:stamp,updatedAt:stamp};sessions.set(k,s);l.sessions.push(s);}
        if(!s.rosterIds.includes(st.id)) s.rosterIds.push(st.id);
        const r=s.records[st.id] ||= emptyRec();
        if(type==='observation') {
          r.status=choice(c.status,['red','yellow','green'],'رنگ یادگیری');r.observed=true;
           if(c.errors!==undefined) {if(!Array.isArray(c.errors)||c.errors.length>10) fail('حداکثر ۱۰ خطا مجاز است.');r.errors=c.errors.map(e=>text(e,'خطا'));}
          detail=sk.subject+' / '+sk.label+'؛ '+STATUS_TEXT[r.status]+(r.errors.length?'؛ خطا: '+r.errors.join('، '):'');
        } else {r.homework=choice(c.status,['complete','partial','missing'],'وضعیت تکلیف');detail=sk.label+'؛ '+({complete:'کامل',partial:'ناقص',missing:'انجام‌نشده'})[r.homework];}
          const note=text(c.note,'یادداشت',true);if(note){r.note=[r.note,note].filter(Boolean).join('\n');detail+='؛ یادداشت: '+note;}
        href='#/pulse/session/'+s.id;
      } else if(type==='attendance') {
         const value=choice(c.status,['present','absent','late'],'حضور');
        l.attendanceDays ||= {};l.attendanceDays[date] ||= {};
        const previous=l.attendanceDays[date][st.id];l.attendanceDays[date][st.id]=value;
        const names={present:'حاضر',absent:'غایب',late:'تأخیر'};
        detail=(previous?'تغییر '+names[previous]+' به ':'')+names[value];href='#/pulse/attendance';
      } else if(type==='followup') {
        const action=text(c.text,'اقدام'), dueOn=day(c.dueOn);
        l.followups.push({id:uid(),studentId:st.id,subject:sk.subject,skillId:sk.id,sourceSessionIds:[],action,activityId:'',createdOn:date,dueOn,status:'planned',outcome:'unchecked',note:text(c.note,'یادداشت',true),completedOn:''});
        detail=sk.label+'؛ '+action+'؛ موعد '+displayDay(dueOn)+(c.note?'؛ یادداشت: '+c.note:'');href='#/pulse/followups';
      } else if(type==='shortage') {
        const item=text(c.item,'نام وسیله');if(!next.lists.firstDayItems.includes(item))fail('وسیله در فهرست کمبودیار نیست؛ ابتدا در تنظیمات فهرست اضافه شود.');
        st.shortage[item]=choice(c.status,['has','missing','unknown'],'وضعیت وسیله');detail=item+'؛ '+({has:'دارد',missing:'ندارد',unknown:'نامشخص'})[c.status];href='#/output/shortage';
      } else if(type==='assessment') {
        const key=choice(c.assessmentSkill,ASSESS_SKILLS.map(x=>x[0]),'مهارت سنجش');
        st.assess[key]=choice(c.level,[0,1,2,3],'سطح سنجش');detail=ASSESS_SKILLS.find(x=>x[0]===key)[1]+'؛ '+LEVELS[c.level];href='#/output/assessment';
      } else if(type==='studentNote') {
        const note=text(c.text,'یادداشت');st.data.note=[st.data.note,displayDay(date)+': '+note].filter(Boolean).join('\n');detail=note;href='#/students/'+st.id;
      } else if(type==='responsibility') {
        const role=choice(c.role,l.responsibilityRoles,'نقش');
        if(l.responsibilityHistory.some(r=>!r.undone&&r.date===date&&(r.role===role||r.studentId===st.id)))fail('این نقش یا دانش‌آموز در این روز مسئولیت دارد.');
        if(l.studentMeta[st.id]?.exemptUntil>=date||l.attendanceDays?.[date]?.[st.id]==='absent')fail('دانش‌آموز معاف یا غایب است.');
        l.responsibilityHistory.push({id:uid(),role,studentId:st.id,date,undone:false});detail=role;href='#/pulse/responsibilities';
      } else if(type==='agreement') {
        const value=text(c.text,'قول'),practice=text(c.practice,'تمرین عملی'),reviewOn=day(c.dueOn);
        l.classAgreements.push({id:uid(),text:value,practice,reviewOn});detail=value+'؛ تمرین '+practice+'؛ مرور '+displayDay(reviewOn);
      } else if(type==='parentMeeting') {
        const agreement=text(c.text,'توافق'),dueOn=day(c.dueOn);
        l.parentMeetings.push({id:uid(),studentId:st.id,date,question:text(c.question,'پرسش',true),agreement,owner:text(c.owner,'مسئول اقدام'),dueOn,nextResult:''});
        detail=agreement+'؛ مسئول '+c.owner+'؛ موعد '+displayDay(dueOn)+(c.question?'؛ پرسش: '+c.question:'');href='#/pulse/parent-meeting';
      }
       items.push({title:labels[type],student:st?.name||(type==='studentAdd'?normalizeName(c.name):'کل کلاس'),date,detail,href});
    }
    for(const s of sessions.values())for(const id of s.rosterIds)if(s.records[id].observed&&next.learning.attendanceDays?.[s.date]?.[id]==='absent')fail('غیبت روزانه با مشاهدهٔ یادگیری در همان روز ناسازگار است؛ ابتدا گزارش را روشن کن.');
    for(const c of changes)if(c.type==='attendance'&&c.status==='absent') {
      const st=student(c.studentId,next),date=day(c.date,localISO());
      if(next.learning.sessions.some(s=>s.date===date&&s.records[st.id]?.observed))fail('برای این روز مشاهدهٔ یادگیری ثبت شده؛ غیبت کامل را بدون اصلاح آن ثبت نکن.');
    }
     if(JSON.stringify(items).length>45000)fail('پیش‌نمایش خیلی بزرگ است؛ گزارش را به بسته‌های کوچک‌تر تقسیم کن.');
     validateImport(next);
     proposal={id:uid(),version:(proposal?.version||0)+1,changes:canonical,base,next,items,demo:demoMode,planDraft:JSON.stringify(planDraft)};
    return {status:'awaiting_teacher_confirmation',version:proposal.version,items};
  }
  function ensureCurrent(expected) {
    if(domain(state)!==expected) fail('داده‌ها از زمان تهیهٔ پیشنهاد تغییر کرده‌اند؛ درخواست را با اطلاعات تازه دوباره بفرست.');
    if(!demoMode) {
      if(savingBlocked||!storageOk)fail('ذخیره‌سازی مسدود است؛ ابتدا از اطلاعات پشتیبان بگیر.');
      let saved;try {saved=JSON.parse(localStorage.getItem(STORAGE_KEY));}catch(_){fail('حافظه خوانده نشد.');}
      if(saved&&domain(saved)!==expected) fail('اطلاعات ذخیره‌شده با این برگه فرق دارد. ابتدا تغییرات را ذخیره یا صفحه را دوباره باز کن.');
    }
  }
   function write(next) {
     if(typeof window.__mehryarValidateCurriculum==='function')window.__mehryarValidateCurriculum(next);
     validateImport(next);
    if(!demoMode) {
      try {localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch(_){fail('ثبت انجام نشد؛ حافظه کافی نیست. هیچ بخشی از گزارش اعمال نشد.');}
    }
     clearTimeout(saveTimer2);saveEpoch++;state=next;if(typeof window.__mehryarSyncCurriculumBudgetBaseline==='function')window.__mehryarSyncCurriculumBudgetBaseline();syncStudentDossiers(next,[],true);dirty=false;showSaved();
  }
  function commit() {
    if(!proposal)fail('پیشنهادی برای ثبت وجود ندارد.');
    const p=proposal;if(p.demo!==demoMode)fail('حالت نمونه تغییر کرده؛ دوباره گزارش بده.');ensureCurrent(p.base);
    if(p.planDraft!==JSON.stringify(planDraft))fail('پیش‌نویس برنامه در این فاصله تغییر کرد؛ ابتدا آن را ذخیره یا لغو کن و دوباره درخواست بده.');
    const hasBudget=p.changes.some(change=>change.type==='curriculumBudget'),pendingBudget=p.next.curriculum?.budget?.draft;
    if(hasBudget&&(!pendingBudget||Number(pendingBudget.counts?.ready||0)<1))fail('هیچ ردیف کامل و آماده‌ای برای ثبت نهایی وجود ندارد.');
    if(hasBudget&&pendingBudget.parseIssues?.length)fail('پیش‌نویس بودجه خطای استخراج دارد؛ تا رفع آن‌ها هیچ ردیفی ثبت نمی‌شود.');
    if(hasBudget&&pendingBudget.mode==='replace'&&Number(pendingBudget.counts?.ready||0)!==Number(pendingBudget.counts?.total||0))fail('جایگزینی فقط وقتی مجاز است که همهٔ ردیف‌ها کامل باشند؛ بودجهٔ فعلی دست‌نخورده ماند.');
      const previous=clone(state),next={...p.next,ui:clone(state.ui),progress:clone(state.progress)};
      if(hasBudget) {
       const budgetDraft=next.curriculum?.budget?.draft,readyCount=Number(budgetDraft?.counts?.ready)||0;
        if(readyCount){const approvedAt=new Date().toISOString();next.curriculum.budget.sourceText=String(budgetDraft?.rawText||next.curriculum.budget.sourceText||'');next.curriculum.budget.approvedAt=approvedAt;next.curriculum.budget.entries=next.curriculum.budget.entries.map(entry=>({...entry,approvedAt:entry.approvedAt||approvedAt}));next.curriculum.budget.history ||= [];next.curriculum.budget.history=next.curriculum.budget.history.slice(-12);}
          if(budgetDraft){const remaining=budgetDraft.rows.filter(row=>row.status!=='matched'),dependencies=budgetDraft.dependencies||{},counts={total:remaining.length,ready:remaining.filter(row=>row.status==='matched'&&row.bookId&&validDay(row.startDate)&&validDay(row.endDate)&&Number.isInteger(row.sessions)&&row.sessions>=1&&row.sessions<=99).length,matched:remaining.filter(row=>row.status==='matched').length,ambiguous:remaining.filter(row=>row.status==='ambiguous').length,unresolved:remaining.filter(row=>row.status==='unresolved').length,needsReview:remaining.filter(row=>row.status==='needs_review').length,missingBooks:Array.isArray(dependencies.books)?dependencies.books.length:0,missingNodes:Array.isArray(dependencies.nodes)?dependencies.nodes.length:0};next.curriculum.budget.draft=remaining.length?{...budgetDraft,rows:remaining,counts,updatedAt:new Date().toISOString()}:null;}
      }
      const receiptItems=p.items.map(item=>{if(item.title!==labels.curriculumBudget)return item;const detail=String(item.detail||''),duplicate=detail.includes('این بودجه‌بندی قبلاً با همین مشخصات ثبت شده است');return {...item,detail:detail.replace('پیش‌نویس نگه داشته شد و هنوز ثبت نهایی نشده است.',duplicate?'\nداده‌ها بدون تغییر باقی ماندند.':'ثبت اتمیک انجام شد؛ کتاب‌ها، مباحث و ردیف‌های بودجه با هم ذخیره شدند.')}});
     next.learning.assistantAudit ||= [];
     next.learning.assistantAudit.push({id:p.id,at:new Date().toISOString(),items:receiptItems});
    next.learning.assistantAudit=next.learning.assistantAudit.slice(-30);
    delete previous.assistantUndo;
    const record={version:1,previous,after:domain(next),demo:demoMode,planDraft:JSON.stringify(planDraft)};
    if(!demoMode)next.assistantUndo=record;
    write(next);syncStudentDossiers(next,p.changes,true);undoRecord=record;proposal=null;outputPreview=null;
     return receiptItems;
  }
  function undo() {
    const r=currentUndo();if(!r)fail('ثبت قابل واگردی وجود ندارد.');
    ensureCurrent(r.after);
    if(r.planDraft!==JSON.stringify(planDraft))fail('پیش‌نویس دستی تغییر کرده؛ ابتدا آن را ذخیره یا لغو کن.');
    write({...r.previous,ui:clone(state.ui),progress:clone(state.progress)});undoRecord=null;proposal=null;outputPreview=null;
  }
  function localAnswer(prompt) {
    const q=normKey(prompt).replace(/[؟?!!.،]/g,'');
    if (!/(ثبت|ذخیره|اصلاح|ویرایش|حذف|اضافه|ایجاد)/.test(q) && /(?:امروز|همین.?امروز)/.test(q) && /(?:کی|چه.?کسی|کدام|کیا|فهرست|لیست)/.test(q) && /(?:تاخیر|تأخیر|غیبت|حاضر)/.test(q)) {
      const status=/(?:تاخیر|تأخیر)/.test(q)?'late':/(?:غیبت)/.test(q)?'absent':'present';
      const labels={late:'تأخیر',absent:'غیبت',present:'حضور'};
      const rows=read({section:'attendance',from:localISO(),to:localISO(),limit:100}).items.filter(row=>row.status===status);
      return rows.length ? `${labels[status]}های امروز (${displayDay(localISO())}): ${rows.map(row=>row.name).join('، ')}.\nاین پاسخ مستقیماً از ثبت محلی حضور و غیاب خوانده شد و درخواست آنلاین مصرف نکرد.` : `برای امروز (${displayDay(localISO())}) موردی از ${labels[status]} ثبت نشده است.\nاین پاسخ مستقیماً از ثبت محلی حضور و غیاب خوانده شد و درخواست آنلاین مصرف نکرد.`;
    }
    if(!['چندتادانشآموزدارم','چنددانشآموزدارم','تعداددانشآموزان','چندنفرقرمزدارم','چندتاقرمزدارم','چندتاقرمز','تعدادقرمزها','آمارکلاس','آمارکلاسم'].includes(q))return null;
    const s=read({section:'summary'});
    if(q.includes('دانشآموز'))return `تعداد دانش‌آموزان فعال: ${fa(s.activeStudents)} نفر در همهٔ پایه‌ها.\nبایگانی: ${fa(s.archived)} نفر.\nمنبع: فهرست واقعی همین برنامه${demoMode?' (نمونهٔ فرضی)':''}.`;
    return `آمار همهٔ پایه‌ها تا ${displayDay(localISO())}${demoMode?' (نمونهٔ فرضی)':''}:\nدانش‌آموز فعال: ${fa(s.activeStudents)} نفر\nدارای حداقل یک مهارت قرمز: ${fa(s.colors.red.students)} نفر، در ${fa(s.colors.red.skillRecords)} ثبتِ آخرِ مهارت\nدارای مهارت زرد: ${fa(s.colors.yellow.students)} نفر\nدارای مهارت سبز: ${fa(s.colors.green.students)} نفر\nبدون مشاهدهٔ مستقیم: ${fa(s.unobservedStudents)} نفر\nرنگ‌ها بر اساس آخرین مشاهدهٔ هر مهارت در کل سابقه‌اند؛ یک نفر می‌تواند در درس‌های مختلف چند رنگ داشته باشد. نداشتن مشاهده به معنی ضعف نیست.\nاین پاسخ محلی است و درخواست آنلاین مصرف نکرد.`;
  }
     function get_budget({grade, year}) {
       const cleanGrade=String(grade||'').replace(/\s*ابتدایی\s*$/,'').trim();
       const cleanYear=String(year||'').trim();
       try{const annual=localStorage.getItem(`mehyar_budget_${cleanGrade}_${cleanYear}`)||localStorage.getItem(`mehyar_budget_${cleanYear}_${cleanGrade}`);if(annual)return JSON.parse(annual);}catch(_){}
       try{return JSON.parse(localStorage.getItem(`budget_${grade}_${year}`));}catch(_){return null;}
    }
     function budgetScheduleHint(sequenceTopics,lastIndex,monthKey,now=new Date(),dayOffset=1) {
       try{
         if(!Array.isArray(sequenceTopics)||!sequenceTopics.length)return null;
         const names=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
         const order=i=>(i-6+12)%12;
         const parts=d=>{const o={};for(const x of new Intl.DateTimeFormat('en-u-ca-persian',{month:'numeric',day:'numeric'}).formatToParts(d))if(x.type==='month'||x.type==='day')o[x.type]=parseInt(x.value,10);return o;};
         const daysIn=m=>m<=6?31:m<=11?30:29;
         const tom=new Date(now.getTime()+86400000*dayOffset),t=parts(now),n=parts(tom);
         if(!t.month||!n.month)return null;
         const tomOrder=order(n.month-1);
         const withOrder=sequenceTopics.map(item=>({item,ord:names.findIndex(nm=>monthKey(nm)===monthKey(item.month))})).map(x=>({...x,ord:x.ord<0?-1:order(x.ord)}));
         const known=withOrder.filter(x=>x.ord>=0);
         const out={todayPersian:t.day+' '+names[t.month-1],tomorrowPersian:n.day+' '+names[n.month-1],tomorrowMonth:names[n.month-1],targetDayPersian:n.day+' '+names[n.month-1],lastTaughtKnown:lastIndex>=0,note:'بودجهٔ ذخیره‌شده ماهانه است و تاریخ دقیق روز ندارد؛ جایگاه مورد انتظار تخمین نسبیِ روز از ماه است و باید تخمین معرفی شود.'};
         let expectedIndex=-1;
         const monthItems=known.filter(x=>x.ord===tomOrder);
         if(monthItems.length){
           const k=Math.min(monthItems.length,Math.max(1,Math.ceil(n.day/daysIn(n.month)*monthItems.length)));
           expectedIndex=sequenceTopics.indexOf(monthItems[k-1].item);
           out.monthTopicCount=monthItems.length;
         }else if(known.length){
           const maxOrd=Math.max(...known.map(x=>x.ord)),minOrd=Math.min(...known.map(x=>x.ord));
           if(tomOrder>maxOrd){out.status='past_budget_end';out.lastBudgetMonth=known.filter(x=>x.ord===maxOrd).at(-1).item.month;expectedIndex=sequenceTopics.length-1;}
           else if(tomOrder<minOrd){out.status='before_budget_start';out.firstBudgetMonth=known.find(x=>x.ord===minOrd).item.month;out.expectedTopicByTomorrow=null;return out;}
           else{const prev=known.filter(x=>x.ord<tomOrder);expectedIndex=sequenceTopics.indexOf(prev[prev.length-1].item);out.status='month_without_topics';}
         }else return null;
         out.expectedTopicByTomorrow=sequenceTopics[expectedIndex];
         const diff=lastIndex>=0?expectedIndex-lastIndex:expectedIndex+1;
         out.topicsBehind=Math.max(0,diff);
         out.topicsAhead=Math.max(0,-diff);
         out.catchUpTopics=diff>0?sequenceTopics.slice(lastIndex+1,expectedIndex+1).slice(0,10):[];
         if(lastIndex>=0)out.lastTaughtTopic=sequenceTopics[lastIndex];
         if(out.status!=='past_budget_end'&&out.status!=='month_without_topics')out.status=diff>0?'behind':diff<0?'ahead':'on_track';
         if(out.status==='past_budget_end'||out.status==='month_without_topics')out.remainingAfterLast=sequenceTopics.length-1-lastIndex;
         return out;
       }catch(_){return null;}
     }
     function get_budget_and_progress({grade,academicYear,subject='',prompt='',offset=0,limit=100}={}) {
       const gradeNames=['اول','دوم','سوم','چهارم','پنجم','ششم'];
       const cleanGrade=value=>{const raw=String(value||'').replace(/^(?:پایه|کلاس)\s*/,'').replace(/\s*ابتدایی\s*$/,'').trim(),numeric=persianDigitsToLatin(raw).match(/^([1-6])$/);return numeric?gradeNames[Number(numeric[1])-1]||'':gradeNames.find(item=>normKey(item)===normKey(raw))||raw;};
       const cleanYear=value=>{const raw=persianDigitsToLatin(String(value||'')).replace(/[–—−﹣－]/g,'-').replace(/\s+/g,''),match=raw.match(/((?:13|14)\d{2})-?((?:13|14)\d{2})/);return match?[Number(match[1]),Number(match[2])].sort((a,b)=>a-b).join('-'):raw;};
       let requestedGrade=cleanGrade(grade||state.klass?.grade),requestedYear=cleanYear(academicYear||state.klass?.year),indexedKey='';
       try{indexedKey=localStorage.getItem('mehyar_last_budget_key')||'';}catch(_){}
       const exactKey=requestedGrade&&requestedYear?`mehyar_budget_${requestedGrade}_${requestedYear}`:'',legacyKey=requestedGrade&&requestedYear?`mehyar_budget_${requestedYear}_${requestedGrade}`:'';
        const allBudgetKeys=[];try{for(let q=0;q<localStorage.length;q++){const kk=localStorage.key(q);if(kk&&kk.startsWith('mehyar_budget_'))allBudgetKeys.push(kk);}}catch(_){}
        let budget=null,budgetKey='',budgetSource='',budgetYearAssumed=false;
        for(const key of [...new Set([indexedKey,exactKey,legacyKey,...allBudgetKeys].filter(value=>typeof value==='string'&&value.startsWith('mehyar_budget_')))]){
          try{
            const candidate=JSON.parse(localStorage.getItem(key)||'null');if(!candidate||!Array.isArray(candidate.months))continue;candidate.months=candidate.months.filter(m=>m&&typeof m==='object');
            const candidateGrade=cleanGrade(candidate.grade),candidateYear=cleanYear(candidate.academicYear),keyMatches=key===exactKey||key===legacyKey,unscopedGradeMatch=!!requestedYear&&key===indexedKey&&key===`mehyar_budget_${requestedGrade}_`&&!!requestedGrade&&candidateGrade===requestedGrade&&!candidateYear;
            if(requestedGrade&&candidateGrade&&candidateGrade!==requestedGrade||requestedYear&&candidateYear&&candidateYear!==requestedYear&&!requestedYear.startsWith(candidateYear)&&!candidateYear.startsWith(requestedYear))continue;
            if((requestedGrade&&!candidateGrade||requestedYear&&!candidateYear)&&!keyMatches&&!unscopedGradeMatch)continue;
            if(!requestedGrade&&candidateGrade)requestedGrade=candidateGrade;if(!requestedYear&&candidateYear)requestedYear=candidateYear;
            budget=candidate;budgetKey=key;budgetSource='annual_budget_storage';budgetYearAssumed=unscopedGradeMatch;break;
         }catch(_){}
       }
       if(!budget&&requestedGrade&&requestedYear){try{const legacy=get_budget({grade:requestedGrade,year:requestedYear});if(legacy&&Array.isArray(legacy.months)){legacy.months=legacy.months.filter(m=>m&&typeof m==='object');budget=legacy;budgetKey=`budget_${requestedGrade}_${requestedYear}`;budgetSource='legacy_budget_storage';}}catch(_){}}
       const monthOrder=['مهر','آبان','آذر','دی','بهمن','اسفند','فروردین','اردیبهشت','خرداد'],monthKey=value=>normKey(String(value||'').replace(/ماه$/,''));
       let budgetTopics=budget?.months?.slice().sort((a,b)=>monthOrder.findIndex(x=>monthKey(x)===monthKey(a.monthName||a.month))-monthOrder.findIndex(x=>monthKey(x)===monthKey(b.monthName||b.month))).flatMap(month=>[
         ...(Array.isArray(month.subjects)?month.subjects:[]).filter(item=>item&&typeof item==='object').flatMap(item=>(Array.isArray(item.topics)?item.topics:[]).map(topic=>({month:month.monthName||month.month||'',subject:String(item.subjectTitle||item.subject||''),topic:String(topic||'').trim()}))),
         ...(Array.isArray(month.lessons)?month.lessons:[]).filter(item=>item&&typeof item==='object').map(item=>({month:month.monthName||month.month||'',subject:String(item.name||item.subjectTitle||''),topic:String(item.topic||item.lesson||'').trim()}))
       ]).filter(item=>item.topic)||[];
       if(!budgetTopics.length&&requestedGrade){
         try{
           const entries=MehryarTools.getCurriculumBudget?.({grade:requestedGrade,year:requestedYear})||[],books=new Map((state.curriculum?.books||[]).map(book=>[book.id,book])),nodes=new Map();
           const walk=items=>{for(const node of Array.isArray(items)?items:[]){if(node?.id)nodes.set(node.id,node);walk(node.children);}};
           for(const book of books.values())walk(book.nodes);
           budgetTopics=entries.map(entry=>{const book=books.get(entry.bookId),node=nodes.get(entry.nodeId),date=validDay(entry.startDate)?entry.startDate:'',month=entry.month||entry.period||(date?new Intl.DateTimeFormat('fa-IR',{month:'long'}).format(dateObj(date)):'');return {month,subject:entry.subject||book?.subject||'',topic:String(entry.nodeTitle||node?.title||'').trim(),startDate:date};}).filter(item=>item.topic).sort((a,b)=>String(a.startDate||'9999-99-99').localeCompare(String(b.startDate||'9999-99-99')));
           if(budgetTopics.length){budget={grade:requestedGrade,academicYear:requestedYear,entries:budgetTopics};budgetKey='';budgetSource='curriculum_budget';}
         }catch(_){}
       }
       const subjectKey=value=>normKey(String(value||'')),promptKey=normKey(prompt),subjects=[...new Set(budgetTopics.map(item=>item.subject).filter(Boolean))],inferredSubject=subjects.find(label=>{const key=subjectKey(label);return key&&promptKey.includes(key)||key.split(/\s+/).some(token=>token.length>2&&promptKey.includes(token));})||(m=>m.length===1?m[0]:undefined)(subjects.filter(label=>String(label).split(/[\s()\[\]،,\-–/]+/).map(subjectKey).some(t=>t.length>2&&promptKey.includes(t)))),requestedSubject=String(subject||inferredSubject||'').trim(),matchedSubject=requestedSubject?(subjects.find(label=>subjectKey(label)===subjectKey(requestedSubject)||subjectKey(label).includes(subjectKey(requestedSubject))||subjectKey(requestedSubject).includes(subjectKey(label)))||''):'',selectedSubject=matchedSubject||requestedSubject,subjectFound=!selectedSubject||!!matchedSubject;
       const sessions=selectSessions(state,{to:localISO()}),sessionById=new Map(sessions.map(session=>[session.id,session]));
       const allObservations=getDirectObservations(state,{to:localISO()}).filter(row=>{const rowGrade=cleanGrade(state.learning.studentMeta?.[row.studentId]?.grade||state.klass?.grade);return !requestedGrade||rowGrade===requestedGrade;}).map(row=>{
         const session=sessionById.get(row.sessionId),student=studentById(row.studentId);
         return {date:row.date,studentId:row.studentId,studentName:student?.name||'',subject:row.subject||session?.subject||'',topic:String(session?.lessonTitle||row.skillLabel||session?.skillLabel||'').trim(),skill:row.skillLabel||'',status:row.status,errors:(row.errors||[]).slice(0,2).map(value=>String(value).slice(0,80)),note:String(row.note||'').slice(0,120),sequence:Number(row.sequence)||0};
       });
       const taughtCandidates=[];
       for(const book of state.curriculum?.books||[]){
         if(requestedGrade&&book.grade&&cleanGrade(book.grade)!==requestedGrade||requestedYear&&book.academicYear&&cleanYear(book.academicYear)!==requestedYear)continue;
         if(selectedSubject&&subjectKey(book.subject)!==subjectKey(selectedSubject))continue;
         const progress=state.curriculum?.teachingProgress?.[book.id]||{},nodes=[];const flatten=items=>{for(const node of Array.isArray(items)?items:[]){nodes.push(node);flatten(node.children);}};flatten(book.nodes);const last=nodes.filter(node=>progress.statuses?.[node.id]==='taught').at(-1);
         if(last)taughtCandidates.push({topic:last.title,subject:book.subject||'',date:String(progress.updatedAt||''),source:'curriculum_teaching_progress'});
       }
       const matchingObservations=allObservations.filter(row=>row.topic&&(!selectedSubject||subjectKey(row.subject)===subjectKey(selectedSubject))),latestObservation=matchingObservations.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.sequence-b.sequence).at(-1);
       if(latestObservation?.topic)taughtCandidates.push({topic:latestObservation.topic,subject:latestObservation.subject,date:latestObservation.date,source:'direct_observation'});
       taughtCandidates.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
       const lastTopicTaught=taughtCandidates.at(-1)||null,topicKey=value=>normKey(persianDigitsToLatin(String(value||''))),sequenceTopics=(selectedSubject?budgetTopics.filter(item=>subjectKey(item.subject)===subjectKey(selectedSubject)):lastTopicTaught?.subject?budgetTopics.filter(item=>subjectKey(item.subject)===subjectKey(lastTopicTaught.subject)):budgetTopics),lastIndex=lastTopicTaught?sequenceTopics.findLastIndex(item=>topicKey(item.topic)===topicKey(lastTopicTaught.topic)):-1;
       const nextBudgetTopic=lastIndex>=0?sequenceTopics[lastIndex+1]||null:!lastTopicTaught?sequenceTopics[0]||null:null;
       const dayOffset=promptKey.includes(normKey('پس‌فردا'))?2:(promptKey.includes('امروز')&&!promptKey.includes('فردا'))?0:1;
       const scheduleHint=(selectedSubject||lastTopicTaught?.subject)?budgetScheduleHint(sequenceTopics,lastIndex,monthKey,new Date(),dayOffset):null;
       const scheduleBySubject=(selectedSubject||lastTopicTaught?.subject)?null:subjects.map(subj=>{
         const seq=budgetTopics.filter(item=>subjectKey(item.subject)===subjectKey(subj)),cands=taughtCandidates.filter(c=>subjectKey(c.subject)===subjectKey(subj)),last=cands.at(-1)||null,idx=last?seq.findLastIndex(item=>topicKey(item.topic)===topicKey(last.topic)):-1,hint=budgetScheduleHint(seq,idx,monthKey,new Date(),dayOffset);
         return hint?{subject:subj,...hint}:null;
       }).filter(Boolean);
       const otherSavedBudgets=[];if(!budget){try{for(let k=0;k<localStorage.length;k++){const sk=localStorage.key(k);if(!sk||!sk.startsWith('mehyar_budget_'))continue;const sc=JSON.parse(localStorage.getItem(sk)||'null');if(sc&&Array.isArray(sc.months))otherSavedBudgets.push({grade:cleanGrade(sc.grade)||'نامشخص',academicYear:cleanYear(sc.academicYear)||'نامشخص',topics:sc.months.reduce((n,m)=>n+(m.subjects||[]).reduce((x,y)=>x+(y.topics||[]).length,0),0)});}}catch(_){}}
        const safeOffset=Number.isInteger(offset)&&offset>=0?offset:0,safeLimit=Number.isInteger(limit)?clamp(limit,1,200):100,observations=allObservations.slice(safeOffset,safeOffset+safeLimit).map(({sequence,...row})=>row);
        return {grade:requestedGrade,academicYear:requestedYear,subject:selectedSubject||null,subjectFound,budget:budget&&safeOffset===0?budget:null,budgetKey:budgetKey||null,budgetSource:budgetSource||null,budgetYearAssumed,observations,totalObservations:allObservations.length,offset:safeOffset,nextOffset:safeOffset+safeLimit<allObservations.length?safeOffset+safeLimit:null,lastTopicTaught,nextBudgetTopic,topicMatch:lastIndex>=0,scheduleHint,scheduleBySubject,otherSavedBudgets,budgetHint:!budget&&otherSavedBudgets.length?`برای پایهٔ ${requestedGrade||'؟'} و سال ${requestedYear||'؟'} بودجه‌ای پیدا نشد، اما بودجهٔ ثبت‌شده برای ${otherSavedBudgets.map(b=>`پایهٔ ${b.grade} و سال ${b.academicYear}`).join('، ')} هست. به معلم بگو پایه یا سالِ کلاس فعال با بودجهٔ ثبت‌شده یکی نیست؛ از او نخواه بودجه را دوباره پیست کند.`:null};
     }
  const str=description=>({type:'STRING',description});
  const declarations=[
    {name:'read_class_data',description:'Read live app data. Use for every factual answer about this class. latestLearning returns the last observed record per student/skill with name; use status to filter its colors. No phone, health, address, credentials. Paginated items: follow nextOffset until null for full lists; summary counts are complete. Default: all active grades, all history until today. Plans/followups are current lists including future dates; attendance and observations obey the date range.',parameters:{type:'OBJECT',properties:{section:{type:'STRING',enum:sections},studentId:str('Exact student ID or full unique name'),skillId:str('Existing skill ID'),status:{type:'STRING',enum:['red','yellow','green'],description:'Only filters latestLearning, not summary'},subject:str('Exact subject'),grade:str('Exact Persian grade, omit for all'),from:str('Gregorian ISO YYYY-MM-DD inclusive; omit for all history'),to:str('Gregorian ISO date'),offset:{type:'INTEGER'},limit:{type:'INTEGER'}},required:['section']}},
     {name:'prepare_teacher_report',description:'Propose 1-50 changes from an explicit teacher report/request. NEVER writes directly; teacher must approve the visible preview. Resolve existing student and skill IDs using read_class_data first. Do not infer dates, skills, causes, observed evidence or results. Use one batch for the whole report. Unsupported edits/deletes must be done in the app. Do not call for hypothetical examples or advice.',parameters:{type:'OBJECT',properties:{changes:{type:'ARRAY',items:{type:'OBJECT',properties:{type:{type:'STRING',enum:Object.keys(labels)},studentId:str('Existing exact ID; omitted only for agreement'),skillId:str('Required for observation/homework/followup'),subject:str('Optional exact subject'),date:str('Gregorian ISO date; omitted means today'),status:str('observation: red/yellow/green; attendance: present/absent/late; homework: complete/partial/missing; shortage: has/missing/unknown'),text:str('Action, agreement or note text'),note:str('Optional teacher evidence'),errors:{type:'ARRAY',items:str('Observed mistake, never inferred diagnosis')},dueOn:str('Required Gregorian ISO deadline for followup/agreement/parentMeeting'),item:str('Exact existing firstDayItems entry for shortage'),assessmentSkill:{type:'STRING',enum:['fa','math','reading','dictation','attention']},level:{type:'INTEGER',description:'Assessment: 0 weak, 1 needs practice, 2 acceptable, 3 good'},role:str('Existing responsibility role'),practice:str('Required practical exercise for agreement'),question:str('Optional family question'),owner:str('Required action owner for parentMeeting')},required:['type']} }},required:['changes']}}
  ];
  declarations[0].parameters.properties.includeArchived={type:'BOOLEAN',description:'students only: include archived students for exact ID discovery and restoration. Other reads remain active-only.'};
  declarations[1].description='Propose 1-50 explicit teacher-requested changes in one batch; never writes before visible teacher confirmation. For a report explicitly about the whole class or all children, observation, attendance, homework or assessment changes may use allStudents=true or scope=class; never choose one child as a proxy. Student operations: add (name/grade), update (name/grade/archived). No permanent student deletion. followupUpdate and parentMeetingUpdate require recordId AND its studentId. Keep identity/skill unchanged. A followup outcome needs a related recheckSessionId; done never means improved. skillAdd needs text and subject. plan7Task adds/updates/deletes a task, not the entire plan. Unsupported operations must be done in the app. Never register hypothetical examples or infer observed evidence.';
   declarations[1].description+=' If the teacher explicitly says the whole class did not know or could not do a skill, prepare class-wide observation records with status red; if only some need practice use yellow; if the whole class is explicitly proficient use green. Do not replace an explicit individual attendance record with a class-wide attendance record. If one message names a student and also describes the whole class, keep those as separate records; never expand a named student to the whole class, and ask for the exact roster identity or skill when either is unclear.';
  Object.assign(declarations[1].parameters.properties.changes.items.properties,{
    name:str('Full student name for studentAdd/studentUpdate'),
    grade:{type:'STRING',enum:PD_GRADES,description:'Required on studentAdd; optional on studentUpdate'},
    archived:{type:'BOOLEAN',description:'studentUpdate only: true archives without deleting history; false restores'},
    recordId:str('Exact existing followup/parentMeeting/plan7 task ID, obtained from read_class_data'),
    outcome:{type:'STRING',enum:Object.keys(FOLLOW_OUTCOME)},
    recheckSessionId:str('Existing observed session for the SAME student and skill, on/after followup creation, not future'),
    nextResult:str('Explicitly reported next parent-meeting result; never inferred'),
    action:{type:'STRING',enum:['add','update','delete'],description:'plan7Task only'},
    dayIndex:{type:'INTEGER',description:'plan7Task add: day number 1-7, NOT a weekday or Gregorian date'},
    done:{type:'BOOLEAN',description:'plan7Task update only'},
    link:str('plan7Task output key from tools href #/output/KEY, or empty for no link')
  });
  const props=declarations[1].parameters.properties.changes.items.properties;
  props.allStudents={type:'BOOLEAN',description:'observation, attendance, homework or assessment only: explicitly repeat this record for every active student in the class or selected grade'};
  props.scope={type:'STRING',enum:['student','class'],description:'observation, attendance, homework or assessment only: use class only when the teacher explicitly reports the whole class'};
  Object.assign(props,Object.fromEntries(['worked','difficulty','nextStep'].map(k=>[k,str('teachingReport only: explicit teacher-reported '+k+'; omit if not reported, never invent')])));
  props.planId=str('teachingReport: optional existing related lesson plan ID');
  props.activityId=str('teachingReport: optional existing related activity ID');
     props.budget={type:'OBJECT',description:'curriculumBudget: accept one human table or text block from the teacher. The app automatically reads the active class, grade, school year, books and topics, extracts rows, dates/months/weeks, activity type and sessions, matches existing records, proposes missing teacher-imported dependencies in the same preview, and commits everything only after one teacher confirmation. Prefer text or table; structured rows are optional. Never ask the teacher for bookId or nodeId, never invent missing data, and preserve each original row. Book-level budget rows are valid without a node.',properties:{mode:{type:'STRING',enum:['replace','append'],description:'replace active-grade rows or append new non-duplicate rows'},text:str('Raw teacher budget text; preferred input, preserved row by row'),table:str('Raw teacher table copied from a spreadsheet or document; use instead of rows when available'),rawText:str('Alias for the raw teacher text or table'),rows:{type:'ARRAY',items:{type:'OBJECT',properties:{originalText:str('Original teacher row or sentence, preserved verbatim'),grade:str('Human grade if stated'),bookTitle:str('Human book title if stated'),subject:str('Human subject or lesson name'),chapter:str('Human chapter or فصل'),lesson:str('Human lesson title'),topic:str('Human topic or مبحث title'),month:str('Explicit month or ماه if stated'),week:str('Explicit week or هفته if stated'),period:str('Explicit period or بازه if stated'),activity:str('Explicit activity type if stated'),startDate:str('Explicit Gregorian or Persian date if stated'),endDate:str('Explicit Gregorian or Persian date if stated'),sessions:{type:'INTEGER',description:'Explicit number of sessions; omit when not stated so the row stays نیازمند بررسی'},programType:str('Teaching, review, assessment or other teacher-stated type'),note:str('Optional source note')},required:['originalText']}},source:str('Optional short source label'),schoolDays:{type:'ARRAY',items:{type:'INTEGER'},description:'Optional school weekdays, 0 Sunday through 6 Saturday'},weekStart:{type:'INTEGER',description:'Optional week start, 0 Sunday through 6 Saturday'},holidays:{type:'ARRAY',items:str('Explicit holiday date')}},required:['mode']};
  const strings={type:'ARRAY',items:str('Explicit text or existing ID as described')};
  props.plan={type:'OBJECT',description:'dailyPlan: new plan requires date, skillId and all textual fields/slots/grade here; existing recordId updates only supplied fields. Unassigned students remain unknown, never infer learning colors. No execution result is recorded.',properties:{grade:{type:'STRING',enum:GRADES},materials:str('Materials separated by Persian comma; empty means none'),activityText:str('Activity and practice instructions'),board:str('Board instructions'),exitCheck:str('Planned exit assessment, not an observed result'),activityIds:strings,groups:{type:'OBJECT',description:'Optional exact student IDs by group; omitted students stay unknown',properties:Object.fromEntries(['teacher','practice','independent','unknown','absent'].map(k=>[k,strings]))},slots:{type:'ARRAY',items:{type:'OBJECT',properties:{minutes:{type:'INTEGER'},...Object.fromEntries(['teacher','teacherGroup','practiceGroup','independentGroup','unknownGroup'].map(k=>[k,str('Explicit work for this group during this time slot')]))},required:['minutes','teacher','teacherGroup','practiceGroup','independentGroup','unknownGroup']}}}};
  props.activity={type:'OBJECT',description:'activity: create with skillId and all fields, or edit exact recordId using supplied fields. Built-in edits make a custom override; originals remain intact.',properties:{title:str('Activity title'),grades:{type:'ARRAY',items:{type:'STRING',enum:PD_GRADES}},materials:strings,steps:strings,durationMinutes:{type:'INTEGER'},practice:{type:'OBJECT',properties:Object.fromEntries(['simple','medium','challenge'].map(k=>[k,str('Practice instructions')]))},...Object.fromEntries(['diagnosticPrompt','observationGuide','independentInstructions','exitCheck','teacherNote'].map(k=>[k,str('Required educational instructions, not invented observations')]))}};
  declarations[1].description+=' dailyPlan saves/edits a lesson plan for the given date in the native tomorrow section. activity creates/edits an activity; use read_class_data first for skills and existing records. Teacher may explicitly request generating and saving a teaching plan/activity; label it a proposal, never fabricate learning results.';
  const dateDescription='Gregorian YYYY-MM-DD, explicit Persian YYYY/MM/DD, or exact امروز/دیروز/پریروز/فردا/پس‌فردا. Pass teacher date literally; app converts. Ask about ambiguous weekdays or dates without year.';
  for(const k of ['date','dueOn'])props[k].description=dateDescription+(k==='date'?'; omitted means today except existing plan/meeting dates are preserved. New dailyPlan requires date.':' ; deadline required on followup/agreement/parentMeeting creation');
  for(const k of ['from','to'])declarations[0].parameters.properties[k].description=dateDescription;
   props.studentId.description='Existing exact ID; omitted for agreement, studentAdd, skillAdd, plan7Task, dailyPlan, activity';
  props.date.description+=' followupUpdate: completion date only with done/closed, not a general edit timestamp.';
  declarations[1].parameters.properties.changes.items.properties.status.description+='; followupUpdate: planned/done/continue/closed';

  declarations[0].parameters.properties.date=str('bag only: explicit date, default tomorrow. Other reads use from/to.');
  Object.assign(props,{
    settings:{type:'OBJECT',properties:{teacher:str('Teacher name'),school:str('School name'),grade:{type:'STRING',enum:GRADES},className:str('Class name'),year:str('School year'),trackingStartedOn:str(dateDescription),weekStart:{type:'INTEGER',description:'0 Sunday, 1 Monday, 2 Tuesday, 3 Wednesday, 4 Thursday, 5 Friday, 6 Saturday'},schoolDays:{type:'ARRAY',items:{type:'INTEGER'}},unseenThreshold:{type:'INTEGER'},radarLimit:{type:'INTEGER'}}},
    listKey:{type:'STRING',enum:Object.keys(listLabels)},group:{type:'STRING',enum:['teacher','practice','independent','auto']},
    message:{type:'OBJECT',properties:{title:str('Template title'),scope:{type:'STRING',enum:['general','individual']},template:str('Plain text; supported placeholders: {نام} {آموزگار} {پایه} {کلاس} {مدرسه} {تلفن} {تاریخ} {ساعت} {مکان} {توضیح} {وسایل} {قوانین} {موارد} {مهلت}')}}
  });
  props.type.enum=Object.keys(labels);
  props.action.description='plan7Task, listItem, messageTemplate: add/update/delete. listItem update renames exact item to text; used roles cannot be renamed/deleted.';
  props.done.description='plan7Task update or bagCheck: explicit boolean';
  props.item.description='Exact existing supply entry, listItem old title, or bag item returned by read';
  props.recordId.description+='; messageTemplate uses the exact existing message key';
  props.studentId.description+='; also omit for classSettings, learningSettings, listItem, bagCheck, messageTemplate';
    declarations[1].description+=' classSettings changes only supplied settings (teacher,school,grade,className,year), not individual grades. learningSettings changes trackingStartedOn/weekStart/schoolDays/unseenThreshold/radarLimit. listItem edits one entry in listKey with action/item/text; no wholesale replacement. pathMove needs studentId/skillId/group and does not change evidence. bagCheck needs tomorrow date, exact item and done. messageTemplate add needs message title/scope/template; update/delete need recordId. curriculumBudget accepts one human text/table through budget.text or budget.table; the app reads the active class, grade, year, books and topics, extracts fields, matches existing records and proposes missing teacher-imported dependencies in the same preview. Structured rows are optional. Never request or require bookId/nodeId, never invent missing values, and preserve unresolved rows. Book-level rows may omit a node. Only the single teacher approval commits the matched rows and dependencies. Read settings/paths/bag/messages first. Never send messages automatically.';


  const printSchema={type:'OBJECT',properties:{...Object.fromEntries(printBools.map(k=>[k,{type:'BOOLEAN'}])),...Object.fromEntries(printStrings.map(k=>[k,str('Explicit print text, empty to clear')])),fontSize:{type:'STRING',enum:['sm','md','lg']},sortBy:{type:'STRING',enum:['no','name']},extraBlank:{type:'INTEGER'},texts:{type:'ARRAY',items:{type:'OBJECT',properties:{key:str('Existing text key from outputSettings read'),text:str('Replacement plain text')},required:['key','text']}}}};
  const outputProps={outputKey:{type:'STRING',enum:outputKeys},studentIds:{type:'ARRAY',items:str('Exact existing student ID')},allStudents:{type:'BOOLEAN'},printSettings:printSchema};
  Object.assign(props,outputProps);props.type.enum=Object.keys(labels);props.studentId.description+='; omit for outputSettings';
  declarations[0].parameters.properties.outputKey=outputProps.outputKey;
  declarations[1].description+=' outputSettings persists only supplied printSettings and explicit selection after teacher confirmation; read outputSettings/outputKey for supported text keys. Use prepare_output_preview instead for a temporary preview without changing saved settings.';
   declarations[0].description+=' lessonContext: evidence-first teaching context, default last 42 days, prioritized skill aggregates with bounded evidence samples, recurring errors, trends across distinct days, previous teacher reports, followups and matching activities. Counts complete within range, not samples. Use limit 4 for an overview; use skillId/grade for details. teachingReports reads saved teacher experience, not measured outcomes. homework reads homework-only records too. attendance returns each recorded date, studentId, student name, grade and status; for questions such as who was late or absent, read attendance and filter status instead of inferring from summary counts.';
  declarations[1].description+=' teachingReport saves teacher-described classroom teaching experience with skillId, text, optional grade/worked/difficulty/nextStep/planId/activityId; no studentId and no invented learning color. It is persistent context for subsequent recommendations, not model training. A current pending draft may be revised: submit its COMPLETE replacement changes, preserving unchanged fields. Invalid revisions do not remove the prior draft. Approval is always a local teacher button, never a model tool.';
  props.studentId.description+='; omit for teachingReport or class-wide observation/attendance/homework/assessment when allStudents=true or scope=class';
  props.grade.description+='; optional teachingReport grade, omit only for whole mixed-grade class';
  declarations.push({name:'prepare_output_preview',description:'Prepare a LOCAL print or parent-message preview from live data; does not save settings, print, copy or send. Read tools/outputSettings/students first. Individual outputs require explicit studentIds or allStudents. messages requires messageKey, and individual templates also require explicit recipients. Preview content including phone fields remains local and is NEVER returned to the model. Teacher opens preview and chooses print/copy.',parameters:{type:'OBJECT',properties:{...outputProps,messageKey:str('Existing message template key; only for messages')},required:['outputKey']}});
    declarations.push({name:'get_budget',description:'Read a legacy teacher-confirmed raw budget for the exact grade and school year. New imports use the native curriculum budget and are read from there.',parameters:{type:'OBJECT',properties:{grade:str('Exact grade stored with the legacy budget'),year:str('Exact normalized school year key')},required:['grade','year']}});
     declarations.push({name:'get_budget_and_progress',description:'Read the saved annual or curriculum budget, direct observations for the grade, the last taught topic and the next topic in order within the requested subject. If the teacher named a subject, pass it. Follow nextOffset until null; only offset zero includes the budget payload.',parameters:{type:'OBJECT',properties:{grade:str('Exact grade, for example ششم'),academicYear:str('Exact school year, for example 1405-1406'),subject:str('Exact requested subject from the teacher prompt, when stated'),offset:{type:'INTEGER',description:'Observation page offset; default 0'},limit:{type:'INTEGER',description:'Observation page size; default 100, maximum 200'}},required:['grade','academicYear']}});

  const assistantRevision=()=>JSON.stringify({
    klass:{teacher:state.klass?.teacher||'',school:state.klass?.school||'',grade:state.klass?.grade||'',className:state.klass?.className||'',year:state.klass?.year||''},
    students:(state.students||[]).map(student=>({id:student.id,name:student.name,no:student.no,grade:state.learning?.studentMeta?.[student.id]?.grade||'',archived:!!state.learning?.studentMeta?.[student.id]?.archived})),
    learning:state.learning,
    curriculum:{scopeKey:state.curriculum?.scopeKey||'',budget:state.curriculum?.budget||{}}
  });
    return {read,prepare,commit,undo,localAnswer,get_budget,get_budget_and_progress,catalog,declarations,draftContext,revision:assistantRevision,get proposal(){return proposal;},get canUndo(){const r=currentUndo();return !!r&&domain(state)===r.after&&r.planDraft===JSON.stringify(planDraft);},prepareOutput,viewOutput,get outputPreview(){return outputPreview;},clear(){proposal=null;undoRecord=null;outputPreview=null;},dismiss(){proposal=null;outputPreview=null;}};
})();

