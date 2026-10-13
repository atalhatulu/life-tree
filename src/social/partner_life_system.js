import {annualYearStatus} from '../core/annual_clock.js';
import {captureRngCheckpoint,restoreRngOrThrow,snapshotObjectGraph} from '../core/transaction_snapshot.js';
import {JOBS} from '../data/catalog.js';
import {simulateNpcRoutineWeek,assertNpcRoutineInputs} from './npc_daily_routine.js';
import {ensureNpcGoal,updateNpcGoal,applyPartnerGoalAlignment} from '../life/npc_goal_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validScore=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
const validCounter=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
const goalIds=new Set(['career','security','family','freedom','wellbeing']);

// Every dependent ledger is checked before the first annual write or RNG draw.
function assertPartnerLifeInputs(state,partner,year){
 if(!Number.isSafeInteger(state.player?.age)||state.player.age<19)
  throw new RangeError('Invalid player age for partner life');
 assertNpcRoutineInputs(partner);
 if(partner.life!=null&&!isRecord(partner.life))throw new TypeError('Invalid partner life');
 for(const field of ['careerSatisfaction','workStress','ambition','lifeSatisfaction']){
  const value=partner.life?.[field];
  if(value!=null&&!validScore(value))throw new RangeError('Invalid partner '+field);
 }
 for(const field of ['careerYears','careerChanges']){
  const value=partner.life?.[field];
  if(value!=null&&!validCounter(value))throw new RangeError('Invalid partner '+field);
 }
 if(partner.monthlyIncome!=null&&
    (typeof partner.monthlyIncome!=='number'||!Number.isFinite(partner.monthlyIncome)||
     partner.monthlyIncome<0||partner.monthlyIncome>1000000000))
  throw new RangeError('Invalid partner monthlyIncome');
 // Savings can grow by at most 6% of monthly income in this pass. Ensure
 // even the largest gain cannot cross the safe integer boundary.
 if(partner.life?.personalSavings!=null&&
    (!Number.isSafeInteger(partner.life.personalSavings)||partner.life.personalSavings<0||
     partner.life.personalSavings>Number.MAX_SAFE_INTEGER-
       Math.ceil((partner.monthlyIncome??0)*.06)-1))
  throw new RangeError('Invalid or overflowing partner personalSavings');
 for(const field of ['relationship','trust','intimacy','resentment','sharedGoals']){
  if(partner[field]!=null&&!validScore(partner[field]))
   throw new RangeError('Invalid partner '+field);
 }
 for(const field of ['ambition','sociability','patience']){
  if(partner.personality?.[field]!=null&&!validScore(partner.personality[field]))
   throw new RangeError('Invalid partner personality '+field);
 }
 const goals=partner.lifeGoals;
 if(goals!=null){
  if(!isRecord(goals)||
     (goals.history!=null&&(!Array.isArray(goals.history)||goals.history.some(x=>!isRecord(x))))||
     (goals.active!=null&&(!isRecord(goals.active)||!goalIds.has(goals.active.id)||
       (goals.active.progress!=null&&!validScore(goals.active.progress)))))
   throw new TypeError('Invalid partner NPC goals');
 }
 // Goal alignment can reject a future-year marker after the routine and
 // savings have already changed unless we check it here.
 annualYearStatus(year,partner.lastGoalAlignmentProcessedYear,'partner goal alignment');
}


function ensurePartnerLife(partner){
 partner.life??={
  careerSatisfaction:55,
  workStress:25,
  ambition:partner.personality?.ambition??50,
  careerYears:0,
  careerChanges:0,
  personalSavings:0,
  lifeSatisfaction:60
 };
 // Partially populated old saves need the same defaults as missing ledgers.
 const defaults={careerSatisfaction:55,workStress:25,ambition:partner.personality?.ambition??50,
  careerYears:0,careerChanges:0,personalSavings:0,lifeSatisfaction:60};
 for(const [key,value] of Object.entries(defaults))partner.life[key]??=value;
 return partner.life;
}

function rerollJob(partner,rng){
 const eligible=JOBS.filter(j=>j.id!=='unemployed'&&j.educationMin<=3&&j.id!==partner.jobId);
 if(!eligible.length)return false;
 const job=rng.weighted(eligible.map(value=>({value,weight:value.weight})));
 partner.job=job.title;
 partner.jobId=job.id;
 partner.monthlyIncome=rng.int(job.income[0],Math.max(job.income[0],Math.round(job.income[1]*.72)));
 return true;
}

export function processPartnerLifeYear(state,rng){
 const entries=[];
 const partner=state.social?.romance;
 if(!partner||partner.alive===false||state.player.age<19)return entries;
 // Validate before initializing partner life or NPC goals; a rejected year is atomic.
 const year=state.year==null?2000+(state.player?.age??0):state.year;
 const {calendarYear,replayed}=annualYearStatus(year,partner.life?.lastProcessedYear,'partner life');
 if(replayed)return entries;
 assertPartnerLifeInputs(state,partner,year);
 // Preserve the entire partner graph, including public nested ledger references.
 const restorePartner=snapshotObjectGraph([partner]);
 const restoreRng=captureRngCheckpoint(rng);
 try {
 const life=ensurePartnerLife(partner);
 const npcGoal=ensureNpcGoal(partner);
 life.careerYears+=1;

 const ambition=life.ambition??50;
 const income=partner.monthlyIncome??0;
 life.workStress=clamp(life.workStress+rng.int(-3,4)+(ambition>70?1:0)+(income<30000?1:0));
 life.careerSatisfaction=clamp(life.careerSatisfaction+rng.int(-4,4)+Math.round((ambition-50)*.02)-Math.round((life.workStress-45)*.025));
 life.personalSavings=Math.max(0,Math.round((life.personalSavings??0)+Math.max(0,income*.06-rng.int(0,Math.max(1,Math.round(income*.025))))));
 life.lifeSatisfaction=clamp(
  35+
  (partner.relationship??60)*.28+
  life.careerSatisfaction*.22-
  life.workStress*.15+
  Math.min(12,(life.personalSavings??0)/100000)
 );
 const routine=simulateNpcRoutineWeek(partner,{year:state.year,kind:'partner'});
 partner.socialAvailability=routine.availability;
 updateNpcGoal(partner,{
  careerSatisfaction:life.careerSatisfaction,
  financialStability:Math.min(100,(life.personalSavings??0)/5000),
  relationshipQuality:partner.relationship??60,
  wellbeing:life.lifeSatisfaction
 });
 const alignment=applyPartnerGoalAlignment(state);
 if(alignment?.alignment<0&&rng.fork('goal-conflict').chance(.18)){
  entries.push({age:state.player.age,kind:'partner-life',text:partner.name+' ile hayattan beklediklerinizin farklılaştığını daha belirgin hissetmeye başladınız.'});
 }else if(alignment?.alignment>0&&rng.fork('goal-alignment').chance(.16)){
  entries.push({age:state.player.age,kind:'partner-life',text:partner.name+' ile benzer uzun vadeli hedeflere yönelmeniz ilişkinizi güçlendirdi.'});
 }

 if(life.careerSatisfaction<=30&&life.careerYears>=2&&rng.fork('partner-job-change').chance(.20)){
  const old=partner.job;
  if(rerollJob(partner,rng.fork('partner-new-job'))){
    life.careerChanges+=1;
    life.careerYears=0;
    life.careerSatisfaction=50;
    life.workStress=clamp(life.workStress-8);
    entries.push({age:state.player.age,kind:'partner-life',text:partner.name+' '+old+' işinden ayrılıp '+partner.job+' olarak yeni bir kariyer adımı attı.'});
  }
 }

 if(life.workStress>=72){
  partner.resentment=clamp((partner.resentment??20)+3);
  partner.intimacy=clamp((partner.intimacy??60)-2);
  entries.push({age:state.player.age,kind:'partner-life',text:partner.name+' iş baskısını eve taşımaya başladı.'});
 }
 if(life.lifeSatisfaction>=78&&rng.fork('partner-positive').chance(.16)){
  partner.trust=clamp((partner.trust??60)+2);
  partner.intimacy=clamp((partner.intimacy??60)+2);
  entries.push({age:state.player.age,kind:'partner-life',text:partner.name+' kendi hayatından daha memnun olduğu bir döneme girdi; ilişkinize de olumlu yansıdı.'});
 }
 life.lastProcessedYear=calendarYear;
 return entries;
 } catch(error){
  restorePartner();
  restoreRngOrThrow(restoreRng,error);
 }
}
