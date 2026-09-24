import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice,activityOrder} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

// Diagnostic audit: report suspicious gameplay without silently treating
// subjective narrative quality as a machine-verifiable invariant.
const PERSONAS=['human-like','random','first-option','last-option'];
const AUDIT_LIVES=24;
const MAX_AGE=95;
const examples=(rows,max=4)=>rows.slice(0,max);
const countBy=(items,field)=>{
 const counts={};
 for(const item of items)counts[item[field]]=(counts[item[field]]??0)+1;
 return Object.fromEntries(Object.entries(counts).sort((a,b)=>b[1]-a[1]));
};
function play(index){
 const persona=PERSONAS[index%PERSONAS.length];
 const seed='decision-quality-audit-2026-'+String(index).padStart(3,'0')+'-'+persona;
 const game=new Game(seed),rng=new RNG(seed+':player');
 const observations=[],flags=[],offered=new Map();
 let lastEventId=null,consecutive=0,years=0;
 while(game.state.player.alive&&game.state.player.age<MAX_AGE){
  const event=game.ageOneYear();
  years++;
  if(!game.state.player.alive)break;
  if(event){
   const choices=game.eventChoices(event);
   const info={
    seed,persona,age:game.state.player.age,eventId:event.id,title:event.title,
    choiceIds:choices.map(c=>c.id),labels:choices.map(c=>c.label),
    city:game.state.location?.cityId,job:game.state.career?.jobId??null,
    employed:Boolean(game.state.career?.employed),
    enrolled:Boolean(game.state.higherEducation?.enrolled),
    cash:Math.round(game.state.finance?.cash??0),
    debt:Math.round(game.state.finance?.debt??0)
   };
   observations.push(info);
   offered.set(event.id,(offered.get(event.id)??0)+1);
   if(choices.length===1)flags.push({...info,kind:'single-visible-choice'});
   if(new Set(choices.map(c=>c.id)).size!==choices.length)
    flags.push({...info,kind:'duplicate-choice-id'});
   if(new Set(choices.map(c=>c.label.trim().toLocaleLowerCase('tr-TR'))).size!==choices.length)
    flags.push({...info,kind:'duplicate-choice-text'});
   if(choices.some(c=>!c.label?.trim()))
    flags.push({...info,kind:'empty-choice-text'});
   if(event.id==='first-job'&&!choices.some(c=>/reddet|ertele|bekle|aramaya devam|şimdilik/i.test(c.label)))
    flags.push({...info,kind:'forced-job-offer'});
   if(event.id==='university-application'&&!choices.some(c=>/ertele|bekle|başvurma|vazgeç/i.test(c.label)))
    flags.push({...info,kind:'forced-university-application'});
   if(lastEventId===event.id)consecutive++;else consecutive=1;
   if(consecutive>=3)flags.push({...info,kind:'same-event-3-consecutive-years',repeats:consecutive});
   lastEventId=event.id;
   const pick=persona==='first-option'?choices[0]:persona==='last-option'?choices.at(-1):
    persona==='random'?rng.pick(choices):humanLikeChoice(game,event,choices,rng.fork('choice-'+game.state.year));
   if(pick){
    const result=game.makeChoice(event,pick.id);
    if(result==null||typeof result==='string'&&/undefined|NaN|\[object Object\]/.test(result))
     flags.push({...info,kind:'malformed-choice-result',choiceId:pick.id,result});
   }
  }else{lastEventId=null;consecutive=0;}
  const order=activityOrder(game,persona==='random'?'random':'human-like',rng.fork('act-'+game.state.year));
  for(const id of order){
   if(game.state.actions.remaining<=0||!game.state.player.alive)break;
   if(game.availableActivities().some(activity=>activity.id===id)){
    try{game.performActivity(id);}catch(error){
     flags.push({seed,persona,age:game.state.player.age,kind:'activity-throws',activityId:id,error:error.message});
    }
   }
  }
  const errors=validateState(game.state);
  if(errors.length)flags.push({seed,persona,age:game.state.player.age,kind:'invalid-state',errors});
 }
 return {seed,persona,age:game.state.player.age,years,observations,flags,
  recurringEvents:[...offered].filter(([,n])=>n>=5).map(([id,n])=>({id,n}))};
}

test('decision-quality audit: 24 reproducible lives across four choice policies',()=>{
 const lives=Array.from({length:AUDIT_LIVES},(_,i)=>play(i));
 const flags=lives.flatMap(life=>life.flags);
 const observations=lives.flatMap(life=>life.observations);
 const breakdown=countBy(flags,'kind');
 const summary={
  lives:lives.length,years:lives.reduce((n,x)=>n+x.years,0),
  decisions:observations.length,uniqueEvents:new Set(observations.map(x=>x.eventId)).size,
  flagCounts:breakdown,flagExamples:Object.fromEntries(
   Object.keys(breakdown).map(kind=>[kind,examples(flags.filter(x=>x.kind===kind),3)])
  ),
  recurringEvents:examples(lives.flatMap(life=>life.recurringEvents.map(x=>({seed:life.seed,...x}))),12),
  personas:Object.fromEntries(PERSONAS.map(p=>[p,{
   lives:lives.filter(x=>x.persona===p).length,
   decisions:lives.filter(x=>x.persona===p).reduce((n,x)=>n+x.observations.length,0)
  }]))
 };
 console.log('DECISION_QUALITY_AUDIT_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('DECISION_QUALITY_AUDIT_END');
 assert.equal(lives.length,AUDIT_LIVES);
 assert.ok(observations.length>80,'audit must exercise a meaningful number of decisions');
 assert.equal(flags.filter(x=>x.kind==='invalid-state').length,0,'invalid-state issues require immediate investigation');
 assert.equal(flags.filter(x=>x.kind==='duplicate-choice-id').length,0,'duplicate IDs make decisions ambiguous');
});
