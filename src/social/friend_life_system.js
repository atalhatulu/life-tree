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

export function processFriendLivesYear(state,rng){
 const entries=[];
 for(const friend of state.social?.friends??[]){
  if(friend.alive===false)continue;
  const life=ensureFriendLife(friend);
  const calendarYear=Number.isInteger(state.year)?state.year:2000+(state.player?.age??0);
  // Annual NPC transitions are transactional: a repeated simulation of the same
  // year must not re-roll relationships, employment or stress.
  if(life.lastProcessedYear===calendarYear)continue;
  if(Number.isInteger(life.lastProcessedYear)&&calendarYear<life.lastProcessedYear)
   throw new RangeError('Cannot process an NPC life in an earlier year');
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
}
