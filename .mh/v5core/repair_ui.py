#!/usr/bin/env python3
"""Integrate live positions into the original pulse radar; keep the rest of V5 intact."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/workspaces/Uoakk/v5/mehryar-v5.html')
text = path.read_text(encoding='utf-8')

def replace(old, new):
    global text
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f'Expected exactly one anchor, found {n}: {old[:80]}')
    text = text.replace(old, new, 1)

replace("    return [grade, isDemo() ? 'demo' : '', localISO(), budgets, sessions.length, lastSession ? (lastSession.updatedAt || lastSession.date || '') : '', progressSig, ((state.curriculum && state.curriculum.books) || []).length].join('|');",
        "    let positions = '', curriculum = '';\n    try { positions = JSON.stringify(window.MehryarV5?.store?.positions || {}); curriculum = JSON.stringify([state.klass, state.curriculum]); } catch (_) {}\n    return [grade, isDemo() ? 'demo' : '', localISO(), budgets, sessions.length, lastSession ? (lastSession.updatedAt || lastSession.date || '') : '', progressSig, curriculum, positions].join('|');")
replace("    const base = MehryarTools.get_budget_and_progress({ grade, prompt: 'امروز', limit: 1 });\n    if (!base || !base.budget)",
        "    if (!grade && !isDemo()) return { kind: 'selectgrade' };\n    const base = MehryarTools.get_budget_and_progress({ grade, prompt: 'امروز', limit: 1 });\n    // Grade-scoped budgets and progress; chat positions belong to the active class.\n    if (!isDemo() && window.MehryarV5?.radarItems) {\n      const items = window.MehryarV5.radarItems({grade});\n      if (items.length) return { kind: 'items', items, base: base || {} };\n      return { kind: base?.budget ? 'noitems' : 'nobudget', base: base || {} };\n    }\n    if (!base || !base.budget)")
replace("    if (items.some(i => i.level === 'info')) return 'برای دقیق‌تر شدن رادار، جایگاه تدریس درس‌ها را ثبت کن.';",
        "    if (items.some(i => i.level === 'info')) return 'برای بعضی درس‌ها جایگاه کلاس یا بازهٔ قابل مقایسه در بودجه مشخص نیست.';")
replace("    if (data.kind === 'nobudget') {",
        "    if (data.kind === 'selectgrade') return { level: 'none', html: head('') + '<p class=\"br-lead\">برای دیدن رادار، یک پایه را از بالای صفحه انتخاب کن.</p><div class=\"br-actions\">' + hide + '</div>' };\n    if (data.kind === 'nobudget') {")
replace('    const cards = data.items.map(i => `<div class="br-item br-${i.level}" data-subject="${esc(i.subject)}"><div class="br-head"><b>${esc(i.subject)}</b><span class="br-chip">${esc(i.chip)}</span></div><p class="br-text">${i.text}</p>${i.sub ? `<p class="br-sub">${i.sub}</p>` : \'\'}</div>`).join(\'\');', '''    const cards = data.items.map(i => {
      const r = i.radar;
      if (!r) return `<div class="br-item br-${i.level}" data-subject="${esc(i.subject)}"><div class="br-head"><b>${esc(i.subject)}</b><span class="br-chip">${esc(i.chip)}</span></div><p class="br-text">${i.text}</p>${i.sub ? `<p class="br-sub">${i.sub}</p>` : ''}</div>`;
      const pct = n => Math.max(0, Math.min(100, Number(n) / r.max * 100));
      const unit = r.unit === 'page' ? 'صفحه' : r.unit === 'chapter' ? 'فصل/درس' : 'مبحث';
      const actual = r.actual == null ? (r.position?.topic || 'ثبت نشده') : unit + ' ' + fa(r.actual);
      const planned = r.expected ? unit + ' ' + fa(r.expected.join(' تا ')) : 'نامشخص';
      const plannedLeft = r.expected ? Math.min(99, pct(r.expected[0])) : 0;
      const bar = `<div class="br-track" role="img" aria-label="${esc('کلاس: ' + actual + '؛ برنامه: ' + planned)}">${r.actual != null ? `<span class="br-actual" style="width:${pct(r.actual)}%"></span>` : ''}${r.expected ? `<span class="br-planned" style="left:${plannedLeft}%;width:${Math.min(100-plannedLeft,Math.max(1,pct(r.expected[1])-plannedLeft))}%"></span>` : ''}</div>`;
      return `<div class="br-item br-${i.level}" data-subject="${esc(i.subject)}"><div class="br-head"><b>${esc(i.subject)}</b><span class="br-chip">${esc(i.chip)}</span></div>${bar}<p class="br-text">کلاس: ${esc(actual)} · برنامه: ${esc(planned)}</p>${r.current ? `<p class="br-sub">${esc(r.current)}</p>` : ''}</div>`;
    }).join('');''')
replace("    const lead = (data.demo ? 'نمونهٔ فرضی است تا ببینی رادار چطور هشدار می‌دهد؛ با بودجهٔ خودت عددها واقعی می‌شود. ' : '') + leadFor(data.items);",
        "    const yearNote = data.base?.budgetYearAssumed ? 'سال بودجه ثبت نشده است؛ انطباق آن با سال فعال فقط یک فرض است. ' : '';\n    const lead = (data.demo ? 'نمونهٔ فرضی است تا ببینی رادار چطور هشدار می‌دهد؛ با بودجهٔ خودت عددها واقعی می‌شود. ' : '') + yearNote + leadFor(data.items);")
replace('    return { level, html: head(behind.length ? `<span class="pd-count br-count br-${level}">${fa(behind.length)}</span>` : \'\') + `<p class="br-lead">${esc(lead)}</p><div class="br-list">${cards}</div>',
        '    const legend = data.items.some(i => i.radar) ? \'<p class="br-legend"><i></i> جای کلاس &nbsp; <i></i> بازهٔ برنامهٔ این ماه</p>\' : \'\';\n    return { level, html: head(behind.length ? `<span class="pd-count br-count br-${level}">${fa(behind.length)}</span>` : \'\') + `<p class="br-lead">${esc(lead)}</p>${legend}<div class="br-list">${cards}</div>')

# Shorten the composer, but keep the storage warning and all input controls.
replace("'پیام یا متن کامل بودجهٔ سالانه را بنوی…'", "'پیامت را بنویس…'")
replace("if(disclaimer)disclaimer.textContent='بودجه‌بندی خام فقط پس از بررسی پیش‌نمایش و کلیک روی «تایید و ثبت» ذخیره می‌شود. ثبت گزارش‌های دیگر هم با تأیید تو انجام می‌شود.';", "if(disclaimer)disclaimer.textContent='بودجه پس از بررسی و تأیید ذخیره می‌شود.';")

path.write_text(text, encoding='utf-8')
print('Original radar and composer updated')