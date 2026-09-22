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

function partnerPreferences(person,rng){
 return {
  partnershipDesire:clamp(Math.round(42+(person.personality?.sociability??50)*.28+rng.int(-12,12))),
  marriageDesire:clamp(Math.round(32+(person.personality?.patience??50)*.22+rng.int(-14,14))),
  parenthoodDesire:clamp(Math.round(38+(person.personality?.patience??50)*.18+rng.int(-16,16))),
  riskTolerance:clamp(Math.round(35+(person.personality?.ambition??50)*.30+rng.int(-12,12))),
  hometownAttachment:clamp(rng.int(28,82))
 };
}

export function createRomanticInterest(state,rng,id){
 const sex=rng.chance(.5)?'female':'male';
 const person=createPersonBase({id,name:rng.pick(FIRST_NAMES[sex]),surname:rng.pick(SURNAMES),sex,age:Math.max(14,state.player.age+rng.int(-2,2)),rng});
 person.role='romantic_interest';
 person.relationship=rng.int(46,68);
 person.cityId=state.location?.cityId??state.origin?.cityId;
 person.cityName=state.location?.cityName??state.origin?.cityName;
 person.preferences=partnerPreferences(person,rng.fork('preferences'));
 person.relationshipTension=rng.int(3,10);
 person.startedAtAge=state.player.age;
 person.relationshipState='stable';
 person.lastQualityTimeAge=null;
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

 // Ergenlik ilişkileri yetişkin partner sisteminden daha hafif tutulur.
 if(age<=18){
  partner.relationship=clamp(partner.relationship+rng.int(-5,4)-1);
  if(partner.relationship<25&&rng.chance(.32)){
   entries.push({age,kind:'relationship',text:partner.name+' ile ilişkin sona erdi.'});
   state.social.exPartners??=[];
   state.social.exPartners.push({...partner,status:'ended'});
   state.social.romance=null;
   state.nextDatingAge=19;
  }
 }
 return entries;
}
