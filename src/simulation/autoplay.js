import {RNG} from '../core/rng.js';
import {assertValidState} from './invariants.js';

function chooseByPolicy(game,event,policy,rng){
 const choices=game.eventChoices(event);
 if(!choices.length) return null;
 const preferred={
  academic:{'high-school-path':'academic','after-high-school':'university','first-romance':'leave'},
  social:{'high-school-path':'academic','after-high-school':'university','first-romance':'approach'},
  vocational:{'high-school-path':'vocational','after-high-school':'work','first-romance':'approach'},
  balanced:{'high-school-path':'academic','after-high-school':'university','first-romance':'approach'}
 }[policy]??{};
 const target=preferred[event.id];
 return choices.find(c=>c.id===target)??rng.pick(choices);
}

function activityOrder(policy){
 if(policy==='academic') return ['study','hobby','exercise'];
 if(policy==='social') return ['socialize','hobby','exercise'];
 if(policy==='vocational') return ['hobby','study','exercise'];
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

  for(const id of activityOrder(policy)){
   if(game.state.actions.remaining<=0) break;
   if(game.availableActivities().some(a=>a.id===id)){
    try{game.performActivity(id);}catch{}
   }
  }

  assertValidState(game.state);
 }
 return game.state;
}
