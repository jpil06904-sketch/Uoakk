<?php
require __DIR__.'/lib.php';
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: POST, GET, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');header('Vary: Origin');header('Cache-Control: no-store');header('Content-Type: application/json; charset=utf-8');header('X-Accel-Buffering: no');set_time_limit(85);@ini_set('output_buffering','0');@ini_set('implicit_flush','1');@ini_set('zlib.output_compression','0');header_remove('Content-Encoding');
$a=$_GET['a']??'';$T0=microtime(true);
// A page opened from content:// (APK) or file:// sends "Origin: null"; a preflight
// must be answered here and never reach the model request.
if(($_SERVER['REQUEST_METHOD']??'GET')==='OPTIONS'){http_response_code(204);header('Content-Length: 0');exit;}
if($a==='ping'){echo json_encode(['ok'=>true,'t'=>time()]);exit;}
$https=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')||($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https';
$base=($https?'https':'http').'://'.$_SERVER['HTTP_HOST'].rtrim(dirname($_SERVER['SCRIPT_NAME']),'/');
function inwin($r){$t=date('Y-m-d');return $r['en']&&(!$r['sd']||$t>=$r['sd'])&&(!$r['ed']||$t<=$r['ed']);}
if($a==='cfg'){
 $o=['banners'=>new stdClass,'popup'=>null];
 foreach(q("SELECT * FROM banners")->fetchAll(PDO::FETCH_ASSOC) as $r)
  if(inwin($r)&&$r['img']&&preg_match('~^https://~i',$r['href']))$o['banners']->{$r['slot']}=['img'=>$base.'/uploads/'.$r['img'],'href'=>$r['href']];
 $p=q("SELECT * FROM popup WHERE id=1")->fetch(PDO::FETCH_ASSOC);
 if($p&&inwin($p)&&$p['title'])$o['popup']=['id'=>(int)$p['rev'],'title'=>$p['title'],'text'=>$p['txt'],'btn'=>$p['btn'],'href'=>preg_match('~^https://~i',$p['href'])?$p['href']:'','once'=>(int)$p['once']];
 echo json_encode($o,JSON_UNESCAPED_UNICODE);exit;}
if($a==='diag'){$r=['ok'=>true,'php'=>PHP_VERSION,'sqlite'=>extension_loaded('pdo_sqlite'),'data_writable'=>is_dir(DIR.'/data')&&is_writable(DIR.'/data')];
 try{q("CREATE TABLE IF NOT EXISTS _t(x)");q("INSERT INTO _t VALUES(1)");q("DELETE FROM _t");$r['db']=true;}catch(Throwable $e){$r['db']=false;$r['ok']=false;$r['err']=substr($e->getMessage(),0,120);}
 echo json_encode($r);exit;}
if($a==='p'){
 $j=json_decode(file_get_contents('php://input')?:'{}',true)?:[];
 $id=preg_replace('/[^a-z0-9]/i','',substr($j['id']??'',0,32));$v=substr(preg_replace('/[^0-9.]/','',$j['v']??''),0,10);
 $ev=is_array($j['ev']??null)?$j['ev']:[];if(!$ev&&!empty($j['e']))$ev=[(string)$j['e']=>1];
 if(strlen($id)<8||!$ev)exit('0');
 $now=time();$day=date('Y-m-d');
 q("INSERT OR IGNORE INTO devices(id,first,last,ver) VALUES(?,?,?,?)",[$id,$now,$now,$v]);
 q("UPDATE devices SET last=?,ver=? WHERE id=?",[$now,$v,$id]);
 q("INSERT OR IGNORE INTO act(day,id) VALUES(?,?)",[$day,$id]);
 $ok=['open','top_view','top_click','bottom_view','bottom_click','popup_view','popup_click','ai_key','ai_ok','ai_quota','ai_busy','ai_err'];
 foreach($ev as $name=>$n){$name=preg_replace('/[^a-z_]/','',(string)$name);if(!in_array($name,$ok,true))continue;$n=max(1,min(500,(int)$n));
  q("INSERT OR IGNORE INTO ev(day,name,n) VALUES(?,?,0)",[$day,$name]);q("UPDATE ev SET n=n+? WHERE day=? AND name=?",[$n,$day,$name]);
  if($name==='ai_key'||$name==='ai_ok')q("INSERT OR IGNORE INTO aidev(id) VALUES(?)",[$id]);
  if($name==='ai_key')q("UPDATE aidev SET key_set=1 WHERE id=?",[$id]);
  if($name==='ai_ok')q("UPDATE aidev SET ok_n=ok_n+?,last_ok=?,key_set=1 WHERE id=?",[$n,$now,$id]);}
 echo '1';exit;}
function aerr($s,$m,$st,$ra=0){http_response_code($s);$e=['code'=>$s,'message'=>$m,'status'=>$st];if($ra>0)$e['details']=[['@type'=>'type.googleapis.com/google.rpc.RetryInfo','retryDelay'=>(int)$ra.'s']];echo json_encode(['error'=>$e],JSON_UNESCAPED_UNICODE);exit;}
function tries_ok($k){$t=time();q("DELETE FROM tries WHERE t<?",[$t-3600]);
 $a=(int)q("SELECT COUNT(*) FROM tries WHERE k=? AND t>?",[$k,$t-600])->fetchColumn();
 $g=(int)q("SELECT COUNT(*) FROM tries")->fetchColumn();
 return $a<8&&$g<1000;}
function tries_add($k){q("INSERT INTO tries(k,t) VALUES(?,?)",[$k,time()]);}
if($a==='act'){
 $j=json_decode(file_get_contents('php://input')?:'{}',true)?:[];
 $id=preg_replace('/[^a-z0-9]/i','',substr((string)($j['id']??''),0,32));$code=normcode($j['c']??'');$rk=rkey($id);
 if(strlen($id)<8||$code===''){echo json_encode(['ok'=>false,'err'=>'invalid']);exit;}
 if(!tries_ok($rk)){http_response_code(429);echo json_encode(['ok'=>false,'err'=>'rate']);exit;}
 $r=q("SELECT * FROM codes WHERE code=?",[$code])->fetch(PDO::FETCH_ASSOC);
 if(!$r){tries_add($rk);echo json_encode(['ok'=>false,'err'=>'invalid']);exit;}
 if($r['blk']){echo json_encode(['ok'=>false,'err'=>'off']);exit;}
 if($r['dev']===''){$now=time();q("UPDATE codes SET dev=?,act=?,last=? WHERE code=? AND dev=''",[$id,$now,$now,$code]);
  $r=q("SELECT * FROM codes WHERE code=?",[$code])->fetch(PDO::FETCH_ASSOC);}
 if(!$r||$r['dev']!==$id){tries_add($rk);echo json_encode(['ok'=>false,'err'=>'used']);exit;}
 echo json_encode(['ok'=>true]);exit;}
function perf_log($m,$g,$st){global $T0;try{q("INSERT INTO perf(t,m,g,tot,st) VALUES(?,?,?,?,?)",[time(),(string)$m,(int)$g,(int)round((microtime(true)-$T0)*1000),(int)$st]);if(mt_rand(1,25)===1)q("DELETE FROM perf WHERE t<?",[time()-7*86400]);}catch(Exception $e){}}
// Remove hidden model channels before any text reaches the browser. State is per
// candidate/part so tags split across SSE events cannot leak their contents.
function visible_text($text,&$state){
 $state=$state??['pending'=>'','hidden'=>false];$s=$state['pending'].$text;$state['pending']='';$out='';
 while($s!==''){
  if(preg_match('~</?(?:brain|thought|think|analysis)>~i',$s,$m,PREG_OFFSET_CAPTURE)){
   $tag=$m[0][0];$at=$m[0][1];if(!$state['hidden'])$out.=substr($s,0,$at);
   $state['hidden']=substr($tag,1,1)!=='/';$s=substr($s,$at+strlen($tag));continue;
  }
  $at=strrpos($s,'<');
  if($at!==false){$tail=substr($s,$at);foreach(['<brain>','</brain>','<thought>','</thought>','<think>','</think>','<analysis>','</analysis>'] as $tag){if(stripos($tag,$tail)===0){$state['pending']=$tail;$s=substr($s,0,$at);break;}}}
  if(!$state['hidden'])$out.=$s;break;
 }
 return $out;
}
function visible_payload($d,&$states){
 if(!is_array($d))return [];
 foreach(($d['candidates']??[]) as $ci=>$candidate){$parts=[];
  foreach(($candidate['content']['parts']??[]) as $part){
   if(!empty($part['thought'])||isset($part['reasoning'])||isset($part['analysis']))continue;
   unset($part['thought'],$part['reasoning_content']);
   if(isset($part['text'])){$key=$candidate['index']??$ci;$part['text']=visible_text($part['text'],$states[$key]);}
   $parts[]=$part;
  }
  if(isset($d['candidates'][$ci]['content']))$d['candidates'][$ci]['content']['parts']=$parts;
 }
 return $d;
}
function api_gcall($u,$key,$body){
 global $T0;$remaining=max(1,(int)(78-(microtime(true)-$T0)));
 $c=curl_init($u);$opts=[CURLOPT_HTTPHEADER=>['x-goog-api-key: '.$key,'Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>min(75,$remaining),CURLOPT_CONNECTTIMEOUT=>10];
 if($body!==null){$opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=$body;}
 curl_setopt_array($c,$opts);$o=curl_exec($c);$ce=curl_errno($c);$st=(int)curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);
 if($st===200){$states=[];$d=json_decode($o,true);if(is_array($d))$o=json_encode(visible_payload($d,$states),JSON_UNESCAPED_UNICODE);}
 return [$st,$o?:'',$ce];
}
if($a==='gping'){
 set_time_limit(85);
 $raw=file_get_contents('php://input');$nl=strpos($raw,"\n");
 if($nl===false||$nl>80)aerr(400,'درخواست نامعتبر.','INVALID_ARGUMENT');
 $head=explode('|',substr($raw,0,$nl));$code=normcode($head[0]??'');$id=preg_replace('/[^a-z0-9]/i','',substr((string)($head[1]??''),0,32));$rk=rkey($id);
 $r=($code!==''&&strlen($id)>=8)?q("SELECT * FROM codes WHERE code=?",[$code])->fetch(PDO::FETCH_ASSOC):false;
 if(!$r||$r['dev']!==$id||$r['blk']){if(!tries_ok($rk))aerr(429,'تلاش‌های ناموفق زیاد بود؛ کمی بعد دوباره امتحان کن.','RESOURCE_EXHAUSTED');tries_add($rk);aerr(401,'کد معتبر نیست یا روی این گوشی فعال نشده است.','UNAUTHENTICATED');}
 $k=q("SELECT * FROM gkeys WHERE en=1 ORDER BY last ASC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
 if(!$k)aerr(503,'هیچ کلید فعالی در پنل نیست.','UNAVAILABLE');
 $out=['ok'=>true,'php_ms'=>(int)round((microtime(true)-$T0)*1000)];
 $t=microtime(true);$g=api_gcall('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',$k['k'],null);
 $out['list_ms']=(int)round((microtime(true)-$t)*1000);$out['list_st']=$g[0];
 $tests=[['fast','gemini-3-flash-preview',['maxOutputTokens'=>8,'thinkingConfig'=>['thinkingBudget'=>0]],'فقط بنویس: آماده'],['strong','gemini-3.8-flash',['maxOutputTokens'=>160],'برای آموزش حرف «ب» به بچه‌های کلاس سوم، سه گام کوتاه بنویس.']];
 foreach($tests as $c){
  $bd=json_encode(['contents'=>[['role'=>'user','parts'=>[['text'=>$c[3]]]]],'generationConfig'=>$c[2]],JSON_UNESCAPED_UNICODE);
   $t=microtime(true);$g=api_gcall('https://generativelanguage.googleapis.com/v1beta/models/'.$c[1].':generateContent',$k['k'],$bd);
  $out[$c[0].'_ms']=(int)round((microtime(true)-$t)*1000);$out[$c[0].'_st']=$g[0];
  $d=json_decode($g[1],true);$out[$c[0].'_th']=(is_array($d)&&isset($d['usageMetadata']['thoughtsTokenCount']))?(int)$d['usageMetadata']['thoughtsTokenCount']:0;}
 echo json_encode($out);exit;}
if($a==='ais'){
 /* V5: real streaming (SSE pass-through, no buffering) */
 set_time_limit(85);ignore_user_abort(false);
 $raw=file_get_contents('php://input');
 if($raw===false||strlen($raw)>400000)aerr(413,'درخواست خیلی بزرگ است.','INVALID_ARGUMENT');
 $nl=strpos($raw,"\n");if($nl===false||$nl>80)aerr(400,'درخواست نامعتبر.','INVALID_ARGUMENT');
 $head=explode('|',substr($raw,0,$nl));$body=substr($raw,$nl+1);
 $code=normcode($head[0]??'');$id=preg_replace('/[^a-z0-9]/i','',substr((string)($head[1]??''),0,32));$m=(string)($_GET['m']??'');
 if(substr(ltrim($body),0,1)!=='{'||!preg_match('/^gemini-[a-z0-9.\-]{1,40}$/',$m))aerr(400,'درخواست نامعتبر.','INVALID_ARGUMENT');
 $rk=rkey($id);
 $r=($code!==''&&strlen($id)>=8)?q("SELECT * FROM codes WHERE code=?",[$code])->fetch(PDO::FETCH_ASSOC):false;
 if(!$r||$r['dev']!==$id||$r['blk']){if(!tries_ok($rk))aerr(429,'تلاش‌های ناموفق زیاد بود. (per minute)','RESOURCE_EXHAUSTED');tries_add($rk);aerr(401,'کد فعال‌سازی معتبر نیست. API_KEY_INVALID','UNAUTHENTICATED');}
 $day=date('Y-m-d');$dn=($r['day']===$day)?(int)$r['dn']:0;
 if((int)$r['lim']>0&&$dn>=(int)$r['lim'])aerr(429,'سقف درخواست امروز این کد پر شده است. (per day)','RESOURCE_EXHAUSTED');
 if(!function_exists('curl_init'))aerr(501,'cURL روی هاست فعال نیست.','UNAVAILABLE');
 $now=time();$qd=qday();$started=false;$err='';$st=0;$kid=0;$busy=false;$net=false;$att=0;$tried=[];
 while($att<3&&!$started){
  $now=time();
  $k=q("SELECT g.*,COALESCE(CASE WHEN x.day=? THEN x.n END,0) AS tn FROM gkeys g LEFT JOIN kmodel x ON x.kid=g.id AND x.m=? WHERE g.en=1 AND g.cool<=? AND COALESCE(x.cool,0)<=?".($tried?" AND g.id NOT IN (".implode(',',array_map('intval',$tried)).")":"")." ORDER BY tn ASC,g.last ASC LIMIT 1",[$qd,$m,$now,$now])->fetch(PDO::FETCH_ASSOC);
  if(!$k)break;
  $att++;$kid=(int)$k['id'];$tried[]=$kid;
  q("UPDATE gkeys SET last=?,uses=uses+1 WHERE id=?",[(int)(microtime(true)*1000),$kid]);
  $tg=microtime(true);$buffer='';$states=[];$lastBeat=0;
  $begin=function()use(&$started){if($started)return;$started=true;http_response_code(200);header('Content-Type: text/event-stream; charset=utf-8');header('X-Accel-Buffering: no');header('Cache-Control: no-cache, no-store, no-transform');header('Connection: keep-alive');while(ob_get_level()>0)@ob_end_flush();};
  $emit=function($line)use(&$states){if(strpos($line,'data:')!==0)return;$d=json_decode(trim(substr($line,5)),true);if(!is_array($d))return;echo 'data: '.json_encode(visible_payload($d,$states),JSON_UNESCAPED_UNICODE)."\n\n";@flush();};
  $c=curl_init('https://generativelanguage.googleapis.com/v1beta/models/'.$m.':streamGenerateContent?alt=sse');
  curl_setopt_array($c,[CURLOPT_HTTPHEADER=>['x-goog-api-key: '.$k['k'],'Content-Type: application/json'],CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_TIMEOUT=>min(75,max(1,(int)(78-(microtime(true)-$T0)))),CURLOPT_CONNECTTIMEOUT=>10,
   CURLOPT_NOPROGRESS=>false,CURLOPT_XFERINFOFUNCTION=>function($ch,$dt,$dn,$ut,$un)use($begin,&$lastBeat,$tg){
    $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$now=microtime(true);
    if(($status===200||($status===0&&$now-$tg>=5))&&$now-$lastBeat>=5){$begin();echo ": keepalive\n\n";@flush();$lastBeat=$now;}
    return connection_aborted()?1:0;
   },
   CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use($begin,$emit,&$buffer,&$err,&$st){
    $st=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);
    if($st!==200){$err.=$chunk;return strlen($chunk);}
    $begin();$buffer.=$chunk;
    while(($pos=strpos($buffer,"\n"))!==false){$line=rtrim(substr($buffer,0,$pos),"\r");$buffer=substr($buffer,$pos+1);$emit($line);}
    return connection_aborted()?0:strlen($chunk);}]);
  curl_exec($c);$ce=(int)curl_errno($c);if(!$st)$st=(int)curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);
  if($buffer!==''&&$st===200)$emit(trim($buffer));
  perf_log($m,(int)round((microtime(true)-$tg)*1000),$st);
  if($started){
   if(($ce||$st!==200)&&!connection_aborted()){echo "\ndata: ".json_encode(['error'=>['code'=>$ce===28?504:($st>=400?$st:502),'message'=>'ارتباط پاسخ زنده کامل نشد؛ دوباره تلاش کنید.']],JSON_UNESCAPED_UNICODE)."\n\n";@flush();}
   q("UPDATE codes SET last=?,n=n+1,day=?,dn=? WHERE code=?",[$now,$day,$dn+1,$code]);
   q("INSERT OR IGNORE INTO kmodel(kid,m,day,n,cool) VALUES(?,?,?,0,0)",[$kid,$m,$qd]);
   q("UPDATE kmodel SET n=CASE WHEN day=? THEN n+1 ELSE 1 END,day=? WHERE kid=? AND m=?",[$qd,$qd,$kid,$m]);exit;}
  if($st===0&&$ce===28)aerr(504,'مدل دیر پاسخ داد؛ دوباره تلاش کن.','DEADLINE_EXCEEDED');
  // Still nothing streamed: this key is exhausted, cool it and try the next one.
  if($st===429){
   q("INSERT OR IGNORE INTO kmodel(kid,m,day,n,cool) VALUES(?,?,?,0,0)",[$kid,$m,$qd]);
   q("UPDATE kmodel SET cool=? WHERE kid=? AND m=?",[preg_match('/PerDay|per day|daily/i',$err)?qreset():$now+20,$kid,$m]);$busy=true;continue;}
  if($st===400&&preg_match('/API_KEY_INVALID|API_KEY_EXPIRED/',$err)){q("UPDATE gkeys SET en=0,note=? WHERE id=?",['کلید نامعتبر یا منقضی',$kid]);continue;}
  if($st===401||$st===403){q("UPDATE gkeys SET cool=?,fails=fails+1,note=? WHERE id=?",[$now+3600,'خطای '.$st,$kid]);continue;}
  if($st===0){$net=true;continue;}
  http_response_code($st);echo $err;exit;}
 $en=(int)q("SELECT COUNT(*) FROM gkeys WHERE en=1")->fetchColumn();
 $w=(int)q("SELECT MIN(x.cool) FROM kmodel x JOIN gkeys g ON g.id=x.kid WHERE g.en=1 AND x.m=? AND x.cool>?",[$m,$now])->fetchColumn();
 $ra=$w>$now?max(5,min(300,$w-$now)):30;
 if($busy||($en>0&&$w>$now&&!$net))aerr(429,'ظرفیت فعلی این مدل پر است؛ کمی بعد دوباره تلاش کن.','RESOURCE_EXHAUSTED',$ra);
 if($en===0)aerr(503,'هیچ کلید فعالی در پنل نیست.','UNAVAILABLE');
 // A saturated model says so in English; never forward that raw text.
 if(preg_match('~high demand|overloaded|rate limit|quota|resource exhausted|try again later|service unavailable~i',$err))aerr(503,'مدل الان مشغول است؛ چند لحظه بعد دوباره تلاش کن.','UNAVAILABLE',20);
 http_response_code($st?:503);echo $err!==''?$err:'{"error":{"message":"سرویس هوش مصنوعی در دسترس نیست.","status":"UNAVAILABLE"}}';exit;}
if($a==='ai'){
 set_time_limit(85);
 $raw=file_get_contents('php://input');
 if($raw===false||strlen($raw)>4000000)aerr(413,'درخواست خیلی بزرگ است.','INVALID_ARGUMENT');
 $nl=strpos($raw,"\n");
 if($nl===false||$nl>80)aerr(400,'درخواست نامعتبر.','INVALID_ARGUMENT');
 $head=explode('|',substr($raw,0,$nl));$body=substr($raw,$nl+1);
 $code=normcode($head[0]??'');$id=preg_replace('/[^a-z0-9]/i','',substr((string)($head[1]??''),0,32));$m=(string)($_GET['m']??'');
 if(substr(ltrim($body),0,1)!=='{'||!preg_match('/^gemini-[a-z0-9.\-]{1,40}$/',$m))aerr(400,'درخواست نامعتبر.','INVALID_ARGUMENT');
 $rk=rkey($id);
 $r=($code!==''&&strlen($id)>=8)?q("SELECT * FROM codes WHERE code=?",[$code])->fetch(PDO::FETCH_ASSOC):false;
 if(!$r||$r['dev']!==$id||$r['blk']){
  if(!tries_ok($rk))aerr(429,'تلاش‌های ناموفق زیاد بود؛ کمی بعد دوباره امتحان کن. (per minute)','RESOURCE_EXHAUSTED');
  tries_add($rk);aerr(401,'کد فعال‌سازی معتبر نیست، مسدود شده یا روی این گوشی فعال نشده است. API_KEY_INVALID','UNAUTHENTICATED');}
 $day=date('Y-m-d');$dn=($r['day']===$day)?(int)$r['dn']:0;
 if((int)$r['lim']>0&&$dn>=(int)$r['lim'])aerr(429,'سقف درخواست امروز این کد پر شده است. (per day)','RESOURCE_EXHAUSTED');
 $u='https://generativelanguage.googleapis.com/v1beta/models/'.$m.':generateContent';
 $qd=qday();$tried=[];$busy=false;$net=false;$att=0;$waited=0;
 while($att<10){
  $now=time();
  $sql="SELECT g.*,COALESCE(CASE WHEN x.day=? THEN x.n END,0) AS tn FROM gkeys g LEFT JOIN kmodel x ON x.kid=g.id AND x.m=? WHERE g.en=1 AND g.cool<=? AND COALESCE(x.cool,0)<=?";
  if($tried)$sql.=" AND g.id NOT IN (".implode(',',array_map('intval',$tried)).")";
  $k=q($sql." ORDER BY tn ASC,g.last ASC LIMIT 1",[$qd,$m,$now,$now])->fetch(PDO::FETCH_ASSOC);
  if(!$k){
   $w=(int)q("SELECT MIN(x.cool) FROM kmodel x JOIN gkeys g ON g.id=x.kid WHERE g.en=1 AND g.cool<=? AND x.m=? AND x.cool>?",[$now,$m,$now])->fetchColumn();
   if($w>$now&&$w-$now<=12&&$waited<12){$sl=$w-$now+1;sleep($sl);$waited+=$sl;$tried=[];continue;}
   break;}
  $att++;$kid=(int)$k['id'];$tried[]=$kid;
  q("UPDATE gkeys SET last=?,uses=uses+1 WHERE id=?",[(int)(microtime(true)*1000),$kid]);
   if(microtime(true)-$T0>=78)aerr(504,'مدل دیر پاسخ داد؛ دوباره تلاش کن.','DEADLINE_EXCEEDED');
   $tg=microtime(true);list($s,$o,$ce)=api_gcall($u,$k['k'],$body);perf_log($m,(int)round((microtime(true)-$tg)*1000),$s);
  if($s===0&&$ce===28)aerr(504,'مدل دیر پاسخ داد؛ دوباره تلاش کن یا سؤال را کوتاه‌تر بپرس.','DEADLINE_EXCEEDED');
  if($s===200){
   q("UPDATE codes SET last=?,n=n+1,day=?,dn=? WHERE code=?",[$now,$day,$dn+1,$code]);
   q("UPDATE gkeys SET fails=0,note='' WHERE id=?",[$kid]);
   q("INSERT OR IGNORE INTO kmodel(kid,m,day,n,cool) VALUES(?,?,?,0,0)",[$kid,$m,$qd]);
   q("UPDATE kmodel SET n=CASE WHEN day=? THEN n+1 ELSE 1 END,day=? WHERE kid=? AND m=?",[$qd,$qd,$kid,$m]);
   http_response_code(200);echo $o;exit;}
  if($s===429){
   $d=json_decode($o,true);$txt=json_encode(is_array($d)?($d['error']??[]):[],JSON_UNESCAPED_UNICODE);
   $until=preg_match('/PerDay|per day|daily/i',$txt)?qreset():$now+20;
   $ids=[$kid];$gr=(string)($k['grp']??'');
   if($gr!=='')foreach(q("SELECT id FROM gkeys WHERE grp=?",[$gr])->fetchAll(PDO::FETCH_COLUMN) as $x)$ids[]=(int)$x;
   foreach(array_unique($ids) as $x){
    q("INSERT OR IGNORE INTO kmodel(kid,m,day,n,cool) VALUES(?,?,?,0,0)",[$x,$m,$qd]);
    q("UPDATE kmodel SET cool=? WHERE kid=? AND m=?",[$until,$x,$m]);}
   $busy=true;continue;}
  if($s===400&&preg_match('/API_KEY_INVALID|API_KEY_EXPIRED/',$o)){
   q("UPDATE gkeys SET en=0,note=? WHERE id=?",['کلید نامعتبر یا منقضی',$kid]);continue;}
  if($s===401||$s===403){
   q("UPDATE gkeys SET cool=?,fails=fails+1,note=? WHERE id=?",[$now+3600,'خطای '.$s,$kid]);continue;}
  if($s===0){$net=true;continue;}
  http_response_code($s);echo $o;exit;}
 $now=time();
 $en=(int)q("SELECT COUNT(*) FROM gkeys WHERE en=1")->fetchColumn();
 $w=(int)q("SELECT MIN(x.cool) FROM kmodel x JOIN gkeys g ON g.id=x.kid WHERE g.en=1 AND x.m=? AND x.cool>?",[$m,$now])->fetchColumn();
 $ra=$w>$now?max(5,min(300,$w-$now)):30;
 if($busy||(!$net&&$en>0&&$w>$now))aerr(429,'ظرفیت فعلی این مدل پر است؛ کمی بعد دوباره امتحان کن. ('.($w-$now>300?'per day':'per minute').')','RESOURCE_EXHAUSTED',$ra);
 if($en===0)aerr(503,'هیچ کلید فعالی در پنل نیست.','UNAVAILABLE');
 aerr(503,'سرویس هوش مصنوعی فعلاً در دسترس نیست.','UNAVAILABLE');}
echo '{}';
