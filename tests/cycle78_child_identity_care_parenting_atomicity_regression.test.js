import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {addChild} from '../src/family/parenting_system.js';
import {evaluateParentCareNeed,setParentCareMode} from '../src/family/elder_system.js';
import {setUpbringingStyle,setChildEducationPlan} from '../src/family/parenting_decisions.js';

function couple(seed){
 const s=new Game(seed).state;
 s.player.age=35;
 s.year=2050;
 s.social.romance=createRomanticInterest(s,new RNG(seed+'-partner'),'partner');
 return s;
}
function child(seed,age=16){
 const s=new Game(seed).state;
 s.player.age=45;
 s.children=[{
  id:'child-1',name:'Ada',age,alive:true,relationship:70,
  personality:{curiosity:50,sociability:50,discipline:50,patience:50,ambition:50},
  parenting:{involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0}
 }];
 return s;
}
function care(seed){
 const s=new Game(seed).state;
 s.player.age=45;
 s.parents.mother.age=80;
 s.parents.mother.health.current=35;
 s.parents.mother.alive=true;
 s.parents.father.age=68;
 s.parents.father.health.current=80;
 s.parents.father.alive=true;
 return s;
}

// Candidate 1: generated child IDs must never collide with legacy/edited IDs.
test('new child ID skips an occupied suffix instead of corrupting save identity',()=>{
 const s=couple('cycle78-child-collision');
 s.children=[{id:'child-2050-2',alive:false},{id:'legacy-child',alive:false}];
 const existing=new Set(s.children.map(c=>c.id));
 const created=addChild(s,new RNG('cycle78-child-rng'));
 assert.ok(!existing.has(created.id));
 assert.equal(created.id,'child-2050-3');
 assert.equal(new Set(s.children.map(c=>c.id)).size,s.children.length);
});
test('sequential child creation keeps distinct IDs in same year',()=>{
 const s=couple('cycle78-child-sequential');
 const rng=new RNG('cycle78-sequential-rng');
 const first=addChild(s,rng.fork('first'));
 const second=addChild(s,rng.fork('second'));
 assert.notEqual(first.id,second.id);
 assert.equal(new Set(s.children.map(c=>c.id)).size,2);
});
test('addChild without partner does not create missing children ledger',()=>{
 const s=new Game('cycle78-child-no-partner').state;
 delete s.children;
 const rng=new RNG('cycle78-child-no-partner-rng');
 const before=structuredClone(s),rngBefore=rng.state;
 assert.throws(()=>addChild(s,rng),/partner/);
 assert.deepEqual(s,before);
 assert.equal(rng.state,rngBefore);
});

// Candidate 2: a pending care referral must remain eligible at execution time.
for(const [label,mutate] of [
 ['recovered',s=>{s.parents.mother.age=73;s.parents.mother.health.current=90;}],
 ['player-too-young',s=>{s.player.age=27;}],
 ['other-parent-priority',s=>{s.parents.father.age=80;s.parents.father.health.current=10;}]
]){
 test('stale care referral '+label+' is rejected atomically',()=>{
  const s=care('cycle78-care-'+label);
  assert.equal(evaluateParentCareNeed(s)?.id,'mother');
  mutate(s);
  const before=structuredClone(s);
  assert.throws(()=>setParentCareMode(s,'family'),/bakım|uygun|güncel|karar/i);
  assert.deepEqual(s,before);
 });
}
test('care decision with no referral retains legacy empty care ledger',()=>{
 const s=care('cycle78-care-no-referral');
 delete s.parentCare;
 const before=structuredClone(s.player.relationships);
 assert.throws(()=>setParentCareMode(s,'family'));
 assert.equal(s.parentCare.active,false);
 assert.equal(s.parentCare.pendingParentId,undefined);
 assert.deepEqual(s.player.relationships,before);
});
test('eligible parent is selected even if another older parent is healthier but ineligible',()=>{
 const s=care('cycle78-care-priority');
 s.parents.mother.age=69;
 s.parents.mother.health.current=52;
 s.parents.father.age=78;
 s.parents.father.health.current=75;
 assert.equal(evaluateParentCareNeed(s)?.id,'father');
 assert.equal(setParentCareMode(s,'family').parentId,'father');
});
test('unchanged valid care referral can be accepted',()=>{
 const s=care('cycle78-care-valid');
 evaluateParentCareNeed(s);
 assert.equal(setParentCareMode(s,'home-care').parentId,'mother');
});

// Candidate 3: malformed nested child fields must fail before any one-time choice is stored.
for(const [style,field] of [['supportive','curiosity'],['strict','discipline'],['free','curiosity']]){
 test('invalid personality field '+field+' prevents partial '+style+' choice',()=>{
  const s=child('cycle78-style-'+style,4);
  s.children[0].personality[field]=NaN;
  const before=structuredClone(s);
  assert.throws(()=>setUpbringingStyle(s,'child-1',style),/kişilik|geçersiz|invalid/i);
  assert.deepEqual(s,before);
 });
}
for(const [plan,field] of [['university','ambition'],['vocational','discipline'],['independent','sociability']]){
 test('invalid personality field '+field+' prevents partial '+plan+' choice',()=>{
  const s=child('cycle78-plan-'+plan);
  s.children[0].personality[field]=Infinity;
  const before=structuredClone(s);
  assert.throws(()=>setChildEducationPlan(s,'child-1',plan),/kişilik|geçersiz|invalid/i);
  assert.deepEqual(s,before);
 });
}
test('malformed parenting support counter cannot become a string on education decision',()=>{
 const s=child('cycle78-plan-support');
 s.children[0].parenting.accumulatedSupport='10';
 const before=structuredClone(s);
 assert.throws(()=>setChildEducationPlan(s,'child-1','vocational'),/ebeveynlik|geçersiz|invalid/i);
 assert.deepEqual(s,before);
});
test('malformed parenting relationship does not partially apply style',()=>{
 const s=child('cycle78-style-relationship',4);
 s.children[0].relationship='70';
 const before=structuredClone(s);
 assert.throws(()=>setUpbringingStyle(s,'child-1','supportive'),/ilişki|geçersiz|invalid/i);
 assert.deepEqual(s,before);
});
test('valid legacy child without parenting ledger gets defaults for education',()=>{
 const s=child('cycle78-plan-legacy');
 delete s.children[0].parenting;
 assert.equal(setChildEducationPlan(s,'child-1','vocational').educationPlan,'vocational');
 assert.equal(s.children[0].parenting.accumulatedSupport,5);
});
test('idempotent old choice does not require new nested validation',()=>{
 const s=child('cycle78-plan-old');
 s.children[0].educationPlan='university';
 delete s.children[0].personality;
 const before=structuredClone(s);
 assert.equal(setChildEducationPlan(s,'child-1','university'),s.children[0]);
 assert.deepEqual(s,before);
});
test('missing child personality cannot store a one-time parenting choice',()=>{
 const s=child('cycle78-style-no-personality',4);
 delete s.children[0].personality;
 const before=structuredClone(s);
 assert.throws(()=>setUpbringingStyle(s,'child-1','strict'),/kişilik|geçersiz/i);
 assert.deepEqual(s,before);
});
test('invalid parenting involvement cannot store a style choice',()=>{
 const s=child('cycle78-style-involvement',5);
 s.children[0].parenting.involvement='high';
 const before=structuredClone(s);
 assert.throws(()=>setUpbringingStyle(s,'child-1','supportive'),/ebeveynlik|geçersiz/i);
 assert.deepEqual(s,before);
});
test('invalid parenting collection cannot store an education plan',()=>{
 const s=child('cycle78-plan-parenting-array');
 s.children[0].parenting=[];
 const before=structuredClone(s);
 assert.throws(()=>setChildEducationPlan(s,'child-1','independent'),/ebeveynlik|geçersiz/i);
 assert.deepEqual(s,before);
});
test('valid legacy child without parenting ledger gets defaults for style',()=>{
 const s=child('cycle78-style-legacy',4);
 delete s.children[0].parenting;
 assert.equal(setUpbringingStyle(s,'child-1','free').upbringingStyle,'free');
 assert.equal(s.children[0].parenting.conflict,6);
});
