import {performance} from 'node:perf_hooks';
import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';
import {familyCompatibility} from '../career/career_taxonomy.js';
import {geneticSummary} from '../health/genetic_system.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}
function pct(n,d){return d?Number((n/d*100).toFixed(1)):0;}
function avg(n,d,digits=2){return d?Number((n/d).toFixed(digits)):0;}
function inc(obj,key,by=1){obj[key]=(obj[key]??0)+by;}
function careerSequence(state){
 const archived=[...(state.careerProfile?.recentJobs??[])].reverse().map(x=>({
  jobId:x.jobId,title:x.title,reason:x.reason,leftAtAge:x.leftAtAge
 }));
 const current=state.career?.jobId?[
  {jobId:state.career.jobId,title:state.career.title,reason:'current',leftAtAge:null}
 ]:[];
 return [...archived,...current];
}
function transitionAudit(state){
 const seq=careerSequence(state);
 const issues=[];
 for(let i=1;i<seq.length;i++){
  const from=seq[i-1],to=seq[i];
  if(!from.jobId||!to.jobId)continue;

  if(from.jobId===to.jobId){
   issues.push({
    type:'same-occupation-return',
    job:to.title,
    after:from.reason
   });
   continue;
  }

  const compatibility=familyCompatibility(from.jobId,to.jobId);
  if(compatibility!==0)continue;

  // A salaried job followed by full-time entrepreneurship is not a direct
  // profession-to-profession jump even if the next salaried job is distant.
  const degreeTags=state.higherEducation?.completed?(state.higherEducation.careerTags??[]):[];
  const degreeBacked=degreeTags.includes(to.jobId);

  if(from.reason==='entrepreneurship'){
   issues.push({type:'post-business-distant-reentry',from:from.title,to:to.title});
  }else if(from.reason==='career-switch'&&degreeBacked){
   issues.push({type:'degree-backed-return',from:from.title,to:to.title});
  }else if(from.reason==='career-switch'){
   issues.push({type:'voluntary-unrelated-switch',from:from.title,to:to.title});
  }else{
   issues.push({type:'forced-unrelated-reemployment',from:from.title,to:to.title,after:from.reason});
  }
 }
 return issues;
}
function ageBucket(age){
 if(age<40)return '<40';
 if(age<60)return '40-59';
 if(age<75)return '60-74';
 if(age<90)return '75-89';
 return '90+';
}

const lives=Math.max(1,Number(arg('lives','100')));
const toAge=Math.max(1,Number(arg('to-age','100')));
const policy=arg('policy','random');
const seedPrefix=arg('seed-prefix','fast-audit');

const report={
 config:{lives,toAge,policy,seedPrefix},
 runtimeMs:0,
 valid:0,invalid:0,deaths:0,
 age:{sum:0,min:null,max:null,buckets:{}},
 education:{graduates:0,programs:{}},
 career:{employedAtEnd:0,retired:0,transitions:0,voluntaryUnrelated:0,forcedUnrelated:0,degreeBackedReturns:0,postBusinessDistant:0,sameOccupationReturns:0,finalJobs:{},issues:[]},
 relationships:{marriedAtEnd:0,activeAtEnd:0,everMarried:0,everWidowed:0,children:0,childless:0,marriedChildless:0,grandchildren:0},
 migration:{moves:0,returnHomeLives:0,reasons:{}},
 health:{sumFinalHealth:0,sumConditions:0,conditions:{},deathsByCause:{},lowHealthDeaths:0,highHealthDeaths:0,deathHealthSum:0},
 genetics:{affectedPeople:0,carrierPeople:0,affectedConditions:{},carrierConditions:{},polygenic:{hypertension:0,metabolic:0,cardiac:0}},
 pacing:{adultMajorDecisions:0,adjacentMajorDecisionLives:0},
 finance:{cash:0,debt:0,homeOwners:0,carOwners:0},
 samples:{invalid:[],careerIssues:[]}
};

const started=performance.now();
for(let i=0;i<lives;i++){
 const game=new Game(seedPrefix+'-'+policy+'-'+i);
 try{
  autoplay(game,{toAge,policy});
 }catch(error){
  report.invalid++;
  if(report.samples.invalid.length<8)report.samples.invalid.push({seed:game.seedText,error:error.message});
  continue;
 }
 const state=game.state;
 const violations=validateState(state);
 if(violations.length){
  report.invalid++;
  if(report.samples.invalid.length<8)report.samples.invalid.push({seed:game.seedText,error:violations.join('; ')});
  continue;
 }
 report.valid++;

 const age=state.player.age;
 report.age.sum+=age;
 report.age.min=report.age.min==null?age:Math.min(report.age.min,age);
 report.age.max=report.age.max==null?age:Math.max(report.age.max,age);
 inc(report.age.buckets,ageBucket(age));

 if(!state.player.alive){
  report.deaths++;
  inc(report.health.deathsByCause,state.death?.cause??'unknown');
  report.health.deathHealthSum+=state.player.health.current;
  if(state.player.health.current<25)report.health.lowHealthDeaths++;
  if(state.player.health.current>=70)report.health.highHealthDeaths++;
 }

 if(state.higherEducation?.completed){
  report.education.graduates++;
  inc(report.education.programs,state.higherEducation.programTitle??'unknown');
 }

 if(state.career?.employed)report.career.employedAtEnd++;
 if(state.retirement?.retired)report.career.retired++;
 if(state.career?.title)inc(report.career.finalJobs,state.career.title);

 const seq=careerSequence(state);
 report.career.transitions+=Math.max(0,seq.length-1);
 const careerIssues=transitionAudit(state);
 for(const issue of careerIssues){
  if(issue.type==='voluntary-unrelated-switch')report.career.voluntaryUnrelated++;
  if(issue.type==='forced-unrelated-reemployment')report.career.forcedUnrelated++;
  if(issue.type==='degree-backed-return')report.career.degreeBackedReturns++;
  if(issue.type==='post-business-distant-reentry')report.career.postBusinessDistant++;
  if(issue.type==='same-occupation-return')report.career.sameOccupationReturns++;
  if(report.samples.careerIssues.length<16)report.samples.careerIssues.push({seed:game.seedText,...issue});
 }
 report.career.issues.push(...careerIssues.map(x=>x.type));

 const romance=state.social?.romance;
 if(romance)report.relationships.activeAtEnd++;
 if(romance?.status==='married')report.relationships.marriedAtEnd++;
 const everMarried=Boolean(
  romance?.status==='married'||
  (state.social?.exSpouses?.length??0)>0||
  (state.social?.deceasedPartners??[]).some(p=>p.status==='married')||
  state.widowedAtAge!=null
 );
 if(everMarried)report.relationships.everMarried++;
 if(state.widowedAtAge!=null)report.relationships.everWidowed++;
 const children=state.children?.length??0;
 report.relationships.children+=children;
 if(children===0){
  report.relationships.childless++;
  if(everMarried)report.relationships.marriedChildless++;
 }
 report.relationships.grandchildren+=state.grandchildren??0;

 const moves=state.migrationHistory??[];
 report.migration.moves+=moves.length;
 let returned=false;
 for(const move of moves){
  inc(report.migration.reasons,move.reason);
  if(move.reason==='return-home')returned=true;
 }
 if(returned)report.migration.returnHomeLives++;

 report.health.sumFinalHealth+=state.player.health.current;
 const conditions=state.healthProfile?.conditions??[];
 report.health.sumConditions+=conditions.length;
 for(const condition of conditions)inc(report.health.conditions,condition.label);

 const genetics=geneticSummary(state.player);
 if(genetics.affected.length)report.genetics.affectedPeople++;
 if(genetics.carriers.length)report.genetics.carrierPeople++;
 for(const label of genetics.affected)inc(report.genetics.affectedConditions,label);
 for(const label of genetics.carriers)inc(report.genetics.carrierConditions,label);
 for(const trait of ['hypertension','metabolic','cardiac']){
  report.genetics.polygenic[trait]+=genetics.polygenic?.[trait]??50;
 }

 const adultNodes=(state.lifeTree?.nodes??[]).filter(n=>n.age>=21&&n.pacingCategory);
 report.pacing.adultMajorDecisions+=adultNodes.length;
 let adjacent=false;
 for(let n=1;n<adultNodes.length;n++){
  if(adultNodes[n].age-adultNodes[n-1].age<2){adjacent=true;break;}
 }
 if(adjacent)report.pacing.adjacentMajorDecisionLives++;

 report.finance.cash+=state.finance?.cash??0;
 report.finance.debt+=state.finance?.debt??0;
 if(state.assets?.home)report.finance.homeOwners++;
 if(state.assets?.car)report.finance.carOwners++;
}
report.runtimeMs=Math.round(performance.now()-started);

const valid=Math.max(1,report.valid);
const summary={
 config:report.config,
 runtimeMs:report.runtimeMs,
 throughputLivesPerSecond:Number((report.valid/(report.runtimeMs/1000)).toFixed(1)),
 validity:{valid:report.valid,invalid:report.invalid,invalidRatePct:pct(report.invalid,lives)},
 lifespan:{
  averageAge:avg(report.age.sum,valid,1),
  minAge:report.age.min,maxAge:report.age.max,
  deathsBeforeTargetPct:pct(report.deaths,lives),
  ageBuckets:report.age.buckets
 },
 education:{
  graduatePct:pct(report.education.graduates,valid),
  programs:report.education.programs
 },
 career:{
  employedAtEndPct:pct(report.career.employedAtEnd,valid),
  retiredPct:pct(report.career.retired,valid),
  averageTransitions:avg(report.career.transitions,valid),
  voluntaryUnrelatedSwitchCount:report.career.voluntaryUnrelated,
  forcedUnrelatedReemploymentCount:report.career.forcedUnrelated,
  degreeBackedReturnCount:report.career.degreeBackedReturns,
  postBusinessDistantReentryCount:report.career.postBusinessDistant,
  sameOccupationReturnCount:report.career.sameOccupationReturns,
  finalJobs:report.career.finalJobs
 },
 relationships:{
  activeAtEndPct:pct(report.relationships.activeAtEnd,valid),
  marriedAtEndPct:pct(report.relationships.marriedAtEnd,valid),
  everMarriedPct:pct(report.relationships.everMarried,valid),
  everWidowedPct:pct(report.relationships.everWidowed,valid),
  averageChildren:avg(report.relationships.children,valid),
  childlessPct:pct(report.relationships.childless,valid),
  childlessAmongEverMarriedPct:pct(report.relationships.marriedChildless,Math.max(1,report.relationships.everMarried)),
  averageGrandchildren:avg(report.relationships.grandchildren,valid)
 },
 migration:{
  averageMoves:avg(report.migration.moves,valid),
  returnHomePct:pct(report.migration.returnHomeLives,valid),
  reasons:report.migration.reasons
 },
 health:{
  averageFinalHealth:avg(report.health.sumFinalHealth,valid,1),
  averageConditions:avg(report.health.sumConditions,valid),
  conditions:report.health.conditions,
  deathCauses:report.health.deathsByCause,
  averageHealthAtDeath:avg(report.health.deathHealthSum,Math.max(1,report.deaths),1),
  lowHealthAmongDeathsPct:pct(report.health.lowHealthDeaths,Math.max(1,report.deaths)),
  highHealthAmongDeathsPct:pct(report.health.highHealthDeaths,Math.max(1,report.deaths))
 },
 genetics:{
  affectedPct:pct(report.genetics.affectedPeople,valid),
  carrierPct:pct(report.genetics.carrierPeople,valid),
  affectedConditions:report.genetics.affectedConditions,
  carrierConditions:report.genetics.carrierConditions,
  averagePolygenicRisk:{
   hypertension:avg(report.genetics.polygenic.hypertension,valid,1),
   metabolic:avg(report.genetics.polygenic.metabolic,valid,1),
   cardiac:avg(report.genetics.polygenic.cardiac,valid,1)
  }
 },
 pacing:{
  averageAdultMajorDecisions:avg(report.pacing.adultMajorDecisions,valid),
  adjacentMajorDecisionLivesPct:pct(report.pacing.adjacentMajorDecisionLives,valid)
 },
 finance:{
  averageCash:Math.round(report.finance.cash/valid),
  averageDebt:Math.round(report.finance.debt/valid),
  homeOwnershipPct:pct(report.finance.homeOwners,valid),
  carOwnershipPct:pct(report.finance.carOwners,valid)
 },
 samples:report.samples
};

console.log('FAST SIMULATION AUDIT');
console.log(JSON.stringify(summary,null,2));
if(report.invalid>0)process.exitCode=1;
