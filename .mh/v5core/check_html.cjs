const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('/workspaces/Uoakk/v5/mehryar-v5.html','utf8');
let count = 0;
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/src=|application\/ld\+json|application\/json/.test(m[1])) continue;
  new vm.Script(m[2],{filename:'inline-'+(++count)+'.js'});
}
console.log('HTML syntax OK:', count, 'scripts');