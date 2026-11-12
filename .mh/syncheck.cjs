// Syntax-check every inline <script> of the fixed file.
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync('/workspaces/Uoakk/mehryar-v4-final-fixed.html', 'utf8');
const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, i = 0; const out = [];
while ((m = re.exec(html))) {
  i++; const attrs = m[1] || '';
  if (/type\s*=\s*["']?(?!text\/javascript|module)/i.test(attrs) && !/javascript/i.test(attrs)) continue;
  try { new vm.Script(m[2], { filename: 'script' + i }); out.push('script' + i + ' OK'); }
  catch (e) { out.push('script' + i + ' ERR ' + e.message); }
}
fs.writeFileSync('/workspaces/Uoakk/.mh/syncheck.txt', out.join('\n'));
