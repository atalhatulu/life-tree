const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const CONDITIONS=[
 {id:'hypertension',label:'Yüksek tansiyon',minAge:32,base:.012,severity:2},
 {id:'back-pain',label:'Kronik bel ağrısı',minAge:28,base:.018,severity:1},
 {id:'metabolic',label:'Metabolik sorun',minAge:35,base:.010,severity:2},
 {id:'anxiety',label:'Anksiyete',minAge:18,base:.012,severity:1},
 {id:'cardiac',label:'Kalp-damar hastalığı',minAge:48,base:.007,severity:3},
 {id:'cancer',label:'Kanser',minAge:52,base:.004,severity:3}
];

function deathCause(state,rng){
 const severe=(state.healthProfile?.conditions??[])
  .filter(c=>c.severity>=2)
  .sort((a,b)=>b.severity-a.severity);
 if(severe.length&&rng.chance(.72))return severe[0].label;
 if(state.player.age>=82)return 'Yaşa bağlı doğal nedenler';
 return 'Genel sağlık komplikasyonları';
}

export function ensureHealthProfile(state){
 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 return state.healthProfile;
}

export function processHealthYear(state,rng){
 const h=ensureHealthProfile(state);
 const entries=[];
 const age=state.player.age;
 const lifestyle=state.finance?.lifestyle;

 h.stress=clamp(h.stress+rng.int(-3,3)+(state.finance?.debt>500000?3:0)+(state.career?.satisfaction<35?2:0));
 h.fitness=clamp(h.fitness+rng.int(-2,2)+(lifestyle?.food==='healthy'?2:0)-(age>=40?1:0));

 let delta=(state.player.health.constitution-60)*.02+(h.fitness-50)*.025-(h.stress-40)*.02;
 if(lifestyle?.food==='healthy')delta+=1.5;
 if(lifestyle?.food==='frugal')delta-=1;
 state.player.health.current=clamp(state.player.health.current+delta+rng.int(-2,2)-(age>=45?1:0));

 for(const condition of CONDITIONS){
  if(age<condition.minAge||h.conditions.some(c=>c.id===condition.id)) continue;
  const chance=condition.base+(100-state.player.health.current)*.00025+h.stress*.00012;
  if(rng.chance(chance)){
   h.conditions.push({id:condition.id,label:condition.label,severity:condition.severity,diagnosedAtAge:age});
   state.player.health.current=clamp(state.player.health.current-condition.severity*4);
   entries.push({age,kind:'health',text:condition.label+' yaşamını etkilemeye başladı.'});
  }
 }

 const severe=h.conditions.reduce((s,c)=>s+c.severity*(c.treatmentSuccessful?.45:1),0);
 const mortality=age<45?0:Math.max(0,(age-44)*.0008+(100-state.player.health.current)*.00025+severe*.0008);
 if(rng.chance(mortality)){
  state.player.alive=false;
  state.death={age,year:state.year,cause:deathCause(state,rng.fork('cause'))};
  entries.push({age,kind:'death',text:'Hayatın '+age+' yaşında sona erdi.'});
 }
 return entries;
}
