import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice} from '../src/simulation/autoplay.js';
import {simulateContinuation} from '../src/life/counterfactual_continuation.js';

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
 assert.equal(result.version,2);
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
