#!/usr/bin/env python3
"""Exercise the production PHP sanitizer, including tags split across events."""
from pathlib import Path
import json
import subprocess

source = (Path(__file__).resolve().parents[2] / 'v5/panel/api.php').read_text()
helpers = source[source.index('function visible_text('):source.index('function api_gcall(')]
program = '<?php\n' + helpers + '''
$states=[];$out=[];
foreach(['<br','ain>English private',' thinking</bra','in>سلام ','<thought>secret</thought>پاسخ'] as $text){
 $d=['candidates'=>[['content'=>['parts'=>[['thought'=>true,'text'=>'hidden reasoning'],['text'=>$text,'thoughtSignature'=>'signature']]],'finishReason'=>'STOP']]];
 $out[]=visible_payload($d,$states);
}
echo json_encode($out,JSON_UNESCAPED_UNICODE);
'''
result = subprocess.run(['php'], input=program, text=True, capture_output=True, check=True)
assert not result.stderr, result.stderr
events = json.loads(result.stdout)
text = ''.join(p.get('text', '') for d in events for c in d['candidates'] for p in c['content']['parts'])
assert text == 'سلام پاسخ', text
assert events[-1]['candidates'][0]['finishReason'] == 'STOP'
assert events[-1]['candidates'][0]['content']['parts'][0]['thoughtSignature'] == 'signature'
print('PHP THOUGHT FILTER / SPLIT TAG / SIGNATURE TESTS PASSED')