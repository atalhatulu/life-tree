import {PHYSICAL_ACTIVITIES,physicalActivityById} from './physical_activity_catalog.js';
import {physicalCapacity,activityEfficiency} from './physical_capacity.js';
import {economy} from '../world/world_state.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function ageTrainingFactor(age){
 if(age<45)return 1;
 if(age<65)return .88;
 if(age<80)return .72;
 return .58;
}

function costFor(state,activity){return Math.round(activity.cost*(economy(state).costOfLiving??1));}

export function availablePhysicalActivities(state){
 const capacity=physicalCapacity(state);
 const cash=state.finance?.cash??0;
 return PHYSICAL_ACTIVITIES
  .map(a=>({...a,cost:costFor(state,a)}))
  .filter(a=>capacity>=a.minCapacity&&cash>=a.cost);
}

export function performPhysicalActivity(state,id,rng){
 state.actions??={remaining:3,max:3};
 if(state.actions.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 const activity=physicalActivityById(id);
 if(!activity)throw new Error('Geçersiz fiziksel aktivite.');
 const capacity=physicalCapacity(state);
 const cost=costFor(state,activity);
 if(capacity<activity.minCapacity)throw new Error('Fiziksel kapasiten bu aktivite için yeterli değil.');
 if(cost>(state.finance?.cash??0))throw new Error('Bu aktiviteyi karşılayacak nakdin yok.');

 if(cost>0)state.finance.cash-=cost;
 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 const efficiency=activityEfficiency(state)*ageTrainingFactor(state.player.age);
 const variation=1+rng.int(-1,1)*.08;
 const gain=Math.max(.3,activity.fitnessGain*efficiency*variation);
 state.healthProfile.fitness=clamp(state.healthProfile.fitness+gain);
 state.healthProfile.lastExerciseAge=state.player.age;
 state.healthProfile.exerciseSessions=(state.healthProfile.exerciseSessions??0)+1;
 state.healthProfile.stress=clamp(state.healthProfile.stress-activity.stressRelief);

 const currentBuild=state.player.appearance?.build??50;
 const physiqueTarget=clamp(30+state.healthProfile.fitness*.65+activity.buildFocus*8);
 const buildDelta=Math.max(0,(physiqueTarget-currentBuild)*.08*activity.buildFocus);
 state.player.appearance.build=clamp(currentBuild+buildDelta);

 state.actions.remaining-=1;
 return {
  activityId:id,
  activityLabel:activity.label,
  cost,
  fitnessGain:Number(gain.toFixed(2)),
  fitness:Number(state.healthProfile.fitness.toFixed(2)),
  build:Number(state.player.appearance.build.toFixed(2)),
  text:activity.label+' yaptın. Fitness +'+gain.toFixed(1)+'.'
 };
}
