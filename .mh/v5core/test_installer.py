#!/usr/bin/env python3
"""Install and upgrade a disposable panel, never the workspace or a real server."""
import base64
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
installer = ROOT / 'install.php'
api = ROOT / 'v5/panel/api.php'
source = installer.read_text(encoding='utf-8')
match = re.search(r"'api\.php'\s*=>\s*'([A-Za-z0-9+/=]+)'", source)
assert match and base64.b64decode(match[1]) == api.read_bytes(), 'installer API differs from V5 API'

with tempfile.TemporaryDirectory(prefix='mehryar-installer-test-') as temp:
    root = Path(temp)
    def install():
        copy = root / 'install.php'
        shutil.copyfile(installer, copy)
        result = subprocess.run(['php', str(copy)], capture_output=True, text=True, timeout=30, check=True)
        assert '❌' not in result.stdout, result.stdout + result.stderr
        assert not copy.exists(), 'successful installer should delete its temporary copy'
    install()
    panel = root / 'panel'
    assert (panel / 'api.php').read_bytes() == api.read_bytes()
    dbs = list((panel / 'data').glob('panel*.sqlite'))
    assert len(dbs) == 1
    db = dbs[0]
    with sqlite3.connect(db) as connection:
        connection.execute("INSERT INTO codes(code,label,dev) VALUES('MH-AAAA-BBBB','existing','device123')")
        connection.execute("INSERT INTO gkeys(k) VALUES('existing-key')")
        connection.execute("INSERT INTO popup(id,title) VALUES(1,'existing popup')")
    password = subprocess.check_output(['php','-r',"echo password_hash('test-password', PASSWORD_DEFAULT);"], text=True)
    (panel / 'data/admin.hash').write_text(password)
    (panel / 'uploads/existing.txt').write_text('existing upload')
    install()
    assert (panel / 'api.php').read_bytes() == api.read_bytes()
    assert list((panel / 'data').glob('panel*.sqlite')) == [db]
    assert db.name in (panel / 'lib.php').read_text()
    assert (panel / 'data/admin.hash').read_text() == password
    subprocess.run(['php','-r',"exit(password_verify('test-password', $argv[1]) ? 0 : 1);",password], check=True)
    assert (panel / 'uploads/existing.txt').read_text() == 'existing upload'
    with sqlite3.connect(db) as connection:
        assert connection.execute('SELECT label,dev FROM codes').fetchone() == ('existing','device123')
        assert connection.execute('SELECT k FROM gkeys').fetchone() == ('existing-key',)
        assert connection.execute('SELECT title FROM popup').fetchone() == ('existing popup',)
    for name in ('api.php','lib.php','admin.php'):
        subprocess.run(['php','-l',str(panel / name)], check=True, capture_output=True)
print('INSTALLER FRESH INSTALL AND UPGRADE TESTS PASSED')