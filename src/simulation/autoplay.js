import {RNG} from '../core/rng.js';
import {assertValidState} from './invariants.js';

function chooseByPolicy(game,event,policy,rng){
 const choices=game.eventChoices(event);
 if(!choices.length) return null;
 if(policy==='random') return rng.pick(choices);

 const preferred={
  academic:{'high-school-path':'academic','after-high-school':'university','first-romance':'leave','gap-year-direction':'retry-university'},
  social:{'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university'},
  vocational:{'high-school-path':'vocational','after-high-school':'work','first-romance':'approach','gap-year-direction':'seek-work'},
  balanced:{'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university'}
 }[policy]??{};
 const target=preferred[event.id];
 return choices.find(c=>c.id===target)??choices[0];
}

function activityOrder(game,policy,rng){
 if(policy==='academic') return ['study','hobby','exercise'];
 if(policy==='social') return ['socialize','hobby','exercise'];
 if(policy==='vocational') return ['hobby','study','exercise'];
 if(policy==='random'){
  const ids=game.availableActivities().map(a=>a.id);
  const shuffled=[];
  while(ids.length){
   const index=rng.int(0,ids.length-1);
   shuffled.push(ids.splice(index,1)[0]);
  }
  return shuffled;
 }
 return ['study','exercise','socialize'];
}

export function autoplay(game,{toAge=18,policy='balanced'}={}){
 const rng=new RNG(game.seedText+':autoplay:'+policy);
 while(game.state.player.age<toAge){
  const event=game.ageOneYear();
  if(event){
   const choice=chooseByPolicy(game,event,policy,rng.fork('event-'+game.state.year));
   if(choice) game.makeChoice(event,choice.id);
  }

  const order=activityOrder(game,policy,rng.fork('activities-'+game.state.year));
  for(const id of order){
   if(game.state.actions.remaining<=0) break;
   if(game.availableActivities().some(a=>a.id===id)){
    try{game.performActivity(id);}catch{}
   }
  }

  assertValidState(game.state);
 }
 return game.state;
}
