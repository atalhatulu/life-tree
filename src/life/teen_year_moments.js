// Teen moments respect enrollment and pocket money, including the age-13
// transition from the primary-school presentation to adolescence.
export function teenYearMoment(state,rng){
 const age=state.player.age;
 if(age<13||age>17)throw new Error('Teen moments apply at ages 13-17.');
 const wallet=Math.max(0,state.childMoney?.wallet??0);
 const pool=[
  {title:'Kendine yatırım',text:'Boş vaktini nasıl kullanacaksın?',choices:[
   {id:'exercise',label:'Spor yap'},
   {id:'learn',label:'Yeni beceri öğren'},
   {id:'social',label:'Sosyalleş'}
  ]}
 ];
 if(state.education?.enrolled)pool.push({
  title:'Okul ve sosyal hayat',text:'Bu hafta neye ağırlık vereceksin?',choices:[
   {id:'friends',label:'Arkadaşlarla takıl'},
   {id:'study',label:'Derse ağırlık ver'},
   {id:'club',label:'Kulüp/hobiye katıl'}
  ]
 });
 if(wallet>0){
  const choices=[{id:'child-save',label:'Harçlığından biriktir'}];
  if(wallet>=300)choices.push({id:'meal-small',label:'Arkadaşlarla ₺300 harcayarak bir şeyler ye'});
  if(wallet>=650)choices.push({id:'clothes-small',label:'₺650 ile kendine bir şey al'});
  pool.push({title:'Harçlık kararı',
   text:'Cebinde ₺'+Math.round(wallet).toLocaleString('tr-TR')+' harçlığın var.',choices});
 }
 return rng.pick(pool);
}
