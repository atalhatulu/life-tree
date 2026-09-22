import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {createSavePayload,parseSave,SAVE_VERSION} from '../src/core/save_system.js';
import {validateState} from '../src/simulation/invariants.js';

function reachHighSchool(seed){
 const game=new Game(seed);
 while(game.state.player.age<14&&game.state.player.alive){
  const event=game.ageOneYear();
  if(event){
   const choices=game.eventChoices(event);
   const choice=event.id==='high-school-path'
    ? choices.find(c=>c.id==='academic')
    : choices[0];
   game.makeChoice(event,choice.id);
  }
 }
 return game;
}

test('v1 saves migrate to current schema automatically',()=>{
 const g=new Game('save-v1-migration');
 autoplay(g,{toAge:25,policy:'human-like'});
 const legacy=createSavePayload(g);
 legacy.version=1;
 delete legacy.schemaVersion;
 delete legacy.state.schemaVersion;
 delete legacy.state.lifeTree.branches;
 delete legacy.state.lifeTree.nextBranchId;
 const migrated=parseSave(legacy);
 assert.equal(migrated.version,SAVE_VERSION);
 assert.equal(migrated.state.schemaVersion,2);
 assert.ok(Array.isArray(migrated.state.lifeTree.branches));
 assert.equal(migrated.migratedFromVersion,1);
});

test('decision snapshots preserve RNG state for branching',()=>{
 const g=reachHighSchool('branch-rng');
 const node=g.state.lifeTree.nodes.find(n=>n.eventId==='high-school-path');
 assert.ok(node?.snapshot?.rng);
 assert.ok(Number.isInteger(node.snapshot.rng.seed));
 assert.ok(Number.isInteger(node.snapshot.rng.state));
});

test('same snapshot and alternate choice produce deterministic future',()=>{
 const source=reachHighSchool('branch-deterministic-v2');
 const nodeIndex=source.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 const payload=createSavePayload(source);
 const a=Game.fromSave(payload);
 const b=Game.fromSave(payload);
 const ba=a.branchFromNode(nodeIndex,'vocational');
 const bb=b.branchFromNode(nodeIndex,'vocational');
 autoplay(ba,{toAge:30,policy:'human-like'});
 autoplay(bb,{toAge:30,policy:'human-like'});
 assert.deepEqual(ba.state,bb.state);
 assert.equal(ba.rng.state,bb.rng.state);
});

test('branch must actually choose a different alternative',()=>{
 const g=reachHighSchool('branch-same-choice');
 const index=g.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 assert.throws(()=>g.branchFromNode(index,'academic'),/must differ/);
});

test('branch metadata records lineage without mutating original nodes',()=>{
 const g=reachHighSchool('branch-lineage');
 const index=g.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 const original=structuredClone(g.state.lifeTree.nodes);
 const branch=g.branchFromNode(index,'vocational');
 assert.deepEqual(g.state.lifeTree.nodes,original);
 assert.equal(branch.state.lifeTree.branches.length,1);
 assert.equal(branch.state.lifeTree.branches[0].parentNodeIndex,index);
 assert.equal(branch.state.lifeTree.branches[0].originalChoiceId,'academic');
 assert.equal(branch.state.lifeTree.branches[0].alternateChoiceId,'vocational');
});

test('invariants catch dead active partner and duplicate child identities',()=>{
 const g=new Game('invariant-cross-system');
 g.state.player.age=35;
 g.state.social.romance={
  id:'dead-partner',name:'Test',surname:'Partner',alive:false,status:'dating',
  age:35,relationship:60,monthlyIncome:0
 };
 const child={...structuredClone(g.state.player),id:'same-child',age:5,relationship:70};
 g.state.children=[structuredClone(child),structuredClone(child)];
 const errors=validateState(g.state);
 assert.ok(errors.some(x=>x.includes('dead partner')));
 assert.ok(errors.some(x=>x.includes('duplicate child id')));
});

test('invariants catch impossible military completion data',()=>{
 const g=new Game('invariant-military');
 g.state.militaryService={
  eligible:true,status:'completed',mode:'standard',serviceMonths:1,
  completedAtAge:22,paidFee:0
 };
 const errors=validateState(g.state);
 assert.ok(errors.includes('invalid standard military duration'));
});

test('normalized fresh state satisfies schema-level invariants',()=>{
 const g=new Game('schema-fresh');
 assert.equal(g.state.schemaVersion,2);
 assert.deepEqual(validateState(g.state),[]);
});
