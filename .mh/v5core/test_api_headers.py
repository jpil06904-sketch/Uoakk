#!/usr/bin/env python3
"""Answer a content:// (Origin: null) preflight and keep CORS clean on errors.

Runs a real PHP server against the panel that install.php builds, so the
headers under test are the ones the phone actually receives.
"""
import socket
import subprocess
import tempfile
from http.client import HTTPConnection
from pathlib import Path
import shutil
import time

ROOT = Path(__file__).resolve().parents[2]
installer = ROOT / 'install.php'
api = ROOT / 'v5/panel/api.php'
source = api.read_text(encoding='utf-8')

# --- 1. static contract: anti-buffering and CORS are declared up front ---
for needle in [
    "header('Access-Control-Allow-Origin: *')",
    "header('Access-Control-Allow-Methods: POST, GET, OPTIONS')",
    "header('Access-Control-Allow-Headers: Content-Type')",
    "header('Vary: Origin')",
    "$_SERVER['REQUEST_METHOD']??'GET')==='OPTIONS'",
    "header('X-Accel-Buffering: no')",
    "@flush()",
    'set_time_limit(85)',
    "@ini_set('output_buffering','0')",
    "@ini_set('implicit_flush','1')",
    "@ini_set('zlib.output_compression','0')",
    "header_remove('Content-Encoding')",
    'CURLOPT_TIMEOUT=>min(75',
    'CURLOPT_XFERINFOFUNCTION',
    ': keepalive\\n\\n',
]:
    assert needle in source, 'missing in api.php: ' + needle

with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]

with tempfile.TemporaryDirectory(prefix='mehryar-api-test-') as temp:
    root = Path(temp)
    shutil.copyfile(installer, root / 'install.php')
    subprocess.run(['php', str(root / 'install.php')], capture_output=True, text=True, timeout=60, check=True)
    assert not (root / 'install.php').exists(), 'a successful install removes its temporary copy'
    assert (root / 'panel/api.php').read_text(encoding='utf-8') == source, 'installed API must match the workspace API'

    server = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', '-t', str(root)],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        for _ in range(60):
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.5):
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('the PHP test server did not start')

        def request(method, path, body=None, origin='null', content_type='text/plain'):
            conn = HTTPConnection('127.0.0.1', port, timeout=15)
            headers = {'Origin': origin}
            if content_type:
                headers['Content-Type'] = content_type
            conn.request(method, path, body=body, headers=headers)
            response = conn.getresponse()
            data = response.read()
            out = (response.status, {k.lower(): v for k, v in response.getheaders()}, data)
            conn.close()
            return out

        # --- 2. the preflight a content:// / file:// page actually sends ---
        status, headers, body = request('OPTIONS', '/panel/api.php?a=ais&m=gemini-3-flash-preview')
        assert status == 204, f'preflight must be answered locally: {status} {body!r}'
        assert headers.get('access-control-allow-origin') == '*', headers
        assert 'POST' in headers.get('access-control-allow-methods', ''), headers
        assert 'Content-Type' in headers.get('access-control-allow-headers', ''), headers
        assert not body, 'a preflight must not run the model'

        # --- 3. a normal request from an opaque origin is accepted and CORS-labelled ---
        status, headers, body = request('GET', '/panel/api.php?a=ping')
        assert status == 200, (status, body)
        assert headers.get('access-control-allow-origin') == '*', headers
        assert b'"ok":true' in body, body

        # --- 4. the streaming endpoint's rejection is still CORS-readable ---
        rejection = ('MH-BADCODE-BADDEV|dev12345\n' + '{"contents":[]}')
        for action in ('ai', 'ais'):
            status, headers, body = request('POST', f'/panel/api.php?a={action}&m=gemini-3-flash-preview', rejection)
            assert status == 401, f'{action}: {status} {body!r}'
            assert headers.get('access-control-allow-origin') == '*', f'{action}: {headers}'
            assert b'error' in body, body

        # --- 5. an invalid model name is rejected without becoming a hang ---
        status, headers, body = request('POST', '/panel/api.php?a=ais&m=not-a-model', rejection)
        assert status == 400, (status, body)
        assert headers.get('access-control-allow-origin') == '*', headers
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()

print('API CORS / PREFLIGHT / ANTI-BUFFER TESTS PASSED')