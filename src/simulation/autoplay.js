import {RNG} from '../core/rng.js';
import {assertValidState} from './invariants.js';

function chooseByPolicy(game,event,policy,rng){
 const choices=game.eventChoices(event);
 if(!choices.length) return null;
 if(policy==='random') return rng.pick(choices);

 const common={
  'adult-lifestyle':'balanced',
  'move-out':'shared',
  'relationship-commitment':'cohabit',
  'marriage-after-cohabiting':'marry',
  'child-decision':'have-child',
  'buy-car':'car:used',
  'buy-home':'home:small-flat',
  'career-switch':'stay'
 };
 const preferred={
  academic:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'leave','gap-year-direction':'retry-university'},
  social:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university','relationship-commitment':'marry'},
  vocational:{...common,'high-school-path':'vocational','after-high-school':'work','first-romance':'approach','gap-year-direction':'seek-work','career-switch':null},
  balanced:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university'}
 }[policy]??common;

 const target=preferred[event.id];
 if(event.id==='career-switch'&&policy==='vocational'){
  const better=choices.find(c=>c.id!=='stay');
  if(better)return better;
 }
 return choices.find(c=>c.id===target)??choices[0];
}

function shuffled(ids,rng){
 const pool=[...ids],out=[];
 while(pool.length){const index=rng.int(0,pool.length-1);out.push(pool.splice(index,1)[0]);}
 return out;
}

function activityOrder(game,policy,rng){
 const age=game.state.player.age;
 if(policy==='random') return shuffled(game.availableActivities().map(a=>a.id),rng);
 if(age>=19){
  if(policy==='academic'&&game.state.higherEducation?.enrolled) return ['study','exercise','checkup'];
  if(policy==='social') return ['date','socialize','exercise','checkup'];
  if(policy==='vocational') return ['work-hard','budget','exercise','checkup'];
  return ['work-hard','exercise','budget','date','checkup'];
 }
 if(policy==='academic') return ['study','hobby','exercise'];
 if(policy==='social') return ['socialize','hobby','exercise'];
 if(policy==='vocational') return ['hobby','study','exercise'];
 return ['study','exercise','socialize'];
}

export function autoplay(game,{toAge=18,policy='balanced',onYear=null}={}){
 const rng=new RNG(game.seedText+':autoplay:'+policy);
 while(game.state.player.age<toAge&&game.state.player.alive){
  const event=game.ageOneYear();
  if(event&&game.state.player.alive){
   const choice=chooseByPolicy(game,event,policy,rng.fork('event-'+game.state.year));
   if(choice) game.makeChoice(event,choice.id);
  }

  if(!game.state.player.alive)break;
  const order=activityOrder(game,policy,rng.fork('activities-'+game.state.year));
  for(const id of order){
   if(game.state.actions.remaining<=0) break;
   if(game.availableActivities().some(a=>a.id===id)){
    try{game.performActivity(id);}catch{}
   }
  }
  assertValidState(game.state);
  if(typeof onYear==='function')onYear(game.state,{event});
 }
 return game.state;
}
