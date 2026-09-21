import {generateJobOffers} from './job_market.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function deepenCareerState(state){
 const c=state.career;
 if(!c?.employed) return;
 c.level??=1;
 c.satisfaction??=clamp(Math.round(45+(c.degreeRelated?12:0)+state.player.personality.ambition*.15));
 c.stability??=60;
}

export function processCareerDynamics(state,rng){
 const c=state.career;
 const entries=[];
 if(!c?.employed) return entries;
 deepenCareerState(state);

 c.satisfaction=clamp(c.satisfaction+rng.int(-5,4)+(c.degreeRelated?1:0));
 c.stability=clamp(c.stability+rng.int(-4,4)+(c.performance>65?2:-1));

 if(c.performance>78&&c.years>=2&&rng.chance(.20)){
  c.level+=1;
  c.monthlyIncome=Math.round(c.monthlyIncome*1.12);
  state.player.monthlyIncome=c.monthlyIncome;
  entries.push({age:state.player.age,kind:'career',text:'Terfi aldın. Kariyer seviyen '+c.level+' oldu.'});
 }

 const firingChance=c.performance<35?.10:c.stability<30?.06:.008;
 if(rng.chance(firingChance)){
  entries.push({age:state.player.age,kind:'career',text:c.title+' işinden çıkarıldın.'});
  c.employed=false;
  state.player.job=null;
  state.player.jobId=null;
  state.player.monthlyIncome=0;
  if(state.business?.active&&state.business.mode==='side'){
   state.business.mode='full-time';
   state.player.job='Girişimci';
   state.player.jobId='entrepreneur';
   state.nextPath='business';
   state.pendingJobOffers=null;
   entries.push({age:state.player.age,kind:'career',text:'Yan işletmeni artık tam zamanlı yürütmeye başladın.'});
   return entries;
  }
  state.nextPath='work';
  state.unemployedSinceAge=state.player.age;
  state.pendingJobOffers=null;
  return entries;
 }

 if(c.years>=3&&c.years%3===0&&(c.satisfaction<55||state.player.personality.ambition>70)){
  state.pendingCareerOffers=generateJobOffers(state,rng.fork('career-switch-'+state.player.age));
 }
 return entries;
}

export function switchJob(state,job){
 const old=state.career;
 state.career={
  employed:true,
  jobId:job.id,
  title:job.title,
  monthlyIncome:job.salary,
  years:0,
  totalYears:old?.totalYears??0,
  performance:50,
  degreeRelated:Boolean(job.related),
  level:1,
  satisfaction:55,
  stability:60,
  previousJobs:[...(old?.previousJobs??[]),old?{title:old.title,years:old.years}:null].filter(Boolean)
 };
 state.player.job=job.title;
 state.player.jobId=job.id;
 state.player.monthlyIncome=job.salary;
 state.pendingCareerOffers=null;
}
