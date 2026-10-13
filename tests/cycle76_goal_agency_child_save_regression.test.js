import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {availableLifeGoals,setLifeGoal} from '../src/life/life_goal_system.js';
import {availableLifeActions,performLifeAction} from '../src/life/agency_system.js';

// Candidate 1: reading goal choices or rejecting an invalid goal must not
// silently migrate legacy saves or create a goal ledger.
for(const id of ['not-a-goal',null,42,{},'']){
 test('invalid life goal '+String(id)+' leaves legacy state unchanged',()=>{
  const state=new Game('cycle76-goal-'+String(id)).state;
  state.player.age=30;
  delete state.lifeGoals;
  const before=structuredClone(state);
  assert.throws(()=>setLifeGoal(state,id),/Bu yaşam hedefi/);
  assert.deepEqual(state,before);
 });
}
test('listing goals on legacy state is read-only',()=>{
 const state=new Game('cycle76-goal-menu').state;
 state.player.age=30;
 delete state.lifeGoals;
 const before=structuredClone(state);
 assert.ok(availableLifeGoals(state).some(goal=>goal.id==='wellbeing'));
 assert.deepEqual(state,before);
});
test('valid goal selection still initializes legacy ledger',()=>{
 const state=new Game('cycle76-goal-valid').state;
 state.player.age=30;
 delete state.lifeGoals;
 assert.equal(setLifeGoal(state,'wellbeing').id,'wellbeing');
 assert.deepEqual(state.lifeGoals.completed,[]);
 assert.deepEqual(state.lifeGoals.history,[]);
});

// Candidate 2: all life actions must validate the action ledger before
// touching friends, children or partners, not just focus-goal.
const setups={
 partner:s=>{s.social.romance={name:'Ece',alive:true,resentment:60,trust:40,life:{workStress:70}};},
 friend:s=>{s.social.friends=[{id:'friend',name:'Ali',alive:true,needsSupport:true,relationship:50}];},
 child:s=>{s.children=[{id:'child',name:'Ada',alive:true,age:12,relationship:50,development:{identityStress:65,confidence:30,parentAttachment:45}}];}
};
for(const [kind,id] of [['partner','support-partner'],['friend','support-friend:friend'],['child','mentor-child:child']]){
 for(const remaining of [undefined,-1,0.5,NaN,Infinity]){
  test(kind+' action with invalid action balance '+String(remaining)+' is atomic',()=>{
   const state=new Game('cycle76-agency-'+kind).state;
   state.player.age=35;
   setups[kind](state);
   if(remaining===undefined)delete state.actions;
   else state.actions={max:3,remaining};
   const before=structuredClone(state);
   assert.throws(()=>performLifeAction(state,id),/aksiyon hakkın kalmadı/);
   assert.deepEqual(state,before);
  });
 }
}
test('available life actions hide choices with exhausted action balance',()=>{
 const state=new Game('cycle76-agency-menu').state;
 state.player.age=35;
 setups.friend(state);
 state.actions.remaining=0;
 assert.deepEqual(availableLifeActions(state),[]);
});
test('valid friend support still consumes exactly one action',()=>{
 const state=new Game('cycle76-agency-valid').state;
 state.player.age=35;
 setups.friend(state);
 state.actions={max:3,remaining:2};
 assert.match(performLifeAction(state,'support-friend:friend'),/Ali/);
 assert.equal(state.actions.remaining,1);
 assert.equal(state.social.friends[0].needsSupport,false);
});

// Candidate 3: descendants are addressed by ID and incremented annually;
// malformed saved descendants must be rejected before state restoration.
const child=(id='child-1',age=4)=>({id,name:'Ada',age,alive:true,relationship:70,health:{current:80}});
for(const [label,mutate] of [
 ['null entry',s=>s.children.push(null)],
 ['array entry',s=>s.children.push([])],
 ['missing ID',s=>s.children.push({...child(),id:undefined})],
 ['empty ID',s=>s.children.push(child(''))],
 ['numeric ID',s=>s.children.push(child(5))],
 ['duplicate IDs',s=>s.children.push(child('same'),child('same'))],
 ['negative age',s=>s.children.push(child('young',-1))],
 ['fractional age',s=>s.children.push(child('young',2.5))],
 ['missing living age',s=>s.children.push({...child(),age:undefined})],
 ['unsafe age',s=>s.children.push(child('unsafe',Number.MAX_SAFE_INTEGER+1))],
 ['non-numeric age',s=>s.children.push(child('bad','young'))]
]){
 test('invalid descendant save '+label+' is rejected without mutation',()=>{
  const payload=createSavePayload(new Game('cycle76-child-'+label));
  payload.state.player.age=35;
  payload.savedAtAge=35;
  mutate(payload.state);
  const before=structuredClone(payload);
  assert.throws(()=>parseSave(payload),/Invalid save.*child/i);
  assert.deepEqual(payload,before);
  assert.throws(()=>Game.fromSave(payload),/Invalid save/);
 });
}
test('valid descendants and deceased legacy descendant without age load',()=>{
 const payload=createSavePayload(new Game('cycle76-child-valid'));
 payload.state.player.age=35;
 payload.savedAtAge=35;
 payload.state.children=[child('living',6),{...child('deceased'),alive:false,age:undefined,id:'deceased'}];
 const restored=parseSave(payload);
 assert.equal(restored.state.children.length,2);
 assert.equal(restored.state.children[0].age,6);
});
