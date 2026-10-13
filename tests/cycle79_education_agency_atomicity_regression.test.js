import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {setChildEducationPlan} from '../src/family/parenting_decisions.js';
import {parentingEvents} from '../src/events/parenting_events.js';
import {performLifeAction} from '../src/life/agency_system.js';

function childState(seed){
 const s=new Game('cycle79-'+seed).state;
 s.player.age=45;
 s.children=[{id:'child-1',name:'Ada',age:17,alive:true,relationship:70,
  personality:{ambition:50,discipline:50,sociability:50},
  parenting:{involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0}}];
 s.finance??={};s.finance.cash=0;
 s.career??={};s.career.monthlyIncome=0;
 s.retirement??={};s.retirement.pensionMonthly=0;
 return s;
}
const educationEvent=parentingEvents.find(e=>e.id==='child-education-plan');
function universityChoices(s){return educationEvent.choices(s).filter(c=>c.id.startsWith('university:'));}

// 1. Direct education API must enforce the same financial predicate as its event.
for(const [label,setup] of [
 ['cash',s=>{s.finance.cash=150000;}],
 ['income',s=>{s.career.monthlyIncome=60000;}],
 ['pension',s=>{s.retirement??={};s.retirement.pensionMonthly=45000;}]
]){
 test('university funding via '+label+' works at event threshold',()=>{
  const s=childState('fund-'+label);setup(s);
  assert.equal(universityChoices(s).length,1);
  assert.equal(setChildEducationPlan(s,'child-1','university').educationPlan,'university');
 });
}
test('unfunded university decision is rejected without state mutation',()=>{
 const s=childState('unfunded');
 const before=structuredClone(s);
 assert.equal(universityChoices(s).length,0);
 assert.throws(()=>setChildEducationPlan(s,'child-1','university'),/finans|maddi|kaynak|bütçe/i);
 assert.deepEqual(s,before);
});
test('funding lost after event choice was offered prevents stale university effect',()=>{
 const s=childState('stale-funding');s.finance.cash=150000;
 const choice=universityChoices(s)[0];assert.ok(choice);
 s.finance.cash=0;
 const before=structuredClone(s);
 assert.throws(()=>choice.effect(s),/finans|maddi|kaynak|bütçe/i);
 assert.deepEqual(s,before);
});
test('invalid numeric string does not count as university funding',()=>{
 const s=childState('string-funding');s.finance.cash='150000';
 const before=structuredClone(s);
 assert.equal(universityChoices(s).length,0);
 assert.throws(()=>setChildEducationPlan(s,'child-1','university'),/finans|maddi|kaynak|bütçe/i);
 assert.deepEqual(s,before);
});
test('unfunded vocational plan remains available',()=>{
 const s=childState('vocational');
 assert.equal(setChildEducationPlan(s,'child-1','vocational').educationPlan,'vocational');
});
test('existing university plan remains idempotent if funding later disappears',()=>{
 const s=childState('legacy-funded');s.children[0].educationPlan='university';
 const before=structuredClone(s);
 assert.equal(setChildEducationPlan(s,'child-1','university'),s.children[0]);
 assert.deepEqual(s,before);
});

function actionState(kind){
 const s=new Game('cycle79-agency-'+kind).state;
 s.player.age=35;s.actions={max:3,remaining:2};
 if(kind==='partner')s.social.romance={name:'Ece',alive:true,resentment:60,trust:40,intimacy:40,life:{workStress:70}};
 if(kind==='friend')s.social.friends=[{id:'friend',name:'Ali',alive:true,needsSupport:true,relationship:50,trust:50,life:{personalStress:70}}];
 if(kind==='child')s.children=[{id:'child',name:'Ada',alive:true,age:12,relationship:50,development:{identityStress:65,confidence:30,parentAttachment:45}}];
 return s;
}
const actionId={partner:'support-partner',friend:'support-friend:friend',child:'mentor-child:child'};
for(const [kind,mutations] of [
 ['partner',[
  ['trust string',s=>{s.social.romance.trust='40';}],
  ['intimacy NaN',s=>{s.social.romance.intimacy=NaN;}],
  ['work stress Infinity',s=>{s.social.romance.life.workStress=Infinity;}],
  ['malformed life object',s=>{s.social.romance.life=[];}]
 ]],
 ['friend',[
  ['trust string',s=>{s.social.friends[0].trust='50';}],
  ['relationship NaN',s=>{s.social.friends[0].relationship=NaN;}],
  ['personal stress Infinity',s=>{s.social.friends[0].life.personalStress=Infinity;}],
  ['malformed life object',s=>{s.social.friends[0].life=[];}]
 ]],
 ['child',[
  ['confidence missing',s=>{delete s.children[0].development.confidence;}],
  ['identity stress string',s=>{s.children[0].development.identityStress='65';}],
  ['attachment Infinity',s=>{s.children[0].development.parentAttachment=Infinity;}],
  ['relationship NaN',s=>{s.children[0].relationship=NaN;}]
 ]]
]){
 for(const [label,mutate] of mutations){
  test(kind+' malformed '+label+' rejects action atomically',()=>{
   const s=actionState(kind);mutate(s);
   const before=structuredClone(s);
   assert.throws(()=>performLifeAction(s,actionId[kind]),/geçersiz|invalid/i);
   assert.deepEqual(s,before);
  });
 }
 test(kind+' valid action consumes one credit and remains functional',()=>{
  const s=actionState(kind);
  assert.equal(typeof performLifeAction(s,actionId[kind]),'string');
  assert.equal(s.actions.remaining,1);
 });
}
