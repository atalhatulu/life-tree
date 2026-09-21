import {HOBBY_ACTIVITIES,hobbyById} from './hobby_catalog.js';
import {activityEfficiency} from '../health/physical_capacity.js';
import {growTrait} from '../character/personality_dynamics.js';
import {economy} from '../world/world_state.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const costFor=(state,hobby)=>Math.round(hobby.cost*(economy(state).costOfLiving??1));

export function availableHobbies(state){
 const cash=state.finance?.cash??0;
 return HOBBY_ACTIVITIES
  .map(h=>({...h,cost:costFor(state,h)}))
  .filter(h=>h.cost<=cash);
}

export function performHobby(state,id,rng){
 state.actions??={remaining:3,max:3};
 if(state.actions.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 const hobby=hobbyById(id);
 if(!hobby)throw new Error('Geçersiz hobi.');
 const cost=costFor(state,hobby);
 if(cost>(state.finance?.cash??0))throw new Error('Bu hobi etkinliğini karşılayacak nakdin yok.');
 if(cost>0)state.finance.cash-=cost;

 state.player.interests??={};
 const current=state.player.interests[hobby.interest]??0;
 const familiarity=current/100;
 const skillGain=Math.max(.8,4.5*(1-familiarity*.65)*(1+rng.int(-1,1)*.08));
 state.player.interests[hobby.interest]=clamp(current+skillGain);

 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 state.healthProfile.stress=clamp(state.healthProfile.stress-hobby.stressRelief);

 if(hobby.physicalGain){
  const adaptation=Math.max(.20,1-(state.healthProfile.fitness??50)/120);
  const gain=hobby.physicalGain*activityEfficiency(state)*adaptation;
  state.healthProfile.fitness=clamp(state.healthProfile.fitness+gain);
  state.healthProfile.lastExerciseAge=state.player.age;
  state.healthProfile.exerciseSessions=(state.healthProfile.exerciseSessions??0)+1;
 }
 if(hobby.curiosityGain){
  state.player.personality.curiosity=growTrait(state.player.personality.curiosity,hobby.curiosityGain);
 }

 state.actions.remaining-=1;
 return {
  hobbyId:id,
  interest:hobby.interest,
  cost,
  interestGain:Number(skillGain.toFixed(2)),
  interestLevel:Number(state.player.interests[hobby.interest].toFixed(2)),
  text:hobby.label+' hobinle ilgilendin.'
 };
}
