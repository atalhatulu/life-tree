import {progressionBurden} from './disease_progression.js';
import {geneticRiskMultiplier,geneticDiseaseModifiers} from './genetic_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const CONDITIONS=[
 {id:'hypertension',label:'Yüksek tansiyon',minAge:32,base:.0080,severity:2},
 {id:'back-pain',label:'Kronik bel ağrısı',minAge:28,base:.0080,severity:1},
 {id:'metabolic',label:'Metabolik sorun',minAge:35,base:.0060,severity:2},
 {id:'anxiety',label:'Anksiyete',minAge:18,base:.0045,severity:1},
 {id:'cardiac',label:'Kalp-damar hastalığı',minAge:48,base:.0045,severity:3},
 {id:'cancer',label:'Kanser',minAge:52,base:.0030,severity:3}
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

function annualAgingWear(age){
 if(age<18)return {health:0,fitness:0};
 if(age<30)return {health:.02,fitness:.10};
 if(age<45)return {health:.07,fitness:.25};
 if(age<60)return {health:.35,fitness:.65};
 if(age<70)return {health:1.55,fitness:2.1};
 if(age<80)return {health:3.55,fitness:3.6};
 if(age<90)return {health:5.05,fitness:5.3};
 if(age<100)return {health:6.25,fitness:6.7};
 return {health:7.4,fitness:8.2};
}

function conditionBurden(condition){
 return progressionBurden(condition);
}

function conditionCeilingPenalty(condition){
 const p=condition.progression;
 const stage=p?.stage??((condition.severity??1)>=3?'severe':(condition.severity??1)>=2?'moderate':'mild');
 const stagePenalty={mild:2,moderate:7,severe:14,critical:24}[stage]??7;
 const statusFactor=p?.status==='remission'?.25:p?.status==='stable'?.60:1;
 const severityBonus=Math.max(0,(condition.severity??1)-1)*1.5;
 return (stagePenalty+severityBonus)*statusFactor;
}

function chronicHealthCeiling(conditions){
 const totalPenalty=conditions.reduce((sum,c)=>sum+conditionCeilingPenalty(c),0);
 return clamp(100-totalPenalty,30,100);
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
 if(health<=15&&(fitness<=25||mobility<=25))return true;
 if(state.player.age>=75&&health<=20&&(fitness<=30||mobility<=30))return true;
 if(state.player.age>=85&&health<=25&&(fitness<=25||mobility<=25))return true;
 if(state.player.age>=90&&health<=30&&fitness<=20)return true;
 return false;
}

export function ensureHealthProfile(state){
 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 return state.healthProfile;
}

export function processHealthYear(state,rng,{healthBeforeYear=null}={}){
 const h=ensureHealthProfile(state);
 const entries=[];
 const age=state.player.age;
 const lifestyle=state.finance?.lifestyle;
 const baseWear=annualAgingWear(age);
 const constitution=state.player.health.constitution??60;
 const agingMultiplier=clamp(1+(60-constitution)*.0075,.70,1.25);
 const exercisedRecently=(h.lastExerciseAge??-999)>=age-1;

 // Exercise never heals Health directly. Fitness is a reserve: it slows normal
 // age-related wear and reduces the damage chronic disease can do over time.
 const fitnessWearMultiplier=clamp(1-(h.fitness-50)*.008,.72,1.28);
 const nutritionWearMultiplier=lifestyle?.food==='healthy'?.92:lifestyle?.food==='frugal'?1.06:1;
 const recentActivityWearMultiplier=exercisedRecently?.94:1;
 const bodyRecovery=state.body?.recovery??70;
 const bodyWearMultiplier=clamp(1+(60-bodyRecovery)*.004,.86,1.18);
 const healthWearMultiplier=clamp(
  agingMultiplier*fitnessWearMultiplier*nutritionWearMultiplier*recentActivityWearMultiplier*bodyWearMultiplier,
  .55,
  1.45
 );
 const wear={
  health:baseWear.health*healthWearMultiplier,
  fitness:baseWear.fitness*agingMultiplier
 };

 h.stress=clamp(h.stress+rng.int(-3,3)+(state.finance?.debt>500000?3:0)+(state.career?.satisfaction<35?2:0));

 const previousFitness=h.fitness;
 let inactivityPenalty=0;
 if(!exercisedRecently)inactivityPenalty=age>=45?0.75:age>=18?0.35:0;
 h.fitness=clamp(previousFitness-wear.fitness-inactivityPenalty);

 const activeBurden=h.conditions.reduce((sum,condition)=>sum+conditionBurden(condition),0);
 // Disease consumes reserve, but diagnosis alone should not create a runaway
 // health spiral. Fitness changes resilience rather than restoring Health.
 const diseaseLossMultiplier=clamp(1-(h.fitness-50)*.006,.75,1.20);
 const mentalWellbeing=state.mentalHealth?.wellbeing??70;
 let additionalLoss=Math.max(0,h.stress-45)*.014+activeBurden*.38*diseaseLossMultiplier+
  Math.max(0,35-mentalWellbeing)*.008;
 if(lifestyle?.food==='frugal')additionalLoss+=.20;

 const previousHealth=healthBeforeYear??state.player.health.current;
 const healthCeiling=chronicHealthCeiling(h.conditions);
 const uncertainty=rng.int(-1,1)*.15;
 const yearlyLoss=Math.max(.01,wear.health+additionalLoss+uncertainty);
 state.player.health.current=Math.min(
  healthCeiling,
  clamp(previousHealth-yearlyLoss)
 );

 for(const condition of CONDITIONS){
  const geneticCourse=geneticDiseaseModifiers(state,condition.id);
  const effectiveMinAge=Math.max(0,condition.minAge+geneticCourse.onsetAgeOffset);
  if(age<effectiveMinAge||h.conditions.some(c=>c.id===condition.id)) continue;
  const geneticMultiplier=geneticRiskMultiplier(state,condition.id);
  const fitnessRiskMultiplier=clamp(1+(50-h.fitness)*.012,.60,1.45);
  const yearsExposed=Math.max(0,age-effectiveMinAge);
  const ageRiskMultiplier=clamp(.85+yearsExposed*.012,.85,1.60);
  const lowHealthRisk=Math.max(0,65-state.player.health.current)*.00007;
  const excessStressRisk=Math.max(0,h.stress-45)*.00007;
  const chance=condition.base*ageRiskMultiplier*geneticMultiplier*fitnessRiskMultiplier+
   lowHealthRisk+excessStressRisk;
  if(rng.chance(chance)){
   h.conditions.push({
    id:condition.id,label:condition.label,severity:condition.severity,diagnosedAtAge:age,
    geneticCourse:{...geneticCourse}
   });
   state.player.health.current=clamp(state.player.health.current-condition.severity*3);
   entries.push({age,kind:'health',paceBlock:true,text:condition.label+' yaşamını etkilemeye başladı.'});
  }
 }

 const mortalityBurden=h.conditions.reduce((sum,condition)=>{
  const serious=Math.max(0,condition.severity-1);
  if(serious===0)return sum;
  const treatmentFactor=condition.treatmentSuccessful===true?.30:condition.treated===true?.70:1;
  return sum+serious*treatmentFactor;
 },0);

 // Ordinary aging/chronic-disease death is reserve-gated. Age and diagnoses
 // increase risk only after the main physical bars are already critically low.
 // Truly sudden events belong to their own event systems and may bypass this gate.
 if(normalDeathEligible(state)){
  const mortality=state.player.health.current<=0
   ?1
   :Math.min(.98,Math.max(
    0,
    ageMortalityBase(age)+(100-state.player.health.current)*.0015+mortalityBurden*.004
   ));
  if(rng.chance(mortality)){
   state.player.alive=false;
   state.death={age,year:state.year,cause:deathCause(state,rng.fork('cause'))};
   entries.push({age,kind:'death',text:'Hayatın '+age+' yaşında sona erdi.'});
  }
 }
 return entries;
}
