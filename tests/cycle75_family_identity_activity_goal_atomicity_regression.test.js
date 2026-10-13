import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {performActivity} from '../src/life/activity_system.js';
import {performLifeAction} from '../src/life/agency_system.js';
import {focusLifeGoal} from '../src/life/life_goal_system.js';
import {RNG} from '../src/core/rng.js';

function saveCase(name,mutate){
 test('family identity: '+name,()=>{
  const payload=createSavePayload(new Game('cycle75-family'));
  mutate(payload.state);
  const before=structuredClone(payload);
  assert.throws(()=>parseSave(payload),/Invalid save.*family.*ID/i);
  assert.deepEqual(payload,before);
  assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save/);
 });
}
// Candidate 1: every founder, player and sibling must have a unique stable ID.
for(const [name,mutate] of [
 ['missing mother ID',s=>{delete s.parents.mother.id;}],
 ['empty father ID',s=>{s.parents.father.id='';}],
 ['nonstring grandmother ID',s=>{s.grandparents.maternal.grandmother.id=42;}],
 ['duplicate parent IDs',s=>{s.parents.father.id=s.parents.mother.id;}],
 ['grandparent aliases parent',s=>{s.grandparents.paternal.grandfather.id=s.parents.father.id;}],
 ['player aliases parent',s=>{s.player.id=s.parents.mother.id;}],
 ['sibling aliases player',s=>{s.siblings.push({id:s.player.id,age:5,alive:true});}],
 ['sibling aliases sibling',s=>{s.siblings.push({id:'same',age:7,alive:true},{id:'same',age:4,alive:true});}],
 ['deceased relative with missing ID',s=>{s.grandparents.maternal.grandmother.alive=false;delete s.grandparents.maternal.grandmother.id;}]
])saveCase(name,mutate);
test('unique family IDs and legacy deceased relative missing age still load',()=>{
 const payload=createSavePayload(new Game('cycle75-family-valid'));
 payload.state.grandparents.maternal.grandmother.alive=false;
 delete payload.state.grandparents.maternal.grandmother.age;
 assert.doesNotThrow(()=>parseSave(payload));
});

// Candidate 2: malformed activity IDs should reject cleanly without changing RNG or state.
for(const id of [null,undefined,0,23,{},[],true,Symbol('activity')]){
 test('invalid activity ID '+String(id)+' is atomic',()=>{
  const state=new Game('cycle75-activity').state;
  state.player.age=25;
  const rng=new RNG('cycle75-activity-rng');
  const before=structuredClone(state),rngBefore=rng.state;
  assert.throws(()=>performActivity(state,id,rng),/Bilinmeyen aktivite/);
  assert.deepEqual(state,before);
  assert.equal(rng.state,rngBefore);
 });
}
test('valid activity still consumes one action',()=>{
 const state=new Game('cycle75-activity-valid').state;
 state.player.age=25;
 state.actions={max:3,remaining:3};
 const before=state.actions.remaining;
 assert.match(performActivity(state,'hobby',new RNG('cycle75-valid')),/.+/);
 assert.equal(state.actions.remaining,before-1);
});

// Candidate 3: failed goal-focus attempts must not create a goal ledger or action ledger.
for(const setup of [
 s=>{delete s.lifeGoals;},
 s=>{s.lifeGoals={active:null,completed:[],history:[]};},
 s=>{s.lifeGoals={active:null};}
]){
 test('missing active goal focus does not mutate state',()=>{
  const state=new Game('cycle75-goal').state;
  state.actions={max:3,remaining:3};
  setup(state);
  const before=structuredClone(state);
  assert.throws(()=>focusLifeGoal(state),/Önce bir yaşam hedefi/);
  assert.deepEqual(state,before);
  assert.throws(()=>performLifeAction(state,'focus-goal'),/Önce bir yaşam hedefi/);
  assert.deepEqual(state,before);
 });
}
test('goal focus with no action ledger fails without partial progress',()=>{
 const state=new Game('cycle75-goal-actions').state;
 state.player.age=30;
 state.lifeGoals={active:{id:'wellbeing',label:'Wellbeing',progress:5,lastFocusedAge:null},completed:[],history:[]};
 delete state.actions;
 const before=structuredClone(state);
 assert.throws(()=>focusLifeGoal(state),/aksiyon hakkın kalmadı/);
 assert.deepEqual(state,before);
});
