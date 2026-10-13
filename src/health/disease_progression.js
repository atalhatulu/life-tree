import {annualYearStatus} from '../core/annual_clock.js';
import {geneticDiseaseModifiers} from './genetic_system.js';
import {captureRngCheckpoint,restoreRngOrThrow,snapshotObjectGraph} from '../core/transaction_snapshot.js';
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
 const p=condition.progression;
 p.score??=clamp((condition.severity??1)*20+(condition.geneticCourse?.initialProgressionBonus??0));
 p.stage??=stageFromScore(p.score);
 p.status??='active';
 p.stableYears??=0;
 p.complicationCount??=0;
 p.lastProgressionAge??=condition.diagnosedAtAge??null;
 return condition.progression;
}

function assertDiseaseYearInput(state,conditions,statuses){
 if(!Array.isArray(conditions))throw new TypeError('Invalid disease conditions');
 const validReserve=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
 if(!validReserve(state.player.health?.current))throw new RangeError('Invalid disease health reserve');
 for(const field of ['fitness','stress'])
  if(state.healthProfile?.[field]!=null&&!validReserve(state.healthProfile[field]))
   throw new RangeError('Invalid disease '+field);
 for(let i=0;i<conditions.length;i++){
  if(statuses[i].replayed)continue;
  const c=conditions[i];
  if(!c||typeof c!=='object'||Array.isArray(c)||
     !Number.isFinite(c.severity)||c.severity<=0||c.severity>5)
   throw new RangeError('Invalid disease condition severity');
  if(c.progression!=null){
   const p=c.progression;
   if(typeof p!=='object'||Array.isArray(p))throw new TypeError('Invalid disease progression');
   if(p.score!=null&&!validReserve(p.score))throw new RangeError('Invalid disease progression score');
   if(p.stage!=null&&!['mild','moderate','severe','critical'].includes(p.stage))
    throw new RangeError('Invalid disease progression stage');
   if(p.status!=null&&!['active','stable','remission'].includes(p.status))
    throw new RangeError('Invalid disease progression status');
   for(const field of ['stableYears','complicationCount'])
    if(p[field]!=null&&(!Number.isSafeInteger(p[field])||p[field]<0||p[field]===Number.MAX_SAFE_INTEGER))
     throw new RangeError('Invalid disease progression '+field+' counter');
  }
  if(c.geneticCourse!=null){
   if(typeof c.geneticCourse!=='object'||Array.isArray(c.geneticCourse))
    throw new TypeError('Invalid disease genetic course');
   for(const field of ['complicationMultiplier','initialProgressionBonus'])
    if(c.geneticCourse[field]!=null&&(!Number.isFinite(c.geneticCourse[field])||c.geneticCourse[field]<0))
     throw new RangeError('Invalid disease genetic '+field);
  }
 }
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
 return (
  severity*1.7+
  Math.max(0,50-health)*.08+
  Math.max(0,45-fitness)*.05+
  Math.max(0,stress-50)*.035
 );
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
 // Preflight every persisted marker before changing even the first condition.
 const {calendarYear}=annualYearStatus(state.year,null,'disease progression');
 if(!Array.isArray(conditions))throw new TypeError('Invalid disease conditions');
 for(const condition of conditions)
  if(!condition||typeof condition!=='object'||Array.isArray(condition))
   throw new TypeError('Invalid disease condition record');
 const statuses=conditions.map(condition=>annualYearStatus(state.year,condition.lastProgressionProcessedYear,'disease progression'));
 if(statuses.every(status=>status.replayed)||conditions.length===0)return entries;
 assertDiseaseYearInput(state,conditions,statuses);
 const restoreGraph=snapshotObjectGraph([state.healthProfile,state.player.health]);
 const restoreRng=captureRngCheckpoint(rng);
 try {
 for(const [index,condition] of conditions.entries()){
  if(statuses[index].replayed)continue;
  condition.geneticCourse??=geneticDiseaseModifiers(state,condition.id);
  // Old saves may have only a subset of the course modifiers. Preserve the
  // existing object while filling fields used by complication probability.
  if(condition.geneticCourse.complicationMultiplier==null)
   condition.geneticCourse.complicationMultiplier=geneticDiseaseModifiers(state,condition.id).complicationMultiplier;
  const p=ensureConditionProgression(condition);
  const beforeStage=p.stage;
  const pressure=biologicalPressure(state,condition)+treatmentModifier(condition)+rng.int(-4,4);

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
  if(rng.chance(complicationChance*treatedFactor*genetics.complicationMultiplier)){
   p.complicationCount+=1;
   p.score=clamp(p.score+8);
   p.stage=stageFromScore(p.score);
   state.player.health.current=clamp(state.player.health.current-(p.stage==='critical'?8:4));
   state.healthProfile.fitness=clamp((state.healthProfile.fitness??50)-(p.stage==='critical'?5:2));
   state.healthProfile.stress=clamp((state.healthProfile.stress??40)+5);
   entries.push({
    age:state.player.age,
    kind:'health',
    paceBlock:true,
    text:condition.label+' nedeniyle bir komplikasyon gelişti.'
   });
  }
  if(calendarYear!==null)condition.lastProgressionProcessedYear=calendarYear;
 }
 return entries;
 }catch(error){
  restoreGraph();
  restoreRngOrThrow(restoreRng,error);
 }
}
