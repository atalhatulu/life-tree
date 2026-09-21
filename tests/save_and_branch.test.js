import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {serializeGame,createSavePayload,parseSave} from '../src/core/save_system.js';

test('serialized save restores identical state',()=>{
 const original=new Game('save-roundtrip');
 autoplay(original,{toAge:32,policy:'balanced'});
 const restored=Game.fromSave(serializeGame(original));
 assert.equal(restored.seedText,original.seedText);
 assert.deepEqual(restored.state,original.state);
 assert.equal(restored.rng.seed,original.rng.seed);
 assert.equal(restored.rng.state,original.rng.state);
});

test('continuation from same save remains deterministic',()=>{
 const original=new Game('save-determinism');
 autoplay(original,{toAge:35,policy:'balanced'});
 const payload=createSavePayload(original);

 const a=Game.fromSave(payload);
 const b=Game.fromSave(payload);
 autoplay(a,{toAge:60,policy:'balanced'});
 autoplay(b,{toAge:60,policy:'balanced'});

 assert.deepEqual(a.state,b.state);
});

test('branching from high-school decision creates independent alternate life',()=>{
 const original=new Game('branch-school');

 while(original.state.player.age<14&&original.state.player.alive){
  const event=original.ageOneYear();
  if(event){
   const choices=original.eventChoices(event);
   const choice=event.id==='high-school-path'
    ? choices.find(c=>c.id==='academic')
    : (choices.find(c=>c.id==='embrace')??choices[0]);
   original.makeChoice(event,choice.id);
  }
 }

 const nodeIndex=original.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 assert.ok(nodeIndex>=0);
 const originalNode=original.state.lifeTree.nodes[nodeIndex];
 assert.equal(originalNode.choiceId,'academic');
 assert.ok(originalNode.snapshot);
 assert.ok(originalNode.snapshot.availableChoices.some(c=>c.id==='vocational'));

 const branched=original.branchFromNode(nodeIndex,'vocational');
 const branchedNode=branched.state.lifeTree.nodes.at(-1);

 assert.equal(original.state.education.path,'academic');
 assert.equal(branched.state.education.path,'vocational');
 assert.equal(branchedNode.eventId,'high-school-path');
 assert.equal(branchedNode.choiceId,'vocational');
 assert.notDeepEqual(branched.state,original.state);
});

test('invalid save payload is rejected',()=>{
 assert.throws(()=>parseSave('{"version":999}'),/Invalid save/);
});
