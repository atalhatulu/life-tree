import {RNG} from './rng.js';
import {generateFamily} from '../family/family_generator.js';
import {processFamilyYear} from '../family/family_simulation.js';
import {processChildhoodYear} from '../life/childhood_simulation.js';
import {processSocialYear} from '../social/social_simulation.js';
import {performActivity,availableActivities} from '../life/activity_system.js';
import {EventEngine} from '../events/event_engine.js';
import {childhoodEvents} from '../events/childhood_events.js';

export class Game{
 constructor(seed=String(Date.now())){
  this.seedText=String(seed);this.rng=new RNG(this.seedText);this.state=generateFamily(this.rng);
  this.state.year=2026;this.state.history=[];this.state.flags={completedEvents:[]};this.state.lifeTree={nodes:[]};
  this.state.social={friends:[]};this.state.actions={remaining:0,max:3};this.events=new EventEngine(childhoodEvents);
 }
 ageOneYear(){
  this.state.player.age+=1;this.state.year+=1;this.state.actions.remaining=this.state.player.age>=5?this.state.actions.max:0;
  const aging=[this.state.parents.mother,this.state.parents.father,...this.state.siblings,this.state.grandparents.maternal.grandmother,this.state.grandparents.maternal.grandfather,this.state.grandparents.paternal.grandmother,this.state.grandparents.paternal.grandfather];
  for(const p of aging)p.age+=1;
  const yearRng=this.rng.fork(`year-${this.state.year}`);
  const auto=[...processFamilyYear(this.state,yearRng.fork('family')),...processChildhoodYear(this.state,yearRng.fork('childhood')),...processSocialYear(this.state,yearRng.fork('social'))];
  this.state.history.push(...auto);
  return this.events.choose(this.state,yearRng.fork('event'));
 }
 makeChoice(event,choiceId){
  const choiceRng=this.rng.fork(`choice-${this.state.year}-${event.id}-${choiceId}`);
  const r=this.events.resolve(this.state,event,choiceId,choiceRng);this.state=r.state;
  this.state.history.push({age:this.state.player.age,eventId:event.id,choiceId,result:r.result,kind:'choice'});
  if(r.decision)this.state.lifeTree.nodes.push(r.decision);return r.result;
 }
 performActivity(id){
  const used=this.state.actions.max-this.state.actions.remaining;
  const result=performActivity(this.state,id,this.rng.fork(`activity-${this.state.year}-${used}-${id}`));
  this.state.history.push({age:this.state.player.age,kind:'activity',result});return result;
 }
 availableActivities(){return availableActivities(this.state);}
}
