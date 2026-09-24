// Browser-independent primary-school year moments, filtered by real state.
// Never offer spending beyond the child's wallet or homework without school.
export function schoolAgeYearMoment(state,rng){
 const age=state.player.age;
 if(age<7||age>12)throw new Error('School-age moment is only available at ages 7-12.');
 const wallet=Math.max(0,state.childMoney?.wallet??0);
 const pool=[
  {title:'Hafta sonu',text:'Ailen sana seçim bıraktı.',choices:[
   {id:'family',label:'Ailece dışarı çık'},
   {id:'learn',label:'Yeni bir şey öğren'},
   {id:'rest',label:'Evde kal'}
  ]}
 ];
 if(state.education?.enrolled){
  const choices=[
   {id:'friends',label:'Arkadaşlarla oyna'},
   {id:'study',label:'Ödevlerini bitir'}
  ];
  if(wallet>=450)choices.push({id:'game-spend',label:'Oyuna/oyuncağa ₺450 harca'});
  pool.push({title:'Okuldan sonra',text:'Günün geri kalanını nasıl geçireceksin?',choices});
 }
 if(wallet>0){
  const choices=[{id:'child-save',label:'Harçlığından biriktir'}];
  if(wallet>=120)choices.push({id:'snack',label:'₺120 ile atıştırmalık al'});
  if(wallet>=280)choices.push({id:'book',label:'₺280 ile kitap/dergi al'});
  pool.push({title:'Harçlık kararı',text:'Cebinde ₺'+Math.round(wallet).toLocaleString('tr-TR')+' harçlığın var.',choices});
 }
 return rng.pick(pool);
}
