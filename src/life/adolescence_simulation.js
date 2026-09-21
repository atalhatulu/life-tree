import {changeTrait} from '../character/personality_dynamics.js';
import {enterMiddleSchool,graduationReadiness} from '../education/pathways.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function processAdolescenceYear(state,rng){
 const entries=[];
 const age=state.player.age;
 if(age<10||age>18) return entries;

 if(age===10&&state.education?.stage==='primary'){
  if(enterMiddleSchool(state,rng.fork('middle-school'))){
   entries.push({age,kind:'education',text:state.education.schoolName+' okulunda ortaokula başladın.'});
  }
 }

 const p=state.player;
 const friends=state.social?.friends??[];
 const peerAverage=friends.length?friends.reduce((sum,f)=>sum+(f.relationship??50),0)/friends.length:50;
 p.personality.sociability=changeTrait(p.personality.sociability,rng.int(-2,2)+(peerAverage>70?1:0));
 p.personality.ambition=changeTrait(p.personality.ambition,rng.int(-2,2)+(state.education?.performance>70?1:0));

 if(state.education?.enrolled){
  const stress=Math.max(0,(state.household.educationSupport-70)*.04)+(state.education.performance>80?1:0);
  state.education.motivation=clamp(state.education.motivation+rng.int(-3,3)-stress);
  state.education.attendance=clamp(state.education.attendance+rng.int(-2,1));
 }

 if(age===18&&state.education?.stage==='high'){
  state.education.graduationReadiness=graduationReadiness(state);
 }
 return entries;
}
