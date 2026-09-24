// Age-appropriate small moments shared by the browser and the childhood audit.
// Babies observe family development; they do not make adult-style decisions.
export function earlyYearMoment(age,rng){
 if(age<3)return null;
 if(age<5)return rng.pick([
  {title:'Birlikte oyun',text:'Ailen seninle zaman geçiriyor.',choices:[
   {id:'play',label:'Birlikte oyun oyna'},
   {id:'family',label:'Ailenin yanında vakit geçir'},
   {id:'rest',label:'Dinlen'}
  ]},
  {title:'Küçük bir keşif',text:'Evde yeni şeyleri merak ediyorsun.',choices:[
   {id:'draw',label:'Boya kalemleriyle karala'},
   {id:'learn',label:'Birlikte resimli kitaba bak'},
   {id:'play',label:'Oyuncaklarla oyna'}
  ]}
 ]);
 return rng.pick([
  {title:'Küçük bir keşif',text:'Bugün seni ne çekiyor?',choices:[
   {id:'play',label:'Oyun kur'},
   {id:'family',label:'Ailenle vakit geçir'},
   {id:'learn',label:'Yeni bir şey öğren'}
  ]},
  {title:'Evde bir gün',text:'Oyun ve günlük işlere katılıyorsun.',choices:[
   {id:'draw',label:'Resim yap'},
   {id:'help-home',label:'Ailene küçük bir işte yardım et'},
   {id:'rest',label:'Dinlen'}
  ]}
 ]);
}
