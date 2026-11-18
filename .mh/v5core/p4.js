
  /* ---------- network: auth = {key, panel:{base,id}|null} ---------- */
  // A panel page can be opened from a content:// APK or a file:// download; the
  // request must still leave for an absolute https address, never a relative one.
  function panelEndpoint(auth, model, stream) {
    const base = String(auth.panel && auth.panel.base || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) { const e = new Error('آدرس پنل کامل نیست؛ فایل را از نشانی کامل هاست باز کن.'); e.code = 'MODEL_NETWORK'; throw e; }
    return { url: base + '/api.php?a=' + (stream ? 'ais' : 'ai') + '&m=' + encodeURIComponent(model), init: b => ({ method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: auth.key + '|' + auth.panel.id + '\n' + JSON.stringify(b) }) };
  }
  function endpoint(auth, model, stream) {
    return auth.panel ? panelEndpoint(auth, model, stream)
      : { url: 'https://generativelanguage.googleapis.com/v1beta/models/' + model + (stream ? ':streamGenerateContent?alt=sse' : ':generateContent'), init: b => ({ method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': auth.key }, body: JSON.stringify(b) }) };
  }
  const textOf = d => (d?.candidates?.[0]?.content?.parts || []).filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
  // A saturated model answers 429/503 or carries a "high demand" body. Detect it
  // and speak Persian instead of showing the raw English upstream message.
  const BUSY_RE = /high demand|overloaded|rate limit|quota|resource exhausted|try again later|service unavailable/i;
  function isBusy(status, data) {
    const msg = String(data?.error?.message || data?.message || ''), st = String(data?.error?.status || '');
    if (BUSY_RE.test(st) || BUSY_RE.test(msg)) return true;
    // A bare 429/503 whose body is English came from Google and means saturation.
    // A Persian body came from our own panel and is already user-ready.
    const upstream = status === 429 || status === 503;
    const latin = /[A-Za-z]/.test(msg), persian = /[\u0600-\u06FF]/.test(msg);
    return upstream && msg !== '' && latin && !persian;
  }
  function apiError(status, data) {
    const msg = data?.error?.message || ('خطای ' + status);
    if (isBusy(status, data)) {
      const e = new Error('مدل الان مشغول است؛ یک لحظهٔ کوچک صبر می‌کنم و دوباره تلاش می‌کنم.');
      e.code = 'MODEL_BUSY'; e.status = typeof status === 'number' ? status : 503; e.data = data; return e;
    }
    const e = new Error(status === 504 ? 'مدل دیر پاسخ داد؛ دوباره تلاش کن.' : status === 401 || /API_KEY/.test(msg) ? 'رمز یا کد فعال‌سازی معتبر نیست.' : msg);
    e.code = status === 429 ? 'MODEL_RATE_LIMIT' : 'MODEL_HTTP'; e.status = status; e.data = data; return e;
  }
  async function postJson(auth, model, body, signal, timeoutMs) {
    const ctl = new AbortController(), fwd = () => ctl.abort();
    if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', fwd, { once: true }); }
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const ep = endpoint(auth, model, false), r = await fetch(ep.url, { ...ep.init(body), signal: ctl.signal });
      const d = await r.json().catch(e => { if (e instanceof SyntaxError) return {}; throw e; });
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!r.ok) throw apiError(r.status, d);
      return d;
    } finally { clearTimeout(timer); signal && signal.removeEventListener('abort', fwd); }
  }
  function simpleMessage(text) {
    const s = norm(text).replace(/[!؟?،.؛]/g, '').trim();
    return /^سلام(?: علیکم| همکار| داداش| بروبچه)?$|^درود$|^مرسی$|^ممنون(?:م)?$|^متشکرم$|^تشکر$|^خداحافظ$|^سلامتی$|^ارواح$|^خسته نباشی$|^شما$|^چه خبر(?:ی)?$|^حالا شما$|^چه خبری از شما$|^چطوری$|^حالت چطوره$|^چطور(?: هستی| بودی)$|^خوبی به چه قند$|^چرا سرعتت کمه$|^چرا کندی$|^چرا اینقدر کندی$/.test(s);
  }
  // Exact small-talk bypass; mixed messages still go to AI. A conservative
  // fallback answers in ~1.2s instead of blocking the first reply on a classifier.
  const ROUTER_TIMEOUT_MS = 1200;
  // Words that mark real teaching/planning work: they always win over a
  // conversational question word such as «چطور».
  const WORK_WORDS = /(?:چکار|چیکار|چه کار|چه کنیم|چی کنیم|راه(?:کار|حل|نما)|کمک|ایده|برنامه|فردا|تحلیل|تدریس|آموزش|یادگیری|یاد بگیر|مشکل|حواس.?پرت|والد|اولیا|بودجه|پیشنهاد|نظرت|سوال|چالش|تصمیم|برنامه‌ریزی|برنامه ریزی|مبحث|فصل|صفحه|نمره|دانش‌آموز|دانش اموز|کلاس|هنوز|منتظر|فکر|انتظار|استفاده|ابزار|ثبت|ذخیره|حذف|تغییر|بروزرسانی|پیشرفت|گزارش|ارزیابی|غایب|تاخیر|تمرین|ارشد|آزمون|کتاب|درس|پایه|سطح|سیکل|برنامه‌ها|حل|یاد|done|finished|complete|ready|آماده|حاضر|بچه|شاگرد)/;
  // Pure social small talk: every word must belong to this list, so a greeting
  // that carries real content (a name, a date, a record) can never pass here.
  const SMALL_WORDS = /^(?:سلام|درود|مرسی|ممنون|متشکرم|تشکر|خداحافظ|سلامتی|ارواح|خسته|نباشی|شما|شماست|چه|چه‌ها|خبر|خبری|از|حالا|چطور|چطوری|حالت|خوبی|به|قند|بودی|هستی|علیکم|همکار|داداش|بروبچه|امروز|ممنونم)$/;
  function fallbackRoute(text) {
    const s = norm(text).replace(/[!؟?،.؛:"'«»\-]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = s ? s.split(' ') : [];
    // 1) a short message made only of social words → FAST, even with a question mark
    if (words.length && words.length <= 6 && words.every(w => SMALL_WORDS.test(w))) return 'FAST';
    // 2) any real work word → the strong analytical model
    if (WORK_WORDS.test(s)) return 'DEEP';
    // 3) a question in a message that is not pure social small talk
    if (/[؟?]/.test(norm(text))) return 'DEEP';
    // 4) short and quiet → FAST; long and unexplained → DEEP
    return s.length <= 40 ? 'FAST' : 'DEEP';
  }
  async function route(text, recent, auth, signal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (simpleMessage(text)) return { route: 'FAST', ms: 0, fallback: false, bypass: true };
    const t0 = performance.now();
    try {
      const ctx = (recent || []).slice(-2).map(m => (m.role === 'user' ? 'معلم: ' : 'مهریار: ') + cut(m.text, 220)).join('\n');
      const d = await postJson(auth, FAST_MODEL, {
        systemInstruction: { parts: [{ text: ROUTER_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: (ctx ? 'دو پیام آخر:\n' + ctx + '\n\n' : '') + 'پیام فعلی معلم: ' + cut(text, 600) }] }],
        generationConfig: { maxOutputTokens: 15, temperature: 0, responseMimeType: 'application/json', thinkingConfig: { thinkingLevel: 'MINIMAL' } }
      }, signal, ROUTER_TIMEOUT_MS);
      const raw = textOf(d); let r = '';
      try { r = String(JSON.parse(raw).route || '').toUpperCase(); } catch (_) {}
      r = r.toUpperCase();
      return { route: r === 'FAST' || r === 'DEEP' ? r : fallbackRoute(text), ms: Math.round(performance.now() - t0), fallback: r !== 'FAST' && r !== 'DEEP' };
    } catch (e) {
      // Router did not answer within ~1.2s or errored → never lock the request; fall back fast.
      if (signal?.aborted) throw e;
      return { route: fallbackRoute(text), ms: Math.round(performance.now() - t0), fallback: true };
    }
  }
  function genConfig(routeName) {
    // gemini-3.8-flash: thinkingLevel HIGH only (no thinkingBudget, MINIMAL not allowed).
    return routeName === 'FAST' ? { maxOutputTokens: 400, temperature: 0.6, thinkingConfig: { thinkingLevel: 'MINIMAL' } }
      : { maxOutputTokens: 900, thinkingConfig: { thinkingLevel: 'HIGH' } };
  }
  // SSE when available; never repeat a request that may have produced an answer.
  // The watchdog measures silence on the connection, not total elapsed time, so a
  // slow phone link that keeps receiving bytes is not killed with "زمان انتظار تمام شد".
  async function stream(auth, model, body, signal, onDelta, timeoutMs = 30000, hardMs = 85000, onWait) {
    const ctl = new AbortController(), fwd = () => ctl.abort();
    if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', fwd, { once: true }); }
    let timedOut = false, stallTimer, thinkTimer;
    const thinking = () => { clearTimeout(thinkTimer); thinkTimer = setTimeout(() => onWait?.(true), 3000); };
    const arm = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs); };
    const hardTimer = setTimeout(() => { if (!timedOut) { timedOut = true; ctl.abort(); } }, hardMs);
    arm(); thinking();
    let full = '', finish = '', usage = null, responseStarted = false;
    try {
      const ep = endpoint(auth, model, true), r = await fetch(ep.url, { ...ep.init(body), signal: ctl.signal });
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw apiError(r.status, d); }
      responseStarted = true;
      // A proxy may give an SSE body a JSON Content-Type. Inspect the body
      // instead, preserving incremental delivery and the original request.
      let kind = '', buf = '', jsonData;
      function consume(data) {
        buf += data;
        if (!kind) {
          if (/^\s*[\[{]/.test(buf)) kind = 'json';
          else if (/^\s*(?::|[a-zA-Z_][a-zA-Z0-9_-]*(?=[:\r\n]))/.test(buf)) kind = 'sse';
        }
        if (kind === 'sse') {
          let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (take(line)) onDelta(full); }
        }
      }
      if (typeof r.body?.getReader === 'function' && typeof TextDecoder === 'function') {
        const reader = r.body.getReader(), dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
          if (done) break;
          if (value?.byteLength) arm(); // reset even for SSE comments or partial UTF-8 bytes
          consume(dec.decode(value, { stream: true }));
        }
        consume(dec.decode());
      } else if (typeof r.text === 'function') {
        // Older WebViews buffer the same response instead of opening another.
        consume(await r.text());
      } else {
        try { jsonData = await r.json(); } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
      }
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (kind === 'sse') {
        if (buf && take(buf)) onDelta(full);
      } else {
        if (jsonData === undefined) { try { jsonData = JSON.parse(buf); } catch (_) {} }
        // Invalid or empty JSON does not prove that the model was never called.
        if (jsonData?.error) throw apiError(jsonData.error.code || 500, jsonData);
        if (!jsonData?.candidates?.[0]) {
          const e = new Error('پاسخ زنده فعال نیست؛ فایل API نسخهٔ جدید را روی هاست قرار دهید.'); e.code = 'NO_STREAM'; throw e;
        }
        full = textOf(jsonData); finish = jsonData.candidates[0].finishReason || ''; usage = jsonData.usageMetadata || null;
        if (full) onDelta(full);
      }
      if (ctl.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!finish) { const e = new Error('پاسخ زنده کامل نرسید؛ چیزی ثبت نشد. دوباره تلاش کن.'); e.code = 'STREAM_INCOMPLETE'; throw e; }
      return { text: full, finish, usage };
    } catch (e) {
      if (timedOut && !signal?.aborted) { const t = new Error('زمان انتظار تمام شد؛ دوباره تلاش کن.'); t.code = 'MODEL_TIMEOUT'; throw t; }
      if (responseStarted && e && typeof e === 'object') e.responseStarted = true;
      throw e;
    } finally { clearTimeout(stallTimer); clearTimeout(hardTimer); clearTimeout(thinkTimer); signal && signal.removeEventListener('abort', fwd); }
    function take(line) {
      line = line.trim(); if (!line.startsWith('data:')) return false;
      let d; try { d = JSON.parse(line.slice(5).trim()); } catch (_) { return false; }
      if (d.error) throw apiError(d.error.code || 500, d);
      const c = d.candidates?.[0]; if (c?.finishReason) finish = c.finishReason; if (d.usageMetadata) usage = d.usageMetadata;
      const piece = textOf(d); if (!piece) return false; full += piece; onWait?.(false); thinking(); return true;
    }
  }
