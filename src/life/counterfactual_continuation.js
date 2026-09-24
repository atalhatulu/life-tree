import {Game} from '../core/game.js';
import {RNG} from '../core/rng.js';
import {humanLikeChoice,activityOrder} from '../simulation/autoplay.js';
import {ensureLifeFinale} from './ending_system.js';

const percentage=(count,total)=>total?Math.round(count/total*1000)/10:0;
const MAX_AGE=130;

function compactLife(game){
 // Keep consequences and personal history across representative milestones.
 for(const node of game.state.lifeTree?.nodes??[]){
  delete node.snapshot;
  delete node.counterfactual;
 }
 return game;
}

function forkLife(base,seed){
 // Clone the actual world at this fork; never generate a different childhood.
 const game=Object.create(Game.prototype);
 game.seedText=seed;
 game.rng=new RNG(seed);
 game.state=structuredClone(base.state);
 game.events=base.events;
 game.activeEventId=null;
 return game;
}

function activities(game,policyRng){
 const order=activityOrder(game,'human-like',policyRng.fork('activities-'+game.state.year));
 for(const id of order){
  if(game.state.actions.remaining<=0||!game.state.player.alive)break;
  if(game.availableActivities().some(a=>a.id===id)){
   try{game.performActivity(id);}catch{}
  }
 }
}

function advanceToNextDecision(base,seed,maxAge){
 const game=forkLife(base,seed);
 const policyRng=new RNG(seed+':policy');
 const previousCount=game.state.lifeTree.nodes.length;
 while(game.state.player.alive&&game.state.player.age<maxAge){
  const event=game.ageOneYear();
  if(!game.state.player.alive)break;
  if(event){
   const choices=game.eventChoices(event);
   const chosen=humanLikeChoice(game,event,choices,policyRng.fork('event-'+game.state.year));
   if(chosen)game.makeChoice(event,chosen.id);
  }
  const milestone=game.state.lifeTree.nodes.length>previousCount
   ?game.state.lifeTree.nodes.at(-1):null;
  if(game.state.player.alive)activities(game,policyRng);
  if(milestone&&game.state.player.alive){
   // Retain only the representative PRE-choice checkpoint; other samples are discarded.
   const checkpoint=milestone.snapshot;
   const choices=checkpoint?.availableChoices??[];
   compactLife(game);
   return {
    key:'decision:'+milestone.eventId+':'+milestone.choiceId,
    kind:'decision',
    age:milestone.age,
    eventId:milestone.eventId,
    choiceId:milestone.choiceId,
    title:milestone.title,
    label:milestone.label,
    decision:{checkpoint,choices},
    sampleSeed:seed,
    game
   };
  }
 }
 compactLife(game);
 if(!game.state.player.alive){
  const finale=ensureLifeFinale(game.state);
  return {
   key:'ending:'+finale.ending.id,
   kind:'ending',
   age:finale.lifespan.age,
   endingId:finale.ending.id,
   title:finale.ending.title,
   label:finale.ending.description,
   cause:finale.ending.cause,
   game
  };
 }
 return {
  key:'limit',
  kind:'limit',
  age:game.state.player.age,
  title:'Yaş sınırına ulaşıldı',
  label:'Bu örnekte ölüm gerçekleşmeden simülasyon sınırına ulaşıldı.',
  game
 };
}

function chooseOutcome(samples){
 const counts=new Map();
 for(const s of samples){
  const entry=counts.get(s.key)??{key:s.key,kind:s.kind,title:s.title,label:s.label,age:s.age,count:0,examples:[]};
  entry.count++;
  entry.examples.push(s);
  counts.set(s.key,entry);
 }
 const sorted=[...counts.values()].sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key,'tr'));
 const winner=sorted[0];
 // A real representative state, not synthetic averages of incompatible futures.
 const ages=winner.examples.map(s=>s.age).sort((a,b)=>a-b);
 const median=ages[Math.floor(ages.length/2)];
 const representative=winner.examples.find(s=>s.age===median)??winner.examples[0];
 const checkpoint=representative.decision?.checkpoint??null;
 if(checkpoint?.state?.lifeTree)checkpoint.state.lifeTree.nodes=[];
 const forks=winner.kind==='decision'&&checkpoint?
  (representative.decision?.choices??[]).filter(choice=>choice.id!==representative.choiceId)
   .map(choice=>{
    const count=samples.filter(s=>s.eventId===representative.eventId&&s.choiceId===choice.id).length;
    return {choiceId:choice.id,label:choice.label,count,probability:percentage(count,samples.length),result:null};
   }):[];
 return {
  representative,
  alternatives:sorted.slice(1,4).map(s=>({
   kind:s.kind,title:s.title,label:s.label,count:s.count,
   probability:percentage(s.count,samples.length)
  })),
  stage:{
   kind:winner.kind,
   age:representative.age,
   title:winner.title,
   label:winner.label,
   count:winner.count,
   samples:samples.length,
   probability:percentage(winner.count,samples.length),
   alternatives:sorted.slice(1,4).map(s=>({
    title:s.title,label:s.label,count:s.count,probability:percentage(s.count,samples.length)
   })),
   ...(winner.kind==='decision'?{
    eventId:representative.eventId,choiceId:representative.choiceId,checkpoint,forks,
    resumeSeed:representative.sampleSeed,selectedResult:null
   }:{}),
   ...(winner.kind==='ending'?{endingId:representative.endingId,cause:representative.cause}:{})
  }
 };
}

export function continuationOriginKey(seedText,node){
 const rng=node.snapshot?.rng??{};
 const prior=node.snapshot?.priorNodes??[];
 return JSON.stringify([
  String(seedText),node.eventId,node.age,
  rng.seed??null,rng.state??null,
  prior.map(n=>[n.eventId,n.choiceId,n.age])
 ]);
}

function startingLife(seedText,node,alternativeId,{allowSelected=false,activitySeed=null}={}){
 if(!node?.snapshot)throw new Error('Bu kararın alternatif snapshot verisi bulunamadı.');
 if(alternativeId===node.choiceId&&!allowSelected)throw new Error('Yaşanmış seçim alternatif olarak simüle edilemez.');
 const alternative=(node.alternatives??[]).find(a=>a.id===alternativeId)
  ??node.snapshot.availableChoices?.find(a=>a.id===alternativeId);
 if(!alternative)throw new Error('Alternatif karar bulunamadı: '+alternativeId);
 const game=Game.fromDecisionSnapshot(seedText,node.snapshot);
 const event=game.events.events.find(e=>e.id===node.eventId);
 if(!event)throw new Error('Karar olayı artık bulunmuyor: '+node.eventId);
 game.makeChoice(event,alternativeId);
 if(activitySeed&&game.state.player.alive)activities(game,new RNG(activitySeed+':policy'));
 compactLife(game);
 return {game,alternative};
}

/**
 * Each stage samples the next actual critical choice/death 100 times from
 * one representative world. The modal next milestone becomes the next
 * canonical fork. Percentages are conditional sample frequencies at that
 * stage, not independent probabilities or a globally most-likely life.
 *
 * onProgress can yield control to the browser; no background work is started.
 */
export async function simulateContinuation(seedText,node,alternativeId,{
 samples=100,maxAge=MAX_AGE,maxStages=130,onProgress=null,
 allowSelected=false,activitySeed=null
}={}){
 if(!Number.isInteger(samples)||samples<1||samples>100)throw new Error('Örnek sayısı 1–100 arasında olmalı.');
 if(!Number.isInteger(maxAge)||maxAge<1||maxAge>130)throw new Error('Geçersiz maksimum yaş.');
 const {game:origin,alternative}=startingLife(seedText,node,alternativeId,{allowSelected,activitySeed});
 let representative=origin;
 const continuation=[];
 const rootSeed=seedText+':continuation:'+node.eventId+':'+node.age+':'+alternativeId;
 let completedSampleRuns=0;

 if(!origin.state.player.alive){
  const finale=ensureLifeFinale(origin.state);
  return {
   version:3,choiceId:alternativeId,label:alternative.label,requestedSamples:samples,
   originKey:continuationOriginKey(seedText,node),
   completedSamples:samples,completedSampleRuns:samples,startAge:node.age,
   continuation:[{
    kind:'ending',age:finale.lifespan.age,title:finale.ending.title,
    label:finale.ending.description,count:samples,samples,probability:100,
    alternatives:[],endingId:finale.ending.id,cause:finale.ending.cause
   }],
   terminal:true,ending:{
    id:finale.ending.id,title:finale.ending.title,
    age:finale.lifespan.age,cause:finale.ending.cause
   }
  };
 }

 for(let stageIndex=0;stageIndex<maxStages&&representative.state.player.alive&&representative.state.player.age<maxAge;stageIndex++){
  const results=[];
  for(let i=0;i<samples;i++){
   const seed=rootSeed+':step-'+stageIndex+':sample-'+i;
   results.push(advanceToNextDecision(representative,seed,maxAge));
   completedSampleRuns++;
   if(onProgress&&((i+1)%2===0||i+1===samples)){
    await onProgress({
     stage:stageIndex+1,completed:i+1,total:samples,
     age:representative.state.player.age,completedSampleRuns
    });
   }
  }
  const chosen=chooseOutcome(results);
  continuation.push(chosen.stage);
  representative=chosen.representative.game;
  if(chosen.stage.kind!=='decision')break;
 }
 const finalStage=continuation.at(-1)??null;
 return {
  version:3,choiceId:alternativeId,label:alternative.label,requestedSamples:samples,
  originKey:continuationOriginKey(seedText,node),
  completedSamples:samples,completedSampleRuns,
  startAge:node.age,continuation,
  terminal:Boolean(finalStage&&finalStage.kind!=='decision'),
  ending:finalStage?.kind==='ending'?{
   id:finalStage.endingId,title:finalStage.title,age:finalStage.age,cause:finalStage.cause
  }:null
 };
}

/**
 * Opens any unchosen option of a simulated critical decision. Each child
 * continuation owns its independent descendants; siblings remain intact.
 */
export async function expandContinuationFork(seedText,parentResult,stageIndex,choiceId,options={}){
 const stage=parentResult?.continuation?.[stageIndex];
 if(stage?.kind!=='decision'||!stage.checkpoint)throw new Error('Bu düğüm için dallanma kaydı yok.');
 const fork=stage.forks?.find(item=>item.choiceId===choiceId);
 if(!fork)throw new Error('Bu kararın alternatif yolu bulunamadı.');
 if(fork.result?.version===3)return fork.result;
 const node={
  eventId:stage.eventId,age:stage.age,title:stage.title,
  choiceId:stage.choiceId,alternatives:[{id:choiceId,label:fork.label}],
  snapshot:stage.checkpoint
 };
 const result=await simulateContinuation(seedText,node,choiceId,{...options,activitySeed:stage.resumeSeed});
 fork.result=result;
 return result;
}

/** Resume the chosen path of a deliberately depth-limited branch.
 * Replays the representative's choice and its same-year activities from
 * the recorded pre-choice checkpoint, rather than inventing a new life.
 */
export async function expandSelectedContinuation(seedText,parentResult,stageIndex,options={}){
 const stage=parentResult?.continuation?.[stageIndex];
 if(stage?.kind!=='decision'||!stage.checkpoint||!stage.resumeSeed)
  throw new Error('Bu hayatın devam durumuna erişilemiyor.');
 if(stage.selectedResult?.version===3)return stage.selectedResult;
 const node={
  eventId:stage.eventId,age:stage.age,title:stage.title,
  choiceId:stage.choiceId,alternatives:[],snapshot:stage.checkpoint
 };
 const result=await simulateContinuation(seedText,node,stage.choiceId,{
  ...options,allowSelected:true,activitySeed:stage.resumeSeed
 });
 stage.selectedResult=result;
 return result;
}

/** Automatically grow all alternatives at the first critical decision.
 * Only the first few levels are computed eagerly; further generations are
 * kept as visible, independently expandable choice nodes.
 */
export async function growFirstGeneration(seedText,result,{
 samples=100,maxStages=3,onProgress=null
}={}){
 const index=result?.continuation?.findIndex(stage=>stage.kind==='decision'&&stage.forks?.length)??-1;
 if(index<0)return result;
 const stage=result.continuation[index];
 for(let i=0;i<stage.forks.length;i++){
  const fork=stage.forks[i];
  if(fork.result)continue;
  await expandContinuationFork(seedText,result,index,fork.choiceId,{
   samples,maxStages,onProgress:onProgress?async progress=>
    onProgress({...progress,branch:i+1,branchTotal:stage.forks.length}):null
  });
 }
 return result;
}
