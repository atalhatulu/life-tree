import {RNG} from './rng.js';
import {generateFamily} from '../family/family_generator.js';
import {processFamilyYear} from '../family/family_simulation.js';
import {processChildhoodYear} from '../life/childhood_simulation.js';
import {EventEngine} from '../events/event_engine.js';
import {childhoodEvents} from '../events/childhood_events.js';

export class Game{
 constructor(seed=String(Date.now())){
  this.seedText=String(seed); this.rng=new RNG(this.seedText); this.state=generateFamily(this.rng);
  this.state.year=2026; this.state.history=[]; this.state.flags={completedEvents:[]}; this.state.lifeTree={nodes:[]};
  this.events=new EventEngine(childhoodEvents);
 }

 ageOneYear(){
  this.state.player.age+=1; this.state.year+=1;
  const agingMembers=[this.state.parents.mother,this.state.parents.father,...this.state.siblings,
   this.state.grandparents.maternal.grandmother,this.state.grandparents.maternal.grandfather,
   this.state.grandparents.paternal.grandmother,this.state.grandparents.paternal.grandfather];
  for(const person of agingMembers) person.age+=1;

  const yearRng=this.rng.fork(`year-${this.state.year}`);
  const auto=[...processFamilyYear(this.state,yearRng.fork('family')),...processChildhoodYear(this.state,yearRng.fork('childhood'))];
  this.state.history.push(...auto);
  return this.events.choose(this.state,yearRng.fork('event'));
 }

 makeChoice(event,choiceId){
  const r=this.events.resolve(this.state,event,choiceId); this.state=r.state;
  this.state.history.push({age:this.state.player.age,eventId:event.id,choiceId,result:r.result,kind:'choice'});
  if(r.decision)this.state.lifeTree.nodes.push(r.decision);
  return r.result;
 }
}
