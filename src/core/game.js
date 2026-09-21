import {RNG} from './rng.js';
import {generateFamily} from '../family/family_generator.js';
import {processFamilyYear} from '../family/family_simulation.js';
import {processElderFamilyYear} from '../family/elder_system.js';
import {releaseTrustFund} from '../finance/trust_fund.js';
import {ensureGuardianship} from '../family/guardianship_system.js';
import {processChildhoodYear} from '../life/childhood_simulation.js';
import {processAdolescenceYear} from '../life/adolescence_simulation.js';
import {processSocialYear} from '../social/social_simulation.js';
import {processRomanceYear} from '../social/romance_system.js';
import {processAdultYear} from '../life/adult_simulation.js';
import {performActivity,availableActivities} from '../life/activity_system.js';
import {EventEngine} from '../events/event_engine.js';
import {parseSave} from './save_system.js';
import {createDecisionSnapshot,restoreDecisionSnapshot} from '../timeline/snapshot.js';
import {childhoodEvents} from '../events/childhood_events.js';
import {adolescenceEvents} from '../events/adolescence_events.js';
import {adultEvents} from '../events/adult_events.js';
import {lateLifeEvents} from '../events/late_life_events.js';
import {parentingEvents} from '../events/parenting_events.js';
import {lateAgeEvents} from '../events/late_age_events.js';

export class Game{
 constructor(seed=String(Date.now())){
  this.seedText=String(seed);
  this.rng=new RNG(this.seedText);
  this.state=generateFamily(this.rng);
  this.state.year=2026;
  this.state.history=[];
  this.state.flags={completedEvents:[]};
  this.state.lifeTree={nodes:[]};
  this.state.social={friends:[],romance:null};
  this.state.actions={remaining:0,max:3};
  this.events=new EventEngine([...childhoodEvents,...adolescenceEvents,...adultEvents,...lateLifeEvents,...parentingEvents,...lateAgeEvents]);
 }

 static fromSave(payloadOrText){
  const payload=parseSave(payloadOrText);
  const game=new Game(payload.seedText);
  game.state=structuredClone(payload.state);
  game.rng.seed=payload.rng.seed>>>0;
  game.rng.state=payload.rng.state>>>0;
  return game;
 }

 static fromDecisionSnapshot(seedText,snapshot){
  const game=new Game(seedText);
  game.state=restoreDecisionSnapshot(snapshot);
  return game;
 }

 ageOneYear(){
  if(!this.state.player.alive) throw new Error('Bu hayat sona erdi.');
  this.state.player.age+=1;
  this.state.year+=1;
  this.state.actions.remaining=this.state.player.age>=5?this.state.actions.max:0;

  const aging=[
   this.state.parents.mother,this.state.parents.father,...this.state.siblings,
   this.state.grandparents.maternal.grandmother,this.state.grandparents.maternal.grandfather,
   this.state.grandparents.paternal.grandmother,this.state.grandparents.paternal.grandfather
  ];
  for(const person of aging) if(person.alive) person.age+=1;

  ensureGuardianship(this.state);

  const yearRng=this.rng.fork('year-'+this.state.year);
  const auto=[
   ...processFamilyYear(this.state,yearRng.fork('family')),
   ...processElderFamilyYear(this.state,yearRng.fork('family-loss')),
   ...releaseTrustFund(this.state),
   ...processChildhoodYear(this.state,yearRng.fork('childhood')),
   ...processSocialYear(this.state,yearRng.fork('social')),
   ...processAdolescenceYear(this.state,yearRng.fork('adolescence')),
   ...processRomanceYear(this.state,yearRng.fork('romance')),
   ...processAdultYear(this.state,yearRng.fork('adult'))
  ];
  this.state.history.push(...auto);
  if(!this.state.player.alive)return null;
  return this.events.choose(this.state,yearRng.fork('event'));
 }

 makeChoice(event,choiceId){
  const availableChoices=this.eventChoices(event);
  const selected=availableChoices.find(choice=>choice.id===choiceId);
  if(!selected)throw new Error('Unknown or unavailable choice: '+choiceId);

  const isMajor=Boolean(selected.majorDecision??event.majorDecision);
  const snapshot=isMajor?createDecisionSnapshot(this.state,event,availableChoices):null;

  const choiceRng=this.rng.fork('choice-'+this.state.year+'-'+event.id+'-'+choiceId);
  const resolved=this.events.resolve(this.state,event,choiceId,choiceRng);
  this.state=resolved.state;
  this.state.history.push({age:this.state.player.age,eventId:event.id,choiceId,result:resolved.result,kind:'choice'});
  if(resolved.decision){
   resolved.decision.snapshot=snapshot;
   this.state.lifeTree.nodes.push(resolved.decision);
  }
  return resolved.result;
 }

 branchFromNode(nodeIndex,choiceId){
  const node=this.state.lifeTree?.nodes?.[nodeIndex];
  if(!node?.snapshot)throw new Error('This Life Tree node has no branch snapshot.');
  const branched=Game.fromDecisionSnapshot(this.seedText,node.snapshot);
  const event=branched.events.events.find(candidate=>candidate.id===node.eventId);
  if(!event)throw new Error('Decision event no longer exists: '+node.eventId);
  branched.makeChoice(event,choiceId);
  return branched;
 }

 performActivity(id){
  const used=this.state.actions.max-this.state.actions.remaining;
  const result=performActivity(this.state,id,this.rng.fork('activity-'+this.state.year+'-'+used+'-'+id));
  this.state.history.push({age:this.state.player.age,kind:'activity',result});
  return result;
 }

 availableActivities(){return availableActivities(this.state);}
 eventChoices(event){return this.events.choicesFor(this.state,event);}
}
