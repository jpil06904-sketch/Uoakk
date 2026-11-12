
(function(){
 const overlay=document.getElementById('salawat-loading');const button=document.getElementById('loading-enter');const started=Date.now();let interval;
 function close(){if(overlay.hidden)return;const hadFocus=overlay.contains(document.activeElement);overlay.hidden=true;clearInterval(interval);if(hadFocus){const next=document.querySelector('#app .photo-intro button,#intro-static button');if(next)next.focus({preventScroll:true});}}
 button.addEventListener('click',close);
 overlay.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='Tab'){e.preventDefault();button.focus();}});
 // Escape path exists even if the main app cannot start; never gate entry
 // on a prayer, a click count, network, or a stored completion flag.
 interval=setInterval(function(){
  if(window.__introAppReady){document.getElementById('loading-status').textContent='مهریار آماده است';if(Date.now()-started>=2600)close();}
  else if(Date.now()-started>=9000){document.getElementById('loading-status').textContent='آماده‌سازی طول کشید؛ می‌توانی وارد معرفی شوی.';clearInterval(interval);}
 },120);
 button.focus({preventScroll:true});
})();
