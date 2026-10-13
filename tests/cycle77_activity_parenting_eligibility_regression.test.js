import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';
import {pendingYoungChild,pendingTeenEducation,setUpbringingStyle,setChildEducationPlan} from '../src/family/parenting_decisions.js';

// Candidate 1: direct activity calls must reject malformed or depleted action
// ledgers before changing state or advancing RNG.
for(const remaining of [0,-1,0.5,NaN,Infinity,'2',null,undefined,Number.MAX_SAFE_INTEGER+1]){
 test('activity with invalid action balance '+String(remaining)+' is atomic',()=>{
  const state=new Game('cycle77-activity-'+String(remaining)).state;
  state.player.age=30;
  state.actions={remaining,max:3};
  const rng=new RNG('cycle77-activity-rng');
  const before=structuredClone(state),rngBefore=rng.state;
  // Availability lists potential activities independently of the action budget.
  assert.deepEqual(state,before);
  assert.throws(()=>performActivity(state,'exercise',rng),/aksiyon hakkın kalmadı/);
  assert.deepEqual(state,before);
  assert.equal(rng.state,rngBefore);
 });
}
test('missing legacy action ledger still initializes on valid activity',()=>{
 const state=new Game('cycle77-legacy-actions').state;
 state.player.age=30;
 delete state.actions;
 assert.ok(availableActivities(state).some(a=>a.id==='exercise'));
 performActivity(state,'exercise',new RNG('cycle77-legacy-rng'));
 assert.equal(state.actions.remaining,2);
});
test('valid activity balance of one consumes exactly one action',()=>{
 const state=new Game('cycle77-one-action').state;
 state.player.age=30;
 state.actions={remaining:1,max:3};
 performActivity(state,'exercise',new RNG('cycle77-one-action-rng'));
 assert.equal(state.actions.remaining,0);
 assert.throws(()=>performActivity(state,'hobby',new RNG('cycle77-exhausted')),/aksiyon hakkın kalmadı/);
});

function childState(seed,age){
 const state=new Game(seed).state;
 state.player.age=45;
 const child={
  id:'child-1',name:'Ada',age,alive:true,relationship:70,
  personality:{curiosity:50,sociability:50,discipline:50,patience:50,ambition:50},
  parenting:{involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0}
 };
 state.children=[child];
 return {state,child};
}
// Candidate 2: a parenting-style decision is only offered for ages 3..7.
for(const age of [0,2,8,15,18]){
 test('parenting style outside age window '+age+' cannot be forced',()=>{
  const {state}=childState('cycle77-style-'+age,age);
  const before=structuredClone(state);
  assert.equal(pendingYoungChild(state),null);
  assert.throws(()=>setUpbringingStyle(state,'child-1','supportive'),/yaş|uygun|kullanılamıyor/i);
  assert.deepEqual(state,before);
 });
}
for(const age of [3,7]){
 test('parenting style boundary age '+age+' still works',()=>{
  const {state,child}=childState('cycle77-style-valid-'+age,age);
  assert.equal(pendingYoungChild(state),child);
  setUpbringingStyle(state,child.id,'supportive');
  assert.equal(child.upbringingStyle,'supportive');
 });
}
test('replaying a previously chosen style after aging is idempotent',()=>{
 const {state,child}=childState('cycle77-style-replay',4);
 setUpbringingStyle(state,child.id,'free');
 child.age=18;
 const before=structuredClone(state);
 assert.equal(setUpbringingStyle(state,child.id,'free'),child);
 assert.deepEqual(state,before);
});

// Candidate 3: education choices are only offered for ages 16..18.
for(const age of [0,12,15,19,25]){
 test('education plan outside age window '+age+' cannot be forced',()=>{
  const {state}=childState('cycle77-education-'+age,age);
  const before=structuredClone(state);
  assert.equal(pendingTeenEducation(state),null);
  assert.throws(()=>setChildEducationPlan(state,'child-1','vocational'),/yaş|uygun|kullanılamıyor/i);
  assert.deepEqual(state,before);
 });
}
for(const age of [16,18]){
 test('education plan boundary age '+age+' still works',()=>{
  const {state,child}=childState('cycle77-education-valid-'+age,age);
  assert.equal(pendingTeenEducation(state),child);
  setChildEducationPlan(state,child.id,'vocational');
  assert.equal(child.educationPlan,'vocational');
 });
}
test('replaying a previously chosen education plan after aging is idempotent',()=>{
 const {state,child}=childState('cycle77-education-replay',16);
 // University funding is now checked by the direct API as well as the event.
 state.finance??={};state.finance.cash=150000;
 setChildEducationPlan(state,child.id,'university');
 child.age=24;
 const before=structuredClone(state);
 assert.equal(setChildEducationPlan(state,child.id,'university'),child);
 assert.deepEqual(state,before);
});
