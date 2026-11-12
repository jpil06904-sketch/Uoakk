
window.__introAppReady=false;
window.launchIntroChoice=function(){var el=document.getElementById('intro-start-message');if(el)el.textContent='اجرای برنامه هنوز آماده نیست. اگر این پیام باقی ماند، فایل را دانلود کنید و در مرورگر اصلی باز کنید.';};
window.addEventListener('error',function(){if(!window.__introAppReady){var el=document.getElementById('intro-start-message');if(el)el.textContent='تصویر قابل نمایش است، اما اجرای برنامه در این محیط کامل نشد. فایل را در مرورگر اصلی باز کنید.';}});
