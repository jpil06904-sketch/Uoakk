p='/workspaces/Uoakk/mehryar-v4-final-fixed.html'
s=open(p,encoding='utf-8').read()
old="""    for(const k of keys){
      try{const b=JSON.parse(localStorage.getItem(k)||'null');if(!b||!Array.isArray(b.months)||!b.months.length)continue;
        const g=F(b.grade),y=yr(b.academicYear);
        if(wantG&&g&&g!==wantG)continue;
        if(wantY&&y&&y!==wantY)continue;
        found=b;break;}catch(_){}
    }
    if(!found)return null;"""
new="""    let yearAssumed=false;
    for(const pass of [0,1,2]){
      for(const k of keys){
        try{const b=JSON.parse(localStorage.getItem(k)||'null');if(!b||!Array.isArray(b.months)||!b.months.length)continue;
          const g=F(b.grade),y=yr(b.academicYear);
          if(pass<2&&wantG&&g&&g!==wantG)continue;
          if(pass<1&&wantY&&y&&y!==wantY)continue;
          if(pass===2&&k!==idx)continue;
          found=b;yearAssumed=pass>0&&!!wantY&&yr(b.academicYear)!==wantY;break;}catch(_){}
      }
      if(found)break;
    }
    if(!found)return null;"""
assert s.count(old)==1
s=s.replace(old,new)
old2="note:'بودجهٔ سالانهٔ تأییدشدهٔ معلم"
old2=old2.replace('ٔ','ٔ')
open(p,'w',encoding='utf-8').write(s)
print('ok')
