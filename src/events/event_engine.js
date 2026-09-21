export class EventEngine{
 constructor(events=[]){this.events=events;}
 eligible(state){return this.events.filter(e=>{ if(e.once&&state.flags?.completedEvents?.includes(e.id)) return false; if(e.minAge!=null&&state.player.age<e.minAge)return false; if(e.maxAge!=null&&state.player.age>e.maxAge)return false; return !e.condition||e.condition(state);});}
 choose(state,rng){const c=this.eligible(state); if(!c.length)return null; return rng.weighted(c.map(event=>({value:event,weight:event.weight?.(state)??1})));}
 resolve(state,event,choiceId,rng){const choice=event.choices.find(c=>c.id===choiceId); if(!choice)throw new Error(`Unknown choice: ${choiceId}`); const next=structuredClone(state); choice.effect?.(next,rng); next.flags??={}; next.flags.completedEvents??=[]; if(event.once&&!next.flags.completedEvents.includes(event.id))next.flags.completedEvents.push(event.id); return {state:next,result:typeof choice.result==='function'?choice.result(next):choice.result,decision:event.majorDecision?{eventId:event.id,title:event.title,choiceId,label:choice.label,age:next.player.age,alternatives:event.choices.filter(c=>c.id!==choiceId).map(c=>({id:c.id,label:c.label}))}:null};}
}
