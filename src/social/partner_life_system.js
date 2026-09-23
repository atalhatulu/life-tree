import {JOBS} from '../data/catalog.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

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
 if(!partner||state.player.age<19)return entries;
 const life=ensurePartnerLife(partner);
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
 return entries;
}
