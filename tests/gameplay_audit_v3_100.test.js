import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice,activityOrder} from '../src/simulation/autoplay.js';
import {assertValidState} from '../src/simulation/invariants.js';

const PERSONAS=[
 {id:'family-first',goal:'family-bond'},
 {id:'career-driven',goal:'career-mastery'},
 {id:'security-first',goal:'financial-security'},
 {id:'wellbeing',goal:'wellbeing'},
 {id:'social',goal:'social-circle'}
];

function npcChoice(event,choices,persona){
 const pick=id=>choices.find(c=>c.id===id);
 if(!event.id.startsWith('npc-'))return null;
 if(event.id==='npc-partner-relocation-request')return persona.id==='career-driven'?pick('accept')??choices[0]:pick('compromise')??choices[0];
 if(event.id==='npc-partner-family-priority')return ['family-first','social'].includes(persona.id)?pick('accept')??choices[0]:pick('compromise')??choices[0];
 if(event.id==='npc-partner-life-balance')return persona.id==='career-driven'?pick('compromise')??choices[0]:pick('accept')??choices[0];
 if(event.id==='npc-child-direction-request')return persona.id==='security-first'?pick('compromise')??choices[0]:pick('accept')??choices[0];
 if(event.id==='npc-friend-support-request')return persona.id==='career-driven'?pick('compromise')??choices[0]:pick('accept')??choices[0];
 return choices[0];
}

function actions(game,persona,rng){
 if(game.state.player.age>=18&&!game.state.lifeGoals?.active&&!(game.state.lifeGoals?.completed??[]).includes(persona.goal)){
  try{game.setLifeGoal(persona.goal);}catch{}
 }
 while(game.state.actions.remaining>0){
  const la=game.availableLifeActions();
  let chosen=null;
  if(persona.id==='family-first')chosen=la.find(a=>a.id.startsWith('mentor-child:')||a.id==='support-partner');
  else if(persona.id==='social')chosen=la.find(a=>a.id.startsWith('support-friend:')||a.id==='support-partner');
  else if(persona.id==='wellbeing')chosen=la.find(a=>a.id==='support-partner'||a.id==='focus-goal');
  chosen??=la.find(a=>a.id==='focus-goal');
  if(chosen){try{game.performLifeAction(chosen.id);continue;}catch{}}
  const order=activityOrder(game,'human-like',rng);
  const id=order.find(x=>game.availableActivities().some(a=>a.id===x));
  if(!id)break;
  try{game.performActivity(id);}catch{break;}
 }
}

function play(index){
 const persona=PERSONAS[index%PERSONAS.length];
 const game=new Game('gameplay-audit-v3-'+index+'-'+persona.id);
 const rng=new RNG(game.seedText+':v3-player');
 const years=[];
 let quiet=0,maxQuiet=0,prevHistory=0;

 while(game.state.player.alive&&game.state.player.age<100){
  const event=game.ageOneYear();
  let eventId=event?.id??null;
  if(event&&game.state.player.alive){
   const choices=game.eventChoices(event);
   const choice=npcChoice(event,choices,persona)??humanLikeChoice(game,event,choices,rng.fork('choice-'+game.state.year));
   if(choice)game.makeChoice(event,choice.id);
  }
  if(game.state.player.alive)actions(game,persona,rng.fork('actions-'+game.state.year));
  assertValidState(game.state);
  const added=game.state.history.length-prevHistory;
  if(!eventId&&added<=1){quiet++;maxQuiet=Math.max(maxQuiet,quiet);}else quiet=0;
  years.push(eventId);
  prevHistory=game.state.history.length;
 }

 const s=game.state;
 const eventCounts={};for(const id of years.filter(Boolean))eventCounts[id]=(eventCounts[id]??0)+1;
 const repeatedEvents=Object.entries(eventCounts).filter(([,n])=>n>=3);
 const initiatives=(s.npcInitiatives?.history??[]).filter(x=>x.status==='resolved');
 const topicCounts={};for(const x of initiatives){const k=x.type+':'+x.actorId;topicCounts[k]=(topicCounts[k]??0)+1;}
 const histories=s.history??[];
 const actionRows=histories.filter(h=>h.kind==='activity'||h.kind==='life-action');
 const actionCounts={};for(const h of actionRows){const id=h.activityId??h.actionId??'unknown';actionCounts[id]=(actionCounts[id]??0)+1;}
 const actionTotal=actionRows.length||1;
 const top=Object.entries(actionCounts).sort((a,b)=>b[1]-a[1])[0]??['none',0];
 const kind=k=>histories.filter(h=>h.kind===k).length;

 return {
  persona:persona.id,age:s.player.age,
  eventPct:Number((years.filter(Boolean).length/Math.max(1,years.length)*100).toFixed(1)),
  maxQuiet,repeatedEvents:repeatedEvents.length,
  npc:initiatives.length,maxNpcTopic:Math.max(0,...Object.values(topicCounts)),
  followups:kind('npc-followup'),echoes:kind('narrative-echo'),longTerm:kind('long-term-consequence'),
  major:s.lifeTree?.nodes?.length??0,
  actionTypes:Object.keys(actionCounts).length,topActionPct:Number((top[1]/actionTotal*100).toFixed(1)),
  goalCompleted:(s.lifeGoals?.completed??[]).includes(persona.goal),
  partner:Boolean(s.social?.romance),children:s.children?.length??0,friends:s.social?.friends?.length??0,
  finalStress:s.healthProfile?.stress??0,debt:Math.round(s.finance?.debt??0)
 };
}

function pct(n,d){return Number((n/Math.max(1,d)*100).toFixed(1));}
function percentile(values,p){
 const sorted=[...values].sort((a,b)=>a-b);
 return sorted[Math.min(sorted.length-1,Math.max(0,Math.ceil(p*sorted.length)-1))];
}

test('gameplay audit v3: 100 player-like full lives',()=>{
 const lives=Array.from({length:100},(_,i)=>play(i));
 const longLives=lives.filter(x=>x.age>=45);
 const avg=k=>Number((lives.reduce((n,x)=>n+(x[k]??0),0)/lives.length).toFixed(2));
 const persona={};
 for(const p of PERSONAS){
  const xs=lives.filter(x=>x.persona===p.id);
  persona[p.id]={
   lives:xs.length,avgAge:Number((xs.reduce((n,x)=>n+x.age,0)/xs.length).toFixed(1)),
   avgNpc:Number((xs.reduce((n,x)=>n+x.npc,0)/xs.length).toFixed(2)),
   noNpcPct:pct(xs.filter(x=>x.age>=45&&x.npc===0).length,xs.filter(x=>x.age>=45).length),
   goalCompletePct:pct(xs.filter(x=>x.goalCompleted).length,xs.length)
  };
 }
 const summary={
  lives:lives.length,avgAge:avg('age'),p10Age:percentile(lives.map(x=>x.age),.10),p90Age:percentile(lives.map(x=>x.age),.90),
  avgEventPct:avg('eventPct'),p10EventPct:percentile(lives.map(x=>x.eventPct),.10),p90EventPct:percentile(lives.map(x=>x.eventPct),.90),
  quiet5PlusPct:pct(lives.filter(x=>x.maxQuiet>=5).length,lives.length),
  repeatedEventLifePct:pct(lives.filter(x=>x.repeatedEvents>=4).length,lives.length),
  avgNpc:avg('npc'),noNpcLongLifePct:pct(longLives.filter(x=>x.npc===0).length,longLives.length),
  npcOver5Pct:pct(lives.filter(x=>x.npc>5).length,lives.length),
  maxNpcInLife:Math.max(...lives.map(x=>x.npc)),maxSameTopic:Math.max(...lives.map(x=>x.maxNpcTopic)),
  sameTopic3PlusPct:pct(lives.filter(x=>x.maxNpcTopic>=3).length,lives.length),
  avgFollowups:avg('followups'),avgEchoes:avg('echoes'),avgLongTerm:avg('longTerm'),avgMajor:avg('major'),
  avgActionTypes:avg('actionTypes'),actionSpamPct:pct(lives.filter(x=>x.topActionPct>=55).length,lives.length),
  maxTopActionPct:Math.max(...lives.map(x=>x.topActionPct)),
  goalCompletePct:pct(lives.filter(x=>x.goalCompleted).length,lives.length),
  stress90PlusPct:pct(lives.filter(x=>x.finalStress>=90).length,lives.length),
  debtPositivePct:pct(lives.filter(x=>x.debt>0).length,lives.length),
  persona
 };
 console.log('\nGAMEPLAY_AUDIT_V3_100_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('GAMEPLAY_AUDIT_V3_100_END\n');

 assert.equal(lives.length,100);
 assert.equal(lives.filter(x=>x.maxNpcTopic>=3).length,0,'same NPC topic should not reach spam territory');
 assert.equal(lives.filter(x=>x.topActionPct>=55).length,0,'action spam regression returned');
 assert.ok(summary.quiet5PlusPct<=20,'too many lives contain 5+ year quiet streaks');
 assert.ok(summary.npcOver5Pct<=10,'NPC initiative volume regressed into spam');
});
