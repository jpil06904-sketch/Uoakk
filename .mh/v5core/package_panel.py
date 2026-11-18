#!/usr/bin/env python3
"""Keep the single-file installer streaming API in sync with the V5 panel API."""
import base64
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
installer = ROOT / 'install.php'
api = ROOT / 'v5/panel/api.php'
source = installer.read_text(encoding='utf-8')
payload = base64.b64encode(api.read_bytes()).decode('ascii')
updated, count = re.subn(r"('api\.php'\s*=>\s*')[A-Za-z0-9+/=]+(')", lambda m: m[1] + payload + m[2], source)
if count != 1:
    raise RuntimeError(f'Expected one API payload, found {count}')
installer.write_text(updated, encoding='utf-8')
print('Installer API synchronized')