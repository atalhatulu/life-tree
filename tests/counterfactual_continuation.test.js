import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice} from '../src/simulation/autoplay.js';
import {simulateContinuation,expandContinuationFork} from '../src/life/counterfactual_continuation.js';

function firstMajorNode(seed){
 const game=new Game(seed);
 const rng=new RNG(seed+':fixture');
 while(game.state.player.alive&&game.state.player.age<35){
  const event=game.ageOneYear();
  if(!event||!game.state.player.alive)continue;
  const choice=humanLikeChoice(game,event,game.eventChoices(event),rng.fork(String(game.state.year)));
  if(choice)game.makeChoice(event,choice.id);
  const node=game.state.lifeTree.nodes.at(-1);
  if(node?.snapshot&&node.alternatives?.length)return {game,node};
 }
 throw new Error('No major decision found.');
}

test('continuation produces a real milestone trajectory without mutating the lived life',async()=>{
 const {game,node}=firstMajorNode('continuation-path');
 const before=JSON.stringify(game.state);
 const alt=node.alternatives[0];
 const updates=[];
 const result=await simulateContinuation(game.seedText,node,alt.id,{
  samples:4,maxAge:65,maxStages:3,onProgress:p=>updates.push(p)
 });
 assert.equal(result.version,3);
 assert.equal(result.requestedSamples,4);
 assert.equal(result.choiceId,alt.id);
 assert.ok(result.continuation.length>=1);
 assert.ok(result.continuation.length<=3);
 assert.ok(result.completedSampleRuns>=4);
 assert.ok(updates.length>=1);
 for(const stage of result.continuation){
  assert.ok(['decision','ending','limit'].includes(stage.kind));
  assert.ok(stage.age>=node.age);
  assert.equal(stage.samples,4);
  assert.ok(stage.count>=1&&stage.count<=4);
  assert.equal(stage.probability,Math.round(stage.count/4*1000)/10);
  assert.ok(stage.title);
 }
 assert.equal(JSON.stringify(game.state),before);
});

test('continuation is reproducible from the same branch snapshot',async()=>{
 const {game,node}=firstMajorNode('continuation-determinism');
 const alt=node.alternatives[0];
 const options={samples:3,maxAge:55,maxStages:2};
 const first=await simulateContinuation(game.seedText,node,alt.id,options);
 const second=await simulateContinuation(game.seedText,node,alt.id,options);
 assert.deepEqual(second,first);
});

test('continuation refuses unsupported sample sizes and the lived choice',async()=>{
 const {game,node}=firstMajorNode('continuation-validation');
 await assert.rejects(()=>simulateContinuation(game.seedText,node,node.choiceId,{samples:3}),/Yaşanmış seçim/);
 await assert.rejects(()=>simulateContinuation(game.seedText,node,node.alternatives[0].id,{samples:101}),/1–100/);
});

test('simulated choices keep unopened forks; opening one grows its own independent life',async()=>{
 const {game,node}=firstMajorNode('recursive-branch-test');
 const originalLife=JSON.stringify(game.state);
 const root=await simulateContinuation(game.seedText,node,node.alternatives[0].id,{
  samples:4,maxAge:70,maxStages:5
 });
 const index=root.continuation.findIndex(stage=>stage.kind==='decision'&&stage.forks?.length);
 assert.ok(index>=0,'Expected at least one critical choice with an alternative');
 const stage=root.continuation[index];
 const fork=stage.forks[0];
 assert.ok(stage.checkpoint?.state,'Representative decision must retain pre-choice world');
 assert.ok(stage.checkpoint.availableChoices.some(choice=>choice.id===fork.choiceId));
 assert.equal(fork.result,null,'Unchosen possibility must remain unopened');
 assert.ok(stage.count>=1);
 assert.equal(stage.forks.find(x=>x.choiceId===fork.choiceId).probability,
  Math.round(fork.count/4*1000)/10);
 const preservedMainStages=root.continuation.map(item=>[item.kind,item.age,item.title,item.label]);
 const branch=await expandContinuationFork(game.seedText,root,index,fork.choiceId,{
  samples:4,maxAge:70,maxStages:4
 });
 assert.equal(branch.version,3);
 assert.equal(branch.choiceId,fork.choiceId);
 assert.equal(fork.result,branch);
 assert.ok(branch.continuation.length>=1);
 assert.deepEqual(root.continuation.map(item=>[item.kind,item.age,item.title,item.label]),preservedMainStages);
 assert.equal(JSON.stringify(game.state),originalLife,'Opening a branch must not change the lived life');
 assert.equal(await expandContinuationFork(game.seedText,root,index,fork.choiceId,{samples:8}),branch,
  'Previously explored branch should be cached');
 const childIndex=branch.continuation.findIndex(item=>item.kind==='decision'&&item.forks?.length);
 if(childIndex>=0){
  const grandchildChoice=branch.continuation[childIndex].forks[0].choiceId;
  const grandchild=await expandContinuationFork(game.seedText,branch,childIndex,grandchildChoice,{
   samples:3,maxAge:70,maxStages:2
  });
  assert.ok(grandchild.continuation.length>=1,'A child possibility may also fork');
  assert.equal(branch.continuation[childIndex].forks[0].result,grandchild);
 }
});

test('simulated fork rejects invalid paths rather than restarting from a wrong state',async()=>{
 const {game,node}=firstMajorNode('recursive-invalid-fork');
 const root=await simulateContinuation(game.seedText,node,node.alternatives[0].id,{
  samples:3,maxAge:60,maxStages:2
 });
 await assert.rejects(()=>expandContinuationFork(game.seedText,root,999,'none',{samples:3}),/dallanma kaydı/);
 const index=root.continuation.findIndex(stage=>stage.kind==='decision'&&stage.forks?.length);
 if(index>=0)await assert.rejects(
  ()=>expandContinuationFork(game.seedText,root,index,'invalid-choice',{samples:3}),
  /alternatif yolu/
 );
});
