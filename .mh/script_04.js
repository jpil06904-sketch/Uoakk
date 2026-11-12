
(function(){
 var status='pending';var labels={pending:'نسخهٔ فونت ۳ · در حال بررسی فونت',loaded:'نسخهٔ فونت ۳ · فونت نوتو سنس بارگذاری شد',failed:'نسخهٔ فونت ۳ · فونت اختصاصی بارگذاری نشد',unknown:'نسخهٔ فونت ۳ · بررسی خودکار فونت پشتیبانی نمی‌شود'};
 function paint(){
  var root=document.getElementById('about-font-slot');if(!root)return;
  var note=document.getElementById('font-compat-note');if(!note){note=document.createElement('div');note.id='font-compat-note';note.setAttribute('role','status');root.insertBefore(note,root.firstChild);}
  if(note.textContent!==labels[status])note.textContent=labels[status];note.setAttribute('data-state',status);
 }
 var app=document.getElementById('app');if(app)new MutationObserver(paint).observe(app,{childList:true,subtree:true});
 if(document.fonts&&document.fonts.load){
  var timedOut=false;var timeout=setTimeout(function(){timedOut=true;status='failed';paint();},7000);
  Promise.all([document.fonts.load('400 14px MehryarSans3','پچژگکی'),document.fonts.load('700 20px MehryarSans3','مهریار')]).then(function(r){clearTimeout(timeout);status=r[0].length&&r[1].length?'loaded':'failed';paint();},function(){clearTimeout(timeout);status='failed';paint();});
 }else{status='unknown';paint();}
 paint();
})();

