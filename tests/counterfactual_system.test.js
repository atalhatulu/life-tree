import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {humanLikeChoice} from '../src/simulation/autoplay.js';
import {simulateCounterfactualChoice,analyzeDecisionNode,ensureCounterfactualChoice} from '../src/life/counterfactual_system.js';

function firstMajorNode(seed='counterfactual-fixture'){
 const g=new Game(seed);
 const policyRng=new RNG(seed+':policy');
 let guard=0;
 while(g.state.player.alive&&g.state.player.age<35&&guard++<40){
  const event=g.ageOneYear();
  if(event&&g.state.player.alive){
   const choices=g.eventChoices(event);
   const picked=humanLikeChoice(g,event,choices,policyRng.fork('event-'+g.state.year));
   if(picked)g.makeChoice(event,picked.id);
   const node=g.state.lifeTree.nodes.at(-1);
   if(node?.snapshot&&(node.alternatives?.length??0)>0)return {g,node};
  }
 }
 throw new Error('Could not produce a major decision fixture.');
}

test('counterfactual simulation produces probabilistic ending data from the same decision snapshot',()=>{
 const {g,node}=firstMajorNode('counterfactual-basic');
 const alt=node.alternatives[0];
 const result=simulateCounterfactualChoice(g.seedText,node,alt.id,{samples:3,maxAge:110});
 assert.equal(result.choiceId,alt.id);
 assert.equal(result.requestedSamples,3);
 assert.ok(result.completedSamples>=1);
 assert.ok(result.endingDistribution.length>=1);
 assert.ok(result.averageAge>node.age);
 assert.ok(result.mostLikelyEnding?.title);
});

test('counterfactual simulation is deterministic for the same node, seed and sample count',()=>{
 const {g,node}=firstMajorNode('counterfactual-deterministic');
 const alt=node.alternatives[0];
 const a=simulateCounterfactualChoice(g.seedText,node,alt.id,{samples:3,maxAge:110});
 const b=simulateCounterfactualChoice(g.seedText,node,alt.id,{samples:3,maxAge:110});
 assert.deepEqual(b,a);
});

test('decision analysis preserves lived choice and analyzes every alternative',()=>{
 const {g,node}=firstMajorNode('counterfactual-node');
 const result=analyzeDecisionNode(g.seedText,node,{samples:2,maxAge:110});
 assert.equal(result.livedChoice.id,node.choiceId);
 assert.equal(result.alternatives.length,node.alternatives.length);
 for(const alt of result.alternatives){
  assert.equal(alt.requestedSamples,2);
  assert.ok(alt.completedSamples>=1);
 }
});


test('lazy counterfactual choice is cached on the Life Tree node',()=>{
 const {g,node}=firstMajorNode('counterfactual-cache');
 const nodeIndex=g.state.lifeTree.nodes.indexOf(node);
 const alt=node.alternatives[0];
 const first=ensureCounterfactualChoice(g.state,g.seedText,nodeIndex,alt.id,{samples:2,maxAge:110});
 const snapshot=JSON.stringify(g.state.lifeTree.nodes[nodeIndex].counterfactual);
 const second=ensureCounterfactualChoice(g.state,g.seedText,nodeIndex,alt.id,{samples:9,maxAge:110});
 assert.deepEqual(second,first);
 assert.equal(JSON.stringify(g.state.lifeTree.nodes[nodeIndex].counterfactual),snapshot);
 assert.equal(g.state.lifeTree.nodes[nodeIndex].counterfactual.alternatives.length,1);
});
