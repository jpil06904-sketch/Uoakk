
  /* ---------- ۵) free voice input (client-side Web Speech API, no audio sent to any API) ---------- */
  const VOICE_FAIL = 'برای تایپِ صوتی، از میکروفونِ خودِ کیبوردِ گوشی استفاده کنید 🎙️';
  const voice = { rec: null, on: false, interim: '' };
  function paintVoice() {
    const b = document.getElementById('v5-mic'), i = document.getElementById('v5-interim');
    if (b) { b.classList.toggle('rec', voice.on); b.setAttribute('aria-pressed', voice.on ? 'true' : 'false'); b.title = voice.on ? 'توقف ضبط' : 'گفتن به‌جای نوشتن'; }
    if (i) { i.textContent = voice.interim; i.hidden = !voice.interim; }
  }
  function appendToComposer(txt) {
    const input = document.getElementById('ai-message'); if (!input || !txt || !txt.trim()) return;
    const cur = input.value, sep = cur && !/\s$/.test(cur) ? ' ' : '';
    input.value = cur + sep + txt.trim();
    input.dispatchEvent(new Event('input', { bubbles: true })); // keeps app draft/counter/autosize in sync
  }
  // sending=true: message is being sent → recognition.stop() and ignore late results.
  function voiceStop(sending) { voice.interim = ''; if (sending) voice.ignore = true; if (voice.rec) { try { voice.rec.stop(); } catch (_) {} } voice.on = false; paintVoice(); }
  function voiceToggle() {
    if (voice.on) { voiceStop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { ui.toast(VOICE_FAIL); return; }
    try {
      const rec = new SR(); rec.lang = 'fa-IR'; rec.interimResults = true; rec.continuous = true;
      voice.ignore = false;
      rec.onresult = e => {
        if (voice.ignore || voice.rec !== rec) return;
        let interim = '';
        for (let k = e.resultIndex; k < e.results.length; k++) {
          const r = e.results[k], t = r[0]?.transcript || '';
          if (r.isFinal) appendToComposer(t); else interim += t; // final text is appended, never auto-sent
        }
        voice.interim = interim.trim(); paintVoice();
      };
      rec.onerror = e => { if (e.error !== 'no-speech' && e.error !== 'aborted') ui.toast(VOICE_FAIL); voice.on = false; voice.interim = ''; paintVoice(); };
      rec.onend = () => { voice.on = false; voice.interim = ''; paintVoice(); };
      voice.rec = rec; rec.start(); voice.on = true; paintVoice();
    } catch (_) { voice.on = false; ui.toast(VOICE_FAIL); paintVoice(); }
  }
  const micHtml = disabled => `<button type="button" id="v5-mic" class="v5-mic${voice.on ? ' rec' : ''}" aria-label="ضبط صدا" aria-pressed="${voice.on}" ${disabled ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>`;

  /* ---------- UI helpers ---------- */
  function receiptHtml(r, i) {
    if (!r || !r.items?.length) return '';
    const live = canUndo(r);
    return `<div class="v5-receipt${r.undone ? ' undone' : ''}" role="status"><b>${r.undone ? 'لغو شد' : 'ثبت در ابزارها'}</b>${r.items.map((it, j) => `<span class="v5-chip ${it.ok ? 'ok' : 'warn'}">${it.ok ? '✓' : '⚠'} ${esc(it.label)}${live && it.action && it.action.tool !== 'reminder' ? ` <button type="button" class="v5-link" data-v5-fix="${i}:${j}">اصلاح</button>` : ''}</span>`).join('')}${live ? `<button type="button" class="v5-link danger" data-v5-undo="${i}">لغو</button>` : ''}</div>`;
  }
  const TYPING_DOTS = '<span class="ai-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
  // No timer of its own: the caller repaints on interval and probes every 3s.
  // 0-3s reading, 3-8s working (wording splits by route), then a calm long-wait line.
  function stageText(stage, sec) {
    if (stage === 'thinking') return 'در حال فکر کردن…' + TYPING_DOTS;
    const s = Math.max(0, Number(sec) || 0);
    if (s < 3) return 'در حال خواندن پیام…' + TYPING_DOTS;
    if (s < 8) return (stage === 'FAST' ? 'در حال نوشتن…' : 'مهریار در حال فکر کردن…') + TYPING_DOTS;
    return 'در حال آماده‌سازی پاسخ دقیق‌تر…' + TYPING_DOTS;
  }
