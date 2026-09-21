import {geneticRiskMultiplier} from './genetic_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const CONDITIONS=[
 {id:'hypertension',label:'Yüksek tansiyon',minAge:32,base:.012,severity:2},
 {id:'back-pain',label:'Kronik bel ağrısı',minAge:28,base:.018,severity:1},
 {id:'metabolic',label:'Metabolik sorun',minAge:35,base:.010,severity:2},
 {id:'anxiety',label:'Anksiyete',minAge:18,base:.012,severity:1},
 {id:'cardiac',label:'Kalp-damar hastalığı',minAge:48,base:.007,severity:3},
 {id:'cancer',label:'Kanser',minAge:52,base:.004,severity:3}
];

function ageMortalityBase(age){
 if(age<45)return 0;
 if(age<60)return .001+(age-45)*.00045;
 if(age<70)return .008+(age-60)*.0011;
 if(age<80)return .020+(age-70)*.0026;
 if(age<90)return .050+(age-80)*.0060;
 if(age<100)return .120+(age-90)*.015;
 return Math.min(.82,.30+(age-100)*.035);
}

function conditionBurden(condition){
 const treatmentFactor=condition.treatmentSuccessful===true?.25:condition.treated===true?.70:1;
 return condition.severity*treatmentFactor;
}

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

 const activeBurden=h.conditions.reduce((sum,condition)=>sum+conditionBurden(condition),0);
 let delta=(state.player.health.constitution-60)*.02+(h.fitness-50)*.025-(h.stress-40)*.02;
 if(lifestyle?.food==='healthy')delta+=1.5;
 if(lifestyle?.food==='frugal')delta-=1;
 delta-=activeBurden*.70;

 // Chronic disease must constrain recovery. Without this ceiling a player with
 // multiple serious diagnoses can repeatedly heal back to 100 while still
 // carrying lethal conditions.
 const healthCeiling=clamp(100-activeBurden*6,20,100);
 state.player.health.current=Math.min(
  healthCeiling,
  clamp(state.player.health.current+delta+rng.int(-2,2)-(age>=45?1:0))
 );

 for(const condition of CONDITIONS){
  if(age<condition.minAge||h.conditions.some(c=>c.id===condition.id)) continue;
  const geneticMultiplier=geneticRiskMultiplier(state,condition.id);
  const chance=condition.base*geneticMultiplier+(100-state.player.health.current)*.00025+h.stress*.00012;
  if(rng.chance(chance)){
   h.conditions.push({id:condition.id,label:condition.label,severity:condition.severity,diagnosedAtAge:age});
   state.player.health.current=clamp(state.player.health.current-condition.severity*4);
   entries.push({age,kind:'health',paceBlock:true,text:condition.label+' yaşamını etkilemeye başladı.'});
  }
 }

 // Mild conditions (severity 1) do not independently create a yearly death
 // lottery in otherwise healthy young adults. Serious untreated disease still
 // contributes risk, and successful treatment substantially reduces it.
 const mortalityBurden=h.conditions.reduce((sum,condition)=>{
  const serious=Math.max(0,condition.severity-1);
  if(serious===0)return sum;
  const treatmentFactor=condition.treatmentSuccessful===true?.30:condition.treated===true?.70:1;
  return sum+serious*treatmentFactor;
 },0);
 const mortality=age>=120?1:Math.min(.95,Math.max(
  0,
  ageMortalityBase(age)+(100-state.player.health.current)*.00030+mortalityBurden*.0010
 ));
 if(rng.chance(mortality)){
  state.player.alive=false;
  state.death={age,year:state.year,cause:deathCause(state,rng.fork('cause'))};
  entries.push({age,kind:'death',text:'Hayatın '+age+' yaşında sona erdi.'});
 }
 return entries;
}
