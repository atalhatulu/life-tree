import {physicalCapacity,workCapacityModifier} from '../health/physical_capacity.js';
import {JOBS} from '../data/catalog.js';
import {economy} from '../world/world_state.js';
import {chooseJobOfferCity,moveToCity,movingCost,relocationHouseholdSize} from '../world/migration_system.js';
import {metaFor,familyCompatibility} from './career_taxonomy.js';
import {
 ensureCareerProfile,yearsInJob,yearsInFamily,recentJobRecord,dominantCareerFamily,archiveCareer
} from './career_profile.js';
import {humanCapitalFor} from './human_capital.js';

const ENTRY_JOB_IDS=['cleaner','mechanic','cook','shopkeeper','driver'];

function interestMatch(state,job){
 const vals=(job.interests??[]).map(i=>state.player.interests?.[i]??0);
 return vals.length?Math.max(...vals):30;
}

function degreeTags(state){
 return state.higherEducation?.completed?(state.higherEducation.careerTags??[]):[];
}

function qualification(state,job,mode){
 const meta=metaFor(job.id);
 const tags=degreeTags(state);
 const exactDegree=(meta.degreeTags??[]).some(tag=>tags.includes(tag));
 const familyYears=yearsInFamily(state,meta.family);
 const jobYears=yearsInJob(state,job.id);
 const vocational=state.education?.path==='vocational';

 if(meta.regulated){
  return {eligible:exactDegree,exactDegree,reason:exactDegree?'degree':'regulated-degree-required'};
 }

 if(exactDegree)return {eligible:true,exactDegree:true,reason:'degree'};

 if(mode==='entry'){
  if(state.higherEducation?.completed){
   const degreeRelated=tags.includes(job.id);
   const familyRelated=tags.some(tag=>familyCompatibility(tag,job.id)>=65);
   return {eligible:degreeRelated||familyRelated||meta.entry,exactDegree:false,reason:degreeRelated?'degree':familyRelated?'adjacent-degree':'fallback-entry'};
  }
  if(vocational&&['mechanic','cook','driver','shopkeeper'].includes(job.id))return {eligible:true,exactDegree:false,reason:'vocational'};
  return {eligible:ENTRY_JOB_IDS.includes(job.id),exactDegree:false,reason:'entry'};
 }

 if(mode==='reemployment'){
  const core=dominantCareerFamily(state);
  const recentJobId=ensureCareerProfile(state).recentJobs[0]?.jobId;
  const compatible=core?meta.family===core||familyCompatibility(recentJobId,job.id)>=65:false;
  const unemployedYears=Math.max(0,state.player.age-(state.unemployedSinceAge??state.player.age));
  const fallbackAllowed=unemployedYears>=3;

  return {
   eligible:jobYears>0||familyYears>=2||compatible||(fallbackAllowed&&meta.entry),
   exactDegree:false,
   reason:jobYears>0
    ?'prior-job'
    :familyYears>=2
      ?'family-experience'
      :compatible
        ?'adjacent-family'
        :fallbackAllowed
          ?'long-unemployment-fallback'
          :'career-mismatch'
  };
 }

 // Deliberate career changes should be coherent.
 const currentId=state.career?.jobId;
 const compatibility=familyCompatibility(currentId,job.id);
 if(job.id===currentId)return {eligible:false,exactDegree:false,reason:'same-job'};
 if(compatibility>=65)return {eligible:true,exactDegree:false,reason:'adjacent-family'};
 // Prior experience in a distant sector is not enough to make an unrelated
 // voluntary switch coherent. Returning to an old distant career requires a
 // dedicated return/retraining path rather than appearing as a normal offer.
 return {eligible:false,exactDegree:false,reason:'retraining-required'};
}

function buildOffer(state,rng,job,mode){
 const fit=interestMatch(state,job);
 const q=qualification(state,job,mode);
 const meta=metaFor(job.id);
 const low=job.income[0],high=job.income[1];
 const experienceYears=yearsInJob(state,job.id)+yearsInFamily(state,meta.family)*.35;
 const degreeBoost=q.exactDegree?1.10:1;
 const capital=humanCapitalFor(state,job.id);
 const experienceBoost=Math.min(1.28,1+experienceYears*.018+capital.score*.0006);
 const macro=economy(state);
 const city=chooseJobOfferCity(state,rng.fork('city-'+job.id));
 const salary=Math.round(
  rng.fork(job.id).int(low,Math.max(low,Math.round(low+(high-low)*.45)))*
  degreeBoost*experienceBoost*macro.wageIndex*city.wage
 );
 const currentSalary=state.career?.monthlyIncome??0;
 const salaryDrop=currentSalary>0?salary/currentSalary:1;
 const transitionPenalty=mode==='career-switch'&&salaryDrop<.72?18:0;
 const chance=Math.min(95,Math.max(5,Math.round(
  38+fit*.18+state.player.personality.discipline*.14+state.player.personality.sociability*.08+
  Math.min(18,experienceYears*2)+capital.score*.10+(q.exactDegree?16:0)+(macro.laborMarket-1)*25+(city.jobs-1)*16-transitionPenalty
 )));
 const currentCityId=state.location?.cityId??state.origin?.cityId;
 const requiresMove=city.id!==currentCityId;
 const moveCost=requiresMove?movingCost(currentCityId,city.id,relocationHouseholdSize(state)):0;
 const recent=recentJobRecord(state,job.id);
 const pingPongPenalty=recent&&recent.reason!=='fired'&&state.player.age-recent.leftAtAge<5?40:0;

 return {
  ...job,
  family:meta.family,
  transitionReason:q.reason,
  fit,salary,offerChance:chance,
  related:q.exactDegree||q.reason==='adjacent-degree'||q.reason==='adjacent-family',
  experienceYears,humanCapital:capital.score,
  cityId:city.id,cityName:city.name,
  requiresMove,moveCost,
  score:fit+chance*.55+Math.min(25,experienceYears*3)+(q.exactDegree?25:0)-transitionPenalty-pingPongPenalty+(city.id===currentCityId?4:0)
 };
}

function inferMode(state,requested){
 if(requested)return requested;
 if(state.career?.employed)return 'career-switch';
 if((state.careerProfile?.totalExperience??0)>0||state.career?.totalYears>0)return 'reemployment';
 return 'entry';
}

export function generateJobOffers(state,rng,count=3,options={}){
 ensureCareerProfile(state);
 const mode=inferMode(state,options.mode);
 const currentId=state.career?.employed?state.career.jobId:null;

 let eligible=JOBS.filter(job=>{
  if(job.id==='unemployed'||job.id===currentId)return false;
  return qualification(state,job,mode).eligible;
 });

 // First graduate job: do not bury the degree under unrelated fallback work.
 if(mode==='entry'&&state.higherEducation?.completed){
  const tags=degreeTags(state);
  const degreeJobs=eligible.filter(job=>{
   const meta=metaFor(job.id);
   return (meta.degreeTags??[]).some(tag=>tags.includes(tag))||tags.includes(job.id);
  });
  if(degreeJobs.length)eligible=degreeJobs;
 }

 let offers=eligible.map(job=>buildOffer(state,rng,job,mode));

 if(mode==='career-switch'){
  offers=offers.filter(offer=>{
   const recent=recentJobRecord(state,offer.id);
   if(recent&&recent.reason!=='fired'&&state.player.age-recent.leftAtAge<4)return false;
   const currentSalary=state.career?.monthlyIncome??0;
   if(currentSalary>0&&offer.salary<currentSalary*.65&&state.career?.satisfaction>=35)return false;
   return true;
  });
 }

 if(mode==='reemployment'){
  offers.sort((a,b)=>{
   const aPrior=yearsInJob(state,a.id)>0?1:0;
   const bPrior=yearsInJob(state,b.id)>0?1:0;
   if(aPrior!==bPrior)return bPrior-aPrior;
   const core=dominantCareerFamily(state);
   const af=a.family===core?1:0,bf=b.family===core?1:0;
   if(af!==bf)return bf-af;
   return b.score-a.score;
  });
 }else{
  offers.sort((a,b)=>b.score-a.score);
 }

 return offers.slice(0,count);
}

export function acceptJob(state,jobId){
 const offer=state.pendingJobOffers?.find(j=>j.id===jobId);
 if(!offer) throw new Error('Bu iş teklifi artık geçerli değil.');

 let moveResult=null;
 if(offer.requiresMove)moveResult=moveToCity(state,offer.cityId,'job',{housing:'shared',stress:4});

 const prior=state.career;
 // Career exits are archived at the moment they happen (firing, relocation,
 // entrepreneurship, career switch). Do not archive again on re-employment.
 const previousJobs=[...(prior?.previousJobs??[])];
 state.career={
  employed:true,
  jobId:offer.id,
  title:offer.title,
  family:offer.family,
  monthlyIncome:offer.salary,
  years:0,
  totalYears:prior?.totalYears??0,
  performance:50,
  degreeRelated:Boolean(offer.related),
  cityId:offer.cityId,
  cityName:offer.cityName,
  level:Math.max(1,Math.min(3,1+Math.floor((offer.experienceYears??0)/5))),
  satisfaction:55,
  stability:60,
  previousJobs,
  enteredAtAge:state.player.age,
  transitionReason:offer.transitionReason
 };
 state.player.job=offer.title;
 state.player.jobId=offer.id;
 state.player.monthlyIncome=offer.salary;
 state.nextPath='work';
 state.pendingJobOffers=null;
 state.unemployedSinceAge=null;
 return {...offer,moveResult};
}

export function progressCareerYear(state,rng){
 const c=state.career;
 if(!c?.employed)return [];
 c.years+=1;
 c.totalYears=(c.totalYears??0)+1;
 const capacity=physicalCapacity(state);
 const target=Math.min(100,state.player.personality.discipline*.35+state.player.personality.sociability*.15+capacity*.15+35+workCapacityModifier(state));
 c.performance=Math.max(0,Math.min(100,c.performance+(target-c.performance)*.3+rng.int(-4,4)));
 if(c.performance>72&&rng.chance(.22)){
  const raise=Math.round(c.monthlyIncome*rng.int(4,10)/100);
  c.monthlyIncome+=raise;
  state.player.monthlyIncome=c.monthlyIncome;
  return [{age:state.player.age,kind:'career',text:'İşindeki performansın sayesinde maaşına zam aldın.'}];
 }
 return [];
}
