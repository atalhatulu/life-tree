import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';

function saved(){return createSavePayload(new Game('cycle71-save-integrity'));}
function reject(label,mutate){
 test(label,()=>{
  const payload=saved();mutate(payload);
  const before=structuredClone(payload);
  assert.throws(()=>parseSave(payload),/Invalid save/);
  assert.deepEqual(payload,before);
  assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save/);
 });
}
// Candidate 1: age metadata in history cannot exceed the saved life.
for(const [label,age] of [['negative',-1],['fractional',0.5],['future',1],['text','0'],['null',null],['unsafe',Number.MAX_SAFE_INTEGER+1]]){
 reject('history rejects '+label+' age',p=>p.state.history.push({kind:'choice',age}));
}
// Candidate 2: the same guard applies to persisted decision nodes.
for(const [label,age] of [['negative',-1],['fractional',0.5],['future',1],['text','0'],['null',null],['unsafe',Number.MAX_SAFE_INTEGER+1]]){
 reject('life tree rejects '+label+' node age',p=>p.state.lifeTree.nodes.push({eventId:'test',age}));
}
// Candidate 3: malformed branch identities and references must be rejected.
for(const [label,mutate] of [
 ['missing branch ID',p=>p.state.lifeTree.branches.push({})],
 ['empty branch ID',p=>p.state.lifeTree.branches.push({id:''})],
 ['numeric branch ID',p=>p.state.lifeTree.branches.push({id:5})],
 ['duplicate branch ID',p=>p.state.lifeTree.branches.push({id:'branch-1'},{id:'branch-1'})],
 ['negative parent index',p=>p.state.lifeTree.branches.push({id:'branch-1',parentNodeIndex:-1})],
 ['fractional parent index',p=>p.state.lifeTree.branches.push({id:'branch-1',parentNodeIndex:0.5})],
 ['dangling parent index',p=>p.state.lifeTree.branches.push({id:'branch-1',parentNodeIndex:0})],
 ['invalid next ID',p=>{p.state.lifeTree.nextBranchId=0;}],
 ['unsafe next ID',p=>{p.state.lifeTree.nextBranchId=Number.MAX_SAFE_INTEGER+1;}],
 ['unknown current branch',p=>{p.state.lifeTree.currentBranchId='branch-99';}],
 ['numeric current branch',p=>{p.state.lifeTree.currentBranchId=1;}]
])reject('branch integrity rejects '+label,mutate);

test('valid historical entries, decisions and branched lives survive save/load',()=>{
 const game=new Game('cycle71-valid-lives');
 for(let i=0;i<20;i++){
  const event=game.ageOneYear();
  if(event)game.makeChoice(event,game.eventChoices(event)[0].id);
 }
 assert.ok(game.state.history.length>0);
 assert.ok(game.state.lifeTree.nodes.length>0);
 assert.deepEqual(Game.fromSave(createSavePayload(game)).state,game.state);
 const index=game.state.lifeTree.nodes.findIndex(node=>node.snapshot?.availableChoices?.length>1);
 assert.ok(index>=0);
 const node=game.state.lifeTree.nodes[index];
 const other=node.snapshot.availableChoices.find(choice=>choice.id!==node.choiceId);
 const branch=game.branchFromNode(index,other.id);
 assert.deepEqual(Game.fromSave(createSavePayload(branch)).state,branch.state);
});
test('legacy entries without age or optional branch metadata remain compatible',()=>{
 const payload=saved();
 payload.state.history.push({kind:'legacy'});
 payload.state.lifeTree.nodes.push({eventId:'legacy'});
 payload.state.lifeTree.branches.push({id:'legacy-branch'});
 payload.state.lifeTree.currentBranchId='legacy-branch';
 delete payload.state.lifeTree.nextBranchId;
 assert.equal(parseSave(payload).state.lifeTree.nextBranchId,1);
 assert.equal(Game.fromSave(payload).state.lifeTree.branches.length,1);
});
