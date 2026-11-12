<?php
error_reporting(E_ALL);ini_set('display_errors','0');ini_set('log_errors','1');
const DIR=__DIR__;date_default_timezone_set('Asia/Tehran');
function db(){static $d;if($d)return $d;@mkdir(DIR.'/data',0755,true);
$d=new PDO('sqlite:'.DIR.'/data/panel.sqlite');$d->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$d->exec("CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,first INT,last INT,ver TEXT);
CREATE TABLE IF NOT EXISTS ev(day TEXT,name TEXT,n INT DEFAULT 0,PRIMARY KEY(day,name));
CREATE TABLE IF NOT EXISTS act(day TEXT,id TEXT,PRIMARY KEY(day,id));
CREATE TABLE IF NOT EXISTS aidev(id TEXT PRIMARY KEY,key_set INT DEFAULT 0,ok_n INT DEFAULT 0,last_ok INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS banners(slot TEXT PRIMARY KEY,img TEXT,href TEXT,sd TEXT,ed TEXT,en INT DEFAULT 1);
CREATE TABLE IF NOT EXISTS popup(id INT PRIMARY KEY,title TEXT,txt TEXT,btn TEXT,href TEXT,sd TEXT,ed TEXT,en INT DEFAULT 0,once INT DEFAULT 1,rev INT DEFAULT 1);
CREATE TABLE IF NOT EXISTS gkeys(id INTEGER PRIMARY KEY AUTOINCREMENT,k TEXT UNIQUE,en INT DEFAULT 1,uses INT DEFAULT 0,cool INT DEFAULT 0,fails INT DEFAULT 0,last INT DEFAULT 0,note TEXT DEFAULT '',grp TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS codes(code TEXT PRIMARY KEY,label TEXT DEFAULT '',created INT DEFAULT 0,dev TEXT DEFAULT '',act INT DEFAULT 0,last INT DEFAULT 0,n INT DEFAULT 0,day TEXT DEFAULT '',dn INT DEFAULT 0,lim INT DEFAULT 300,blk INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS tries(k TEXT,t INT);
CREATE TABLE IF NOT EXISTS kmodel(kid INT,m TEXT,day TEXT DEFAULT '',n INT DEFAULT 0,cool INT DEFAULT 0,PRIMARY KEY(kid,m));
CREATE TABLE IF NOT EXISTS perf(t INT,m TEXT,g INT,tot INT,st INT);");
if(!in_array('grp',$d->query("PRAGMA table_info(gkeys)")->fetchAll(PDO::FETCH_COLUMN,1)))$d->exec("ALTER TABLE gkeys ADD COLUMN grp TEXT DEFAULT ''");
return $d;}
function q($sql,$a=[]){$s=db()->prepare($sql);$s->execute($a);return $s;}
function jdate($ymd){if(!preg_match('/^(\d{4})-(\d\d)-(\d\d)$/',$ymd,$m))return $ymd;$gy=(int)$m[1];$gm=(int)$m[2];$gd=(int)$m[3];
$g=[0,31,59,90,120,151,181,212,243,273,304,334];$gy2=$gm>2?$gy+1:$gy;
$days=355666+365*$gy+intdiv($gy2+3,4)-intdiv($gy2+99,100)+intdiv($gy2+399,400)+$gd+$g[$gm-1];
$jy=-1595+33*intdiv($days,12053);$days%=12053;$jy+=4*intdiv($days,1461);$days%=1461;
if($days>365){$jy+=intdiv($days-1,365);$days=($days-1)%365;}
$jm=$days<186?1+intdiv($days,31):7+intdiv($days-186,30);$jd=1+($days<186?$days%31:($days-186)%30);
return strtr(sprintf('%04d/%02d/%02d',$jy,$jm,$jd),['0'=>'۰','1'=>'۱','2'=>'۲','3'=>'۳','4'=>'۴','5'=>'۵','6'=>'۶','7'=>'۷','8'=>'۸','9'=>'۹']);}

function cut($s,$n=60){return preg_match('/^.{0,'.(int)$n.'}/su',(string)$s,$m)?$m[0]:'';}
function normcode($s){
 $s=strtr((string)$s,['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
 $s=preg_replace('/[^A-Z0-9]/','',strtoupper($s));
 if(strlen($s)===10&&substr($s,0,2)==='MH')return 'MH-'.substr($s,2,4).'-'.substr($s,6,4);
 return '';}
function newcode(){$A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';$b=random_bytes(8);$o='';for($i=0;$i<8;$i++)$o.=$A[ord($b[$i])%32];return 'MH-'.substr($o,0,4).'-'.substr($o,4,4);}
function rkey($id){$ip=preg_replace('/[^0-9a-fA-F:.]/','',(string)($_SERVER['HTTP_X_CLIENT_IP']??''));return $ip!==''?'i'.substr($ip,0,45):'d'.$id;}
function gcall($u,$key,$body){
 $h=['x-goog-api-key: '.$key];
 if($body!==null)$h[]='Content-Type: application/json';
 if(function_exists('curl_init')){
  $c=curl_init($u);
  $o=[CURLOPT_HTTPHEADER=>$h,CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>80,CURLOPT_CONNECTTIMEOUT=>10];
  if($body!==null){$o[CURLOPT_POST]=true;$o[CURLOPT_POSTFIELDS]=$body;}
  curl_setopt_array($c,$o);
  $r=curl_exec($c);$s=(int)curl_getinfo($c,CURLINFO_HTTP_CODE);$en=(int)curl_errno($c);curl_close($c);
  return [$s,$r===false?'':$r,$en];}
 $x=['method'=>$body!==null?'POST':'GET','header'=>implode("\r\n",$h),'timeout'=>80,'ignore_errors'=>true];
 if($body!==null)$x['content']=$body;
 $r=@file_get_contents($u,false,stream_context_create(['http'=>$x]));$s=0;
 if(isset($http_response_header[0])&&preg_match('~ (\d{3})~',$http_response_header[0],$m))$s=(int)$m[1];
 return [$s,$r===false?'':$r,0];}
function qday(){$d=new DateTime('now',new DateTimeZone('America/Los_Angeles'));return $d->format('Y-m-d');}
function qreset(){$d=new DateTime('tomorrow midnight',new DateTimeZone('America/Los_Angeles'));return $d->getTimestamp();}
