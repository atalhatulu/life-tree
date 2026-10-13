import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {createDecisionSnapshot,restoreDecisionSnapshot} from '../src/timeline/snapshot.js';

function saved(){return createSavePayload(new Game('cycle69-save-shape'));}
function rejectsSave(edit){
 const input=saved();edit(input);
 const before=structuredClone(input);
 assert.throws(()=>parseSave(input),/Invalid save/);
 assert.deepEqual(input,before);
 assert.throws(()=>parseSave(JSON.stringify(input)),/Invalid save/);
}

// 1. An explicitly null object/collection is corruption, not an absent legacy field.
for(const [name,edit] of [
 ['flags',p=>p.state.flags=null],
 ['lifeTree',p=>p.state.lifeTree=null],
 ['social',p=>p.state.social=null],
 ['lifeGoals',p=>p.state.lifeGoals=null],
 ['npcInitiatives',p=>p.state.npcInitiatives=null],
 ['completedEvents',p=>p.state.flags.completedEvents=null],
 ['branches',p=>p.state.lifeTree.branches=null],
 ['friends',p=>p.state.social.friends=null],
 ['children',p=>p.state.children=null],
 ['lifeGoals.history',p=>p.state.lifeGoals.history=null],
 ['npcInitiatives.pending',p=>p.state.npcInitiatives.pending=null]
])test('explicit null save collection rejected: '+name,()=>rejectsSave(edit));
test('missing optional legacy save collections still migrate',()=>{
 const p=saved();p.version=1;
 delete p.state.lifeTree.branches;delete p.state.social.friends;
 assert.ok(Array.isArray(parseSave(p).state.lifeTree.branches));
 assert.ok(Array.isArray(parseSave(p).state.social.friends));
});

function checkpoint(){
 const game=new Game('cycle69-snapshot');
 game.state.lifeTree.nodes=[{id:'node-1',eventId:'first',choiceId:'yes'}];
 return createDecisionSnapshot(game.state,{id:'example',title:'Example'},[],{seed:game.rng.seed,state:game.rng.state});
}
// 2. A duplicate checkpoint node list must not silently replace a different history.
test('snapshot rejects conflicting priorNodes vs embedded nodes',()=>{
 const snap=checkpoint();snap.priorNodes[0].choiceId='no';
 assert.throws(()=>restoreDecisionSnapshot(snap),/Invalid decision snapshot/);
});
test('snapshot rejects malformed embedded node entries',()=>{
 for(const value of [null,7,'bad',[]]){
  const snap=checkpoint();snap.state.lifeTree.nodes=[value];
  assert.throws(()=>restoreDecisionSnapshot(snap),/Invalid decision snapshot/);
 }
});
test('snapshot rejects malformed embedded branch entries',()=>{
 for(const value of [null,7,'bad',[]]){
  const snap=checkpoint();snap.state.lifeTree.branches=[value];
  assert.throws(()=>restoreDecisionSnapshot(snap),/Invalid decision snapshot/);
 }
});
test('compact continuation checkpoint restores priorNodes when embedded nodes are empty',()=>{
 const snap=checkpoint();snap.state.lifeTree.nodes=[];
 assert.deepEqual(restoreDecisionSnapshot(snap).lifeTree.nodes,snap.priorNodes);
});
test('valid snapshot node lists and legacy omitted priorNodes restore',()=>{
 const snap=checkpoint();
 assert.deepEqual(restoreDecisionSnapshot(snap).lifeTree.nodes,snap.priorNodes);
 delete snap.priorNodes;
 assert.deepEqual(restoreDecisionSnapshot(snap).lifeTree.nodes,snap.state.lifeTree.nodes);
});

function school(){
 const game=new Game('cycle69-branch-provenance');
 while(game.state.player.alive&&game.state.player.age<14){
  const event=game.ageOneYear();
  if(event){
   const choice=event.id==='high-school-path'
    ?game.eventChoices(event).find(c=>c.id==='academic')
    :game.eventChoices(event)[0];
   game.makeChoice(event,choice.id);
  }
 }
 const index=game.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 assert.ok(index>=0);
 return {game,index};
}
// 3. Branches must refer to the exact saved decision and an integer node index.
test('branch rejects coercible but noninteger node indices without mutation',()=>{
 const {game,index}=school();
 for(const invalid of [String(index),index+0.5,null,NaN,Infinity,-1]){
  const before=structuredClone(game.state);
  assert.throws(()=>game.branchFromNode(invalid,'vocational'),/Invalid Life Tree node index/);
  assert.deepEqual(game.state,before);
 }
});
test('branch rejects a node whose event ID disagrees with its checkpoint',()=>{
 const {game,index}=school();
 game.state.lifeTree.nodes[index].snapshot.eventId='wrong-event';
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'vocational'),/Life Tree decision snapshot mismatch/);
 assert.deepEqual(game.state,before);
});
test('branch rejects a node whose original choice is absent from checkpoint',()=>{
 const {game,index}=school();
 game.state.lifeTree.nodes[index].snapshot.availableChoices=[];
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'vocational'),/Life Tree decision snapshot mismatch/);
 assert.deepEqual(game.state,before);
});
test('branch rejects alternate absent from the original checkpoint choices',()=>{
 const {game,index}=school();
 game.state.lifeTree.nodes[index].snapshot.availableChoices=
  game.state.lifeTree.nodes[index].snapshot.availableChoices.filter(c=>c.id==='academic');
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'vocational'),/Unknown or unavailable choice/);
 assert.deepEqual(game.state,before);
});
test('valid alternate branch still succeeds after provenance checks',()=>{
 const {game,index}=school();
 const branch=game.branchFromNode(index,'vocational');
 assert.equal(branch.state.education.path,'vocational');
});
