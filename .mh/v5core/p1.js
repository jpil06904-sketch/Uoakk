/* ===== Mehryar V5 core: AI router, O(1) context, streaming, <actions>, class_state, voice ===== */
window.MehryarV5 = (() => {
  'use strict';
  const STORE_KEY = 'mehryar_v5_brain';
  const FAST_MODEL = 'gemini-3-flash-preview', DEEP_MODEL = 'gemini-3.8-flash';
  const CLASS_MODES = ['حضوری عادی', 'مجازی/شاد', 'هفته مرور و امتحان'];
  const LEVELS = ['قفل ۱', 'قفل ۲', 'قفل ۳', 'مستقل'];
  const DEEP_STAGES = ['در حال خواندن پیام…', 'مهریار در حال فکر کردن…', 'در حال آماده‌سازی پاسخ دقیق‌تر…'];
  const today = () => localISO();
  const daysBetween = (a, b) => Math.round((dateObj(b) - dateObj(a)) / 86400000);
  const cut = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  // Persian normalisation for name matching: ي/ى→ی، ك→ک، removes ZWNJ/tatweel/diacritics.
  const norm = s => String(s || '').replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u200c\u200f\u200e]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const tight = s => norm(s).replace(/\s+/g, '');

  /* ---------- local store (separate from main state so migrations never drop it) ---------- */
  function load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_) { s = {}; }
    s.classMode = CLASS_MODES.includes(s.classMode) ? s.classMode : 'حضوری عادی';
    s.facilities = Array.isArray(s.facilities) ? s.facilities.filter(x => typeof x === 'string').slice(0, 20) : [];
    const cs = s.classState && typeof s.classState === 'object' ? s.classState : {};
    s.classState = { main_track: String(cs.main_track || ''), lagging_group: String(cs.lagging_group || ''), advanced_group: String(cs.advanced_group || ''), last_action: String(cs.last_action || ''), what_failed: Array.isArray(cs.what_failed) ? cs.what_failed.filter(x => x && typeof x === 'object').slice(0, 2) : [], updatedAt: String(cs.updatedAt || '') };
    s.reminders = Array.isArray(s.reminders) ? s.reminders.slice(-60) : [];
    s.levels = s.levels && typeof s.levels === 'object' ? s.levels : {};
    s.positions = s.positions && typeof s.positions === 'object' ? s.positions : {};
    s.msgCount = Number(s.msgCount) || 0;
    s.lastBriefing = String(s.lastBriefing || '');
    return s;
  }
  let store = load();
  function save() { if (typeof demoMode !== 'undefined' && demoMode) return; try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (_) {} }

  /* ---------- class_state hygiene: expire what_failed after 45 days, cap 200 words ---------- */
  function pruneClassState(cs) {
    const t = today();
    cs.what_failed = (cs.what_failed || []).filter(f => f && f.method && (!validDay(f.date) || daysBetween(f.date, t) <= 45)).slice(-2)
      .map(f => ({ topic: cut(f.topic, 40), date: validDay(f.date) ? f.date : t, method: cut(f.method, 90) }));
    for (const k of ['main_track', 'lagging_group', 'advanced_group', 'last_action']) cs[k] = cut(cs[k], 260);
    let guard = 0;
    while (words(JSON.stringify(cs)) > 200 && guard++ < 20) {
      const k = ['last_action', 'advanced_group', 'lagging_group', 'main_track'].sort((a, b) => cs[b].length - cs[a].length)[0];
      cs[k] = cut(cs[k], Math.max(20, Math.floor(cs[k].length * 0.75)));
    }
    return cs;
  }
  function classStateText() {
    const cs = pruneClassState(store.classState);
    const failed = cs.what_failed.map(f => `${f.method} (مبحث: ${f.topic || '؟'}، ${f.date})`).join(' | ');
    const lines = [cs.main_track && 'مسیر اکثریت: ' + cs.main_track, cs.lagging_group && 'گروه جامانده: ' + cs.lagging_group, cs.advanced_group && 'گروه پیشرو: ' + cs.advanced_group, cs.last_action && 'آخرین اقدام: ' + cs.last_action, failed && 'روش‌های شکست‌خورده: ' + failed].filter(Boolean);
    return lines.length ? lines.join('\n') : 'هنوز ثبت نشده است.';
  }
