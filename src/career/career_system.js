import {generateJobOffers} from './job_market.js';
import {economy} from '../world/world_state.js';
import {moveToCity} from '../world/migration_system.js';
import {archiveCareer,yearsInFamily} from './career_profile.js';
import {metaFor,familyCompatibility} from './career_taxonomy.js';
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

 let promotedThisYear=false;
 if(c.performance>78&&c.years>=2&&rng.chance(.20)){
  c.level+=1;
  c.monthlyIncome=Math.round(c.monthlyIncome*1.12);
  state.player.monthlyIncome=c.monthlyIncome;
  c.stability=clamp(c.stability+8);
  promotedThisYear=true;
  entries.push({age:state.player.age,kind:'career',paceBlock:true,text:'Terfi aldın. Kariyer seviyen '+c.level+' oldu.'});
 }

 const macro=economy(state);
 const marketRisk=Math.max(0,(1-macro.laborMarket)*.08);
 const firingChance=Math.min(.22,(c.performance<35?.10:c.stability<30?.06:.008)+marketRisk);
 if(!promotedThisYear&&rng.chance(firingChance)){
  entries.push({age:state.player.age,kind:'career',paceBlock:true,text:c.title+' işinden çıkarıldın.'});
  archiveCareer(state,'fired');
  c.exitReason='fired';
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
  state.pendingCareerOffers=generateJobOffers(state,rng.fork('career-switch-'+state.player.age),3,{mode:'career-switch'});
 }
 return entries;
}

function transitionReasonForSwitch(state,job){
 const current=state.career;
 const currentIncome=current?.monthlyIncome??0;
 const salaryRatio=currentIncome>0?(job.salary??0)/currentIncome:1;
 const sameOrAdjacent=(job.transitionReason==='adjacent-family'||job.related===true);
 if(job.requiresMove&&salaryRatio>=1.12)return 'relocation-upgrade';
 if(salaryRatio>=1.15)return 'salary-growth';
 if((current?.satisfaction??50)<35&&sameOrAdjacent)return 'low-satisfaction-adjacent';
 if(sameOrAdjacent)return job.transitionReason??'adjacent-family';
 return job.transitionReason??'career-switch';
}

export function switchJob(state,job){
 const old=state.career;
 if(!old?.employed)throw new Error('Aktif kariyer olmadan gönüllü kariyer değişimi yapılamaz.');
 if(familyCompatibility(old.jobId,job.id)<65){
  state.pendingCareerOffers=null;
  throw new Error('Bu teklif mevcut kariyerinle artık tutarlı değil; yeniden eğitim veya ayrı bir kariyer dönüş yolu gerekir.');
 }
 archiveCareer(state,'career-switch');
 let moveResult=null;
 if(job.requiresMove)moveResult=moveToCity(state,job.cityId,'career-switch',{housing:'shared',stress:4});
 const family=job.family??metaFor(job.id).family;
 const familyYears=yearsInFamily(state,family);
 state.career={
  employed:true,
  jobId:job.id,
  title:job.title,
  family,
  monthlyIncome:job.salary,
  years:0,
  totalYears:old?.totalYears??0,
  performance:50,
  degreeRelated:Boolean(job.related),
  cityId:job.cityId??state.location?.cityId,
  cityName:job.cityName??state.location?.cityName,
  level:Math.max(1,Math.min(3,1+Math.floor(familyYears/6))),
  satisfaction:55,
  stability:60,
  enteredAtAge:state.player.age,
  transitionReason:transitionReasonForSwitch(state,job),
  previousJobs:[...(old?.previousJobs??[]),old?{title:old.title,years:old.years}:null].filter(Boolean)
 };
 state.player.job=job.title;
 state.player.jobId=job.id;
 state.player.monthlyIncome=job.salary;
 state.pendingCareerOffers=null;
 return {job:state.career,moveResult};
}
