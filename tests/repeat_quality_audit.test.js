import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice,activityOrder} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

// Diagnostic—not every repeated event is an error. Distinguish repeated
// prompts from genuinely unchanged options, states, and consequences.
const TOPICS=new Set(['first-job','gap-year-direction','health-treatment']);
const SEEDS=24;
function signature(game,event,choices){
 const s=game.state;
 return {
  age:s.player.age,
  eventId:event.id,
  choices:choices.map(c=>({id:c.id,label:c.label})),
  optionIds:choices.map(c=>c.id).join('|'),
  optionText:choices.map(c=>c.label).join('|'),
  job: s.career?.jobId??null,employed:Boolean(s.career?.employed),
  enrolled:Boolean(s.higherEducation?.enrolled),nextPath:s.nextPath??null,
  conditions:(s.healthProfile?.conditions??[]).filter(c=>!c.treated)
   .map(c=>({id:c.id,severity:c.severity,score:c.progression?.score??null})),
  cash:Math.round(s.finance?.cash??0),debt:Math.round(s.finance?.debt??0),
  searchAge:s.nextJobSearchAge??null,gapAge:s.nextGapDecisionAge??null,
  treatmentAge:s.nextTreatmentDecisionAge??null
 };
}
function checkAfter(before,game,choice,flags,seed){
 const s=game.state,common={seed,age:before.age,eventId:before.eventId,
  chosen:choice.id,before};
 if(before.eventId==='first-job'&&choice.id==='reject-job-offers'){
  if(s.pendingJobOffers!==null||s.nextJobSearchAge<=s.player.age)
   flags.push({...common,kind:'job-rejection-no-cooldown'});
 }
 if(before.eventId==='gap-year-direction'&&choice.id==='continue-gap'){
  if(s.nextGapDecisionAge<s.player.age+2)
   flags.push({...common,kind:'gap-wait-does-not-wait'});
 }
 if(before.eventId==='health-treatment'&&choice.id==='defer-treatment'){
  if(s.nextTreatmentDecisionAge<s.player.age+2)
   flags.push({...common,kind:'treatment-deferral-no-cooldown'});
 }
 if(before.eventId==='health-treatment'&&choice.id.startsWith('treat:')){
  const targetId=choice.id.slice('treat:'.length);
  const condition=s.healthProfile?.conditions?.find(c=>c.id===targetId);
  if(!condition?.treated||condition.treatmentAge!==s.player.age)
   flags.push({...common,kind:'treatment-did-not-apply'});
 }
}
function run(index){
 const policy=['human-like','random','first-option','last-option'][index%4];
 const seed='repeat-quality-2026-'+String(index).padStart(3,'0')+'-'+policy;
 const game=new Game(seed),rng=new RNG(seed+':driver');
 const observations=[],flags=[],seen=new Map(),histogram={};
 while(game.state.player.alive&&game.state.player.age<95){
  const event=game.ageOneYear();
  if(!game.state.player.alive)break;
  if(event){
   const choices=game.eventChoices(event);
   if(TOPICS.has(event.id)){
    const current=signature(game,event,choices);
    const previous=seen.get(event.id);
    histogram[event.id]=(histogram[event.id]??0)+1;
    observations.push({seed,policy,...current});
    if(previous){
     const gap=current.age-previous.age;
     if(gap===1)flags.push({seed,kind:'same-topic-next-year',eventId:event.id,
      previousAge:previous.age,age:current.age});
     if(current.optionText===previous.optionText&&current.optionIds===previous.optionIds)
      flags.push({seed,kind:'identical-choice-presentation',eventId:event.id,
       previousAge:previous.age,age:current.age,gap,
       options:current.choices.map(c=>c.label)});
     if(event.id==='health-treatment'&&JSON.stringify(current.conditions)===JSON.stringify(previous.conditions))
      flags.push({seed,kind:'unchanged-health-state',eventId:event.id,
       previousAge:previous.age,age:current.age,gap,conditions:current.conditions});
    }
    seen.set(event.id,current);
   }
   const choice=policy==='first-option'?choices[0]:policy==='last-option'?choices.at(-1):
    policy==='random'?rng.pick(choices):humanLikeChoice(game,event,choices,rng.fork('event-'+game.state.year));
   if(choice){
    const before=TOPICS.has(event.id)?signature(game,event,choices):null;
    game.makeChoice(event,choice.id);
    if(before)checkAfter(before,game,choice,flags,seed);
   }
  }
  for(const id of activityOrder(game,policy==='random'?'random':'human-like',rng.fork('activities-'+game.state.year))){
   if(game.state.actions.remaining<=0||!game.state.player.alive)break;
   if(game.availableActivities().some(a=>a.id===id))try{game.performActivity(id);}catch{}
  }
  const errors=validateState(game.state);
  if(errors.length)flags.push({seed,kind:'invalid-state',age:game.state.player.age,errors});
 }
 return {seed,policy,age:game.state.player.age,observations,flags,histogram};
}
test('repeat quality: jobs, gap decisions, and treatment across 24 complete lives',()=>{
 const lives=Array.from({length:SEEDS},(_,i)=>run(i));
 const observations=lives.flatMap(l=>l.observations),flags=lives.flatMap(l=>l.flags);
 const kinds=[...new Set(flags.map(f=>f.kind))];
 const summary={
  lives:lives.length,observations:observations.length,
  eventTotals:Object.fromEntries([...TOPICS].map(id=>[id,
   observations.filter(x=>x.eventId===id).length])),
  counts:Object.fromEntries(kinds.map(kind=>[kind,flags.filter(x=>x.kind===kind).length])),
  examples:Object.fromEntries(kinds.map(kind=>[kind,flags.filter(x=>x.kind===kind).slice(0,3)])),
  longestJobSeries:lives.map(l=>({seed:l.seed,offers:l.histogram['first-job']??0}))
   .sort((a,b)=>b.offers-a.offers).slice(0,4),
  longestGapSeries:lives.map(l=>({seed:l.seed,gaps:l.histogram['gap-year-direction']??0}))
   .sort((a,b)=>b.gaps-a.gaps).slice(0,4),
  longestTreatmentSeries:lives.map(l=>({seed:l.seed,treatments:l.histogram['health-treatment']??0}))
   .sort((a,b)=>b.treatments-a.treatments).slice(0,4)
 };
 console.log('REPEAT_QUALITY_AUDIT_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('REPEAT_QUALITY_AUDIT_END');
 assert.equal(lives.length,SEEDS);
 assert.ok(observations.length>35,'audit must exercise target events');
 for(const kind of ['invalid-state','job-rejection-no-cooldown','gap-wait-does-not-wait',
  'treatment-deferral-no-cooldown','treatment-did-not-apply']){
  assert.equal(flags.filter(f=>f.kind===kind).length,0,kind);
 }
});
