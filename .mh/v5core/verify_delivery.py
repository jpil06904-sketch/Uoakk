#!/usr/bin/env python3
"""Confirm the three publishable artifacts agree with the sources in this folder."""
import base64
import hashlib
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
HTML = ROOT / 'v5/mehryar-v5.html'
API = ROOT / 'v5/panel/api.php'
INSTALLER = ROOT / 'install.php'

html = HTML.read_text(encoding='utf-8')
core = (HERE / 'core.js').read_text(encoding='utf-8')
bridge = (HERE / 'bridge.js').read_text(encoding='utf-8') + (HERE / 'bridge2.js').read_text(encoding='utf-8')
css = (HERE / 'css.css').read_text(encoding='utf-8')
api = API.read_text(encoding='utf-8')
installer = INSTALLER.read_text(encoding='utf-8')

payload = re.search(r"'api\.php'\s*=>\s*'([A-Za-z0-9+/=]+)'", installer).group(1)
embedded = base64.b64decode(payload).decode('utf-8')

checks = [
    ('core.js embedded verbatim once', core in html and html.count('/* ===== Mehryar V5 core:') == 1),
    ('bridge embedded verbatim', bridge in html),
    ('css embedded verbatim once', css in html and html.count('<style id="v5-style">') == 1),
    ('installer API == v5/panel/api.php', embedded == api),
    ('router budget 1200ms', 'ROUTER_TIMEOUT_MS = 1200' in html),
    ('FAST stage message', "stage === 'FAST') return 'در حال نوشتن…'" in html),
    ('stream stall watchdog', 'stallTimer' in html and 'hardTimer' in html),
    ('stream budgets 60s/150s', "FAST_MODEL ? 60000 : 150000" in html),
    ('absolute panel guard', 'آدرس پنل کامل نیست' in html),
    ('radar muted red #fef2f2', '.budget-radar .br-warn{--radar-color:#e8878b;background:#fef2f2' in css),
    ('radar muted border #fecaca', '#fecaca' in css),
    ('composer 1 line / 46px / 15px', 'min-height:46px' in css and 'font-size:15px' in css and 'max-height:120px' in css),
    ('collapsed top sections', '.v5-menu,.ai-options{' in css and 'max-height:44px' in css),
    ('CORS for Origin: null', "Access-Control-Allow-Origin: *" in api),
    ('OPTIONS preflight answered', "==='OPTIONS'" in api),
    ('SSE anti-buffer headers', 'X-Accel-Buffering: no' in api and '@flush()' in api and 'set_time_limit(180)' in api),
]

width = max(len(name) for name, _ in checks)
for name, ok in checks:
    print(f'  {"ok  " if ok else "FAIL"} {name}')

for path in (HTML, API, INSTALLER):
    raw = path.read_bytes()
    print(f'  {path.relative_to(ROOT)}  {len(raw):,} bytes  sha256 {hashlib.sha256(raw).hexdigest()[:16]}')

failed = [name for name, ok in checks if not ok]
print()
print('DELIVERY CHECK PASSED' if not failed else 'DELIVERY CHECK FAILED: ' + ', '.join(failed))
raise SystemExit(1 if failed else 0)