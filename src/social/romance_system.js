import {FIRST_NAMES,SURNAMES,JOBS} from '../data/catalog.js';
import {createPersonBase} from '../character/person.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function assignPartnerWork(person,rng){
 const eligible=JOBS.filter(j=>j.id!=='unemployed'&&j.educationMin<=3);
 const job=rng.weighted(eligible.map(value=>({value,weight:value.weight})));
 person.job=job.title;
 person.jobId=job.id;
 person.monthlyIncome=rng.int(job.income[0],Math.max(job.income[0],Math.round(job.income[1]*.7)));
}

export function createRomanticInterest(state,rng,id){
 const sex=rng.chance(.5)?'female':'male';
 const person=createPersonBase({id,name:rng.pick(FIRST_NAMES[sex]),surname:rng.pick(SURNAMES),sex,age:Math.max(14,state.player.age+rng.int(-1,1)),rng});
 person.role='romantic_interest';
 person.relationship=rng.int(42,70);
 person.cityId=state.location?.cityId??state.origin?.cityId;
 person.cityName=state.location?.cityName??state.origin?.cityName;
 assignPartnerWork(person,rng.fork('work'));
 return person;
}

export function processRomanceYear(state,rng){
 state.social??={friends:[],romance:null};
 if(state.social.romance===undefined) state.social.romance=null;
 const age=state.player.age;
 const entries=[];
 if(age<14||!state.social.romance) return entries;

 const partner=state.social.romance;
 partner.age+=1;

 // Ergenlikte ilişki daha basit bir modelle akar.
 // Yetişkinlikte ilişki kalitesi, uyumluluk, finansal baskı ve ölüm
 // partnership_system tarafından yönetilir.
 if(age<=18){
  partner.relationship=clamp(partner.relationship+rng.int(-6,5));
  if(partner.relationship<25&&rng.chance(.28)){
   entries.push({age,kind:'relationship',text:partner.name+' ile ilişkin sona erdi.'});
   state.social.romance=null;
  }
 }
 return entries;
}
