import {
 canPresentPacedEvent,
 shouldPresentEventThisYear,
 annotateDecisionPacing,
 recordPresentedEvent
} from '../life/pacing_system.js';

export class EventEngine{
 constructor(events=[]){this.events=events;}

 eligible(state){
  return this.events.filter(e=>{
   if(e.once&&state.flags?.completedEvents?.includes(e.id)) return false;
   if(e.minAge!=null&&state.player.age<e.minAge)return false;
   if(e.maxAge!=null&&state.player.age>e.maxAge)return false;
   if(e.condition&&!e.condition(state))return false;
   if(!canPresentPacedEvent(state,e))return false;
   return this.choicesFor(state,e).length>0;
  });
 }

 choicesFor(state,event){
  const raw=typeof event.choices==='function'?event.choices(state):event.choices;
  return raw.filter(choice=>!choice.condition||choice.condition(state));
 }

 choose(state,rng){
  const candidates=this.eligible(state);
  if(!candidates.length)return null;
  if(!shouldPresentEventThisYear(state,candidates,rng.fork('pacing')))return null;

  const maxPriority=Math.max(...candidates.map(e=>e.priority??0));
  const pool=candidates.filter(e=>(e.priority??0)===maxPriority);
  return rng.weighted(pool.map(event=>({value:event,weight:event.weight?.(state)??1})));
 }

 resolve(state,event,choiceId,rng){
  const choice=this.choicesFor(state,event).find(c=>c.id===choiceId);
  if(!choice)throw new Error('Unknown or unavailable choice: '+choiceId);

  const next=structuredClone(state);
  choice.effect?.(next,rng);

  next.flags??={};
  next.flags.completedEvents??=[];
  if(event.once&&!next.flags.completedEvents.includes(event.id))next.flags.completedEvents.push(event.id);

  recordPresentedEvent(next,event);

  const alternatives=this.choicesFor(state,event)
   .filter(c=>c.id!==choiceId)
   .map(c=>({id:c.id,label:c.label}));

  const decision=(choice.majorDecision??event.majorDecision)
   ? annotateDecisionPacing({
      eventId:event.id,
      title:event.title,
      choiceId,
      label:choice.label,
      age:next.player.age,
      alternatives
     },event)
   : null;

  return {
   state:next,
   result:typeof choice.result==='function'?choice.result(next):choice.result,
   decision
  };
 }
}
