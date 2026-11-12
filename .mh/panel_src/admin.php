<?php
require __DIR__.'/lib.php';
session_start();
function h($s){return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}
function page($t,$b){echo '<!doctype html><html lang=fa dir=rtl><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>'.h($t).' — پنل مهریار</title><style>body{font:15px/1.8 system-ui,Tahoma,sans-serif;background:#f4f6f5;color:#14211b;margin:0}main{max-width:760px;margin:0 auto;padding:16px}nav{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}nav a{padding:8px 14px;border-radius:10px;background:#fff;color:#14211b;text-decoration:none;border:1px solid #d9e2dd}nav a.on{background:#16a34a;color:#fff;border-color:#16a34a}section{background:#fff;border:1px solid #d9e2dd;border-radius:14px;padding:16px;margin-bottom:14px}h2{margin:0 0 10px;font-size:17px}label{display:block;margin:10px 0 4px;font-weight:600}input,textarea{width:100%;box-sizing:border-box;padding:9px;border:1px solid #c5d0ca;border-radius:9px;font:inherit}input[type=checkbox]{width:auto}button{padding:10px 18px;border:0;border-radius:10px;background:#16a34a;color:#fff;font:inherit;cursor:pointer;margin-top:12px}table{width:100%;border-collapse:collapse}td,th{padding:6px 4px;border-bottom:1px solid #eef2f0;text-align:right}.n{font-size:22px;font-weight:700}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.m{color:#5c6e65;font-size:13px}.e{color:#b42318}.ok{color:#15803d}.bar{height:8px;background:#16a34a;border-radius:4px}.s{padding:5px 11px;margin:3px 2px;font-size:13px}.s.r{background:#b42318}.s.y{background:#5c6e65}.cd{border-top:1px solid #eef2f0;padding:10px 0}input[type=number]{width:90px}img{max-width:100%;border-radius:10px}</style><main>'.$b.'</main>';}
if(empty($_SESSION['t']))$_SESSION['t']=bin2hex(random_bytes(16));
$T='<input type=hidden name=t value="'.$_SESSION['t'].'">';$post=$_SERVER['REQUEST_METHOD']==='POST';
if($post&&!hash_equals($_SESSION['t'],$_POST['t']??''))exit('درخواست نامعتبر');
$hf=DIR.'/data/admin.hash';
if(!file_exists($hf)){
 if($post&&strlen($_POST['pw']??'')>=8){file_put_contents($hf,password_hash($_POST['pw'],PASSWORD_DEFAULT));header('Location: admin.php');exit;}
 page('تعیین رمز','<section><h2>تعیین رمز مدیر</h2><form method=post>'.$T.'<p>اولین ورود است. رمز را (حداقل ۸ نویسه) انتخاب کن.</p><input type=password name=pw minlength=8 required><button>ذخیره رمز</button></form></section>');exit;}
if(isset($_GET['out'])){session_destroy();header('Location: admin.php');exit;}
if(empty($_SESSION['ok'])){
 if($post&&password_verify($_POST['pw']??'',file_get_contents($hf))){$_SESSION['ok']=1;header('Location: admin.php');exit;}
 if($post)sleep(1);
 page('ورود','<section><h2>ورود مدیر</h2><form method=post>'.$T.'<label>رمز</label><input type=password name=pw required autofocus>'.($post?'<p class=e>رمز درست نیست.</p>':'').'<button>ورود</button></form></section>');exit;}
function up($s){if(empty($_FILES['img']['tmp_name']))return null;$f=$_FILES['img'];$i=@getimagesize($f['tmp_name']);
 if(!$i||!in_array($i[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP]))throw new Exception('فقط عکس JPG، PNG یا WebP');
 if($f['size']>500000)throw new Exception('حجم عکس باید زیر ۵۰۰ کیلوبایت باشد');
 if(abs($i[0]/$i[1]-3)>0.15)$GLOBALS['w']=' (هشدار: نسبت عکس ۳ به ۱ نیست و ممکن است بریده شود)';
 @mkdir(DIR.'/uploads',0755,true);$x=[IMAGETYPE_JPEG=>'jpg',IMAGETYPE_PNG=>'png',IMAGETYPE_WEBP=>'webp'][$i[2]];$n=$s.'-'.time().'.'.$x;
 if(!move_uploaded_file($f['tmp_name'],DIR.'/uploads/'.$n))throw new Exception('ذخیرهٔ عکس ناموفق بود');return $n;}
$msg='';$w='';$p=$_GET['p']??'stats';
if($post&&isset($_POST['do'])){try{
 $href=trim($_POST['href']??'');if($href&&!preg_match('~^https://~i',$href))throw new Exception('لینک باید با https:// شروع شود');
 if($_POST['do']==='banner'){$s=($_POST['slot']??'')==='bottom'?'bottom':'top';$old=(string)q("SELECT img FROM banners WHERE slot=?",[$s])->fetchColumn();
  $n=up($s);if($n&&$old)@unlink(DIR.'/uploads/'.$old);if(!$n)$n=$old;if(isset($_POST['del'])){if($old)@unlink(DIR.'/uploads/'.$old);$n='';}
  q("REPLACE INTO banners(slot,img,href,sd,ed,en) VALUES(?,?,?,?,?,?)",[$s,$n,$href,$_POST['sd']??'',$_POST['ed']??'',isset($_POST['en'])?1:0]);$msg='بنر ذخیره شد.'.$GLOBALS['w'];$p='banners';}
 if($_POST['do']==='popup'){$rev=(int)q("SELECT rev FROM popup WHERE id=1")->fetchColumn()+1;
  q("REPLACE INTO popup(id,title,txt,btn,href,sd,ed,en,once,rev) VALUES(1,?,?,?,?,?,?,?,?,?)",[trim($_POST['title']??''),trim($_POST['txt']??''),trim($_POST['btn']??''),$href,$_POST['sd']??'',$_POST['ed']??'',isset($_POST['en'])?1:0,isset($_POST['once'])?1:0,$rev]);$msg='پاپ‌آپ ذخیره شد.';$p='popup';}
 if($_POST['do']==='gen'){$cnt=max(1,min(50,(int)($_POST['cnt']??1)));$lab=cut(trim($_POST['label']??''));$lim=max(0,min(5000,(int)($_POST['lim']??300)));$made=[];
  for($i=0;$i<$cnt;$i++){$c=newcode();q("INSERT INTO codes(code,label,created,lim) VALUES(?,?,?,?)",[$c,($cnt>1&&$lab!==''?$lab.' '.($i+1):$lab),time(),$lim]);$made[]=$c;}
  $msg='ساخته شد: '.implode(' ، ',$made);$p='codes';}
 if($_POST['do']==='codeact'){$c=normcode($_POST['code']??'');$x=$_POST['x']??'';
  if($x==='off')q("UPDATE codes SET blk=1 WHERE code=?",[$c]);
  elseif($x==='on')q("UPDATE codes SET blk=0 WHERE code=?",[$c]);
  elseif($x==='free')q("UPDATE codes SET dev='',act=0 WHERE code=?",[$c]);
  elseif($x==='del')q("DELETE FROM codes WHERE code=?",[$c]);
  elseif($x==='lim')q("UPDATE codes SET lim=? WHERE code=?",[max(0,min(5000,(int)($_POST['lim']??0))),$c]);
  $msg='انجام شد.';$p='codes';}
 if($_POST['do']==='addkeys'){$n=0;$dup=0;$bad=0;$sm='';$gr=cut(trim($_POST['grp']??''),40);
  foreach(preg_split('/[\s,;"\'`]+/',(string)($_POST['keys']??'')) as $l){$l=trim($l);if($l==='')continue;
   if(!preg_match('/^[A-Za-z0-9_.\-]{20,200}$/',$l)){$bad++;if($sm==='')$sm=substr($l,0,4).'… (طول '.strlen($l).')';continue;}
   $c=q("INSERT OR IGNORE INTO gkeys(k,grp) VALUES(?,?)",[$l,$gr])->rowCount();if($c>0)$n+=$c;else $dup++;}
  $msg=($n>0?'اضافه شد: '.$n:'خطا: هیچ کلیدی اضافه نشد').($dup?' · تکراری: '.$dup:'').($bad?' · شکل نامعتبر: '.$bad.' (نمونه: '.$sm.')':'').'.';$p='keys';}
 if($_POST['do']==='keyact'){$id=(int)($_POST['id']??0);$x=$_POST['x']??'';$msg='انجام شد.';
  if($x==='off')q("UPDATE gkeys SET en=0 WHERE id=?",[$id]);
  elseif($x==='on'){q("UPDATE gkeys SET en=1,cool=0,fails=0,note='' WHERE id=?",[$id]);q("UPDATE kmodel SET cool=0 WHERE kid=?",[$id]);}
  elseif($x==='grp')q("UPDATE gkeys SET grp=? WHERE id=?",[cut(trim($_POST['grp']??''),40),$id]);
  elseif($x==='del')q("DELETE FROM gkeys WHERE id=?",[$id]);
  elseif($x==='test'){$k=(string)q("SELECT k FROM gkeys WHERE id=?",[$id])->fetchColumn();$r=gcall('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',$k,null);
   $d=json_decode($r[1],true);$em=(is_array($d)&&isset($d['error']['message']))?cut((string)$d['error']['message'],110):'';
   $msg=$r[0]===200?'این کلید سالم است.':'خطا: تست ناموفق بود (کد '.$r[0].')'.($em!==''?' — '.$em:'').'.';}
  $p='keys';}
 if($_POST['do']==='testall'){set_time_limit(120);$ok=0;$fl=[];$z=false;
  foreach(q("SELECT id,k FROM gkeys ORDER BY id")->fetchAll(PDO::FETCH_ASSOC) as $r){$g=gcall('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',$r['k'],null);
   if($g[0]===200)$ok++;else{$fl[]='#'.(int)$r['id'].' (کد '.$g[0].')';if($g[0]===0)$z=true;}}
  $msg=($fl?'خطا: ':'').'تست همهٔ کلیدها — سالم: '.$ok.($fl?' · ناموفق: '.implode('، ',$fl):'').($z?' · کد ۰ یعنی سرور پنل به گوگل وصل نشد':'').'.';$p='keys';}
 if($_POST['do']==='speed'){set_time_limit(300);
  $k=(string)q("SELECT k FROM gkeys WHERE en=1 ORDER BY id LIMIT 1")->fetchColumn();
  if($k==='')throw new Exception('اول یک کلید فعال اضافه کن.');
  $pr='یک معلم کلاس دوم دبستان گزارش داده که در درس ریاضی چهار نفر از بیست‌وپنج دانش‌آموز مبحث «تقسیم» را متوجه نشده‌اند و دو جلسه از بودجه عقب است. در حداکثر پنج جمله تحلیل کن و یک قدم عملی برای فردا پیشنهاد بده.';
  $cs=[['gemini-3.8-flash','پیش‌فرض',[]],['gemini-3.8-flash','سقف ۱۰۲۴',['thinkingConfig'=>['thinkingBudget'=>1024]]],['gemini-3.8-flash','سطح کم',['thinkingConfig'=>['thinkingLevel'=>'low']]],['gemini-3-flash-preview','پیش‌فرض',[]],['gemini-3-flash-preview','سقف ۵۱۲',['thinkingConfig'=>['thinkingBudget'=>512]]]];
  $rw=[];
  foreach($cs as $c){$gc=array_merge(['maxOutputTokens'=>700],$c[2]);
   $bd=json_encode(['contents'=>[['role'=>'user','parts'=>[['text'=>$pr]]]],'generationConfig'=>$gc],JSON_UNESCAPED_UNICODE);
   $t=microtime(true);$g=gcall('https://generativelanguage.googleapis.com/v1beta/models/'.$c[0].':generateContent',$k,$bd);$ms=(int)round((microtime(true)-$t)*1000);
   $d=json_decode($g[1],true);$th=(is_array($d)&&isset($d['usageMetadata']['thoughtsTokenCount']))?(int)$d['usageMetadata']['thoughtsTokenCount']:0;
   $ot=(is_array($d)&&isset($d['usageMetadata']['candidatesTokenCount']))?(int)$d['usageMetadata']['candidatesTokenCount']:0;
   $em=(is_array($d)&&isset($d['error']['message']))?cut((string)$d['error']['message'],70):'';
   $rw[]=$c[0].' · '.$c[1].' ← '.($g[0]===200?round($ms/1000,1).' ثانیه، فکر '.$th.'، خروجی '.$ot:'خطا '.$g[0].($em!==''?' ('.$em.')':''));}
  $msg='تست سرعت مدل از سرور پنل: '.implode(' ؛ ',$rw).'.';$p='keys';}
}catch(Exception $e){$msg='خطا: '.$e->getMessage();}}
$nav='<nav>';foreach(['stats'=>'آمار','codes'=>'کدها','keys'=>'کلیدها','speed'=>'سرعت','banners'=>'بنرها','popup'=>'پاپ‌آپ'] as $k=>$v)$nav.='<a class="'.($p===$k?'on':'').'" href="?p='.$k.'">'.$v.'</a>';$nav.='<a href="?out=1">خروج</a></nav>';
$out=$nav.($msg?'<section class="'.(strpos($msg,'خطا')===0?'e':'ok').'">'.h($msg).'</section>':'');
if($p==='banners'){foreach(['top'=>'بنر بالای صفحهٔ خانه','bottom'=>'بنر پایین صفحهٔ خانه'] as $s=>$nm){
 $r=q("SELECT * FROM banners WHERE slot=?",[$s])->fetch(PDO::FETCH_ASSOC)?:['img'=>'','href'=>'','sd'=>'','ed'=>'','en'=>0];
 $out.='<section><h2>'.$nm.'</h2>'.($r['img']?'<img src="uploads/'.h($r['img']).'" alt="">':'<p class=m>هنوز عکسی نگذاشته‌ای؛ تا آن موقع بنر داخلی اپ نشان داده می‌شود.</p>').'<form method=post enctype=multipart/form-data>'.$T.'<input type=hidden name=do value=banner><input type=hidden name=slot value='.$s.'><label>عکس (۱۸۰۰×۶۰۰، زیر ۵۰۰ کیلوبایت)</label><input type=file name=img accept="image/*"><label>لینک (https)</label><input name=href value="'.h($r['href']).'" placeholder="https://"><label>از تاریخ</label><input type=date name=sd value="'.h($r['sd']).'"><label>تا تاریخ</label><input type=date name=ed value="'.h($r['ed']).'"><label><input type=checkbox name=en '.($r['en']?'checked':'').'> فعال</label>'.($r['img']?'<label><input type=checkbox name=del> حذف عکس (بازگشت به بنر داخلی)</label>':'').'<button>ذخیره</button></form></section>';}}
elseif($p==='popup'){$r=q("SELECT * FROM popup WHERE id=1")->fetch(PDO::FETCH_ASSOC)?:['title'=>'','txt'=>'','btn'=>'','href'=>'','sd'=>'','ed'=>'','en'=>0,'once'=>1];
 $out.='<section><h2>پاپ‌آپ</h2><form method=post>'.$T.'<input type=hidden name=do value=popup><label>عنوان</label><input name=title value="'.h($r['title']).'" maxlength=80><label>متن (ساده، بدون HTML)</label><textarea name=txt rows=4 maxlength=600>'.h($r['txt']).'</textarea><label>متن دکمه (اختیاری)</label><input name=btn value="'.h($r['btn']).'" maxlength=30><label>لینک دکمه (https، اختیاری)</label><input name=href value="'.h($r['href']).'"><label>از تاریخ</label><input type=date name=sd value="'.h($r['sd']).'"><label>تا تاریخ</label><input type=date name=ed value="'.h($r['ed']).'"><label><input type=checkbox name=once '.($r['once']?'checked':'').'> هر معلم فقط یک‌بار ببیند (با هر ذخیره دوباره نشان داده می‌شود)</label><label><input type=checkbox name=en '.($r['en']?'checked':'').'> فعال</label><button>ذخیره</button></form></section>';}
elseif($p==='codes'){
 $td=date('Y-m-d');$all=q("SELECT * FROM codes ORDER BY created DESC")->fetchAll(PDO::FETCH_ASSOC);
 $cu=0;$ca=0;$cb=0;$tdn=0;foreach($all as $r){if($r['blk'])$cb++;elseif($r['dev']==='')$cu++;else $ca++;if($r['day']===$td)$tdn+=(int)$r['dn'];}
 $fmt=function($t){return $t?h(jdate(date('Y-m-d',$t))).' '.date('H:i',$t):'—';};
 $out.='<section><h2>کدهای فعال‌سازی چت‌بات</h2><div class=g><div><div class=n>'.$ca.'</div>فعال‌شده</div><div><div class=n>'.$cu.'</div>استفاده‌نشده</div><div><div class=n>'.$cb.'</div>مسدود</div><div><div class=n>'.$tdn.'</div>درخواست امروز</div></div><p class=m>«فعال‌شده» یعنی معلم کد را در اپ زده و کد به گوشی او گره خورده است.</p></section>';
 $out.='<section><h2>ساخت کد جدید</h2><form method=post>'.$T.'<input type=hidden name=do value=gen><label>اسم معلم (برای یادآوری خودت)</label><input name=label maxlength=60><label>تعداد کد</label><input type=number name=cnt value=1 min=1 max=50><label>سقف درخواست در روز برای هر کد (۰ یعنی بدون سقف)</label><input type=number name=lim value=300 min=0 max=5000><button>ساخت</button></form></section>';
 $rows='';
 foreach($all as $r){$c=h($r['code']);
  $st=$r['blk']?'<span class=e>مسدود</span>':($r['dev']===''?'<span class=m>استفاده‌نشده</span>':'<span class=ok>فعال‌شده</span>');
  $rows.='<div class=cd><b dir=ltr>'.$c.'</b>'.($r['label']!==''?' — '.h($r['label']):'').' · '.$st
   .'<div class=m>ساخت: '.$fmt($r['created']).' · فعال‌سازی: '.$fmt($r['act']).' · آخرین استفاده: '.$fmt($r['last']).' · امروز: '.($r['day']===$td?(int)$r['dn']:0).((int)$r['lim']>0?' از '.(int)$r['lim']:'').' · کل: '.(int)$r['n'].'</div>'
   .'<form method=post>'.$T.'<input type=hidden name=do value=codeact><input type=hidden name=code value="'.$c.'">'
   .'<button type=button class=s data-c="'.$c.'" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.dataset.c);this.textContent=\'کپی شد\'">کپی کد</button>'
   .($r['dev']!==''?'<button class="s y" name=x value=free onclick="return confirm(\'گوشی این کد آزاد شود تا روی گوشی دیگر فعال شود؟\')">آزاد کردن گوشی</button>':'')
   .($r['blk']?'<button class=s name=x value=on>فعال‌کردن دوباره</button>':'<button class="s y" name=x value=off>مسدود</button>')
   .'<button class="s r" name=x value=del onclick="return confirm(\'این کد حذف شود؟\')">حذف</button>'
   .'<br><input type=number name=lim value="'.(int)$r['lim'].'" min=0 max=5000 style="width:80px;padding:4px"><button class=s name=x value=lim>ثبت سقف روزانه</button></form></div>';}
 $out.='<section><h2>همهٔ کدها ('.count($all).')</h2>'.($rows?:'<p class=m>هنوز کدی نساخته‌ای.</p>').'</section>';}
elseif($p==='speed'){
 $rw=q("SELECT m,COUNT(*) AS c,AVG(g) AS g,AVG(tot) AS tt,MAX(tot) AS mx,SUM(CASE WHEN st=504 THEN 1 ELSE 0 END) AS tmo FROM (SELECT * FROM perf ORDER BY t DESC LIMIT 200) GROUP BY m ORDER BY m")->fetchAll(PDO::FETCH_ASSOC);
 $sc=function($ms){return round(((float)$ms)/1000,1);};
 $out.='<section><h2>زمان پاسخ (۲۰۰ درخواست آخر)</h2>';
 if(!$rw)$out.='<p class=m>هنوز درخواستی ثبت نشده است. بعد از چند گفتگو در اپ، اینجا را دوباره ببین.</p>';
 foreach($rw as $r){$ov=max(0,(float)$r['tt']-(float)$r['g']);
  $out.='<div class=cd><b dir=ltr>'.h($r['m']).'</b><div class=m>تعداد: '.(int)$r['c'].' · میانگین کل: '.$sc($r['tt']).' ثانیه · انتظار برای گوگل: '.$sc($r['g']).' ثانیه · سربار خود سرور: '.$sc($ov).' ثانیه · کندترین: '.$sc($r['mx']).' ثانیه · قطع‌شده: '.(int)$r['tmo'].'</div></div>';}
 $out.='<p class=m>اگر «انتظار برای گوگل» بخش اصلی زمان است، سرور مشکلی ندارد و کندی از خود مدل (فکر کردن و طول جواب) است. اگر «سربار خود سرور» زیاد است، مشکل از هاست یا پایگاه‌داده است.</p></section>';
 $ls=q("SELECT * FROM perf ORDER BY t DESC LIMIT 12")->fetchAll(PDO::FETCH_ASSOC);$lr='';
 foreach($ls as $r)$lr.='<div class=cd><span class=m>'.date('H:i',(int)$r['t']).'</span> · <b dir=ltr>'.h($r['m']).'</b> · گوگل '.$sc($r['g']).' ثانیه · کل '.$sc($r['tot']).' ثانیه · وضعیت '.(int)$r['st'].'</div>';
 $out.='<section><h2>آخرین درخواست‌ها</h2>'.($lr?:'<p class=m>—</p>').'</section>';}
elseif($p==='keys'){
 $ks=q("SELECT * FROM gkeys ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);$tn=time();
 $ov='';foreach(q("SELECT m,SUM(CASE WHEN day=? THEN n ELSE 0 END) AS tot,SUM(CASE WHEN cool>? THEN 1 ELSE 0 END) AS rest FROM kmodel GROUP BY m ORDER BY m",[qday(),$tn])->fetchAll(PDO::FETCH_ASSOC) as $x)$ov.='<div class=cd><b dir=ltr>'.h($x['m']).'</b><div class=m>امروز '.(int)$x['tot'].' درخواست موفق · '.(int)$x['rest'].' کلید در استراحت</div></div>';
 $enc=(int)q("SELECT COUNT(*) FROM gkeys WHERE en=1")->fetchColumn();
 $out.='<section><h2>وضعیت ظرفیت</h2><p class=m>'.$enc.' کلید فعال'.($ov===''?' · هنوز درخواستی ثبت نشده':'').'</p>'.$ov.'<form method=post>'.$T.'<input type=hidden name=do value=testall><button class=s>تست همهٔ کلیدها (چند ثانیه طول می‌کشد)</button></form><form method=post>'.$T.'<input type=hidden name=do value=speed><button class=s>تست سرعت مدل (حدود یک دقیقه)</button></form><p class=m>اگر کلیدهای «در استراحت» نزدیک تعداد کل کلیدها شدند، ظرفیت آن مدل دارد تمام می‌شود و باید کلید تازه (از پروژهٔ جدید) اضافه کنی.</p></section>';
 $out.='<section><h2>افزودن کلیدهای Gemini</h2><form method=post>'.$T.'<input type=hidden name=do value=addkeys><label>هر کلید در یک خط (کلیدهای تازهٔ گوگل با AQ. شروع می‌شوند و نقطه دارند؛ تکراری‌ها نادیده گرفته می‌شوند)</label><textarea name=keys rows=6 dir=ltr placeholder="AQ.Ab8... یا AIza..."></textarea><label>گروه (اختیاری): اگر این کلیدها از یک پروژهٔ گوگل‌اند، یک اسم یکسان بنویس</label><input name=grp maxlength=40><button>افزودن</button></form><p class=m>سهمیهٔ گوگل برای هر <b>پروژه</b> است، نه هر کلید. چند کلید از یک پروژه ظرفیت اضافه نمی‌دهند؛ برای ظرفیت واقعی هر کلید را از یک پروژهٔ جدا بساز.</p><p class=m>چرخش خودکار است: هر درخواست به کلیدی می‌رود که امروز برای همان مدل کمترین استفاده را داشته. اگر سهمیهٔ یک مدل روی یک کلید پر شود، فقط همان مدل روی آن کلید تا ریست سهمیه کنار می‌رود و مدل دیگر روی همان کلید کار می‌کند. سهمیهٔ روزانهٔ گوگل نیمه‌شب به وقت غرب آمریکا ریست می‌شود (حدود ۱۰:۳۰ تا ۱۱:۳۰ صبح به وقت ایران).</p><p class=m>کلیدها فقط روی سرور پنل می‌مانند و به اپ فرستاده نمی‌شوند. در لیست فقط بخشی از هر کلید دیده می‌شود.</p></section>';
 $rows='';
 foreach($ks as $r){$k=(string)$r['k'];
  $ms='';$ac=false;foreach(q("SELECT * FROM kmodel WHERE kid=? ORDER BY m",[(int)$r['id']])->fetchAll(PDO::FETCH_ASSOC) as $x){$cl=(int)$x['cool'];if($cl>$tn)$ac=true;
   $ms.='<div class=m>'.h($x['m']).' — امروز: '.($x['day']===qday()?(int)$x['n']:0).($cl>$tn?' — استراحت تا '.h(jdate(date('Y-m-d',$cl))).' '.date('H:i',$cl):'').'</div>';}
  $st=!$r['en']?'<span class=e>خاموش</span>':((int)$r['cool']>$tn?'<span class=m>در استراحت تا '.date('H:i',(int)$r['cool']).'</span>':'<span class=ok>آماده</span>');
  $rows.='<div class=cd><b dir=ltr>'.h(substr($k,0,6).'…'.substr($k,-4)).'</b> · '.$st.((string)$r['grp']!==''?' · <span class=m>گروه: '.h($r['grp']).'</span>':'').($r['note']!==''?' · <span class=m>'.h($r['note']).'</span>':'')
   .'<div class=m>کل استفاده: '.(int)$r['uses'].' · خطای پشت‌سرهم: '.(int)$r['fails'].'</div>'.$ms
   .'<form method=post>'.$T.'<input type=hidden name=do value=keyact><input type=hidden name=id value="'.(int)$r['id'].'">'
   .'<button class=s name=x value=test>تست</button>'
   .'<input name=grp value="'.h($r['grp']).'" maxlength=40 placeholder="گروه" style="width:90px;padding:4px"><button class="s y" name=x value=grp>ثبت گروه</button>'
   .($r['en']?'<button class="s y" name=x value=off>خاموش</button>':'')
   .((!$r['en']||$ac||(int)$r['cool']>$tn)?'<button class=s name=x value=on>فعال و آماده</button>':'')
   .'<button class="s r" name=x value=del onclick="return confirm(\'این کلید حذف شود؟\')">حذف</button></form></div>';}
 $out.='<section><h2>کلیدها ('.count($ks).')</h2>'.($rows?:'<p class=m>هنوز کلیدی نگذاشته‌ای.</p>').'</section>';}
else{$td=strtotime('today');$tot=q("SELECT COUNT(*) FROM devices")->fetchColumn();$n1=q("SELECT COUNT(*) FROM devices WHERE first>=?",[$td])->fetchColumn();$n7=q("SELECT COUNT(*) FROM devices WHERE first>=?",[strtotime('-6 days',$td)])->fetchColumn();
 $ac=function($d){return q("SELECT COUNT(DISTINCT id) FROM act WHERE day>=?",[$d])->fetchColumn();};
 $ev=[];foreach(q("SELECT name,SUM(n) FROM ev WHERE day>=? GROUP BY name",[date('Y-m-d',strtotime('-29 days'))])->fetchAll(PDO::FETCH_NUM) as $x)$ev[$x[0]]=(int)$x[1];
 $c=function($k)use($ev){return (int)($ev[$k]??0);};$ctr=function($v,$k)use($c){return $c($v)?round(100*$c($k)/$c($v),1).'٪':'—';};
 $out.='<section><h2>دستگاه‌ها (تقریبی)</h2><div class=g><div><div class=n>'.$tot.'</div>نصب کل</div><div><div class=n>'.$n1.'</div>جدید امروز</div><div><div class=n>'.$n7.'</div>جدید ۷ روز</div><div><div class=n>'.$ac(date('Y-m-d')).'</div>فعال امروز</div><div><div class=n>'.$ac(date('Y-m-d',strtotime('-6 days'))).'</div>فعال ۷ روز</div><div><div class=n>'.$ac(date('Y-m-d',strtotime('-29 days'))).'</div>فعال ۳۰ روز</div></div><p class=m>پاک‌کردن حافظهٔ مرورگر یا استفادهٔ دو دستگاه، شمارش را کمی تغییر می‌دهد.</p></section>';
 $days=q("SELECT day,COUNT(*) FROM act WHERE day>=? GROUP BY day ORDER BY day",[date('Y-m-d',strtotime('-13 days'))])->fetchAll(PDO::FETCH_KEY_PAIR);$mx=max(1,$days?max($days):1);
 $out.='<section><h2>فعال در ۱۴ روز گذشته</h2><table>';foreach($days as $dd=>$k)$out.='<tr><td>'.h(jdate($dd)).'</td><td style="width:60%"><div class=bar style="width:'.round(100*$k/$mx).'%"></div></td><td>'.$k.'</td></tr>';$out.='</table></section>';
 $out.='<section><h2>هوش مصنوعی</h2><div class=g><div><div class=n>'.q("SELECT COUNT(*) FROM aidev WHERE key_set=1")->fetchColumn().'</div>متصل به هوش مصنوعی</div><div><div class=n>'.q("SELECT COUNT(*) FROM aidev WHERE ok_n>0")->fetchColumn().'</div>جواب موفق گرفته‌اند</div><div><div class=n>'.q("SELECT COUNT(*) FROM aidev WHERE last_ok>=?",[strtotime('-6 days',$td)])->fetchColumn().'</div>موفق در ۷ روز</div></div><table><tr><th>۳۰ روز گذشته</th><th>تعداد</th></tr><tr><td>جواب موفق</td><td>'.$c('ai_ok').'</td></tr><tr><td>تلاش ناموفق: سهمیه</td><td>'.$c('ai_quota').'</td></tr><tr><td>تلاش ناموفق: شلوغی</td><td>'.$c('ai_busy').'</td></tr><tr><td>خطای دیگر</td><td>'.$c('ai_err').'</td></tr></table></section>';
 $out.='<section><h2>بنرها و پاپ‌آپ (۳۰ روز)</h2><table><tr><th></th><th>دیده‌شدن</th><th>کلیک</th><th>نرخ</th></tr>';foreach(['top'=>'بنر بالا','bottom'=>'بنر پایین','popup'=>'پاپ‌آپ'] as $k=>$nm)$out.='<tr><td>'.$nm.'</td><td>'.$c($k.'_view').'</td><td>'.$c($k.'_click').'</td><td>'.$ctr($k.'_view',$k.'_click').'</td></tr>';$out.='</table><p class=m>فقط عدد کلی شمرده می‌شود؛ معلوم نیست کدام معلم کلیک کرده.</p></section>';
 $out.='<section><h2>نسخه‌ها</h2><table>';foreach(q("SELECT ver,COUNT(*) FROM devices GROUP BY ver ORDER BY 2 DESC")->fetchAll(PDO::FETCH_NUM) as $x)$out.='<tr><td>'.h($x[0]?:'نامشخص').'</td><td>'.$x[1].'</td></tr>';$out.='</table></section>';}
page('پنل',$out);
