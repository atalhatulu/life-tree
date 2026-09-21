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
 assignPartnerWork(person,rng.fork('work'));
 return person;
}

export function processRomanceYear(state,rng){
 state.social??={friends:[],romance:null};
 if(state.social.romance===undefined) state.social.romance=null;
 const age=state.player.age;
 const entries=[];
 if(age<14) return entries;
 if(state.social.romance){
  state.social.romance.age+=1;
  state.social.romance.relationship=clamp(state.social.romance.relationship+rng.int(-6,5));
  if(state.social.romance.relationship<25&&rng.chance(.28)&&state.social.romance.status!=='married'){
   entries.push({age,kind:'relationship',text:state.social.romance.name+' ile ilişkin sona erdi.'});
   state.social.romance=null;
  }
 }
 return entries;
}
