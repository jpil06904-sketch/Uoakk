#!/usr/bin/env python3
"""Build, sync and run the whole Mehryar V5 suite. Exits non-zero on any failure."""
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

STEPS = [
    ('js syntax', ['node', '--check', 'core.js'], HERE),
    ('build', ['python3', 'build.py'], HERE),
    ('panel sync', ['python3', 'package_panel.py'], HERE),
    ('php lint api', ['php', '-l', str(ROOT / 'v5/panel/api.php')], ROOT),
    ('php lint installer', ['php', '-l', str(ROOT / 'install.php')], ROOT),
]

TESTS = sorted(p.name for p in HERE.glob('test_*.cjs') if p.name != 'test_env.cjs')
PY_TESTS = sorted(p.name for p in list(HERE.glob('test_*.py')))


def run(label, argv, cwd):
    print(f'-- {label}: {" ".join(str(a) for a in argv)}', flush=True)
    result = subprocess.run([str(a) for a in argv], cwd=str(cwd), capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.rstrip(), flush=True)
    if result.returncode != 0:
        print(result.stderr.rstrip(), flush=True)
    return result.returncode == 0


def main():
    failures = []
    for label, argv, cwd in STEPS:
        ok = run(label, argv, cwd)
        print(f'   == {label}: {"ok" if ok else "FAILED"}', flush=True)
        if not ok:
            failures.append(label)
            return 1

    for name in TESTS:
        ok = run(f'node {name}', ['node', name], HERE)
        print(f'   == {name}: {"PASS" if ok else "FAIL"}', flush=True)
        if not ok:
            failures.append(name)

    for name in PY_TESTS:
        ok = run(f'python {name}', ['python3', name], HERE)
        print(f'   == {name}: {"PASS" if ok else "FAIL"}', flush=True)
        if not ok:
            failures.append(name)

    print(f'\n{len(TESTS) + len(PY_TESTS)} suites, {len(failures)} failing', flush=True)
    if failures:
        print('FAILING: ' + ', '.join(failures), flush=True)
        return 1
    print('ALL SUITES PASS', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())