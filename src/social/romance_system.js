import {FIRST_NAMES,SURNAMES} from '../data/catalog.js';
import {createPersonBase} from '../character/person.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function createRomanticInterest(state,rng,id){
 const sex=rng.chance(.5)?'female':'male';
 const person=createPersonBase({id,name:rng.pick(FIRST_NAMES[sex]),surname:rng.pick(SURNAMES),sex,age:Math.max(14,state.player.age+rng.int(-1,1)),rng});
 person.role='romantic_interest';
 person.relationship=rng.int(42,70);
 return person;
}

export function processRomanceYear(state,rng){
 state.social??={friends:[],romance:null};
 if(state.social.romance===undefined) state.social.romance=null;
 const age=state.player.age;
 const entries=[];
 if(age<14||age>18) return entries;
 if(state.social.romance){
  state.social.romance.age+=1;
  state.social.romance.relationship=clamp(state.social.romance.relationship+rng.int(-6,5));
  if(state.social.romance.relationship<25&&rng.chance(.28)){
   entries.push({age,kind:'relationship',text:state.social.romance.name+' ile ilişkin sona erdi.'});
   state.social.romance=null;
  }
 }
 return entries;
}
