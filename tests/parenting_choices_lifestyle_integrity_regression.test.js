import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {pendingYoungChild,pendingTeenEducation,setUpbringingStyle,setChildEducationPlan} from '../src/family/parenting_decisions.js';
import {processChildDevelopmentYear} from '../src/family/child_development_system.js';
import {setLifestyle} from '../src/lifestyle/lifestyle_system.js';

function family(seed='choice-integrity'){
 const state=new Game(seed).state;
 state.player.age=45;
 state.year=2071;
 const child={
  id:'child-1',name:'Ada',age:16,alive:true,relationship:65,
  health:{current:85},
  personality:{curiosity:50,sociability:55,discipline:50,patience:50,ambition:45},
  parenting:{involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0}
 };
 state.children=[child];
 return {state,child};
}
function snapshot(value){return structuredClone(value);}

test('parenting style repeated decision never re-awards relationship or personality',()=>{
 const {state,child}=family('style-repeat');child.age=4;
 setUpbringingStyle(state,child.id,'supportive');
 const before=snapshot(child);
 assert.equal(setUpbringingStyle(state,child.id,'supportive'),child);
 assert.deepEqual(child,before);
 state.year++;
 assert.equal(setUpbringingStyle(state,child.id,'supportive'),child);
 assert.deepEqual(child,before);
});

test('parenting style cannot be replaced or set to unknown value, without mutation',()=>{
 const {state,child}=family('style-invalid');child.age=5;
 const original=snapshot(child);
 assert.throws(()=>setUpbringingStyle(state,child.id,'unknown'));
 assert.deepEqual(child,original);
 setUpbringingStyle(state,child.id,'strict');
 const chosen=snapshot(child);
 assert.throws(()=>setUpbringingStyle(state,child.id,'free'));
 assert.deepEqual(child,chosen);
});

test('parenting style remains one-time after serialization and for legacy choices',()=>{
 const {state,child}=family('style-save');child.age=4;
 setUpbringingStyle(state,child.id,'free');
 const saved=snapshot(state);
 const old=snapshot(saved.children[0]);
 setUpbringingStyle(saved,child.id,'free');
 assert.deepEqual(saved.children[0],old);
});

test('deceased children cannot receive parenting choices or be offered parenting events',()=>{
 const {state,child}=family('style-dead');child.age=4;child.alive=false;
 const before=snapshot(child);
 assert.equal(pendingYoungChild(state),null);
 assert.throws(()=>setUpbringingStyle(state,child.id,'supportive'));
 assert.deepEqual(child,before);
 child.age=16;
 assert.equal(pendingTeenEducation(state),null);
 assert.throws(()=>setChildEducationPlan(state,child.id,'university'));
 assert.deepEqual({...child,age:4},before);
});

test('education plan repeated decision never re-awards ambition or accumulated support',()=>{
 const {state,child}=family('plan-repeat');
 state.finance??={};state.finance.cash=150000;
 setChildEducationPlan(state,child.id,'university');
 const before=snapshot(child);
 assert.equal(setChildEducationPlan(state,child.id,'university'),child);
 assert.deepEqual(child,before);
 state.year++;
 setChildEducationPlan(state,child.id,'university');
 assert.deepEqual(child,before);
});

test('education plan cannot be replaced or invalid, without partial mutation',()=>{
 const {state,child}=family('plan-invalid');
 const original=snapshot(child);
 assert.throws(()=>setChildEducationPlan(state,child.id,'wrong'));
 assert.deepEqual(child,original);
 setChildEducationPlan(state,child.id,'vocational');
 const chosen=snapshot(child);
 assert.throws(()=>setChildEducationPlan(state,child.id,'independent'));
 assert.deepEqual(child,chosen);
});

test('education plan remains one-time after serialization',()=>{
 const {state,child}=family('plan-save');
 setChildEducationPlan(state,child.id,'independent');
 const restored=snapshot(state);
 const before=snapshot(restored.children[0]);
 setChildEducationPlan(restored,child.id,'independent');
 assert.deepEqual(restored.children[0],before);
});

test('explicit university and vocational education decisions survive age-18 auto-direction',()=>{
 for(const plan of ['university','vocational']){
  const {state,child}=family('plan-age18-'+plan);
  if(plan==='university'){state.finance??={};state.finance.cash=150000;}
  setChildEducationPlan(state,child.id,plan);
  child.age=18;
  processChildDevelopmentYear(state,new RNG('plan-age18-'+plan));
  assert.equal(child.educationPlan,plan);
 }
});

test('independent education decision resolves to a concrete path at adulthood',()=>{
 const {state,child}=family('plan-independent');
 setChildEducationPlan(state,child.id,'independent');
 child.age=18;
 processChildDevelopmentYear(state,new RNG('plan-independent'));
 assert.ok(['university','vocational','work'].includes(child.educationPlan));
});

test('lifestyle multi-field update is atomic when a later field is invalid',()=>{
 const {state}=family('lifestyle-atomic');
 state.finance={lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 const before=snapshot(state.finance.lifestyle);
 assert.throws(()=>setLifestyle(state,{food:'healthy',clothing:'invalid'}));
 assert.deepEqual(state.finance.lifestyle,before);
});

test('lifestyle rejects unsupported keys and non-object changes atomically',()=>{
 const {state}=family('lifestyle-invalid');
 state.finance={lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 const before=snapshot(state.finance.lifestyle);
 assert.throws(()=>setLifestyle(state,{food:'premium',leisure:'family'}));
 assert.deepEqual(state.finance.lifestyle,before);
 for(const invalid of [null,[], 'food', 4]){
  assert.throws(()=>setLifestyle(state,invalid));
  assert.deepEqual(state.finance.lifestyle,before);
 }
});

test('lifestyle valid batch updates remain supported',()=>{
 const {state}=family('lifestyle-valid');
 state.finance={lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 setLifestyle(state,{food:'healthy',clothing:'premium',transport:'car'});
 assert.deepEqual(state.finance.lifestyle,{housing:'family',food:'healthy',clothing:'premium',transport:'car'});
});
