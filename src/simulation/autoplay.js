import {chooseProceduralEventChoice} from './procedural_decision_agent.js';
import {performProceduralYearActions} from './procedural_player.js';
import {RNG} from '../core/rng.js';
import {assertValidState} from './invariants.js';

export function autoplay(game,{toAge=18,policy='balanced',onYear=null}={}){
 const rng=new RNG(game.seedText+':autoplay:'+policy);
 while(game.state.player.age<toAge&&game.state.player.alive){
  const event=game.ageOneYear();
  if(event&&game.state.player.alive){
   const choice=chooseProceduralEventChoice(game,event,policy,rng.fork('event-'+game.state.year));
   if(choice) game.makeChoice(event,choice.id);
  }

  if(!game.state.player.alive)break;
  performProceduralYearActions(game,policy,rng.fork('activities-'+game.state.year));
  assertValidState(game.state);
  if(typeof onYear==='function')onYear(game.state,{event});
 }
 return game.state;
}
