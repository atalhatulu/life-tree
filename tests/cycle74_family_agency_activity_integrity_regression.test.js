import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {availableLifeActions,performLifeAction} from '../src/life/agency_system.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';
import {RNG} from '../src/core/rng.js';

function rejectsFamilySave(label,mutate){
 test('rejects malformed family save: '+label,()=>{
  const payload=createSavePayload(new Game('cycle74-family'));
  mutate(payload.state);
  const before=structuredClone(payload);
  assert.throws(()=>parseSave(payload),/Invalid save/);
  assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save/);
  assert.deepEqual(payload,before);
 });
}
// Candidate 1: required living family members must survive a save roundtrip.
for(const [label,mutate] of [
 ['parents missing',s=>{delete s.parents;}],
 ['mother missing',s=>{delete s.parents.mother;}],
 ['father is null',s=>{s.parents.father=null;}],
 ['mother is an array',s=>{s.parents.mother=[];}],
 ['grandparents missing',s=>{delete s.grandparents;}],
 ['maternal lineage missing',s=>{delete s.grandparents.maternal;}],
 ['paternal grandfather missing',s=>{delete s.grandparents.paternal.grandfather;}],
 ['grandmother is a string',s=>{s.grandparents.maternal.grandmother='invalid';}],
 ['siblings missing',s=>{delete s.siblings;}],
 ['siblings not an array',s=>{s.siblings={};}],
 ['null sibling',s=>{s.siblings.push(null);}],
 ['array sibling',s=>{s.siblings.push([]);}],
 ['living mother negative age',s=>{s.parents.mother.age=-1;}],
 ['living father fractional age',s=>{s.parents.father.age=30.5;}],
 ['living grandmother missing age',s=>{delete s.grandparents.maternal.grandmother.age;}],
 ['living sibling unsafe age',s=>{s.siblings.push({alive:true,age:Number.MAX_SAFE_INTEGER+1});}]
])rejectsFamilySave(label,mutate);
test('valid family and legacy deceased relative with missing age survive load',()=>{
 const game=new Game('cycle74-family-valid');
 const payload=createSavePayload(game);
 payload.state.grandparents.maternal.grandmother.alive=false;
 delete payload.state.grandparents.maternal.grandmother.age;
 const parsed=parseSave(payload);
 assert.equal(parsed.state.grandparents.maternal.grandmother.alive,false);
 assert.deepEqual(Game.fromSave(createSavePayload(game)).state,game.state);
});

function adultState(){
 const state=new Game('cycle74-agency').state;
 state.player.age=35;state.actions={max:3,remaining:3};
 return state;
}
function rejectsAction(label,setup,id){
 test('rejects unavailable direct agency action: '+label,()=>{
  const state=adultState();setup(state);
  assert.equal(availableLifeActions(state).some(action=>action.id===id),false);
  const before=structuredClone(state);
  assert.throws(()=>performLifeAction(state,id),/artık kullanılamıyor|Bilinmeyen yaşam aksiyonu/);
  assert.deepEqual(state,before);
 });
}
// Candidate 2: the execution path must honor the same contextual rules as UI availability.
rejectsAction('infant cannot be mentored',s=>{s.children=[{id:'child',name:'Ada',alive:true,age:4,development:{identityStress:90,confidence:20}}];},'mentor-child:child');
rejectsAction('adult child cannot be mentored',s=>{s.children=[{id:'child',name:'Ada',alive:true,age:18,development:{identityStress:90,confidence:20}}];},'mentor-child:child');
rejectsAction('child without support need',s=>{s.children=[{id:'child',name:'Ada',alive:true,age:12,development:{identityStress:20,confidence:80}}];},'mentor-child:child');
rejectsAction('calm partner cannot consume support action',s=>{s.social.romance={name:'Ece',alive:true,resentment:20,life:{workStress:20}};},'support-partner');
test('available child mentoring and partner support still work',()=>{
 const state=adultState();
 state.children=[{id:'child',name:'Ada',alive:true,age:12,relationship:50,development:{identityStress:60,confidence:40,parentAttachment:45}}];
 state.social.romance={name:'Ece',alive:true,resentment:60,trust:45,life:{workStress:70}};
 assert.ok(availableLifeActions(state).some(a=>a.id==='mentor-child:child'));
 assert.match(performLifeAction(state,'mentor-child:child'),/Ada/);
 assert.equal(state.children[0].development.confidence,45);
 assert.match(performLifeAction(state,'support-partner'),/Ece/);
 assert.equal(state.actions.remaining,1);
});
test('duplicate child IDs cannot redirect mentoring to an ineligible child',()=>{
 const state=adultState();
 state.children=[
  {id:'child',name:'Infant',alive:true,age:2,relationship:50},
  {id:'child',name:'Ada',alive:true,age:12,relationship:50,development:{identityStress:60,confidence:40,parentAttachment:45}}
 ];
 assert.ok(availableLifeActions(state).some(a=>a.id==='mentor-child:child'));
 assert.match(performLifeAction(state,'mentor-child:child'),/Ada/);
 assert.equal(state.children[0].relationship,50);
 assert.equal(state.children[1].relationship,54);
});

// Candidate 3: bypassing the activities menu must not bypass medical cooldown.
test('direct checkup cannot bypass one-year medical cooldown',()=>{
 const state=adultState();
 const rng=new RNG('cycle74-checkup');
 assert.ok(availableActivities(state).some(a=>a.id==='checkup'));
 performActivity(state,'checkup',rng);
 state.player.age+=1;state.year+=1;state.actions.remaining=3;
 assert.equal(availableActivities(state).some(a=>a.id==='checkup'),false);
 const before=structuredClone(state);const rngBefore=rng.state;
 assert.throws(()=>performActivity(state,'checkup',rng),/Bu aktivite şu anda kullanılamıyor/);
 assert.deepEqual(state,before);
 assert.equal(rng.state,rngBefore);
 state.player.age+=1;state.year+=1;state.actions.remaining=3;
 assert.ok(availableActivities(state).some(a=>a.id==='checkup'));
 assert.match(performActivity(state,'checkup',rng),/Sağlık kontrolünden/);
 assert.equal(state.actions.remaining,2);
});
test('direct checkup rejects a future last-checkup age without spending action',()=>{
 const state=adultState();state.healthProfile={lastCheckupAge:state.player.age+1,stress:30};
 const before=structuredClone(state);
 assert.throws(()=>performActivity(state,'checkup',new RNG('future-checkup')),/Bu aktivite şu anda kullanılamıyor/);
 assert.deepEqual(state,before);
});
