  const FAC_OPTIONS = ['تخته', 'کامپیوتر', 'ویدئوپروژکتور', 'پرینتر', 'اینترنت', 'هیچ‌کدام'];
  function settingsHtml() {
    return `<section class="v5-panel" aria-label="حالت و امکانات کلاس"><b>حالت و امکانات کلاس (برای پیشنهادهای واقعی‌تر)</b>
      <label>حالت کلاس <select id="v5-mode">${CLASS_MODES.map(m => `<option ${m === store.classMode ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <div class="v5-facs">${FAC_OPTIONS.map(f => `<label><input type="checkbox" data-v5-fac="${esc(f)}" ${store.facilities.includes(f) ? 'checked' : ''}> ${esc(f)}</label>`).join('')}</div>
      <details><summary>حافظهٔ زندهٔ کلاس (class_state)</summary><pre class="v5-state">${esc(classStateText())}</pre><button type="button" class="v5-link danger" id="v5-state-reset">پاک کردن حافظهٔ کلاس</button></details>
      <div class="v5-row"><button type="button" class="btn btn-primary" id="v5-settings-save">ذخیره</button><button type="button" class="btn btn-tinted-gray" id="v5-panel-close">بستن</button></div></section>`;
  }
  function readSettings() {
    const mode = document.getElementById('v5-mode')?.value;
    if (CLASS_MODES.includes(mode)) store.classMode = mode;
    const f = [...document.querySelectorAll('[data-v5-fac]')].filter(x => x.checked).map(x => x.dataset.v5Fac);
    store.facilities = f.includes('هیچ‌کدام') ? ['هیچ‌کدام'] : f.filter(x => FAC_OPTIONS.includes(x)); save();
  }
  function wireFacilities() {
    const boxes = [...document.querySelectorAll('[data-v5-fac]')];
    boxes.forEach(box => box.addEventListener('change', () => {
      if (!box.checked) return;
      boxes.forEach(other => { if (other !== box && (box.dataset.v5Fac === 'هیچ‌کدام' || other.dataset.v5Fac === 'هیچ‌کدام')) other.checked = false; });
    }));
  }
  function resetClassState() { store.classState = { main_track: '', lagging_group: '', advanced_group: '', last_action: '', what_failed: [], updatedAt: '' }; save(); }
  function growthPickerHtml() {
    const list = students();
    return `<section class="v5-panel"><b>گزارش رشد یک شاگرد</b><p>کل سوابق رشدِ همین شاگرد از روز اول برای مهریار فرستاده می‌شود.</p><label>شاگرد <select id="v5-growth-student">${list.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></label><div class="v5-row"><button type="button" class="btn btn-primary" id="v5-growth-go" ${list.length ? '' : 'disabled'}>نوشتن گزارش</button><button type="button" class="btn btn-tinted-gray" id="v5-panel-close">بستن</button></div></section>`;
  }
  // Card for the «نبض کلاس» dashboard (reminders + live class state).
  function pulseCardHtml() {
    const t = today(), tom = plusDays(t, 1), rem = store.reminders.filter(r => !r.done && r.when >= t && r.when <= plusDays(t, 7)).sort((a, b) => a.when.localeCompare(b.when)).slice(0, 5);
    const cs = store.classState;
    if (!rem.length && !cs.main_track && !cs.lagging_group) return '';
    return `<section class="v5-pulse"><h3>مهریار · یادآورها و حافظهٔ کلاس</h3>${rem.length ? `<ul>${rem.map(r => `<li><span>${r.when === t ? 'امروز' : r.when === tom ? 'فردا' : esc(displayDay(r.when))}</span> ${esc(r.title)} <button type="button" class="v5-link" data-v5-done="${esc(r.id)}">انجام شد</button></li>`).join('')}</ul>` : '<p>یادآور نزدیکی ثبت نشده است.</p>'}${cs.main_track ? `<p><b>مسیر اکثریت:</b> ${esc(cut(cs.main_track, 120))}</p>` : ''}${cs.lagging_group ? `<p><b>جامانده‌ها:</b> ${esc(cut(cs.lagging_group, 120))}</p>` : ''}<a class="btn btn-tinted-gray" href="#/pulse/assistant">${briefingDue() ? 'بریفینگ صبح امروز' : 'گفت‌وگو با مهریار'}</a></section>`;
  }
  function reminderDone(id) { const r = store.reminders.find(x => x.id === id); if (r) { r.done = true; save(); } }

  return { FAST_MODEL, DEEP_MODEL, ask, applyActions, undoActions, fixAction, canUndo, splitActions, scheduleStateUpdate, route, buildSystem, syllabusMap, toolsSummary, studentsBlock, mentionedStudents, classStateText, pruneClassState, norm,
    wireFacilities, pulseSnapshot, radarData, radarHtml, radarItems, remember, recall, clearMemory, rankMemories, verifiedActions, explicitProgress,
    voiceToggle, voiceStop, micHtml, paintVoice, receiptHtml, stageText, settingsHtml, readSettings, resetClassState, growthPickerHtml, pulseCardHtml, reminderDone, briefingDue,
    get store() { return store; } };
})();
