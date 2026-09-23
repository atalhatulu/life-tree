import {Game} from '../core/game.js';
import {RNG} from '../core/rng.js';
import {humanLikeChoice,activityOrder} from '../simulation/autoplay.js';
import {ensureLifeFinale} from './ending_system.js';

function round(value,digits=1){
 const m=10**digits;
 return Math.round(value*m)/m;
}
function avg(values){
 return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
}
function pct(count,total){
 return total?round(count/total*100,1):0;
}

function chooseLifeActions(game){
 const available=game.availableLifeActions();
 if(!available.length||game.state.actions.remaining<=0)return null;
 const s=game.state;
 if(s.healthProfile?.stress>=68){
  const support=available.find(a=>a.id==='support-partner');
  if(support)return support;
 }
 const child=available.find(a=>a.id.startsWith('mentor-child:'));
 if(child&&(s.children??[]).some(c=>(c.relationship??70)<62))return child;
 const friend=available.find(a=>a.id.startsWith('support-friend:'));
 if(friend)return friend;
 return available.find(a=>a.id==='focus-goal')??null;
}

function playToEnd(game,simulationRng,maxAge=100){
 while(game.state.player.alive&&game.state.player.age<maxAge){
  const event=game.ageOneYear();
  if(event&&game.state.player.alive){
   const choices=game.eventChoices(event);
   const chosen=humanLikeChoice(game,event,choices,simulationRng.fork('event-'+game.state.year));
   if(chosen)game.makeChoice(event,chosen.id);
  }
  if(!game.state.player.alive)break;

  let guard=0;
  while(game.state.actions.remaining>0&&guard++<4){
   const lifeAction=chooseLifeActions(game);
   if(!lifeAction)break;
   try{game.performLifeAction(lifeAction.id);}catch{break;}
  }

  const order=activityOrder(game,'human-like',simulationRng.fork('activities-'+game.state.year));
  for(const id of order){
   if(game.state.actions.remaining<=0)break;
   if(game.availableActivities().some(a=>a.id===id)){
    try{game.performActivity(id);}catch{}
   }
  }
 }
 if(!game.state.player.alive)return ensureLifeFinale(game.state);
 return null;
}

function branchGame(seedText,node,alternative,sampleIndex){
 if(!node?.snapshot)throw new Error('Counterfactual simulation requires a decision snapshot.');
 const game=Game.fromDecisionSnapshot(seedText,node.snapshot);
 const event=game.events.events.find(candidate=>candidate.id===node.eventId);
 if(!event)throw new Error('Decision event no longer exists: '+node.eventId);

 // The past and the alternate decision are identical across samples.
 // Only the future after the decision receives a new deterministic child seed.
 game.makeChoice(event,alternative.id);
 const futureSeed=seedText+':counterfactual:'+node.eventId+':'+node.age+':'+alternative.id+':'+sampleIndex;
 game.rng=new RNG(futureSeed);
 return {game,futureRng:new RNG(futureSeed+':policy')};
}

function summarizeRuns(runs,alternative,samples){
 const completed=runs.filter(Boolean);
 const endings=new Map();
 for(const recap of completed){
  const id=recap.ending.id;
  const entry=endings.get(id)??{id,title:recap.ending.title,count:0};
  entry.count++;
  endings.set(id,entry);
 }
 const endingDistribution=[...endings.values()]
  .map(x=>({...x,probability:pct(x.count,completed.length)}))
  .sort((a,b)=>b.count-a.count||a.title.localeCompare(b.title,'tr'));

 const metrics=completed.map(r=>r.ending.metrics);
 const familyHigh=metrics.filter(m=>m.family>=65).length;
 const careerHigh=metrics.filter(m=>m.career>=65).length;

 return {
  choiceId:alternative.id,
  label:alternative.label,
  requestedSamples:samples,
  completedSamples:completed.length,
  endingDistribution,
  mostLikelyEnding:endingDistribution[0]??null,
  averageAge:round(avg(completed.map(r=>r.lifespan.age)),1),
  averageNetWorth:Math.round(avg(completed.map(r=>r.netWorth))),
  childrenProbability:pct(completed.filter(r=>r.children>0).length,completed.length),
  strongFamilyProbability:pct(familyHigh,completed.length),
  strongCareerProbability:pct(careerHigh,completed.length),
  averageChildren:round(avg(completed.map(r=>r.children)),2),
  averageMajorDecisions:round(avg(completed.map(r=>r.majorDecisions)),1)
 };
}

export function simulateCounterfactualChoice(seedText,node,alternativeId,{samples=12,maxAge=100}={}){
 if(!node?.snapshot)throw new Error('Counterfactual node has no snapshot.');
 const alternative=(node.alternatives??[]).find(a=>a.id===alternativeId)
  ??node.snapshot.availableChoices?.find(a=>a.id===alternativeId);
 if(!alternative)throw new Error('Unknown alternate choice: '+alternativeId);
 if(alternative.id===node.choiceId)throw new Error('Counterfactual choice must differ from lived choice.');

 const runs=[];
 for(let i=0;i<samples;i++){
  const {game,futureRng}=branchGame(seedText,node,alternative,i);
  runs.push(playToEnd(game,futureRng,maxAge));
 }
 return summarizeRuns(runs,alternative,samples);
}

export function analyzeDecisionNode(seedText,node,options={}){
 const results=[];
 for(const alternative of node.alternatives??[]){
  results.push(simulateCounterfactualChoice(seedText,node,alternative.id,options));
 }
 return {
  eventId:node.eventId,
  age:node.age,
  title:node.title,
  livedChoice:{id:node.choiceId,label:node.label},
  alternatives:results
 };
}

export function ensureCounterfactualAnalysis(state,seedText,nodeIndex,options={}){
 const node=state.lifeTree?.nodes?.[nodeIndex];
 if(!node)throw new Error('Life Tree node not found.');
 node.counterfactual??=analyzeDecisionNode(seedText,node,options);
 return node.counterfactual;
}
