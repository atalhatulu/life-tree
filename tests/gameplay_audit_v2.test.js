import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice,activityOrder} from '../src/simulation/autoplay.js';
import {assertValidState} from '../src/simulation/invariants.js';

const PERSONAS=[
 {id:'family-first',goal:'family-bond',npc:'accept'},
 {id:'career-driven',goal:'career-mastery',npc:'career'},
 {id:'security-first',goal:'financial-security',npc:'compromise'},
 {id:'wellbeing',goal:'wellbeing',npc:'balance'},
 {id:'social',goal:'social-circle',npc:'support'}
];

function chooseNpc(event,choices,persona){
 const byId=id=>choices.find(c=>c.id===id);
 if(!event.id.startsWith('npc-'))return null;
 if(event.id==='npc-partner-relocation-request'){
  if(persona.npc==='career')return byId('accept')??choices[0];
  if(persona.npc==='accept')return byId('compromise')??choices[0];
  return byId('compromise')??choices[0];
 }
 if(event.id==='npc-partner-family-priority'){
  if(persona.id==='career-driven')return byId('compromise')??choices[0];
  if(persona.id==='family-first'||persona.id==='social')return byId('accept')??choices[0];
  return byId('compromise')??choices[0];
 }
 if(event.id==='npc-partner-life-balance'){
  if(persona.id==='career-driven')return byId('compromise')??choices[0];
  return byId('accept')??choices[0];
 }
 if(event.id==='npc-child-direction-request'){
  if(persona.id==='security-first')return byId('compromise')??choices[0];
  return byId('accept')??choices[0];
 }
 if(event.id==='npc-friend-support-request'){
  if(persona.id==='career-driven')return byId('compromise')??choices[0];
  return byId('accept')??choices[0];
 }
 return choices[0];
}

function selectGoal(game,persona){
 if(game.state.player.age<18||game.state.lifeGoals?.active)return;
 if((game.state.lifeGoals?.completed??[]).includes(persona.goal))return;
 try{game.setLifeGoal(persona.goal);}catch{}
}

function doActions(game,persona,rng){
 selectGoal(game,persona);
 while(game.state.actions.remaining>0){
  const lifeActions=game.availableLifeActions();
  let life=null;
  if(persona.id==='family-first')life=lifeActions.find(a=>a.id.startsWith('mentor-child:')||a.id==='support-partner');
  if(persona.id==='social')life=lifeActions.find(a=>a.id.startsWith('support-friend:')||a.id==='support-partner');
  if(persona.id==='wellbeing')life=lifeActions.find(a=>a.id==='support-partner'||a.id==='focus-goal');
  life??=lifeActions.find(a=>a.id==='focus-goal');
  if(life){
   try{game.performLifeAction(life.id);continue;}catch{}
  }
  const order=activityOrder(game,'human-like',rng);
  const id=order.find(x=>game.availableActivities().some(a=>a.id===x));
  if(!id)break;
  try{game.performActivity(id);}catch{break;}
 }
}

function playLife(index){
 const persona=PERSONAS[index%PERSONAS.length];
 const game=new Game('gameplay-audit-v2-'+index+'-'+persona.id);
 const rng=new RNG(game.seedText+':manual-player');
 const yearRows=[];
 let maxQuiet=0,currentQuiet=0;
 let previousHistory=0;

 while(game.state.player.alive&&game.state.player.age<100){
  const ageBefore=game.state.player.age;
  const event=game.ageOneYear();
  const autoRows=game.state.history.length-previousHistory;
  let choiceId=null,eventId=event?.id??null;
  if(event&&game.state.player.alive){
   const choices=game.eventChoices(event);
   const choice=chooseNpc(event,choices,persona)??humanLikeChoice(game,event,choices,rng.fork('choice-'+game.state.year));
   if(choice){
    choiceId=choice.id;
    game.makeChoice(event,choice.id);
   }
  }
  if(game.state.player.alive)doActions(game,persona,rng.fork('actions-'+game.state.year));
  assertValidState(game.state);

  const newRows=game.state.history.length-previousHistory;
  const meaningful=eventId||newRows>1;
  if(!meaningful){currentQuiet++;maxQuiet=Math.max(maxQuiet,currentQuiet);}else currentQuiet=0;
  yearRows.push({age:game.state.player.age,eventId,choiceId,rows:newRows,actionsUsed:(game.state.actions.max-game.state.actions.remaining)});
  previousHistory=game.state.history.length;
  if(game.state.player.age===ageBefore)throw new Error('age did not advance');
 }

 const s=game.state;
 const events=yearRows.filter(y=>y.eventId);
 const eventCounts={};
 for(const y of events)eventCounts[y.eventId]=(eventCounts[y.eventId]??0)+1;
 const repeatedEvents=Object.entries(eventCounts).filter(([,n])=>n>=3);
 const histories=s.history??[];
 const kindCount=k=>histories.filter(h=>h.kind===k).length;
 const initiatives=(s.npcInitiatives?.history??[]).filter(x=>x.status==='resolved');
 const npcResponses=initiatives.reduce((o,x)=>(o[x.response]=(o[x.response]??0)+1,o),{});
 const npcTopicCounts={};
 for(const x of initiatives){const key=x.type+':'+x.actorId;npcTopicCounts[key]=(npcTopicCounts[key]??0)+1;}
 const maxNpcSameTopic=Math.max(0,...Object.values(npcTopicCounts));
 const actionRows=histories.filter(h=>h.kind==='activity'||h.kind==='life-action');
 const activityCounts={};
 for(const h of actionRows){const id=h.activityId??h.actionId??'unknown';activityCounts[id]=(activityCounts[id]??0)+1;}
 const actionTotal=actionRows.length||1;
 const topAction=Object.entries(activityCounts).sort((a,b)=>b[1]-a[1])[0]??['none',0];

 return {
  seed:game.seedText,persona:persona.id,finalAge:s.player.age,alive:s.player.alive,
  historyRows:histories.length,yearsPlayed:yearRows.length,
  eventYears:events.length,eventYearPct:Number((events.length/Math.max(1,yearRows.length)*100).toFixed(1)),
  maxQuietYears:maxQuiet,repeatedEvents,
  majorDecisions:s.lifeTree?.nodes?.length??0,
  lifeGoalActive:s.lifeGoals?.active?.id??null,lifeGoalsCompleted:s.lifeGoals?.completed??[],
  npcInitiatives:initiatives.length,npcResponses,npcFollowups:kindCount('npc-followup'),maxNpcSameTopic,
  narrativeEchoes:kindCount('narrative-echo'),longTermConsequences:kindCount('long-term-consequence'),
  consequenceChains:kindCount('consequence-chain'),
  partner:Boolean(s.social?.romance),divorces:s.social?.exSpouses?.length??0,
  children:s.children?.length??0,friends:s.social?.friends?.length??0,
  topAction:{id:topAction[0],count:topAction[1],sharePct:Number((topAction[1]/actionTotal*100).toFixed(1))},
  actionTypes:Object.keys(activityCounts).length,
  finalStress:s.healthProfile?.stress??null,
  debt:Math.round(s.finance?.debt??0),cash:Math.round(s.finance?.cash??0)
 };
}

test('gameplay audit v2: 15 player-like full lives',()=>{
 const lives=Array.from({length:15},(_,i)=>playLife(i));
 const avg=k=>Number((lives.reduce((n,x)=>n+(x[k]??0),0)/lives.length).toFixed(2));
 const flags=[];
 for(const life of lives){
  if(life.maxQuietYears>=5)flags.push({seed:life.seed,type:'quiet-streak',value:life.maxQuietYears});
  if(life.eventYearPct<30)flags.push({seed:life.seed,type:'low-event-density',value:life.eventYearPct});
  if(life.npcInitiatives===0&&life.finalAge>=45)flags.push({seed:life.seed,type:'no-npc-initiative'});
  if(life.maxNpcSameTopic>=3)flags.push({seed:life.seed,type:'npc-topic-repetition',value:life.maxNpcSameTopic});
  if(life.narrativeEchoes===0&&life.finalAge>=45)flags.push({seed:life.seed,type:'no-narrative-echo'});
  if(life.longTermConsequences===0&&life.majorDecisions>=3&&life.finalAge>=45)flags.push({seed:life.seed,type:'no-long-term-consequence'});
  if(life.topAction.sharePct>=55&&life.yearsPlayed>=30)flags.push({seed:life.seed,type:'action-repetition',value:life.topAction});
  if(life.repeatedEvents.length>=4)flags.push({seed:life.seed,type:'event-repetition',value:life.repeatedEvents});
 }
 const summary={
  lives:lives.length,
  avgFinalAge:avg('finalAge'),
  avgEventYearPct:avg('eventYearPct'),
  avgMajorDecisions:avg('majorDecisions'),
  avgNpcInitiatives:avg('npcInitiatives'),
  avgNpcFollowups:avg('npcFollowups'),
  avgMaxNpcSameTopic:avg('maxNpcSameTopic'),
  avgNarrativeEchoes:avg('narrativeEchoes'),
  avgLongTermConsequences:avg('longTermConsequences'),
  avgActionTypes:avg('actionTypes'),
  flags,
  livesDetail:lives
 };
 console.log('\nGAMEPLAY_AUDIT_V2_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('GAMEPLAY_AUDIT_V2_END\n');
 assert.equal(lives.length,15);
});
