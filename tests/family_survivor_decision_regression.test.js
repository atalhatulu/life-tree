import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {mutuallyWantChildren,parenthoodReadiness,attemptChild} from '../src/family/parenting_system.js';
import {evaluateParentCareNeed,setParentCareMode,processElderFamilyYear} from '../src/family/elder_system.js';
import {processNarrativeEchoesYear} from '../src/life/narrative_echo_system.js';

function careState(seed){
 const s=new Game(seed).state;
 s.player.age=45;
 s.parents.mother.age=80;
 s.parents.mother.health.current=35;
 s.parents.mother.alive=true;
 s.parents.father.age=60;
 s.parents.father.health.current=80;
 s.healthProfile??={stress:20};
 return s;
}

function coupleState(alive){
 return {player:{age:32},preferences:{parenthoodDesire:80},social:{romance:{alive,status:'married',relationship:85,yearsTogether:6,preferences:{parenthoodDesire:85}}},children:[],finance:{cash:300000,savings:0},career:{monthlyIncome:80000}};
}

test('deceased partner cannot consent, create readiness or trigger conception RNG',()=>{
 const s=coupleState(false);
 assert.equal(mutuallyWantChildren(s),false);
 assert.equal(parenthoodReadiness(s),0);
 assert.equal(attemptChild(s,{chance(){throw Error('conception RNG must not run')}}),null);
 assert.equal(s.lastParenthoodAttempt.reason,'not-eligible');
 assert.equal(s.children.length,0);
});

test('living and legacy partners remain eligible for parenthood',()=>{
 for(const alive of [true,undefined]){
  const s=coupleState(alive);
  assert.equal(mutuallyWantChildren(s),true);
  assert.ok(parenthoodReadiness(s)>0);
  const child=attemptChild(s,{chance:()=>false});
  assert.equal(child,null);
  assert.equal(s.lastParenthoodAttempt.reason,undefined);
 }
});

test('parent death clears a previously pending care decision during reevaluation',()=>{
 const s=careState('pending-care-reevaluate');
 assert.equal(evaluateParentCareNeed(s)?.id,s.parents.mother.id);
 s.parents.mother.alive=false;
 assert.equal(evaluateParentCareNeed(s),null);
 assert.equal(s.parentCare.pendingParentId,null);
 assert.equal(s.parentCare.pendingParentName,null);
});

test('death in the same year as a care referral clears pending decision',()=>{
 const s=careState('pending-care-death-year');
 const rng={fork:key=>({int:()=>0,chance:()=>key==='death-mother'})};
 processElderFamilyYear(s,rng);
 assert.equal(s.parents.mother.alive,false);
 assert.equal(s.parentCare.pendingParentId,null);
 assert.equal(s.parentCare.pendingParentName,null);
});

test('care cannot start for a deceased parent, without referral or when already active',()=>{
 const s=careState('care-validation');
 assert.throws(()=>setParentCareMode(s,'family'));
 assert.equal(s.parentCare.active,false);
 evaluateParentCareNeed(s);
 s.parents.mother.alive=false;
 assert.throws(()=>setParentCareMode(s,'family'));
 assert.equal(s.parentCare.active,false);
 s.parents.mother.alive=true;
 setParentCareMode(s,'family');
 const snapshot=structuredClone(s.parentCare);
 assert.throws(()=>setParentCareMode(s,'facility'));
 assert.deepEqual(s.parentCare,snapshot);
});

test('invalid care modes leave pending referral and player stats unchanged',()=>{
 const s=careState('care-invalid-mode');
 evaluateParentCareNeed(s);
 const before={care:structuredClone(s.parentCare),stress:s.healthProfile.stress,relationships:structuredClone(s.player.relationships)};
 for(const invalidMode of ['unknown','__proto__','constructor','toString']){
  assert.throws(()=>setParentCareMode(s,invalidMode));
 }
 assert.deepEqual(s.parentCare,before.care);
 assert.equal(s.healthProfile.stress,before.stress);
 assert.deepEqual(s.player.relationships,before.relationships);
});

test('family decision echoes do not improve deceased descendants but do improve living and legacy descendants',()=>{
 const s=new Game('echo-survivors').state;
 s.player.age=45;
 s.children=[
  {id:'dead',alive:false,relationship:40},
  {id:'living',alive:true,relationship:50},
  {id:'legacy',relationship:60}
 ];
 s.lifeTree={nodes:[{age:30,pacingCategory:'family',label:'Aile kararı'}]};
 const rng={chance:()=>true,weighted:items=>items[0].value};
 const entries=processNarrativeEchoesYear(s,rng);
 assert.equal(entries.length,1);
 assert.equal(s.children[0].relationship,40);
 assert.equal(s.children[1].relationship,51);
 assert.equal(s.children[2].relationship,61);
});

test('relationship decision echoes do not reward a deceased partner',()=>{
 for(const alive of [false,true,undefined]){
  const s=new Game('echo-partner-'+alive).state;
  s.player.age=45;
  s.social.romance={alive,trust:40};
  s.lifeTree={nodes:[{age:30,pacingCategory:'relationship',label:'İlişki kararı'}]};
  const rng={chance:()=>true,weighted:items=>items[0].value};
  assert.equal(processNarrativeEchoesYear(s,rng).length,1);
  assert.equal(s.social.romance.trust,alive===false?40:41);
 }
});

test('a stale care referral switches to a surviving eligible parent',()=>{
 const s=careState('care-referral-switch');
 evaluateParentCareNeed(s);
 s.parents.mother.alive=false;
 s.parents.father.age=79;
 s.parents.father.health.current=40;
 assert.equal(evaluateParentCareNeed(s)?.id,s.parents.father.id);
 assert.equal(s.parentCare.pendingParentId,s.parents.father.id);
 assert.equal(s.parentCare.pendingParentName,s.parents.father.name);
});
