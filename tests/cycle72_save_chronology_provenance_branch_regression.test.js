import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';

function base(){return createSavePayload(new Game('cycle72-integrity'));}
function rejects(label,edit){
 test(label,()=>{
  const payload=base();edit(payload);
  const original=structuredClone(payload);
  assert.throws(()=>parseSave(payload),/Invalid save/);
  assert.deepEqual(payload,original);
  assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save/);
 });
}
function lived(){
 const game=new Game('cycle72-decision');
 while(game.state.player.alive&&game.state.player.age<20){
  const event=game.ageOneYear();
  if(event)game.makeChoice(event,game.eventChoices(event)[0].id);
 }
 assert.ok(game.state.lifeTree.nodes.length>=2);
 return game;
}

// Candidate 1: history ages must be nondecreasing, ignoring absent legacy ages.
for(const [label,ages] of [
 ['simple reversal',[2,1]],['reversal with missing legacy age',[4,null,3]],
 ['late reversal',[0,3,3,2]],['reversal after unrelated records',[1,2,null,1]]
])rejects('history rejects chronological '+label,p=>{
 p.state.player.age=10;p.savedAtAge=10;
 p.state.history=ages.map(age=>age===null?{kind:'legacy'}:{kind:'activity',age});
});
test('history accepts equal ages, increasing ages, and omitted legacy ages',()=>{
 const p=base();p.state.player.age=10;p.savedAtAge=10;
 p.state.history=[{age:0},{kind:'legacy'},{age:4},{age:4},{age:10}];
 assert.equal(parseSave(p).state.history.length,5);
});

// Candidate 2: node chronology and decision provenance must be coherent.
for(const [label,ages] of [
 ['simple reversal',[5,4]],['reversal across legacy node',[7,null,6]],
 ['late reversal',[2,4,4,3]]
])rejects('life tree rejects chronological '+label,p=>{
 p.state.player.age=10;p.savedAtAge=10;
 p.state.lifeTree.nodes=ages.map(age=>age===null?{eventId:'legacy'}:{eventId:'legacy',age});
});
for(const [label,edit] of [
 ['event mismatch',node=>{node.snapshot.eventId='wrong-event';}],
 ['choice absent',node=>{node.snapshot.availableChoices=[{id:'wrong',label:'Wrong'}];}],
 ['snapshot age mismatch',node=>{node.snapshot.age=node.age-1;}],
 ['snapshot state age mismatch',node=>{node.snapshot.state.player.age=node.age-1;}],
 ['snapshot year mismatch',node=>{node.snapshot.year+=1;}],
 ['snapshot malformed',node=>{node.snapshot={version:2,state:null};}],
 ['snapshot invalid rng',node=>{node.snapshot.rng={seed:-1,state:0};}]
])test('saved decision rejects '+label,()=>{
 const p=createSavePayload(lived());edit(p.state.lifeTree.nodes[0]);
 const before=structuredClone(p);
 assert.throws(()=>parseSave(p),/Invalid save/);
 assert.deepEqual(p,before);
});
test('valid decision snapshots, chronological nodes and old nodes without snapshots load',()=>{
 const g=lived();const p=createSavePayload(g);
 assert.deepEqual(Game.fromSave(p).state,g.state);
 p.state.lifeTree.nodes.push({eventId:'legacy'});
 assert.equal(parseSave(p).state.lifeTree.nodes.length,g.state.lifeTree.nodes.length+1);
});

// Candidate 3: branch provenance and next-ID allocation after a fork.
function branched(){
 const g=lived();const index=g.state.lifeTree.nodes.findIndex(n=>n.snapshot?.availableChoices?.length>1);
 assert.ok(index>=0);
 const node=g.state.lifeTree.nodes[index];
 const other=node.snapshot.availableChoices.find(c=>c.id!==node.choiceId);
 return {g,index,node,branch:g.branchFromNode(index,other.id)};
}
for(const [label,edit] of [
 ['event mismatch',b=>{b.eventId='other-event';}],
 ['alternate choice mismatch',b=>{b.alternateChoiceId='not-the-choice';}],
 ['same original and alternate',b=>{b.originalChoiceId=b.alternateChoiceId;}],
 ['negative creation age',b=>{b.createdAtAge=-1;}],
 ['fractional creation age',b=>{b.createdAtAge=2.5;}],
 ['numeric event',b=>{b.eventId=5;}],
 ['numeric original choice',b=>{b.originalChoiceId=42;}]
])test('branch record rejects '+label,()=>{
 const {branch}=branched();const p=createSavePayload(branch);
 edit(p.state.lifeTree.branches[0]);
 const before=structuredClone(p);
 assert.throws(()=>parseSave(p),/Invalid save/);
 assert.deepEqual(p,before);
});
test('branch from a branch allocates a fresh ID and remains loadable',()=>{
 const {g,index,node,branch}=branched();
 const first=branch.state.lifeTree.branches[0];
 assert.equal(first.id,'branch-1');
 assert.equal(branch.state.lifeTree.nextBranchId,2);
 const nextNode=branch.state.lifeTree.nodes[index];
 const backChoice=nextNode.snapshot.availableChoices.find(c=>c.id!==nextNode.choiceId);
 assert.ok(backChoice);
 const nested=branch.branchFromNode(index,backChoice.id);
 assert.deepEqual(nested.state.lifeTree.branches.map(b=>b.id),['branch-1','branch-2']);
 assert.equal(nested.state.lifeTree.nextBranchId,3);
 assert.deepEqual(Game.fromSave(createSavePayload(nested)).state,nested.state);
 assert.equal(g.state.lifeTree.nextBranchId,2);
});
test('old branch entries without optional provenance remain compatible',()=>{
 const p=base();p.state.lifeTree.branches.push({id:'legacy-branch'});
 p.state.lifeTree.currentBranchId='legacy-branch';
 assert.equal(parseSave(p).state.lifeTree.branches[0].id,'legacy-branch');
});
