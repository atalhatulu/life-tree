import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {createDecisionSnapshot,restoreDecisionSnapshot} from '../src/timeline/snapshot.js';

function saved(){return createSavePayload(new Game('cycle73-counter'));}
function checkpoint(){
 const game=new Game('cycle73-snapshot');
 return createDecisionSnapshot(game.state,{id:'example',title:'Example'},
  [{id:'yes',label:'Yes'},{id:'no',label:'No'}],{seed:game.rng.seed,state:game.rng.state});
}
function rejectsSave(label,mutate){
 test(label,()=>{
  const payload=saved();mutate(payload);
  const original=structuredClone(payload);
  assert.throws(()=>parseSave(payload),/Invalid save/);
  assert.deepEqual(payload,original);
  assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save/);
 });
}
function rejectsSnapshot(label,mutate){
 test(label,()=>{
  const snapshot=checkpoint();mutate(snapshot);
  const original=structuredClone(snapshot);
  assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
  assert.deepEqual(snapshot,original);
  assert.throws(()=>Game.fromDecisionSnapshot('cycle73-snapshot',snapshot),/Invalid decision snapshot/);
 });
}

// Candidate 1: the persisted next ID must not collide with any allocated ID.
for(const [name,ids,next] of [
 ['counter equals allocated ID',['branch-1'],1],
 ['counter behind allocated IDs',['branch-2'],2],
 ['counter behind non-contiguous IDs',['branch-2','branch-8'],7],
 ['counter behind largest safe ID',['branch-9007199254740990'],10]
])rejectsSave('rejects stale branch allocator: '+name,p=>{
 p.state.lifeTree.branches=ids.map(id=>({id}));
 p.state.lifeTree.nextBranchId=next;
});
test('explicit safe branch allocator beyond all IDs remains unchanged',()=>{
 const p=saved();p.state.lifeTree.branches=[{id:'branch-2'},{id:'branch-8'}];
 p.state.lifeTree.nextBranchId=9;
 assert.equal(parseSave(p).state.lifeTree.nextBranchId,9);
});
for(const version of [1,2])test('missing legacy branch counter is inferred without changing input, version '+version,()=>{
 const p=saved();p.version=version;
 p.state.lifeTree.branches=[{id:'branch-1'},{id:'custom-branch'},{id:'branch-5'}];
 delete p.state.lifeTree.nextBranchId;
 const original=structuredClone(p);
 assert.equal(parseSave(p).state.lifeTree.nextBranchId,6);
 assert.equal(Game.fromSave(p).state.lifeTree.nextBranchId,6);
 assert.deepEqual(p,original);
});
test('missing counter with only custom IDs retains old default',()=>{
 const p=saved();p.state.lifeTree.branches=[{id:'legacy-branch'}];
 delete p.state.lifeTree.nextBranchId;
 assert.equal(parseSave(p).state.lifeTree.nextBranchId,1);
});

// Candidate 2: checkpoints must not hide malformed nested state collections.
for(const [name,mutate] of [
 ['flags object',s=>{s.state.flags=[];}],
 ['completed events array',s=>{s.state.flags.completedEvents={};}],
 ['completed events entry',s=>{s.state.flags.completedEvents=[''];}],
 ['social object',s=>{s.state.social=null;}],
 ['friends array',s=>{s.state.social.friends='invalid';}],
 ['former partners array',s=>{s.state.social.exPartners=null;}],
 ['children array',s=>{s.state.children={};}],
 ['life goals object',s=>{s.state.lifeGoals='invalid';}],
 ['life goals completed array',s=>{s.state.lifeGoals.completed=null;}],
 ['NPC initiatives object',s=>{s.state.npcInitiatives=[];}],
 ['NPC pending array',s=>{s.state.npcInitiatives.pending={};}],
 ['actions object',s=>{s.state.actions=[];}],
 ['child money object',s=>{s.state.childMoney='invalid';}],
 ['finance debts object',s=>{s.state.finance={debts:'invalid'};}]
])rejectsSnapshot('rejects malformed nested checkpoint '+name,mutate);
test('old checkpoints missing optional nested collections still restore',()=>{
 const s=checkpoint();
 for(const key of ['flags','social','children','lifeGoals','npcInitiatives','actions','childMoney'])delete s.state[key];
 assert.equal(restoreDecisionSnapshot(s).player.age,s.state.player.age);
 assert.equal(Game.fromDecisionSnapshot('cycle73-snapshot',s).state.player.age,s.state.player.age);
});

// Candidate 3: checkpoint's prior timeline must not contain future or reversed ages.
for(const [name,ages] of [
 ['future node',[1]],
 ['negative node',[-1]],
 ['fractional node',[0.5]],
 ['reversed prior nodes',[0,3,2]],
 ['reversed embedded nodes',[0,2,1]]
])rejectsSnapshot('rejects checkpoint '+name,s=>{
 s.state.player.age=3;s.age=3;
 if(name==='future node')s.priorNodes=[{age:4}];
 else if(name==='reversed embedded nodes'){
  delete s.priorNodes;s.state.lifeTree.nodes=ages.map(age=>({age}));
 }else s.priorNodes=ages.map(age=>({age}));
});
for(const [name,ages] of [
 ['future history',[0,4]],
 ['reversed history',[0,2,1]],
 ['invalid history age',[0,'1']]
])rejectsSnapshot('rejects checkpoint '+name,s=>{
 s.state.player.age=3;s.age=3;
 s.state.history=ages.map(age=>({age}));
});
test('checkpoint allows equal ages and missing legacy ages',()=>{
 const s=checkpoint();s.state.player.age=5;s.age=5;
 s.priorNodes=[{age:0},{kind:'legacy'},{age:3},{age:3}];
 s.state.lifeTree.nodes=[]; // compact continuation form
 s.state.history=[{age:0},{kind:'legacy'},{age:5}];
 assert.deepEqual(restoreDecisionSnapshot(s).lifeTree.nodes,s.priorNodes);
});

test('legacy counter recovery permits a new branch without reusing its ID',()=>{
 const game=new Game('cycle73-real-branch');
 while(game.state.player.alive&&game.state.player.age<18){
  const event=game.ageOneYear();
  if(event)game.makeChoice(event,game.eventChoices(event)[0].id);
 }
 const index=game.state.lifeTree.nodes.findIndex(n=>n.snapshot?.availableChoices?.length>1);
 assert.ok(index>=0);
 const node=game.state.lifeTree.nodes[index];
 const alternate=node.snapshot.availableChoices.find(c=>c.id!==node.choiceId).id;
 const first=game.branchFromNode(index,alternate);
 const payload=createSavePayload(first);
 delete payload.state.lifeTree.nextBranchId;
 const loaded=Game.fromSave(payload);
 assert.equal(loaded.state.lifeTree.nextBranchId,2);
 const other=loaded.state.lifeTree.nodes[index].snapshot.availableChoices
  .find(c=>c.id!==loaded.state.lifeTree.nodes[index].choiceId).id;
 const second=loaded.branchFromNode(index,other);
 assert.deepEqual(second.state.lifeTree.branches.map(b=>b.id),['branch-1','branch-2']);
});
test('outer save rejects malformed nested snapshot before load',()=>{
 const game=new Game('cycle73-saved-snapshot');
 while(game.state.player.alive&&game.state.player.age<18){
  const event=game.ageOneYear();
  if(event)game.makeChoice(event,game.eventChoices(event)[0].id);
 }
 const payload=createSavePayload(game);
 const node=payload.state.lifeTree.nodes.find(n=>n.snapshot);
 assert.ok(node);
 node.snapshot.state.social.friends={broken:true};
 const original=structuredClone(payload);
 assert.throws(()=>parseSave(payload),/Invalid save/);
 assert.deepEqual(payload,original);
});
