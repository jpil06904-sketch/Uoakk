import re
src = open('/workspaces/Uoakk/mehryar-v4-final-fixed.html', encoding='utf-8').read()
blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', src, re.S)
open('/tmp/check_all.js', 'w', encoding='utf-8').write('\n;\n'.join(blocks))
print('blocks', len(blocks))
