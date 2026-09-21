import {performProceduralYearActions} from './procedural_player.js';
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

export function autoplay(game,{toAge=18,policy='balanced',onYear=null}={}){
 const rng=new RNG(game.seedText+':autoplay:'+policy);
 while(game.state.player.age<toAge&&game.state.player.alive){
  const event=game.ageOneYear();
  if(event&&game.state.player.alive){
   const choice=chooseByPolicy(game,event,policy,rng.fork('event-'+game.state.year));
   if(choice) game.makeChoice(event,choice.id);
  }

  if(!game.state.player.alive)break;
  performProceduralYearActions(game,policy,rng.fork('activities-'+game.state.year));
  assertValidState(game.state);
  if(typeof onYear==='function')onYear(game.state,{event});
 }
 return game.state;
}
