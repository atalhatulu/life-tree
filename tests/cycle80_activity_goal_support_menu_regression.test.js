import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {performActivity} from '../src/life/activity_system.js';
import {setLifeGoal,focusLifeGoal} from '../src/life/life_goal_system.js';
import {availableLifeActions,performLifeAction} from '../src/life/agency_system.js';

function adult(seed){
 const state=new Game('cycle80-'+seed).state;
 state.player.age=35;
 state.actions={remaining:3,max:3};
 return state;
}
function atomicActivity(label,setup,id='exercise'){
 test('invalid activity memory '+label+' is rejected before effects',()=>{
  const state=adult('memory-'+label);
  setup(state);
  const rng=new RNG('cycle80-rng-'+label);
  const before=structuredClone(state),rngBefore=rng.state;
  assert.throws(()=>performActivity(state,id,rng),/geçersiz|invalid/i);
  assert.deepEqual(state,before);
  assert.equal(rng.state,rngBefore);
 });
}
for(const [label,setup] of [
 ['root array',s=>{s.activityMemory=[];}],
 ['entry null',s=>{s.activityMemory={exercise:null};}],
 ['entry array',s=>{s.activityMemory={exercise:[]};}],
 ['uses string',s=>{s.activityMemory={exercise:{uses:'2',lastAge:null,streak:0}};}],
 ['uses negative',s=>{s.activityMemory={exercise:{uses:-1,lastAge:null,streak:0}};}],
 ['uses overflow',s=>{s.activityMemory={exercise:{uses:Number.MAX_SAFE_INTEGER,lastAge:null,streak:0}};}],
 ['streak fractional',s=>{s.activityMemory={exercise:{uses:0,lastAge:null,streak:1.5}};}],
 ['streak overflow',s=>{s.activityMemory={exercise:{uses:0,lastAge:null,streak:Number.MAX_SAFE_INTEGER}};}],
 ['last age future',s=>{s.activityMemory={exercise:{uses:2,lastAge:36,streak:2}};}],
 ['last age NaN',s=>{s.activityMemory={exercise:{uses:2,lastAge:NaN,streak:2}};}]
])atomicActivity(label,setup);

test('legacy activity memory missing counters gets finite defaults on success',()=>{
 const s=adult('legacy-memory');
 s.activityMemory={exercise:{streak:2}};
 performActivity(s,'exercise',new RNG('cycle80-legacy'));
 assert.deepEqual(s.activityMemory.exercise,{streak:1,uses:1,lastAge:35});
 assert.equal(s.actions.remaining,2);
});
test('normal activity memory increments once',()=>{
 const s=adult('normal-memory');
 s.activityMemory={exercise:{uses:3,streak:2,lastAge:34}};
 performActivity(s,'exercise',new RNG('cycle80-normal'));
 assert.deepEqual(s.activityMemory.exercise,{uses:4,streak:3,lastAge:35});
});

function atomicGoal(label,mutate){
 test('invalid goal focus '+label+' is rejected without partial update',()=>{
  const s=adult('goal-'+label);
  setLifeGoal(s,'wellbeing');
  mutate(s.lifeGoals.active);
  const before=structuredClone(s);
  assert.throws(()=>focusLifeGoal(s),/geçersiz|invalid/i);
  assert.deepEqual(s,before);
  assert.equal(availableLifeActions(s).some(a=>a.id==='focus-goal'),false);
 });
}
for(const [label,mutate] of [
 ['progress string',g=>{g.progress='42';}],
 ['progress NaN',g=>{g.progress=NaN;}],
 ['progress infinity',g=>{g.progress=Infinity;}],
 ['focusYears string',g=>{g.focusYears='1';}],
 ['focusYears negative',g=>{g.focusYears=-1;}],
 ['focusYears overflow',g=>{g.focusYears=Number.MAX_SAFE_INTEGER;}],
 ['future focus age',g=>{g.lastFocusedAge=36;}],
 ['negative focus age',g=>{g.lastFocusedAge=-1;}],
 ['fractional focus age',g=>{g.lastFocusedAge=31.5;}]
])atomicGoal(label,mutate);
test('valid focus increments and respects two-year cooldown',()=>{
 const s=adult('goal-valid');
 setLifeGoal(s,'wellbeing');
 assert.equal(availableLifeActions(s).some(a=>a.id==='focus-goal'),true);
 focusLifeGoal(s);
 assert.equal(s.lifeGoals.active.focusYears,1);
 assert.equal(s.lifeGoals.active.progress,1);
 assert.equal(s.actions.remaining,2);
 assert.equal(availableLifeActions(s).some(a=>a.id==='focus-goal'),false);
});
test('legacy missing goal focusYears defaults to zero',()=>{
 const s=adult('goal-legacy');setLifeGoal(s,'wellbeing');
 delete s.lifeGoals.active.focusYears;
 focusLifeGoal(s);
 assert.equal(s.lifeGoals.active.focusYears,1);
});

function addSupport(s){
 s.social.friends=[
  {id:'friend-a',name:'Ali',alive:true,needsSupport:true,relationship:50,trust:50},
  {id:'friend-b',name:'Bora',alive:true,needsSupport:true,relationship:60,trust:60},
  {id:'friend-dead',name:'Cem',alive:false,needsSupport:true},
  {id:'friend-no',name:'Deniz',alive:true,needsSupport:false}
 ];
 s.children=[
  {id:'child-a',name:'Ada',alive:true,age:12,relationship:55,development:{confidence:30,identityStress:70,parentAttachment:50}},
  {id:'child-b',name:'Efe',alive:true,age:15,relationship:55,development:{confidence:30,identityStress:70,parentAttachment:50}},
  {id:'child-adult',name:'Elif',alive:true,age:19,development:{confidence:20,identityStress:90}}
 ];
}
test('life action menu lists every eligible friend and child',()=>{
 const s=adult('support-multiple');addSupport(s);
 const before=structuredClone(s);
 const ids=availableLifeActions(s).map(a=>a.id);
 for(const id of ['support-friend:friend-a','support-friend:friend-b','mentor-child:child-a','mentor-child:child-b'])
  assert.ok(ids.includes(id),id);
 for(const id of ['support-friend:friend-dead','support-friend:friend-no','mentor-child:child-adult'])
  assert.ok(!ids.includes(id),id);
 assert.deepEqual(s,before);
});
test('second listed friend and child actions are executable',()=>{
 const s=adult('support-second');addSupport(s);
 performLifeAction(s,'support-friend:friend-b');
 performLifeAction(s,'mentor-child:child-b');
 assert.equal(s.actions.remaining,1);
 assert.equal(s.social.friends[1].needsSupport,false);
 assert.equal(s.children[1].relationship,59);
});
test('menu omits duplicate or invalid support IDs',()=>{
 const s=adult('support-ids');addSupport(s);
 s.social.friends.push({...s.social.friends[0]});
 s.social.friends.push({...s.social.friends[0],id:23});
 s.children.push({...s.children[0]});
 s.children.push({...s.children[0],id:null});
 const ids=availableLifeActions(s).map(a=>a.id);
 assert.equal(ids.filter(id=>id==='support-friend:friend-a').length,1);
 assert.equal(ids.filter(id=>id==='mentor-child:child-a').length,1);
 assert.ok(!ids.includes('support-friend:23'));
 assert.ok(!ids.includes('mentor-child:null'));
});
