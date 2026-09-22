import {performance} from 'node:perf_hooks';
import {Game} from '../core/game.js';
import {autoplay} from '../simulation/autoplay.js';
import {validateState} from '../simulation/invariants.js';
import {auditCareerTransitions,careerTransitionCount} from '../career/career_audit.js';
import {geneticSummary} from '../health/genetic_system.js';
import {physicalCapacity} from '../health/physical_capacity.js';

function arg(name,fallback){
 const index=process.argv.indexOf('--'+name);
 return index>=0&&process.argv[index+1]!=null?process.argv[index+1]:fallback;
}
function pct(n,d){return d?Number((n/d*100).toFixed(1)):0;}
function avg(n,d,digits=2){return d?Number((n/d).toFixed(digits)):0;}
function inc(obj,key,by=1){obj[key]=(obj[key]??0)+by;}
function push(obj,key,value){obj[key]??=[];obj[key].push(value);}
function sum(values){return values.reduce((a,b)=>a+b,0);}
function quantile(values,q){
 if(!values.length)return 0;
 const sorted=[...values].sort((a,b)=>a-b);
 const pos=(sorted.length-1)*q;
 const base=Math.floor(pos);
 const rest=pos-base;
 return Number((sorted[base]+(sorted[base+1]!=null?rest*(sorted[base+1]-sorted[base]):0)).toFixed(1));
}
function distribution(values){
 return {
  n:values.length,
  min:values.length?Math.min(...values):0,
  p10:quantile(values,.10),
  p25:quantile(values,.25),
  median:quantile(values,.50),
  p75:quantile(values,.75),
  p90:quantile(values,.90),
  max:values.length?Math.max(...values):0,
  mean:values.length?Number((sum(values)/values.length).toFixed(1)):0
 };
}
function correlation(xs,ys){
 const n=Math.min(xs.length,ys.length);
 if(n<3)return 0;
 const x=xs.slice(0,n),y=ys.slice(0,n);
 const mx=sum(x)/n,my=sum(y)/n;
 let num=0,dx=0,dy=0;
 for(let i=0;i<n;i++){
  const a=x[i]-mx,b=y[i]-my;
  num+=a*b;dx+=a*a;dy+=b*b;
 }
 if(dx===0||dy===0)return 0;
 return Number((num/Math.sqrt(dx*dy)).toFixed(3));
}
function ageBucket(age){
 if(age<20)return '<20';
 if(age<40)return '20-39';
 if(age<60)return '40-59';
 if(age<75)return '60-74';
 if(age<90)return '75-89';
 return '90+';
}
function wealthBucket(value){
 if(value<0)return 'negative';
 if(value<250000)return '<250k';
 if(value<1000000)return '250k-1m';
 if(value<5000000)return '1m-5m';
 if(value<20000000)return '5m-20m';
 return '20m+';
}
function historyCount(state,predicate){
 return (state.history??[]).filter(predicate).length;
}
function historyAgeList(state,predicate){
 return (state.history??[]).filter(predicate).map(x=>x.age).filter(Number.isFinite);
}
function firstAge(state,predicate){
 const ages=historyAgeList(state,predicate);
 return ages.length?Math.min(...ages):null;
}
function eventChoiceKey(item){
 return item.eventId+'::'+item.choiceId;
}
function childOutcome(child){
 return child.adultLife?.jobTitle??child.educationPlan??'minor/unknown';
}
function geneticRiskGroup(score){
 if(score<40)return 'low';
 if(score<65)return 'medium';
 return 'high';
}
function closeFamily(state){
 return [
  state.parents?.mother,state.parents?.father,
  state.grandparents?.maternal?.grandmother,state.grandparents?.maternal?.grandfather,
  state.grandparents?.paternal?.grandmother,state.grandparents?.paternal?.grandfather,
  ...(state.siblings??[])
 ].filter(Boolean);
}
function activeOrHistoricalPartners(state){
 return [
  ...(state.social?.exSpouses??[]),
  ...(state.social?.deceasedPartners??[]),
  ...(state.social?.romance?[state.social.romance]:[])
 ];
}

const lives=Math.max(1,Number(arg('lives','100')));
const toAge=Math.max(1,Number(arg('to-age','100')));
const policy=arg('policy','random');
const seedPrefix=arg('seed-prefix','fast-audit');

const report={
 config:{lives,toAge,policy,seedPrefix},
 runtimeMs:0,valid:0,invalid:0,deaths:0,

 population:{
  sex:{},birthCities:{},finalCities:{},childhoodClasses:{},siblingCounts:{},
  guardianTypes:{},orphaned:0,everMoved:0,hometownAtEnd:0,neverLeftHometown:0
 },

 traits:{
  personality:{discipline:[],sociability:[],curiosity:[],ambition:[],patience:[]},
  appearance:{attractiveness:[],build:[],heightCm:[]},
  constitution:[],
  preferences:{
   partnershipDesire:[],marriageDesire:[],parenthoodDesire:[],
   homeOwnershipDesire:[],carOwnershipDesire:[],riskTolerance:[],hometownAttachment:[]
  }
 },

 lifespan:{
  ages:[],ageBuckets:{},causes:{},healthAtDeath:[],conditionsAtDeath:[],
  deathsUnder40:0,deathsUnder60:0,deaths90Plus:0
 },

 family:{
  motherDeathAges:[],fatherDeathAges:[],grandparentLosses:0,siblingLosses:0,
  friendLosses:0,trustFunds:0,trustFundAmounts:[],inheritanceEvents:0,
  inheritanceAmounts:[],guardianshipHistories:0
 },

 education:{
  highSchoolPaths:{},schoolNames:{},performance:[],readiness:[],aptitude:[],
  universityAttempts:0,admissions:0,graduates:0,programs:{},universities:{},
  graduationAges:[],universityMoves:0,gapYears:[],degreeRelatedCareer:0
 },

 career:{
  employedAtEnd:0,retired:0,finalJobs:{},finalFamilies:{},
  transitions:[],totalExperience:[],jobYears:{},familyYears:{},
  promotions:0,firings:0,unemploymentStarts:0,firstJobAges:[],
  retirementAges:[],retirementSources:{},pensions:[],
  voluntaryUnrelated:0,forcedUnrelated:0,degreeBackedReturns:0,
  postBusinessDistant:0,sameOccupationReturns:0,
  exitReasons:{},issues:[]
 },

 business:{
  founded:0,activeAtEnd:0,fullTime:0,side:0,closed:0,retired:0,
  startAges:[],years:[],finalHealth:[],capital:[],profit:[],employees:[],saleValues:[]
 },

 relationships:{
  everRomance:0,activeAtEnd:0,marriedAtEnd:0,everMarried:0,everCohabited:0,
  divorced:0,everWidowed:0,partnerDeaths:0,relationshipCounts:[],
  firstDatingAges:[],marriageAges:[],yearsTogether:[],compatibility:[],relationshipScore:[],
  children:[],childless:0,marriedChildless:0,grandchildren:[],
  childOutcomes:{},childEducationPlans:{}
 },

 social:{
  finalFriends:[],friendsCreated:0,deceasedFriends:[],firstFriendAges:[]
 },

 migration:{
  moves:[],movers:0,returnHomeLives:0,reasons:{},routes:{},moveAges:[],costs:[],
  firstMoveAges:[],lastMoveAges:[],finalResidenceYears:[],moveAgeBuckets:{},
  originDepartures:{},destinationArrivals:{},movesBySex:{},returnHomeBySex:{},
  universityMoves:0,partnerMoves:0,careerMoves:0,jobMoves:0
 },

 health:{
  finalHealth:[],physicalCapacity:[],stress:[],fitness:[],conditionCounts:[],conditions:{},
  progressionStages:{},progressionStatuses:{},complications:[],
  diagnosisAges:{},treated:0,untreated:0,treatmentSuccess:0,treatmentFailure:0,
  treatmentAges:[],geneticDiagnoses:0,deathHealthHigh70:0,deathHealthLow25:0,
  checkups:0
 },

 genetics:{
  affectedPeople:0,carrierPeople:0,affectedConditions:{},carrierConditions:{},
  polygenic:{hypertension:[],metabolic:[],cardiac:[]},
  riskGroups:{
   hypertension:{low:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0},medium:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0},high:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0}},
   metabolic:{low:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0},medium:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0},high:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0}},
   cardiac:{low:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0},medium:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0},high:{n:0,diagnosed:0,diagnosisAges:[],critical:0,complications:0}}
  }
 },

 finance:{
  cash:[],savings:[],liquidReserves:[],debt:[],netWorth:[],wealthBuckets:{},
  distressYears:[],distressEvents:[],restructured:0,discretionaryAnnual:[],
  monthlyIncome:[],monthlyExpenses:[],tax:[],familySupport:[],partnerContribution:[],
  childCosts:[],homeOwners:0,carOwners:0,homePurchaseAges:[],carPurchaseAges:[],
  homePrices:[],carPrices:[],estateNet:[],inheritanceReceived:[]
 },

 world:{
  recessions:0,booms:0,healthCostShocks:0,
  finalLaborMarket:[],finalCostOfLiving:[],finalWageIndex:[],finalHealthcareCost:[],finalConfidence:[]
 },

 segments:{
  bySex:{},byBirthCity:{},byChildhoodClass:{}
 },

 pacing:{
  adultMajorDecisions:[],adjacentMajorDecisionLives:0,categories:{},eventIds:{}
 },

 events:{
  historyKinds:{},eventIds:{},choiceIds:{},eventChoicePairs:{},activities:{},
  socialActivities:{},physicalActivities:{},hobbies:{},relationshipInteractions:[],
  ageByEvent:{},ageByActivity:{},historyRows:[]
 },

 longitudinal:{
  byAge:{}
 },

 correlations:{
  rows:[]
 },

 samples:{
  invalid:[],careerIssues:[],extremeDebt:[],extremeCash:[],youngDeaths:[],highHealthDeaths:[]
 }
};

function recordSegment(container,key,state,netWorth){
 const bucket=container[key]??={
  n:0,ages:[],health:[],fitness:[],conditions:[],children:[],moves:[],income:[],netWorth:[],
  married:0,everMarried:0,graduated:0,employed:0,retired:0,homeOwners:0,carOwners:0
 };
 bucket.n++;
 bucket.ages.push(state.player.age??0);
 bucket.health.push(state.player.health.current??0);
 bucket.fitness.push(state.healthProfile?.fitness??0);
 bucket.conditions.push(state.healthProfile?.conditions?.length??0);
 bucket.children.push(state.children?.length??0);
 bucket.moves.push(state.migrationHistory?.length??0);
 bucket.income.push(state.finance?.monthlyIncome??state.player.monthlyIncome??0);
 bucket.netWorth.push(netWorth);
 bucket.married+=state.social?.romance?.status==='married'?1:0;
 bucket.everMarried+=(state.marriageHistory?.length??0)>0||state.social?.romance?.status==='married'?1:0;
 bucket.graduated+=state.higherEducation?.completed?1:0;
 bucket.employed+=state.career?.employed?1:0;
 bucket.retired+=state.retirement?.retired?1:0;
 bucket.homeOwners+=state.assets?.home?1:0;
 bucket.carOwners+=state.assets?.car?1:0;
}

function summarizeSegments(container){
 return Object.fromEntries(Object.entries(container).map(([key,b])=>[key,{
  n:b.n,
  lifespan:distribution(b.ages),
  health:distribution(b.health),
  fitness:distribution(b.fitness),
  conditions:distribution(b.conditions),
  children:distribution(b.children),
  moves:distribution(b.moves),
  monthlyIncome:distribution(b.income),
  netWorth:distribution(b.netWorth),
  marriedAtEndPct:pct(b.married,b.n),
  everMarriedPct:pct(b.everMarried,b.n),
  graduatePct:pct(b.graduated,b.n),
  employedAtEndPct:pct(b.employed,b.n),
  retiredPct:pct(b.retired,b.n),
  homeOwnershipPct:pct(b.homeOwners,b.n),
  carOwnershipPct:pct(b.carOwners,b.n)
 }]));
}

function recordSnapshot(state){
 const age=state.player.age;
 if(age<10||age%5!==0)return;
 const key=String(age);
 const bucket=report.longitudinal.byAge[key]??={
  n:0,alive:0,health:0,capacity:0,stress:0,fitness:0,cash:0,savings:0,debt:0,income:0,
  employed:0,retired:0,married:0,children:0,conditions:0,friends:0,moves:0
 };
 bucket.n++;
 bucket.alive+=state.player.alive?1:0;
 bucket.health+=state.player.health.current??0;
 bucket.capacity+=physicalCapacity(state);
 bucket.stress+=state.healthProfile?.stress??0;
 bucket.fitness+=state.healthProfile?.fitness??0;
 bucket.cash+=state.finance?.cash??0;
 bucket.savings+=state.finance?.savings??0;
 bucket.debt+=state.finance?.debt??0;
 bucket.income+=state.finance?.monthlyIncome??state.player.monthlyIncome??0;
 bucket.employed+=state.career?.employed?1:0;
 bucket.retired+=state.retirement?.retired?1:0;
 bucket.married+=state.social?.romance?.status==='married'?1:0;
 bucket.children+=state.children?.length??0;
 bucket.conditions+=state.healthProfile?.conditions?.length??0;
 bucket.friends+=state.social?.friends?.length??0;
 bucket.moves+=state.migrationHistory?.length??0;
}

const started=performance.now();

for(let i=0;i<lives;i++){
 const game=new Game(seedPrefix+'-'+policy+'-'+i);

 try{
  autoplay(game,{toAge,policy,onYear:recordSnapshot});
 }catch(error){
  report.invalid++;
  if(report.samples.invalid.length<12)report.samples.invalid.push({seed:game.seedText,error:error.message});
  continue;
 }

 const state=game.state;
 const violations=validateState(state);
 if(violations.length){
  report.invalid++;
  if(report.samples.invalid.length<12)report.samples.invalid.push({seed:game.seedText,error:violations.join('; ')});
  continue;
 }
 report.valid++;

 // Population / origin
 inc(report.population.sex,state.player.sex??'unknown');
 inc(report.population.birthCities,state.origin?.cityName??'unknown');
 inc(report.population.finalCities,state.location?.cityName??state.origin?.cityName??'unknown');
 inc(report.population.childhoodClasses,state.player.background?.childhoodClass??state.household?.economicClass??'unknown');
 inc(report.population.siblingCounts,String(state.siblings?.length??0));
 if(state.guardianship){
  report.population.orphaned++;
  inc(report.population.guardianTypes,state.guardianship.type??'unknown');
 }
 report.family.guardianshipHistories+=state.guardianshipHistory?.length??0;

 // Traits
 for(const key of Object.keys(report.traits.personality))report.traits.personality[key].push(state.player.personality?.[key]??0);
 for(const key of Object.keys(report.traits.appearance))report.traits.appearance[key].push(state.player.appearance?.[key]??0);
 report.traits.constitution.push(state.player.health?.constitution??0);
 for(const key of Object.keys(report.traits.preferences)){
  if(state.preferences?.[key]!=null)report.traits.preferences[key].push(state.preferences[key]);
 }

 // Lifespan / death
 const age=state.player.age;
 report.lifespan.ages.push(age);
 inc(report.lifespan.ageBuckets,ageBucket(age));
 if(!state.player.alive){
  report.deaths++;
  const cause=state.death?.cause??'unknown';
  inc(report.lifespan.causes,cause);
  report.lifespan.healthAtDeath.push(state.player.health.current??0);
  report.lifespan.conditionsAtDeath.push(state.healthProfile?.conditions?.length??0);
  if(age<40)report.lifespan.deathsUnder40++;
  if(age<60)report.lifespan.deathsUnder60++;
  if(age>=90)report.lifespan.deaths90Plus++;
  if((state.player.health.current??0)>=70){
   report.health.deathHealthHigh70++;
   if(report.samples.highHealthDeaths.length<12)report.samples.highHealthDeaths.push({seed:game.seedText,age,cause,health:state.player.health.current});
  }
  if((state.player.health.current??0)<25)report.health.deathHealthLow25++;
  if(age<45&&report.samples.youngDeaths.length<12)report.samples.youngDeaths.push({seed:game.seedText,age,cause,health:state.player.health.current});
 }

 // Family / loss / inheritance
 if(state.parents?.mother&&!state.parents.mother.alive&&state.parents.mother.deathAge!=null)report.family.motherDeathAges.push(state.parents.mother.deathAge);
 if(state.parents?.father&&!state.parents.father.alive&&state.parents.father.deathAge!=null)report.family.fatherDeathAges.push(state.parents.father.deathAge);
 report.family.grandparentLosses+=[
  state.grandparents?.maternal?.grandmother,state.grandparents?.maternal?.grandfather,
  state.grandparents?.paternal?.grandmother,state.grandparents?.paternal?.grandfather
 ].filter(p=>p&&!p.alive).length;
 report.family.siblingLosses+=(state.siblings??[]).filter(p=>!p.alive).length;
 report.family.friendLosses+=state.social?.deceasedFriends?.length??0;
 if(state.trustFund?.released){
  report.family.trustFunds++;
  report.family.trustFundAmounts.push(state.trustFund.balance??0);
 }
 const inheritanceHistory=state.inheritanceHistory??[];
 report.family.inheritanceEvents+=inheritanceHistory.length;
 for(const item of inheritanceHistory)report.family.inheritanceAmounts.push(item.amount??0);

 // Education
 inc(report.education.highSchoolPaths,state.education?.pathLabel??state.education?.path??'unknown');
 if(state.education?.schoolName)inc(report.education.schoolNames,state.education.schoolName);
 report.education.performance.push(state.education?.performance??0);
 report.education.readiness.push(state.education?.graduationReadiness??0);
 report.education.aptitude.push(state.education?.aptitude??0);
 report.education.universityAttempts+=historyCount(state,x=>x.kind==='choice'&&x.eventId==='university-application');
 report.education.admissions+=state.education?.admissionSucceeded?1:0;
 report.education.gapYears.push(state.gapYears??0);
 if(state.higherEducation?.movedForUniversity){
  report.education.universityMoves++;
  report.migration.universityMoves++;
 }
 if(state.higherEducation?.completed){
  report.education.graduates++;
  inc(report.education.programs,state.higherEducation.programTitle??'unknown');
  inc(report.education.universities,state.higherEducation.universityName??'unknown');
  const gradAge=firstAge(state,x=>x.kind==='education'&&String(x.text??'').includes('mezun oldun'));
  if(gradAge!=null)report.education.graduationAges.push(gradAge);
 }
 if(state.career?.degreeRelated)report.education.degreeRelatedCareer++;

 // Career
 if(state.career?.employed)report.career.employedAtEnd++;
 if(state.retirement?.retired){
  report.career.retired++;
  if(state.retirement.retiredAtAge!=null)report.career.retirementAges.push(state.retirement.retiredAtAge);
  inc(report.career.retirementSources,state.retirement.source??'unknown');
  report.career.pensions.push(state.retirement.pensionMonthly??0);
 }
 if(state.career?.title)inc(report.career.finalJobs,state.career.title);
 if(state.career?.family)inc(report.career.finalFamilies,state.career.family);
 report.career.transitions.push(careerTransitionCount(state));
 report.career.totalExperience.push(state.careerProfile?.totalExperience??state.career?.totalYears??0);
 for(const [jobId,years] of Object.entries(state.careerProfile?.experienceByJob??{}))inc(report.career.jobYears,jobId,years);
 for(const [family,years] of Object.entries(state.careerProfile?.experienceByFamily??{}))inc(report.career.familyYears,family,years);
 report.career.promotions+=historyCount(state,x=>x.kind==='career'&&String(x.text??'').startsWith('Terfi aldın'));
 report.career.firings+=historyCount(state,x=>x.kind==='career'&&String(x.text??'').includes('işinden çıkarıldın'));
 report.career.unemploymentStarts+=historyCount(state,x=>x.kind==='career'&&String(x.text??'').includes('işinden çıkarıldın'));
 const firstJobAge=firstAge(state,x=>x.kind==='choice'&&x.eventId==='first-job');
 if(firstJobAge!=null)report.career.firstJobAges.push(firstJobAge);
 for(const item of state.careerProfile?.recentJobs??[])inc(report.career.exitReasons,item.reason??'unknown');

 const careerIssues=auditCareerTransitions(state);
 for(const issue of careerIssues){
  if(issue.type==='voluntary-unrelated-switch')report.career.voluntaryUnrelated++;
  if(issue.type==='forced-unrelated-reemployment')report.career.forcedUnrelated++;
  if(issue.type==='degree-backed-return')report.career.degreeBackedReturns++;
  if(issue.type==='post-business-distant-reentry')report.career.postBusinessDistant++;
  if(issue.type==='same-occupation-return')report.career.sameOccupationReturns++;
  if(report.samples.careerIssues.length<20)report.samples.careerIssues.push({seed:game.seedText,...issue});
 }
 report.career.issues.push(...careerIssues.map(x=>x.type));

 // Business
 if(state.business){
  report.business.founded++;
  if(state.business.active)report.business.activeAtEnd++;
  inc(report.business,state.business.mode==='full-time'?'fullTime':'side');
  if(state.business.exitType==='closure')report.business.closed++;
  if(state.business.exitType==='retirement-sale')report.business.retired++;
  report.business.startAges.push(state.business.startedAtAge??0);
  report.business.years.push(state.business.years??0);
  report.business.finalHealth.push(state.business.health??0);
  report.business.capital.push(state.business.capital??0);
  report.business.profit.push(state.business.monthlyProfit??0);
  report.business.employees.push(state.business.employees??0);
  if(state.business.saleValue!=null)report.business.saleValues.push(state.business.saleValue);
 }

 // Relationships / children
 const partners=activeOrHistoricalPartners(state);
 if(partners.length)report.relationships.everRomance++;
 report.relationships.relationshipCounts.push(partners.length);
 const romance=state.social?.romance;
 if(romance)report.relationships.activeAtEnd++;
 if(romance?.status==='married')report.relationships.marriedAtEnd++;
 if(partners.some(p=>p.status==='cohabiting'||p.status==='married'))report.relationships.everCohabited++;
 const everMarried=partners.some(p=>p.status==='married')||state.widowedAtAge!=null;
 if(everMarried)report.relationships.everMarried++;
 if((state.social?.exSpouses?.length??0)>0)report.relationships.divorced++;
 if(state.widowedAtAge!=null)report.relationships.everWidowed++;
 report.relationships.partnerDeaths+=state.social?.deceasedPartners?.length??0;
 const datingAge=firstAge(state,x=>x.kind==='choice'&&x.eventId==='adult-dating'&&x.choiceId==='meet');
 if(datingAge!=null)report.relationships.firstDatingAges.push(datingAge);
 for(const p of partners){
  if(p.marriedAtAge!=null)report.relationships.marriageAges.push(p.marriedAtAge);
  if(p.yearsTogether!=null)report.relationships.yearsTogether.push(p.yearsTogether);
  if(p.compatibility!=null)report.relationships.compatibility.push(p.compatibility);
  if(p.relationship!=null)report.relationships.relationshipScore.push(p.relationship);
 }
 const children=state.children??[];
 report.relationships.children.push(children.length);
 if(children.length===0){
  report.relationships.childless++;
  if(everMarried)report.relationships.marriedChildless++;
 }
 report.relationships.grandchildren.push(state.grandchildren??0);
 for(const child of children){
  inc(report.relationships.childOutcomes,childOutcome(child));
  if(child.educationPlan)inc(report.relationships.childEducationPlans,child.educationPlan);
 }

 // Social
 report.social.finalFriends.push(state.social?.friends?.length??0);
 report.social.deceasedFriends.push(state.social?.deceasedFriends?.length??0);
 report.social.friendsCreated+=historyCount(state,x=>x.kind==='social'&&String(x.text??'').includes('ile arkadaş oldun'));
 const firstFriend=firstAge(state,x=>x.kind==='social'&&String(x.text??'').includes('ile arkadaş oldun'));
 if(firstFriend!=null)report.social.firstFriendAges.push(firstFriend);

 // Migration
 const moves=state.migrationHistory??[];
 report.migration.moves.push(moves.length);
 const sex=state.player.sex??'unknown';
 const originCity=state.origin?.cityName??'unknown';
 const finalCity=state.location?.cityName??originCity;
 if(moves.length){
  report.migration.movers++;
  report.population.everMoved++;
  const ages=moves.map(move=>move.age).filter(Number.isFinite);
  if(ages.length){
   report.migration.firstMoveAges.push(Math.min(...ages));
   report.migration.lastMoveAges.push(Math.max(...ages));
  }
 }else if(finalCity===originCity){
  report.population.neverLeftHometown++;
 }
 if(finalCity===originCity)report.population.hometownAtEnd++;
 if(state.location?.sinceYear!=null)report.migration.finalResidenceYears.push(Math.max(0,state.year-state.location.sinceYear));
 let returned=false;
 for(const move of moves){
  const reason=move.reason??'unknown';
  inc(report.migration.reasons,reason);
  inc(report.migration.routes,(move.fromCityName??'?')+' -> '+(move.toCityName??'?'));
  inc(report.migration.originDepartures,move.fromCityName??'?');
  inc(report.migration.destinationArrivals,move.toCityName??'?');
  inc(report.migration.movesBySex,sex);
  inc(report.migration.moveAgeBuckets,ageBucket(move.age??0));
  report.migration.moveAges.push(move.age??0);
  report.migration.costs.push(move.cost??0);
  if(reason==='return-home')returned=true;
  if(reason==='partner-job')report.migration.partnerMoves++;
  if(reason==='career-switch')report.migration.careerMoves++;
  if(reason==='job')report.migration.jobMoves++;
  if(reason==='university')report.migration.universityMoves++;
 }
 if(returned){report.migration.returnHomeLives++;inc(report.migration.returnHomeBySex,sex);}

 // Health
 report.health.finalHealth.push(state.player.health.current??0);
 report.health.physicalCapacity.push(physicalCapacity(state));
 report.health.stress.push(state.healthProfile?.stress??0);
 report.health.fitness.push(state.healthProfile?.fitness??0);
 const conditions=state.healthProfile?.conditions??[];
 report.health.conditionCounts.push(conditions.length);
 for(const condition of conditions){
  inc(report.health.conditions,condition.label??condition.id);
  push(report.health.diagnosisAges,condition.label??condition.id,condition.diagnosedAtAge??state.player.age);
  if(condition.progression){
   inc(report.health.progressionStages,condition.progression.stage??'unknown');
   inc(report.health.progressionStatuses,condition.progression.status??'unknown');
   report.health.complications.push(condition.progression.complicationCount??0);
  }
  if(condition.genetic)report.health.geneticDiagnoses++;
  if(condition.treated){
   report.health.treated++;
   if(condition.treatmentAge!=null)report.health.treatmentAges.push(condition.treatmentAge);
   if(condition.treatmentSuccessful)report.health.treatmentSuccess++;
   else report.health.treatmentFailure++;
  }else report.health.untreated++;
 }
 report.health.checkups+=historyCount(state,x=>x.kind==='activity'&&x.activityId==='checkup');

 // Genetics
 const genetics=geneticSummary(state.player);
 if(genetics.affected.length)report.genetics.affectedPeople++;
 if(genetics.carriers.length)report.genetics.carrierPeople++;
 for(const label of genetics.affected)inc(report.genetics.affectedConditions,label);
 for(const label of genetics.carriers)inc(report.genetics.carrierConditions,label);
 for(const trait of Object.keys(report.genetics.polygenic)){
  const score=genetics.polygenic?.[trait]??50;
  report.genetics.polygenic[trait].push(score);
  const group=geneticRiskGroup(score);
  const bucket=report.genetics.riskGroups[trait][group];
  bucket.n++;
  const diagnosedCondition=(state.healthProfile?.conditions??[]).find(condition=>condition.id===trait);
  if(diagnosedCondition){
   bucket.diagnosed++;
   if(diagnosedCondition.diagnosedAtAge!=null)bucket.diagnosisAges.push(diagnosedCondition.diagnosedAtAge);
   if(diagnosedCondition.progression?.stage==='critical')bucket.critical++;
   bucket.complications+=diagnosedCondition.progression?.complicationCount??0;
  }
 }

 // Finance / assets / estate
 const cash=state.finance?.cash??0;
 const savings=state.finance?.savings??0;
 const debt=state.finance?.debt??0;
 const homeValue=state.assets?.home?.price??0;
 const carValue=state.assets?.car?.price??0;
 const netWorth=cash+savings+homeValue+carValue-debt;
 recordSegment(report.segments.bySex,state.player.sex??'unknown',state,netWorth);
 recordSegment(report.segments.byBirthCity,state.origin?.cityName??'unknown',state,netWorth);
 recordSegment(report.segments.byChildhoodClass,state.player.background?.childhoodClass??state.household?.economicClass??'unknown',state,netWorth);
 report.finance.cash.push(cash);
 report.finance.savings.push(savings);
 report.finance.liquidReserves.push(cash+savings);
 report.finance.debt.push(debt);
 report.finance.distressYears.push(state.finance?.financialDistressYears??0);
 report.finance.distressEvents.push(state.finance?.financialDistressEvents??0);
 if(state.finance?.debtRestructured)report.finance.restructured++;
 report.finance.discretionaryAnnual.push(state.finance?.discretionaryAnnual??0);
 report.finance.netWorth.push(netWorth);
 inc(report.finance.wealthBuckets,wealthBucket(netWorth));
 report.finance.monthlyIncome.push(state.finance?.monthlyIncome??state.player.monthlyIncome??0);
 report.finance.monthlyExpenses.push(state.finance?.monthlyExpenses??0);
 report.finance.tax.push(state.finance?.monthlyTax??0);
 report.finance.familySupport.push(state.finance?.familySupportMonthly??0);
 report.finance.partnerContribution.push(state.finance?.partnerContributionMonthly??0);
 report.finance.childCosts.push(state.finance?.childMonthlyCost??0);
 if(state.assets?.home){
  report.finance.homeOwners++;
  if(state.assets.home.purchasedAtAge!=null)report.finance.homePurchaseAges.push(state.assets.home.purchasedAtAge);
  report.finance.homePrices.push(state.assets.home.price??0);
 }
 if(state.assets?.car){
  report.finance.carOwners++;
  if(state.assets.car.purchasedAtAge!=null)report.finance.carPurchaseAges.push(state.assets.car.purchasedAtAge);
  report.finance.carPrices.push(state.assets.car.price??0);
 }
 if(state.estate?.net!=null)report.finance.estateNet.push(state.estate.net);
 report.finance.inheritanceReceived.push((state.inheritanceHistory??[]).reduce((s,x)=>s+(x.amount??0),0));

 if(debt>5000000&&report.samples.extremeDebt.length<10)report.samples.extremeDebt.push({seed:game.seedText,age,debt,cash,savings});
 if(cash>5000000&&report.samples.extremeCash.length<10)report.samples.extremeCash.push({seed:game.seedText,age,cash,savings,debt});

 // World
 const world=state.world?.economy;
 if(world){
  report.world.finalLaborMarket.push(world.laborMarket);
  report.world.finalCostOfLiving.push(world.costOfLiving);
  report.world.finalWageIndex.push(world.wageIndex);
  report.world.finalHealthcareCost.push(world.healthcareCost);
  report.world.finalConfidence.push(world.confidence);
 }
 report.world.recessions+=historyCount(state,x=>x.kind==='world'&&String(x.text??'').includes('Ekonomik durgunluk'));
 report.world.booms+=historyCount(state,x=>x.kind==='world'&&String(x.text??'').includes('Güçlü ekonomik dönem'));
 report.world.healthCostShocks+=historyCount(state,x=>x.kind==='world'&&String(x.text??'').includes('Sağlık hizmetlerinin'));

 // Pacing / event telemetry
 const pacedNodes=(state.lifeTree?.nodes??[]).filter(n=>n.age>=21&&n.pacingCategory);
 report.pacing.adultMajorDecisions.push(pacedNodes.length);
 let adjacent=false;
 for(let n=1;n<pacedNodes.length;n++){
  if(pacedNodes[n].age-pacedNodes[n-1].age<2){adjacent=true;break;}
 }
 if(adjacent)report.pacing.adjacentMajorDecisionLives++;
 for(const node of pacedNodes){
  inc(report.pacing.categories,node.pacingCategory??'unknown');
  inc(report.pacing.eventIds,node.eventId??'unknown');
 }

 for(const item of state.history??[]){
  inc(report.events.historyKinds,item.kind??'unknown');
  if(item.eventId){
   inc(report.events.eventIds,item.eventId);
   push(report.events.ageByEvent,item.eventId,item.age);
  }
  if(item.choiceId)inc(report.events.choiceIds,item.choiceId);
  if(item.eventId&&item.choiceId)inc(report.events.eventChoicePairs,eventChoiceKey(item));
  if(item.kind==='activity'&&item.activityId){
   inc(report.events.activities,item.activityId);
   push(report.events.ageByActivity,item.activityId,item.age);
  }
  if(item.kind==='social-activity'&&item.activityId){
   inc(report.events.socialActivities,item.activityId);
   push(report.events.ageByActivity,'social:'+item.activityId,item.age);
  }
  if(item.kind==='physical-activity'&&item.activityId){
   inc(report.events.physicalActivities,item.activityId);
   push(report.events.ageByActivity,'physical:'+item.activityId,item.age);
  }
  if(item.kind==='hobby'&&item.hobbyId){
   inc(report.events.hobbies,item.hobbyId);
   push(report.events.ageByActivity,'hobby:'+item.hobbyId,item.age);
  }
 }
 report.events.historyRows.push(state.history?.length??0);
 report.events.relationshipInteractions.push(Object.values(state.relationshipMemories??{}).reduce((sum,m)=>sum+(m.interactions??0),0));

 // Correlation row: one row per valid life
 report.correlations.rows.push({
  age,
  health:state.player.health.current??0,
  physicalCapacity:physicalCapacity(state),
  conditions:conditions.length,
  constitution:state.player.health.constitution??0,
  discipline:state.player.personality?.discipline??0,
  sociability:state.player.personality?.sociability??0,
  ambition:state.player.personality?.ambition??0,
  attractiveness:state.player.appearance?.attractiveness??0,
  parenthoodDesire:state.preferences?.parenthoodDesire??0,
  partnershipDesire:state.preferences?.partnershipDesire??0,
  educationLevel:state.player.education?.level??0,
  graduated:state.higherEducation?.completed?1:0,
  employed:state.career?.employed?1:0,
  careerExperience:state.careerProfile?.totalExperience??0,
  children:children.length,
  everMarried:everMarried?1:0,
  friends:state.social?.friends?.length??0,
  cash,
  savings,
  debt,
  netWorth,
  migrations:moves.length,
  childhoodClass:['düşük','orta','üst-orta','yüksek'].indexOf(state.player.background?.childhoodClass??state.household?.economicClass)+1
 });
}

report.runtimeMs=Math.round(performance.now()-started);
const valid=Math.max(1,report.valid);

function averageAgeMap(map){
 const result={};
 for(const [key,values] of Object.entries(map))result[key]=distribution(values);
 return result;
}
function summarizeLongitudinal(){
 const out={};
 for(const [age,b] of Object.entries(report.longitudinal.byAge)){
  const n=Math.max(1,b.n);
  out[age]={
   n:b.n,
   survivalPct:pct(report.lifespan.ages.filter(finalAge=>finalAge>=Number(age)).length,valid),
   avgHealth:avg(b.health,n,1),
   avgPhysicalCapacity:avg(b.capacity,n,1),
   avgStress:avg(b.stress,n,1),
   avgFitness:avg(b.fitness,n,1),
   avgCash:Math.round(b.cash/n),
   avgSavings:Math.round(b.savings/n),
   avgDebt:Math.round(b.debt/n),
   avgMonthlyIncome:Math.round(b.income/n),
   employedPct:pct(b.employed,b.n),
   retiredPct:pct(b.retired,b.n),
   marriedPct:pct(b.married,b.n),
   avgChildren:avg(b.children,n),
   avgConditions:avg(b.conditions,n),
   avgFriends:avg(b.friends,n),
   avgMoves:avg(b.moves,n)
  };
 }
 return out;
}
function correlationSummary(rows){
 const keys=[
  'age','health','physicalCapacity','conditions','constitution','discipline','sociability','ambition','attractiveness',
  'parenthoodDesire','partnershipDesire','educationLevel','graduated','employed','careerExperience',
  'children','everMarried','friends','cash','savings','debt','netWorth','migrations','childhoodClass'
 ];
 const result={};
 const targets=['age','health','physicalCapacity','conditions','graduated','careerExperience','children','everMarried','netWorth'];
 for(const target of targets){
  result[target]={};
  for(const key of keys){
   if(key===target)continue;
   result[target][key]=correlation(rows.map(r=>r[target]),rows.map(r=>r[key]));
  }
 }
 return result;
}

const summary={
 config:report.config,
 runtime:{
  ms:report.runtimeMs,
  seconds:Number((report.runtimeMs/1000).toFixed(2)),
  livesPerSecond:Number((report.valid/(report.runtimeMs/1000)).toFixed(1))
 },
 validity:{valid:report.valid,invalid:report.invalid,invalidRatePct:pct(report.invalid,lives)},

 population:{
  sex:report.population.sex,
  sexPct:Object.fromEntries(Object.entries(report.population.sex).map(([k,v])=>[k,pct(v,valid)])),
  birthCities:report.population.birthCities,
  finalCities:report.population.finalCities,
  everMovedPct:pct(report.population.everMoved,valid),
  hometownAtEndPct:pct(report.population.hometownAtEnd,valid),
  neverLeftHometownPct:pct(report.population.neverLeftHometown,valid),
  childhoodClasses:report.population.childhoodClasses,
  siblingCounts:report.population.siblingCounts,
  orphanedPct:pct(report.population.orphaned,valid),
  guardianTypes:report.population.guardianTypes
 },

 traits:{
  personality:Object.fromEntries(Object.entries(report.traits.personality).map(([k,v])=>[k,distribution(v)])),
  appearance:Object.fromEntries(Object.entries(report.traits.appearance).map(([k,v])=>[k,distribution(v)])),
  constitution:distribution(report.traits.constitution),
  preferences:Object.fromEntries(Object.entries(report.traits.preferences).map(([k,v])=>[k,distribution(v)]))
 },

 lifespan:{
  ages:distribution(report.lifespan.ages),
  ageBuckets:report.lifespan.ageBuckets,
  deathsBeforeTargetPct:pct(report.deaths,lives),
  causes:report.lifespan.causes,
  healthAtDeath:distribution(report.lifespan.healthAtDeath),
  conditionsAtDeath:distribution(report.lifespan.conditionsAtDeath),
  deathUnder40Pct:pct(report.lifespan.deathsUnder40,valid),
  deathUnder60Pct:pct(report.lifespan.deathsUnder60,valid),
  death90PlusPct:pct(report.lifespan.deaths90Plus,valid)
 },

 family:{
  motherDeathAges:distribution(report.family.motherDeathAges),
  fatherDeathAges:distribution(report.family.fatherDeathAges),
  averageGrandparentLosses:avg(report.family.grandparentLosses,valid),
  averageSiblingLosses:avg(report.family.siblingLosses,valid),
  averageFriendLosses:avg(report.family.friendLosses,valid),
  trustFundPct:pct(report.family.trustFunds,valid),
  trustFundAmounts:distribution(report.family.trustFundAmounts),
  inheritanceEvents:report.family.inheritanceEvents,
  inheritanceAmounts:distribution(report.family.inheritanceAmounts),
  guardianshipHistoryCount:report.family.guardianshipHistories
 },

 education:{
  highSchoolPaths:report.education.highSchoolPaths,
  schools:report.education.schoolNames,
  performance:distribution(report.education.performance),
  readiness:distribution(report.education.readiness),
  aptitude:distribution(report.education.aptitude),
  universityAttemptsPerLife:avg(report.education.universityAttempts,valid),
  admissionPct:pct(report.education.admissions,valid),
  graduatePct:pct(report.education.graduates,valid),
  programs:report.education.programs,
  universities:report.education.universities,
  graduationAges:distribution(report.education.graduationAges),
  universityMovePct:pct(report.education.universityMoves,valid),
  gapYears:distribution(report.education.gapYears),
  finalCareerDegreeRelatedPct:pct(report.education.degreeRelatedCareer,valid)
 },

 career:{
  employedAtEndPct:pct(report.career.employedAtEnd,valid),
  retiredPct:pct(report.career.retired,valid),
  finalJobs:report.career.finalJobs,
  finalFamilies:report.career.finalFamilies,
  transitions:distribution(report.career.transitions),
  totalExperience:distribution(report.career.totalExperience),
  aggregateYearsByJob:report.career.jobYears,
  aggregateYearsByFamily:report.career.familyYears,
  promotionsPerLife:avg(report.career.promotions,valid),
  firingsPerLife:avg(report.career.firings,valid),
  firstJobAges:distribution(report.career.firstJobAges),
  retirementAges:distribution(report.career.retirementAges),
  retirementSources:report.career.retirementSources,
  pensions:distribution(report.career.pensions),
  exitReasons:report.career.exitReasons,
  anomalyAudit:{
   voluntaryUnrelatedSwitchCount:report.career.voluntaryUnrelated,
   forcedUnrelatedReemploymentCount:report.career.forcedUnrelated,
   degreeBackedReturnCount:report.career.degreeBackedReturns,
   postBusinessDistantReentryCount:report.career.postBusinessDistant,
   sameOccupationReturnCount:report.career.sameOccupationReturns,
   rapidVoluntaryReturnCount:report.career.rapidVoluntaryReturns
  }
 },

 business:{
  foundedPct:pct(report.business.founded,valid),
  activeAtEndPct:pct(report.business.activeAtEnd,valid),
  fullTimeCount:report.business.fullTime,
  sideCount:report.business.side,
  closedCount:report.business.closed,
  retiredCount:report.business.retired,
  startAges:distribution(report.business.startAges),
  years:distribution(report.business.years),
  finalHealth:distribution(report.business.finalHealth),
  capital:distribution(report.business.capital),
  monthlyProfit:distribution(report.business.profit),
  employees:distribution(report.business.employees),
  saleValues:distribution(report.business.saleValues)
 },

 relationships:{
  everRomancePct:pct(report.relationships.everRomance,valid),
  activeAtEndPct:pct(report.relationships.activeAtEnd,valid),
  marriedAtEndPct:pct(report.relationships.marriedAtEnd,valid),
  everMarriedPct:pct(report.relationships.everMarried,valid),
  everCohabitedPct:pct(report.relationships.everCohabited,valid),
  divorcedPct:pct(report.relationships.divorced,valid),
  everWidowedPct:pct(report.relationships.everWidowed,valid),
  partnerDeathsPerLife:avg(report.relationships.partnerDeaths,valid),
  relationshipCounts:distribution(report.relationships.relationshipCounts),
  firstDatingAges:distribution(report.relationships.firstDatingAges),
  marriageAges:distribution(report.relationships.marriageAges),
  yearsTogether:distribution(report.relationships.yearsTogether),
  compatibility:distribution(report.relationships.compatibility),
  relationshipScore:distribution(report.relationships.relationshipScore),
  children:distribution(report.relationships.children),
  childlessPct:pct(report.relationships.childless,valid),
  childlessAmongEverMarriedPct:pct(report.relationships.marriedChildless,Math.max(1,report.relationships.everMarried)),
  grandchildren:distribution(report.relationships.grandchildren),
  childOutcomes:report.relationships.childOutcomes,
  childEducationPlans:report.relationships.childEducationPlans
 },

 social:{
  finalFriends:distribution(report.social.finalFriends),
  friendsCreatedPerLife:avg(report.social.friendsCreated,valid),
  deceasedFriends:distribution(report.social.deceasedFriends),
  firstFriendAges:distribution(report.social.firstFriendAges)
 },

 migration:{
  moves:distribution(report.migration.moves),
  moverPct:pct(report.migration.movers,valid),
  returnHomePct:pct(report.migration.returnHomeLives,valid),
  returnHomeAmongMoversPct:pct(report.migration.returnHomeLives,report.migration.movers),
  reasons:report.migration.reasons,
  routes:report.migration.routes,
  moveAges:distribution(report.migration.moveAges),
  firstMoveAges:distribution(report.migration.firstMoveAges),
  lastMoveAges:distribution(report.migration.lastMoveAges),
  finalResidenceYears:distribution(report.migration.finalResidenceYears),
  moveAgeBuckets:report.migration.moveAgeBuckets,
  costs:distribution(report.migration.costs),
  originDepartures:report.migration.originDepartures,
  destinationArrivals:report.migration.destinationArrivals,
  movesBySex:report.migration.movesBySex,
  returnHomeBySex:report.migration.returnHomeBySex,
  universityMoves:report.migration.universityMoves,
  partnerMoves:report.migration.partnerMoves,
  careerMoves:report.migration.careerMoves,
  jobMoves:report.migration.jobMoves
 },

 health:{
  finalHealth:distribution(report.health.finalHealth),
  physicalCapacity:distribution(report.health.physicalCapacity),
  stress:distribution(report.health.stress),
  fitness:distribution(report.health.fitness),
  conditionCounts:distribution(report.health.conditionCounts),
  conditions:report.health.conditions,
  progressionStages:report.health.progressionStages,
  progressionStatuses:report.health.progressionStatuses,
  complications:distribution(report.health.complications),
  diagnosisAges:averageAgeMap(report.health.diagnosisAges),
  treatedCount:report.health.treated,
  untreatedCount:report.health.untreated,
  treatmentSuccessRatePct:pct(report.health.treatmentSuccess,report.health.treated),
  treatmentFailureRatePct:pct(report.health.treatmentFailure,report.health.treated),
  treatmentAges:distribution(report.health.treatmentAges),
  geneticDiagnosisCount:report.health.geneticDiagnoses,
  health70PlusAmongDeathsPct:pct(report.health.deathHealthHigh70,Math.max(1,report.deaths)),
  healthUnder25AmongDeathsPct:pct(report.health.deathHealthLow25,Math.max(1,report.deaths)),
  checkupsPerLife:avg(report.health.checkups,valid)
 },

 genetics:{
  affectedPct:pct(report.genetics.affectedPeople,valid),
  carrierPct:pct(report.genetics.carrierPeople,valid),
  affectedConditions:report.genetics.affectedConditions,
  carrierConditions:report.genetics.carrierConditions,
  polygenic:Object.fromEntries(Object.entries(report.genetics.polygenic).map(([k,v])=>[k,distribution(v)])),
  riskGroups:Object.fromEntries(Object.entries(report.genetics.riskGroups).map(([trait,groups])=>[
   trait,
   Object.fromEntries(Object.entries(groups).map(([group,b])=>[group,{
    n:b.n,
    diagnosisPct:pct(b.diagnosed,b.n),
    diagnosisAges:distribution(b.diagnosisAges),
    criticalAmongDiagnosedPct:pct(b.critical,b.diagnosed),
    complicationsPerDiagnosed:avg(b.complications,b.diagnosed)
   }]))
  ]))
 },

 finance:{
  cash:distribution(report.finance.cash),
  savings:distribution(report.finance.savings),
  liquidReserves:distribution(report.finance.liquidReserves),
  debt:distribution(report.finance.debt),
  netWorth:distribution(report.finance.netWorth),
  wealthBuckets:report.finance.wealthBuckets,
  distressYears:distribution(report.finance.distressYears),
  distressEvents:distribution(report.finance.distressEvents),
  restructuredPct:pct(report.finance.restructured,valid),
  discretionaryAnnual:distribution(report.finance.discretionaryAnnual),
  monthlyIncome:distribution(report.finance.monthlyIncome),
  monthlyExpenses:distribution(report.finance.monthlyExpenses),
  monthlyTax:distribution(report.finance.tax),
  familySupport:distribution(report.finance.familySupport),
  partnerContribution:distribution(report.finance.partnerContribution),
  childCosts:distribution(report.finance.childCosts),
  homeOwnershipPct:pct(report.finance.homeOwners,valid),
  carOwnershipPct:pct(report.finance.carOwners,valid),
  homePurchaseAges:distribution(report.finance.homePurchaseAges),
  carPurchaseAges:distribution(report.finance.carPurchaseAges),
  homePrices:distribution(report.finance.homePrices),
  carPrices:distribution(report.finance.carPrices),
  estateNet:distribution(report.finance.estateNet),
  inheritanceReceived:distribution(report.finance.inheritanceReceived)
 },

 segments:{
  bySex:summarizeSegments(report.segments.bySex),
  byBirthCity:summarizeSegments(report.segments.byBirthCity),
  byChildhoodClass:summarizeSegments(report.segments.byChildhoodClass)
 },

 world:{
  recessionsPerLife:avg(report.world.recessions,valid),
  boomsPerLife:avg(report.world.booms,valid),
  healthCostShocksPerLife:avg(report.world.healthCostShocks,valid),
  finalLaborMarket:distribution(report.world.finalLaborMarket),
  finalCostOfLiving:distribution(report.world.finalCostOfLiving),
  finalWageIndex:distribution(report.world.finalWageIndex),
  finalHealthcareCost:distribution(report.world.finalHealthcareCost),
  finalConfidence:distribution(report.world.finalConfidence)
 },

 pacing:{
  adultMajorDecisions:distribution(report.pacing.adultMajorDecisions),
  adjacentMajorDecisionLivesPct:pct(report.pacing.adjacentMajorDecisionLives,valid),
  categories:report.pacing.categories,
  eventIds:report.pacing.eventIds
 },

 events:{
  historyKinds:report.events.historyKinds,
  eventIds:report.events.eventIds,
  choiceIds:report.events.choiceIds,
  eventChoicePairs:report.events.eventChoicePairs,
  activities:report.events.activities,
  socialActivities:report.events.socialActivities,
  physicalActivities:report.events.physicalActivities,
  hobbies:report.events.hobbies,
  relationshipInteractions:distribution(report.events.relationshipInteractions),
  eventAgeDistributions:averageAgeMap(report.events.ageByEvent),
  activityAgeDistributions:averageAgeMap(report.events.ageByActivity),
  historyRowsPerLife:distribution(report.events.historyRows)
 },

 longitudinal:summarizeLongitudinal(),
 correlations:correlationSummary(report.correlations.rows),
 samples:report.samples
};

console.log('FAST SIMULATION FULL TELEMETRY');
console.log(JSON.stringify(summary,null,2));
if(report.invalid>0)process.exitCode=1;
