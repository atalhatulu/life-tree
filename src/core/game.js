import {RNG} from './rng.js';
import {generateFamily} from '../family/family_generator.js';
import {EventEngine} from '../events/event_engine.js';
import {childhoodEvents} from '../events/childhood_events.js';
export class Game{
 constructor(seed=String(Date.now())){this.seedText=String(seed);this.rng=new RNG(this.seedText);this.state=generateFamily(this.rng);this.state.year=2026;this.state.history=[];this.state.flags={completedEvents:[]};this.state.lifeTree={nodes:[]};this.events=new EventEngine(childhoodEvents);}
 ageOneYear(){this.state.player.age+=1;this.state.year+=1;for(const p of [this.state.parents.mother,this.state.parents.father,...this.state.siblings])p.age+=1;return this.events.choose(this.state,this.rng.fork(`year-${this.state.year}`));}
 makeChoice(event,choiceId){const r=this.events.resolve(this.state,event,choiceId);this.state=r.state;this.state.history.push({age:this.state.player.age,eventId:event.id,choiceId,result:r.result});if(r.decision)this.state.lifeTree.nodes.push(r.decision);return r.result;}
}
