import {annualYearStatus} from '../core/annual_clock.js';
import {captureRngCheckpoint,restoreRngOrThrow,snapshotObjectGraph} from '../core/transaction_snapshot.js';
import {JOBS} from '../data/countries/turkey/jobs.js';
import {ensureNpcGoal,updateNpcGoal} from '../life/npc_goal_system.js';
import {simulateNpcRoutineWeek} from './npc_daily_routine.js';
import {settleNpcActivityYear} from './npc_activity_ledger.js';
import {generateNpcYearActivities} from './npc_activity_auto.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureFriendLife(friend){
 friend.life??={
  workStability:55,
  relationshipStatus:'single',
  personalStress:25,
  lifeSatisfaction:55,
  movedAway:false,
  majorEvents:0
 };
 // Older saves can contain a partially populated life ledger. Fill only
 // missing values so annual arithmetic never starts from undefined/NaN.
 const defaults={workStability:55,relationshipStatus:'single',personalStress:25,
  lifeSatisfaction:55,movedAway:false,majorEvents:0};
 for(const [key,value] of Object.entries(defaults))friend.life[key]??=value;
 return friend.life;
}

export function eligibleNpcJobs(friend){
 const outcome=friend.life?.schoolOutcome;
 const education=outcome==='advanced'?4:outcome==='progressing'?3:1;
 return JOBS.filter(job=>job.id!=='unemployed'&&job.educationMin<=education);
}

export function npcMonthlyIncome(friend){
 if(friend.jobId==='unemployed'||friend.jobId==null)return 0;
 const job=JOBS.find(item=>item.id===friend.jobId);
 return job?Math.round((job.income[0]+job.income[1])/2):Math.max(0,friend.monthlyIncome??0);
}

const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validScore=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
const validCounter=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
const goalIds=new Set(['career','security','family','freedom','wellbeing']);

// Validate every unprocessed living NPC before changing the first friend.
// Missing legacy fields are allowed, but present values must not produce NaN,
// overflow counters, or corrupt NPC goal progress.
function assertFriendYearInputs(friend){
 if(!isRecord(friend)||typeof friend.id!=='string'||!friend.id)
  throw new TypeError('Invalid NPC friend record or ID');
 if(!validCounter(friend.age))throw new RangeError('Invalid or overflowing NPC age');
 if(friend.relationship!=null&&!validScore(friend.relationship))
  throw new RangeError('Invalid NPC relationship');
 if(friend.personality!=null&&!isRecord(friend.personality))
  throw new TypeError('Invalid NPC personality');
 if(friend.personality?.sociability!=null&&!validScore(friend.personality.sociability))
  throw new RangeError('Invalid NPC sociability');
 const life=friend.life;
 if(life!=null&&!isRecord(life))throw new TypeError('Invalid NPC life');
 for(const field of ['personalStress','workStability','lifeSatisfaction','academicProgress','socialCapital']){
  if(life?.[field]!=null&&!validScore(life[field]))throw new RangeError('Invalid NPC '+field);
 }
 if(life?.majorEvents!=null&&(!validCounter(life.majorEvents)||
    life.majorEvents>Number.MAX_SAFE_INTEGER-3))
  throw new RangeError('Invalid or overflowing NPC majorEvents');
 if(life?.careerYears!=null&&!validCounter(life.careerYears))
  throw new RangeError('Invalid NPC careerYears');
 const goals=friend.lifeGoals;
 if(goals!=null&&(!isRecord(goals)||
  (goals.history!=null&&(!Array.isArray(goals.history)||goals.history.some(x=>!isRecord(x))))||
  (goals.active!=null&&(!isRecord(goals.active)||!goalIds.has(goals.active.id)||
   (goals.active.progress!=null&&!validScore(goals.active.progress))))))
  throw new TypeError('Invalid NPC goal progress or history');
}

export function processFriendLivesYear(state,rng){
 const entries=[];
 const calendarYear=state.year==null?2000+(state.player?.age??0):state.year;
 // Preflight the entire living cohort before initializing a life or consuming RNG.
 // A malformed marker on a later friend must not partially update earlier friends.
 const friends=state.social?.friends??[];
 if(!Array.isArray(friends))throw new TypeError('Invalid NPC friends collection');
 const living=friends.filter(friend=>friend?.alive!==false);
 annualYearStatus(calendarYear,null,'NPC life');
 for(const friend of living){
  const {replayed}=annualYearStatus(calendarYear,friend.life?.lastProcessedYear,'NPC life');
  if(!replayed)assertFriendYearInputs(friend);
 }
 const restore=snapshotObjectGraph(living);
 const restoreRng=captureRngCheckpoint(rng);
 try {
 for(const friend of state.social?.friends??[]){
  if(friend.alive===false)continue;
  const life=ensureFriendLife(friend);
  // Annual NPC transitions are transactional: a repeated simulation of the same
  // year must not re-roll relationships, employment or stress.
  if(life.lastProcessedYear===calendarYear)continue;
  ensureNpcGoal(friend);
  life.personalStress=clamp(life.personalStress+rng.fork(friend.id+'-stress').int(-3,4));
  life.workStability=clamp(life.workStability+rng.fork(friend.id+'-work').int(-4,4));
  life.lifeSatisfaction=clamp(
    38+
    (friend.relationship??55)*.18+
    life.workStability*.18-
    life.personalStress*.16+
    (friend.closeFriend?8:0)
  );
  updateNpcGoal(friend,{
   careerSatisfaction:life.workStability,
   financialStability:life.workStability,
   relationshipQuality:friend.relationship??55,
   wellbeing:life.lifeSatisfaction
  });

  if(life.relationshipStatus==='single'&&friend.age>=20&&rng.fork(friend.id+'-partner').chance(.08+(friend.personality?.sociability??50)*.001)){
    life.relationshipStatus='partnered';
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' ciddi bir ilişkiye başladı.'});
  }else if(life.relationshipStatus==='partnered'&&rng.fork(friend.id+'-breakup').chance(.035+Math.max(0,45-life.lifeSatisfaction)*.002)){
    life.relationshipStatus='single';
    life.personalStress=clamp(life.personalStress+10);
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' ilişkisinin bittiğini anlattı.'});
  }

  if(!life.movedAway&&friend.age>=22&&rng.fork(friend.id+'-move').chance(.035)){
    life.movedAway=true;
    friend.cityName='Başka şehir';
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' işi veya özel hayatı nedeniyle başka bir şehre taşındı.'});
  }

  // Only employed working-age NPCs can lose a job.
  if(friend.age>=18&&friend.age<67&&friend.jobId&&friend.jobId!=='unemployed'&&life.workStability<=28&&rng.fork(friend.id+'-job-loss').chance(.18)){
    life.personalStress=clamp(life.personalStress+12);
    life.workStability=20;
    friend.jobId='unemployed';
    friend.monthlyIncome=0;
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' işini kaybetti ve zor bir döneme girdi.'});
  }

  // Education affects the chance of finding work, without guaranteeing employment.
  const educationBonus=life.schoolOutcome==='advanced'?.08:life.schoolOutcome==='progressing'?.04:0;
  if(friend.age>=18&&friend.age<67&&friend.jobId==='unemployed'&&rng.fork(friend.id+'-reemployment').chance(.22+educationBonus)){
    const options=eligibleNpcJobs(friend);
    const index=rng.fork(friend.id+'-new-job').int(0,options.length-1);
    friend.jobId=options[index].id;
    friend.job=options[index].title;
    friend.monthlyIncome=npcMonthlyIncome(friend);
    life.lastReemploymentYear=calendarYear;
    life.workStability=clamp(Math.max(42,life.workStability));
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' yeniden iş buldu.'});
  }

  // Weekly representative activities are generated before settlement.
  // Existing entries are idempotent, so re-running this year never duplicates gains.
  generateNpcYearActivities(friend,{year:calendarYear});
  const settlement=settleNpcActivityYear(friend,{year:calendarYear,annualGains:{academic:0,social:0}});
  if(settlement.status==='settled'&&settlement.deltas.academic>0){
    life.academicProgress=clamp((life.academicProgress??0)+settlement.deltas.academic);
  }
  if(settlement.status==='settled'&&settlement.deltas.social>0){
    // NPC social activity builds their own social network, not intimacy with the player.
    // Player relationship changes must be caused by actual player/NPC interactions.
    life.socialCapital=clamp((life.socialCapital??50)+settlement.deltas.social);
  }
  // School outcomes belong to the NPC, not the player's exam system.
  // Progress only comes from eligible, recorded school-day study activities.
  if(friend.age>=6&&friend.age<18){
    const academic=life.academicProgress??0;
    life.schoolStanding=academic>=25?'advanced':academic>=10?'progressing':'developing';
    if(friend.age===17&&!life.schoolCompletionYear){
      life.schoolCompletionYear=calendarYear;
      life.schoolOutcome=life.schoolStanding;
      entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' okul dönemini tamamladı.'});
    }
  }
  const routine=simulateNpcRoutineWeek(friend,{year:calendarYear,kind:'friend'});
  friend.socialAvailability=routine.availability;

  if(friend.closeFriend&&life.personalStress>=72&&rng.fork(friend.id+'-reach-out').chance(.25)){
    friend.needsSupport=true;
    entries.push({age:state.player.age,kind:'friend-life',paceBlock:true,text:friend.name+' zorlandığı için özellikle sana ulaşmaya başladı.'});
  }else if(life.personalStress<50){
    friend.needsSupport=false;
  }
  life.lastProcessedYear=calendarYear;
 }
 return entries;
 }catch(error){
  restore();
  restoreRngOrThrow(restoreRng,error);
 }
}
