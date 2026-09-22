import {progressionBurden} from './disease_progression.js';
import {geneticRiskMultiplier,geneticDiseaseModifiers} from './genetic_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const CONDITIONS=[
 {id:'hypertension',label:'Yüksek tansiyon',minAge:32,base:.0080,severity:2,threshold:27},
 {id:'back-pain',label:'Kronik bel ağrısı',minAge:28,base:.0095,severity:1,threshold:25},
 {id:'metabolic',label:'Metabolik sorun',minAge:35,base:.0065,severity:2,threshold:33},
 {id:'cardiac',label:'Kalp-damar hastalığı',minAge:48,base:.0028,severity:3,threshold:35},
 {id:'cancer',label:'Kanser',minAge:50,base:.0022,severity:3,threshold:48}
];

function ageMortalityBase(age){
 if(age<45)return 0;
 if(age<55)return .0008+(age-45)*.00018;
 if(age<65)return .0030+(age-55)*.00055;
 if(age<70)return .0090+(age-65)*.0015;
 if(age<75)return .0180+(age-70)*.0025;
 if(age<80)return .0320+(age-75)*.0040;
 if(age<85)return .0550+(age-80)*.0075;
 if(age<90)return .0950+(age-85)*.0110;
 if(age<95)return .1550+(age-90)*.0170;
 return Math.min(.55,.25+(age-95)*.035);
}

function annualAgingWear(age){
 if(age<18)return {health:0,fitness:0};
 if(age<30)return {health:.05,fitness:.10};
 if(age<45)return {health:.18,fitness:.28};
 if(age<60)return {health:.45,fitness:.55};
 if(age<70)return {health:1.15,fitness:1.30};
 if(age<80)return {health:2.15,fitness:2.35};
 if(age<90)return {health:3.45,fitness:3.70};
 if(age<100)return {health:5.0,fitness:5.3};
 return {health:8.0,fitness:8.2};
}

function conditionBurden(condition){
 return progressionBurden(condition);
}

function deathCause(state,rng){
 const severe=(state.healthProfile?.conditions??[])
  .filter(c=>c.severity>=2)
  .sort((a,b)=>b.severity-a.severity);
 if(severe.length&&rng.chance(.72))return severe[0].label;
 if(state.player.age>=82)return 'Yaşa bağlı doğal nedenler';
 return 'Genel sağlık komplikasyonları';
}

function normalDeathEligible(state){
 const health=state.player.health.current??100;
 const fitness=state.healthProfile?.fitness??100;
 const mobility=state.lateLife?.mobility??100;
 if(health<=0)return true;
 if(health<=8)return true;
 if(health<=15&&(fitness<=20||mobility<=20))return true;
 if(state.player.age>=90&&health<=20&&fitness<=15)return true;
 return false;
}

export function ensureHealthProfile(state){
 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 state.healthProfile.riskExposure??={};
 return state.healthProfile;
}

function exposureGain(state,condition,geneticMultiplier){
 const age=state.player.age;
 const h=state.healthProfile;
 const health=state.player.health.current??70;
 const fitness=h.fitness??50;
 let gain=condition.base*100;
 if(age>=condition.minAge+10)gain+=.28;
 if(age>=condition.minAge+20)gain+=.42;
 if(age>=condition.minAge+30)gain+=.58;
 if(fitness<45)gain+=.28;
 if(fitness<30)gain+=.22;
 if(health<60)gain+=.24;
 if(h.stress>60)gain+=.18;
 if(state.finance?.debt>1000000)gain+=.08;
 if(condition.id==='metabolic'&&fitness<40)gain+=.35;
 if(condition.id==='cardiac'&&h.conditions.some(c=>c.id==='hypertension'))gain+=.78;
 if(condition.id==='cardiac'&&h.conditions.some(c=>c.id==='metabolic'))gain+=.62;
 if(condition.id==='back-pain'&&state.career?.employed)gain+=.12;
 return gain*geneticMultiplier;
}

export function processHealthYear(state,rng,{healthBeforeYear=null}={}){
 const h=ensureHealthProfile(state);
 const entries=[];
 const age=state.player.age;
 const lifestyle=state.finance?.lifestyle;
 const baseWear=annualAgingWear(age);
 const constitution=state.player.health.constitution??60;
 const agingMultiplier=clamp(1+(60-constitution)*.0075,.70,1.25);
 const wear={
  health:baseWear.health*agingMultiplier,
  fitness:baseWear.fitness*agingMultiplier
 };

 h.stress=clamp(h.stress+rng.int(-3,3)+(state.finance?.debt>500000?3:0)+(state.career?.satisfaction<35?2:0));

 const previousFitness=h.fitness;
 const simulatedFitness=clamp(h.fitness+rng.int(-2,2)+(lifestyle?.food==='healthy'?2:0));
 h.fitness=wear.fitness>0?Math.min(simulatedFitness,clamp(previousFitness-wear.fitness)):simulatedFitness;

 const activeBurden=h.conditions.reduce((sum,condition)=>sum+conditionBurden(condition),0);
 let delta=(state.player.health.constitution-60)*.02+(h.fitness-50)*.025-(h.stress-40)*.02;
 if(lifestyle?.food==='healthy')delta+=1.5;
 if(lifestyle?.food==='frugal')delta-=1;
 delta-=activeBurden*.70;

 const previousHealth=healthBeforeYear??state.player.health.current;
 const healthCeiling=clamp(100-activeBurden*6,20,100);
 const simulatedHealth=Math.min(
  healthCeiling,
  clamp(state.player.health.current+delta+rng.int(-2,2))
 );
 state.player.health.current=wear.health>0
  ?Math.min(simulatedHealth,clamp(previousHealth-wear.health))
  :simulatedHealth;

 for(const condition of CONDITIONS){
  const geneticCourse=geneticDiseaseModifiers(state,condition.id);
  const effectiveMinAge=Math.max(0,condition.minAge+geneticCourse.onsetAgeOffset);
  if(age<effectiveMinAge||h.conditions.some(c=>c.id===condition.id)) continue;
  const geneticMultiplier=geneticRiskMultiplier(state,condition.id);
  const currentExposure=h.riskExposure[condition.id]??0;
  const nextExposure=clamp(currentExposure+exposureGain(state,condition,geneticMultiplier),0,100);
  h.riskExposure[condition.id]=nextExposure;
  if(nextExposure<condition.threshold)continue;

  const excess=Math.max(0,nextExposure-condition.threshold);
  const agePressure=Math.max(0,age-effectiveMinAge)*.00035;
  const chance=Math.min(.095,condition.base*.65*geneticMultiplier+excess*.00075+agePressure+(100-state.player.health.current)*.00008);
  if(rng.chance(chance)){
   h.conditions.push({
    id:condition.id,label:condition.label,severity:condition.severity,diagnosedAtAge:age,
    geneticCourse:{...geneticCourse},
    riskExposureAtDiagnosis:nextExposure
   });
   h.riskExposure[condition.id]=Math.max(0,nextExposure-18);
   state.player.health.current=clamp(state.player.health.current-condition.severity*3);
   entries.push({age,kind:'health',paceBlock:condition.severity>=2,text:condition.label+' yaşamını etkilemeye başladı.'});
  }
 }

 const mortalityBurden=h.conditions.reduce((sum,condition)=>{
  const serious=Math.max(0,condition.severity-1);
  if(serious===0)return sum;
  const treatmentFactor=condition.treatmentSuccessful===true?.30:condition.treated===true?.70:1;
  return sum+serious*treatmentFactor;
 },0);

 // Mortality is age-hazard driven after later adulthood. Low physical reserve and
 // chronic disease amplify the hazard, but healthy older adults are no longer
 // effectively immortal until the health bar reaches zero.
 const health=state.player.health.current??100;
 const fitness=h.fitness??50;
 const sexFactor=state.player.sex==='male'?1.14:.88;
 const reserveFactor=1+
  Math.max(0,55-health)*.012+
  Math.max(0,40-fitness)*.006;
 const diseaseFactor=1+mortalityBurden*.11;
 const criticalReserve=normalDeathEligible(state);
 const mortality=health<=0
  ?1
  :Math.min(.98,ageMortalityBase(age)*sexFactor*reserveFactor*diseaseFactor+(criticalReserve?.025:0));
 if(mortality>0&&rng.chance(mortality)){
  state.player.alive=false;
  state.death={age,year:state.year,cause:deathCause(state,rng.fork('cause'))};
  entries.push({age,kind:'death',text:'Hayatın '+age+' yaşında sona erdi.'});
 }
 return entries;
}
