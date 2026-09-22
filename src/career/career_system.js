import {generateJobOffers} from './job_market.js';
import {economy} from '../world/world_state.js';
import {moveToCity} from '../world/migration_system.js';
import {archiveCareer,yearsInFamily} from './career_profile.js';
import {metaFor,retrainingYears} from './career_taxonomy.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const LEVELS=[
 {id:'junior',minYears:0},
 {id:'mid',minYears:3},
 {id:'senior',minYears:7},
 {id:'lead',minYears:12}
];

function levelForYears(years){
 let level=LEVELS[0];
 for(const item of LEVELS)if(years>=item.minYears)level=item;
 return level;
}

export function deepenCareerState(state){
 const c=state.career;
 if(!c?.employed) return;
 c.level??=1;
 c.levelTitle??=levelForYears(c.years??0).id;
 c.satisfaction??=clamp(Math.round(45+(c.degreeRelated?12:0)+state.player.personality.ambition*.15));
 c.stability??=60;
 c.network??=clamp(Math.round((state.player.personality.sociability??50)*.7+20));
 c.companyFit??=clamp(50+(c.degreeRelated?10:0));
}

export function processCareerDynamics(state,rng){
 const c=state.career;
 const entries=[];
 if(!c?.employed) return entries;
 deepenCareerState(state);

 c.companyFit=clamp(c.companyFit+rng.int(-3,3)+(c.degreeRelated?1:0));
 if(c.sector==='public')c.stability=clamp(c.stability+1);
 if(c.sector==='self-employed'){
  const swing=rng.int(-10,14);
  c.monthlyIncome=Math.max(0,Math.round(c.monthlyIncome*(1+swing/100)));
  state.player.monthlyIncome=c.monthlyIncome;
 }
 c.network=clamp(c.network+rng.int(-2,2)+(state.player.personality.sociability>65?1:0));
 c.satisfaction=clamp(c.satisfaction+rng.int(-4,4)+(c.degreeRelated?1:0)+(c.companyFit-50)*.02);
 c.stability=clamp(c.stability+rng.int(-3,3)+(c.performance>65?2:-1)+(c.network-50)*.01);

 const expectedLevel=levelForYears(c.years??0);
 let promotedThisYear=false;
 const promotionChance=Math.min(.42,.08+(c.performance-65)*.006+(c.network-50)*.002+(c.companyFit-50)*.0015);
 if(expectedLevel.id!==c.levelTitle&&c.performance>68&&rng.chance(Math.max(.06,promotionChance))){
  c.levelTitle=expectedLevel.id;
  c.level=Math.min(4,(c.level??1)+1);
  c.monthlyIncome=Math.round(c.monthlyIncome*(expectedLevel.id==='lead'?1.16:1.11));
  state.player.monthlyIncome=c.monthlyIncome;
  c.stability=clamp(c.stability+8);
  promotedThisYear=true;
  entries.push({age:state.player.age,kind:'career',paceBlock:true,text:'Terfi aldın. Yeni kariyer seviyen '+c.levelTitle+' oldu.'});
 }

 const macro=economy(state);
 const marketRisk=Math.max(0,(1-macro.laborMarket)*.08);
 const sectorRisk=c.sector==='public'?.35:c.sector==='self-employed'?1.35:1;
 const firingChance=Math.min(.24,((c.performance<35?.10:c.stability<30?.06:.008)+marketRisk)*sectorRisk);
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

export function switchJob(state,job){
 const old=state.career;
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
  stability:job.sectorStability??60,
  sector:job.sector??'private',
  enteredAtAge:state.player.age,
  transitionReason:job.transitionReason??'career-switch',
  previousJobs:[...(old?.previousJobs??[]),old?{title:old.title,years:old.years}:null].filter(Boolean)
 };
 state.player.job=job.title;
 state.player.jobId=job.id;
 state.player.monthlyIncome=job.salary;
 state.pendingCareerOffers=null;
 return {job:state.career,moveResult};
}


export function beginRetraining(state,targetJobId){
 const current=state.career?.jobId;
 const years=retrainingYears(current,targetJobId);
 if(!Number.isFinite(years)||years<=0)throw new Error('Bu geçiş için retraining yolu uygun değil.');
 state.retraining={
  fromJobId:current,
  targetJobId,
  startedAtAge:state.player.age,
  requiredYears:years,
  yearsCompleted:0,
  completed:false
 };
 return state.retraining;
}

export function processRetrainingYear(state){
 const r=state.retraining;
 if(!r||r.completed)return [];
 r.yearsCompleted+=1;
 if(r.yearsCompleted>=r.requiredYears){
  r.completed=true;
  r.completedAtAge=state.player.age;
  return [{age:state.player.age,kind:'career',text:'Kariyer değişimi için yeniden eğitim sürecini tamamladın.'}];
 }
 return [];
}
