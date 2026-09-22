const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureMiddleAgeState(state){
 if(state.player.age<35||state.player.age>60)return null;
 state.middleAge??={
  burnoutPressure:0,
  stagnationYears:0,
  carePressure:0,
  financialPressure:0,
  lastReflectionAge:null,
  transitions:[]
 };
 return state.middleAge;
}

export function processMiddleAgeYear(state,rng){
 const m=ensureMiddleAgeState(state);
 if(!m)return [];
 const entries=[];
 const age=state.player.age;
 const career=state.career;
 const stress=state.healthProfile?.stress??20;
 const debt=state.finance?.debt??0;
 const children=(state.children??[]).filter(c=>c.age<22).length;
 const parentCare=state.parentCare?.active;

 if(career?.employed){
  if((career.satisfaction??50)<42)m.stagnationYears+=1;
  else m.stagnationYears=Math.max(0,m.stagnationYears-1);
 }else m.stagnationYears=0;

 m.burnoutPressure=clamp(
  m.burnoutPressure+
  (stress>65?5:stress>50?2:-2)+
  ((state.activityMemory?.['work-hard']?.streak??0)>=4?3:0)+
  ((career?.satisfaction??50)<35?2:0)
 );
 m.financialPressure=clamp(
  (debt>2000000?45:debt>750000?25:8)+
  (children*5)+
  ((state.finance?.monthlyExpenses??0)>(state.finance?.monthlyIncome??0)?15:0)
 );
 m.carePressure=clamp((parentCare?35:0)+children*6);

 if(m.burnoutPressure>=70&&rng.chance(.18)){
  if(state.healthProfile)state.healthProfile.stress=clamp(state.healthProfile.stress+6);
  if(career?.employed)career.satisfaction=clamp((career.satisfaction??50)-5);
  entries.push({age,kind:'career',text:'Uzun süredir biriken iş yükü tükenmişlik hissini artırdı.'});
  m.transitions.push({age,type:'burnout'});
  m.burnoutPressure=55;
 }
 if(m.stagnationYears>=4&&rng.chance(.22)){
  entries.push({age,kind:'career',text:'Kariyerinde uzun süredir ilerlemediğini fark etmeye başladın.'});
  m.transitions.push({age,type:'career-stagnation'});
  m.lastReflectionAge=age;
  m.stagnationYears=2;
 }
 if(m.financialPressure>=55&&rng.chance(.12)){
  entries.push({age,kind:'finance',text:'Hane giderleri ve uzun vadeli sorumluluklar bütçeni daha dikkatli yönetmeni gerektiriyor.'});
  m.transitions.push({age,type:'financial-pressure'});
 }
 if((age===40||age===50||age===60)&&m.lastReflectionAge!==age){
  entries.push({age,kind:'life',text:'Hayatının bu döneminde kariyer, sağlık ve aile dengeni yeniden değerlendirdin.'});
  m.lastReflectionAge=age;
 }
 return entries;
}
