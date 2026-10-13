import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {availableLifeActions,performLifeAction} from '../src/life/agency_system.js';

function fixture(label){
 const state=new Game('cycle86-'+label).state;
 state.player.age=35;
 state.actions={remaining:3,max:3};
 state.social.friends=[
  {id:'friend',name:'Ali',alive:true,needsSupport:true,relationship:55,trust:55,life:{personalStress:65}}
 ];
 state.children=[
  {id:'child',name:'Ada',alive:true,age:12,relationship:60,
   development:{confidence:30,identityStress:70,parentAttachment:60}}
 ];
 state.social.romance={name:'Ece',alive:true,resentment:60,trust:50,intimacy:50,life:{workStress:70}};
 return state;
}
function assertRejectedWithoutMutation(label,id,change,{error=/Geçersiz|kullanılamıyor/}={}){
 test(label+' rejects without state mutation',()=>{
  const state=fixture(label);
  change(state);
  const before=structuredClone(state);
  assert.throws(()=>performLifeAction(state,id),error);
  assert.deepEqual(state,before);
  assert.equal(availableLifeActions(state).some(action=>action.id===id),false);
  assert.deepEqual(state,before);
 });
}
// Candidate 1: malformed lists or members cannot crash the menu or redirect
// a direct action to a non-person. Healthy collections remain independent.
for(const [label,value] of [
 ['friend list string','invalid'],['friend list object',{}],['friend list number',23]
])assertRejectedWithoutMutation(label,'support-friend:friend',s=>{s.social.friends=value;});
for(const [label,value] of [
 ['child list string','invalid'],['child list object',{}],['child list number',23]
])assertRejectedWithoutMutation(label,'mentor-child:child',s=>{s.children=value;});
for(const [label,value] of [
 ['null friend',null],['string friend','broken'],['array friend',[]]
])test(label+' is skipped while another friend remains selectable',()=>{
 const state=fixture(label);
 state.social.friends.unshift(value);
 const before=structuredClone(state);
 assert.equal(availableLifeActions(state).some(a=>a.id==='support-friend:friend'),true);
 assert.match(performLifeAction(state,'support-friend:friend'),/Ali/);
 assert.equal(state.social.friends[1].needsSupport,false);
 assert.deepEqual(state.social.friends[0],before.social.friends[0]);
});
for(const [label,value] of [
 ['null child',null],['string child','broken'],['array child',[]]
])test(label+' is skipped while another child remains selectable',()=>{
 const state=fixture(label);
 state.children.unshift(value);
 const before=structuredClone(state);
 assert.equal(availableLifeActions(state).some(a=>a.id==='mentor-child:child'),true);
 assert.match(performLifeAction(state,'mentor-child:child'),/Ada/);
 assert.equal(state.children[1].relationship,64);
 assert.deepEqual(state.children[0],before.children[0]);
});
// Candidate 2: do not silently overwrite malformed historical timestamps or
// accept coercible/fractional ages as eligible mentoring ages.
for(const [label,value] of [
 ['friend contact future',36],['friend contact negative',-1],
 ['friend contact string','34'],['friend contact fraction',34.5],
 ['friend contact NaN',NaN],['friend contact infinity',Infinity],
 ['friend contact unsafe',Number.MAX_SAFE_INTEGER+1]
])assertRejectedWithoutMutation(label,'support-friend:friend',s=>{s.social.friends[0].lastContactAge=value;});
for(const [label,value] of [
 ['child age string','12'],['child age fraction',12.5],
 ['child age NaN',NaN],['child age infinity',Infinity],
 ['child age unsafe',Number.MAX_SAFE_INTEGER+1]
])assertRejectedWithoutMutation(label,'mentor-child:child',s=>{s.children[0].age=value;});
// Candidate 3: menu must hide otherwise eligible actions that fail the exact
// preflight used by the direct API, including nested legacy subrecords.
for(const [label,id,change] of [
 ['partner invalid trust','support-partner',s=>{s.social.romance.trust='50';}],
 ['partner invalid intimacy','support-partner',s=>{s.social.romance.intimacy=NaN;}],
 ['partner malformed life','support-partner',s=>{s.social.romance.life=[];}],
 ['friend invalid trust','support-friend:friend',s=>{s.social.friends[0].trust='55';}],
 ['friend malformed life','support-friend:friend',s=>{s.social.friends[0].life=[];}],
 ['child invalid relationship','mentor-child:child',s=>{s.children[0].relationship=NaN;}],
 ['child invalid attachment','mentor-child:child',s=>{s.children[0].development.parentAttachment='60';}]
])assertRejectedWithoutMutation(label,id,change);

test('invalid first matching ID cannot expose a second entry that direct API cannot use',()=>{
 const state=fixture('duplicate-invalid-first');
 state.social.friends[0].trust=NaN;
 state.social.friends.push({id:'friend',name:'Second',alive:true,needsSupport:true,relationship:60,trust:60});
 state.children[0].relationship=NaN;
 state.children.push({id:'child',name:'Second child',alive:true,age:12,relationship:60,
  development:{confidence:30,identityStress:70,parentAttachment:60}});
 const before=structuredClone(state);
 assert.equal(availableLifeActions(state).some(a=>a.id==='support-friend:friend'),false);
 assert.equal(availableLifeActions(state).some(a=>a.id==='mentor-child:child'),false);
 assert.throws(()=>performLifeAction(state,'support-friend:friend'),/Geçersiz/);
 assert.throws(()=>performLifeAction(state,'mentor-child:child'),/Geçersiz/);
 assert.deepEqual(state,before);
});

test('valid support, past timestamp, and legacy absent timestamp remain functional',()=>{
 const state=fixture('valid');
 state.social.friends[0].lastContactAge=34;
 const ids=availableLifeActions(state).map(a=>a.id);
 for(const id of ['support-partner','support-friend:friend','mentor-child:child'])assert.ok(ids.includes(id),id);
 performLifeAction(state,'support-friend:friend');
 performLifeAction(state,'mentor-child:child');
 performLifeAction(state,'support-partner');
 assert.equal(state.social.friends[0].lastContactAge,35);
 assert.equal(state.children[0].relationship,64);
 assert.equal(state.actions.remaining,0);
});

test('legacy null collections are empty and do not block partner support',()=>{
 const state=fixture('null-legacy');
 state.social.friends=null;state.children=null;
 assert.deepEqual(availableLifeActions(state).map(a=>a.id),['support-partner']);
 assert.match(performLifeAction(state,'support-partner'),/Ece/);
});
