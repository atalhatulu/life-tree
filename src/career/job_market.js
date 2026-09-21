import {JOBS} from '../data/catalog.js';
import {economy} from '../world/world_state.js';
import {locationProfile} from '../data/countries/turkey/profile.js';

const ENTRY_JOB_IDS=['cleaner','mechanic','cook','shopkeeper','driver','accountant'];

function interestMatch(state,job){
 const vals=(job.interests??[]).map(i=>state.player.interests?.[i]??0);
 return vals.length?Math.max(...vals):30;
}

function buildOffer(state,rng,job,careerTags,graduated){
 const fit=interestMatch(state,job);
 const related=careerTags.includes(job.id);
 const low=job.income[0],high=job.income[1];
 const degreeSalaryBoost=graduated&&related?1.08:1;
 const macro=economy(state);
 const city=locationProfile(state);
 const salary=Math.round(rng.fork(job.id).int(low,Math.max(low,Math.round(low+(high-low)*.45)))*degreeSalaryBoost*macro.wageIndex*city.wage);
 const chance=Math.min(95,Math.max(8,Math.round(45+fit*.20+state.player.personality.discipline*.15+state.player.personality.sociability*.10+(related?12:0)+(macro.laborMarket-1)*28+(city.jobs-1)*18)));
 return {...job,fit,salary,offerChance:chance,related,score:fit+chance*.4};
}

export function generateJobOffers(state,rng,count=3){
 const graduated=Boolean(state.higherEducation?.completed);
 const educationLevel=graduated?4:2;
 const careerTags=state.higherEducation?.careerTags??[];
 const currentId=state.career?.employed?state.career.jobId:null;
 const eligible=JOBS.filter(j=>j.id!=='unemployed'&&j.id!==currentId&&j.educationMin<=educationLevel&&(graduated||ENTRY_JOB_IDS.includes(j.id)));
 const offers=eligible.map(job=>buildOffer(state,rng,job,careerTags,graduated));

 if(graduated&&careerTags.length){
  const related=offers.filter(o=>o.related).sort((a,b)=>b.score-a.score);
  const fallback=offers.filter(o=>!o.related).sort((a,b)=>b.score-a.score);
  if(related.length) return [...related,...fallback].slice(0,count);
 }

 return offers.sort((a,b)=>b.score-a.score).slice(0,count);
}

export function acceptJob(state,jobId){
 const offer=state.pendingJobOffers?.find(j=>j.id===jobId);
 if(!offer) throw new Error('Bu iş teklifi artık geçerli değil.');
 state.career={
  employed:true,
  jobId:offer.id,
  title:offer.title,
  monthlyIncome:offer.salary,
  years:0,
  totalYears:state.career?.totalYears??0,
  performance:50,
  degreeRelated:Boolean(offer.related)
 };
 state.player.job=offer.title;
 state.player.jobId=offer.id;
 state.player.monthlyIncome=offer.salary;
 state.nextPath='work';
 state.pendingJobOffers=null;
 return offer;
}

export function progressCareerYear(state,rng){
 const c=state.career;
 if(!c?.employed) return [];
 c.years+=1;
 c.totalYears=(c.totalYears??0)+1;
 const target=Math.min(100,state.player.personality.discipline*.35+state.player.personality.sociability*.15+state.player.health.current*.15+35);
 c.performance=Math.max(0,Math.min(100,c.performance+(target-c.performance)*.3+rng.int(-4,4)));
 if(c.performance>72&&rng.chance(.22)){
  const raise=Math.round(c.monthlyIncome*rng.int(4,10)/100);
  c.monthlyIncome+=raise;
  state.player.monthlyIncome=c.monthlyIncome;
  return [{age:state.player.age,kind:'career',text:'İşindeki performansın sayesinde maaşına zam aldın.'}];
 }
 return [];
}
