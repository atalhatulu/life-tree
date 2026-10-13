import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {availableLifeGoals,setLifeGoal,processLifeGoalsYear} from '../src/life/life_goal_system.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';

function adult(label){
 const state=new Game('cycle87-'+label).state;
 state.year=2075;state.player.age=35;
 return state;
}
// Candidate 1: goal selection must not partially migrate malformed ledgers.
for(const [label,change] of [
 ['root string',s=>{s.lifeGoals='bad';}],
 ['root array',s=>{s.lifeGoals=[];}],
 ['completed string',s=>{s.lifeGoals.completed='wellbeing';}],
 ['completed entry',s=>{s.lifeGoals.completed=[null];}],
 ['completed unknown ID',s=>{s.lifeGoals.completed=['not-a-goal'];}],
 ['history object',s=>{s.lifeGoals.history={};}],
 ['history null member',s=>{s.lifeGoals.history=[null];}],
 ['active array',s=>{s.lifeGoals.active=[];}],
 ['active unknown ID',s=>{s.lifeGoals.active={id:'unknown'};}],
 ['active missing ID',s=>{s.lifeGoals.active={progress:20};}]
])test('goal selection rejects '+label+' without mutation',()=>{
 const s=adult('selection-'+label);change(s);
 const before=structuredClone(s);
 assert.deepEqual(availableLifeGoals(s),[]);
 assert.throws(()=>setLifeGoal(s,'wellbeing'),/Geçersiz/);
 assert.deepEqual(s,before);
});
for(const age of ['35',NaN,35.5,-1,Number.MAX_SAFE_INTEGER+1])
 test('invalid goal selection age '+String(age)+' cannot mutate state',()=>{
  const s=adult('selection-age');s.player.age=age;
  const before=structuredClone(s);
  assert.deepEqual(availableLifeGoals(s),[]);
  assert.throws(()=>setLifeGoal(s,'wellbeing'),/kullanılamıyor/);
  assert.deepEqual(s,before);
 });
test('valid goal switch archives old goal once and legacy missing ledger works',()=>{
 const s=adult('switch');delete s.lifeGoals;
 assert.equal(setLifeGoal(s,'wellbeing').id,'wellbeing');
 setLifeGoal(s,'social-circle');
 assert.equal(s.lifeGoals.history.length,1);
 assert.equal(s.lifeGoals.history[0].id,'wellbeing');
 assert.equal(setLifeGoal(s,'social-circle'),s.lifeGoals.active);
 assert.equal(s.lifeGoals.history.length,1);
});

// Candidate 2: scoring a goal with corrupted numeric/collection inputs must
// not write NaN progress or consume its annual processing marker.
for(const [label,id,change] of [
 ['financial cash string','financial-security',s=>{s.finance={cash:'100'};}],
 ['financial debt infinity','financial-security',s=>{s.finance={debt:Infinity};}],
 ['financial career monthly income','financial-security',s=>{s.career={monthlyIncome:NaN};}],
 ['career performance','career-mastery',s=>{s.career={employed:true,performance:NaN};}],
 ['career experience','career-mastery',s=>{s.careerProfile={totalExperience:'12'};}],
 ['family child list','family-bond',s=>{s.children={};}],
 ['family child entry','family-bond',s=>{s.children=[null];}],
 ['family child relationship','family-bond',s=>{s.children=[{alive:true,relationship:'70'}];}],
 ['family parent relationship','family-bond',s=>{s.parents.mother.relationship=NaN;}],
 ['wellbeing health','wellbeing',s=>{s.player.health.current=NaN;}],
 ['wellbeing fitness','wellbeing',s=>{s.healthProfile={fitness:'50'};}],
 ['wellbeing strain','wellbeing',s=>{s.mentalHealth={strain:Infinity};}],
 ['social friend list','social-circle',s=>{s.social.friends={};}],
 ['social friend null','social-circle',s=>{s.social.friends=[null];}],
 ['social friend relationship','social-circle',s=>{s.social.friends=[{alive:true,relationship:'80'}];}]
])test('annual goal '+label+' rejects without mutation',()=>{
 const s=adult('annual-'+label);
 setLifeGoal(s,id);change(s);
 const before=structuredClone(s);
 assert.throws(()=>processLifeGoalsYear(s),/Geçersiz/);
 assert.deepEqual(s,before);
});
for(const [label,change] of [
 ['invalid progress',s=>{s.lifeGoals.active.progress=NaN;}],
 ['future started age',s=>{s.lifeGoals.active.startedAtAge=36;}],
 ['invalid started age',s=>{s.lifeGoals.active.startedAtAge='25';}],
 ['unknown goal',s=>{s.lifeGoals.active.id='unknown';}]
])test('annual goal invalid active metadata '+label+' is atomic',()=>{
 const s=adult('annual-meta-'+label);setLifeGoal(s,'wellbeing');change(s);
 const before=structuredClone(s);
 assert.throws(()=>processLifeGoalsYear(s),/Geçersiz/);
 assert.deepEqual(s,before);
});
test('annual goal valid and legacy missing started age still advance',()=>{
 const s=adult('annual-valid');setLifeGoal(s,'wellbeing');
 delete s.lifeGoals.active.startedAtAge;
 assert.doesNotThrow(()=>processLifeGoalsYear(s));
 assert.equal(s.lifeGoals.active.lastProcessedYear,2075);
 assert.ok(Number.isFinite(s.lifeGoals.active.progress));
});

// Candidate 3: invalid persisted friend records should not survive loading
// only to corrupt the next birthday simulation.
function friend(){return {id:'friend-a',name:'Ali',age:35,alive:true,relationship:70,yearsKnown:3,lastContactAge:34};}
for(const [label,change] of [
 ['null friend',s=>{s.social.friends=[null];}],
 ['string friend',s=>{s.social.friends=['bad'];}],
 ['missing friend ID',s=>{s.social.friends=[{...friend(),id:undefined}];}],
 ['duplicate friend ID',s=>{s.social.friends=[friend(),friend()];}],
 ['friend age string',s=>{s.social.friends=[{...friend(),age:'35'}];}],
 ['friend age negative',s=>{s.social.friends=[{...friend(),age:-1}];}],
 ['friend age overflow',s=>{s.social.friends=[{...friend(),age:Number.MAX_SAFE_INTEGER+1}];}],
 ['friend relationship NaN',s=>{s.social.friends=[{...friend(),relationship:NaN}];}],
 ['friend relationship string',s=>{s.social.friends=[{...friend(),relationship:'70'}];}],
 ['friend yearsKnown fractional',s=>{s.social.friends=[{...friend(),yearsKnown:2.5}];}],
 ['friend future contact',s=>{s.social.friends=[{...friend(),lastContactAge:36}];}]
])test('invalid friend save '+label+' rejected without mutation',()=>{
 const payload=createSavePayload(new Game('cycle87-save-'+label));
 payload.state.player.age=35;payload.savedAtAge=35;
 change(payload.state);
 const before=structuredClone(payload);
 assert.throws(()=>parseSave(payload),/Invalid save.*friend/i);
 assert.deepEqual(payload,before);
});
test('valid friend and incomplete deceased legacy friend load',()=>{
 const payload=createSavePayload(new Game('cycle87-save-valid'));
 payload.state.player.age=35;payload.savedAtAge=35;
 payload.state.social.friends=[friend(),{id:'friend-dead',alive:false}];
 const parsed=parseSave(payload);
 assert.equal(parsed.state.social.friends.length,2);
});
