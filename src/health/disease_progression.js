import {geneticDiseaseModifiers} from './genetic_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function stageFromScore(score){
 if(score<25)return 'mild';
 if(score<50)return 'moderate';
 if(score<75)return 'severe';
 return 'critical';
}

export function ensureConditionProgression(condition){
 condition.progression??={
  score:clamp((condition.severity??1)*20+(condition.geneticCourse?.initialProgressionBonus??0)),
  stage:stageFromScore(clamp((condition.severity??1)*20+(condition.geneticCourse?.initialProgressionBonus??0))),
  status:'active',
  stableYears:0,
  complicationCount:0,
  lastProgressionAge:condition.diagnosedAtAge??null
 };
 return condition.progression;
}

function treatmentModifier(condition){
 if(condition.treatmentSuccessful===true)return -4.5;
 if(condition.treated===true)return -2;
 return 0;
}

function biologicalPressure(state,condition){
 const health=state.player.health.current??50;
 const fitness=state.healthProfile?.fitness??50;
 const stress=state.healthProfile?.stress??40;
 const severity=condition.severity??1;
 const geneticCourse=condition.geneticCourse??geneticDiseaseModifiers(state,condition.id);
 const baseline=(
  severity*1.15+
  Math.max(0,50-health)*.055+
  (50-fitness)*.045+
  Math.max(0,stress-45)*.025
 );
 return baseline*geneticCourse.progressionMultiplier;
}

export function progressionBurden(condition){
 const p=ensureConditionProgression(condition);
 const stageWeight={mild:.55,moderate:1,severe:1.6,critical:2.4}[p.stage]??1;
 const statusWeight=p.status==='remission'?.25:p.status==='stable'?.55:1;
 return (condition.severity??1)*stageWeight*statusWeight;
}

export function processDiseaseProgressionYear(state,rng){
 const entries=[];
 const conditions=state.healthProfile?.conditions??[];
 for(const condition of conditions){
  condition.geneticCourse??=geneticDiseaseModifiers(state,condition.id);
  const p=ensureConditionProgression(condition);
  const beforeStage=p.stage;
  const pressure=biologicalPressure(state,condition)+treatmentModifier(condition)+rng.int(-2,2);

  p.score=clamp(p.score+pressure);
  p.stage=stageFromScore(p.score);
  p.lastProgressionAge=state.player.age;

  if(condition.treatmentSuccessful===true&&p.score<=18&&p.stableYears>=1){
   p.status='remission';
   p.stableYears+=1;
  }else if(pressure<=0){
   p.status='stable';
   p.stableYears+=1;
  }else{
   p.status='active';
   p.stableYears=0;
  }

  if(p.stage!==beforeStage){
   entries.push({
    age:state.player.age,
    kind:'health',
    paceBlock:p.stage==='severe'||p.stage==='critical',
    text:condition.label+' durumu '+p.stage+' evreye geçti.'
   });
  }

  const complicationChance=p.stage==='critical'
   ?.12
   :p.stage==='severe'
    ?.045
    :p.stage==='moderate'
     ?.012
     :.003;

  const genetics=condition.geneticCourse??geneticDiseaseModifiers(state,condition.id);
  const treatedFactor=condition.treatmentSuccessful===true?.35:condition.treated===true?.70:1;
  // Stronger fitness materially improves resilience but never makes a serious
  // disease complication impossible.
  const fitness=state.healthProfile?.fitness??50;
  const fitnessComplicationFactor=clamp(1+(50-fitness)*.012,.58,1.42);
  if(rng.chance(complicationChance*treatedFactor*genetics.complicationMultiplier*fitnessComplicationFactor)){
   p.complicationCount+=1;
   p.score=clamp(p.score+8);
   p.stage=stageFromScore(p.score);
   state.player.health.current=clamp(state.player.health.current-(p.stage==='critical'?7:3.5));
   state.healthProfile.fitness=clamp((state.healthProfile.fitness??50)-(p.stage==='critical'?4:1.5));
   state.healthProfile.stress=clamp((state.healthProfile.stress??40)+5);
   entries.push({
    age:state.player.age,
    kind:'health',
    paceBlock:true,
    text:condition.label+' nedeniyle bir komplikasyon gelişti.'
   });
  }
 }
 return entries;
}
