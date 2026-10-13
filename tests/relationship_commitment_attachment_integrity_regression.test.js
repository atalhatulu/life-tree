import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {marryPartner,moveInTogether} from '../src/social/partnership_system.js';
import {processChildDevelopmentYear} from '../src/family/child_development_system.js';

function state(seed='commitment'){
 const s=new Game(seed).state;
 s.year=2060;s.player.age=34;
 s.social.romance={id:'partner',name:'Partner',alive:true,status:'dating',relationship:60,relationshipTension:20,yearsTogether:3};
 s.finance={lifestyle:{housing:'family'}};
 return s;
}
const fixedRng={fork(){return this;},int(){return 0;},chance(){return false;}};

// Commitment decisions are single transitions, not repeatable relationship boosters.
test('marrying once applies the bonus and sets the marriage start age',()=>{
 const s=state('marriage-once');marryPartner(s);
 assert.equal(s.social.romance.status,'married');
 assert.equal(s.social.romance.marriedAtAge,34);
 assert.equal(s.social.romance.marriageYears,0);
 assert.equal(s.social.romance.relationship,64);
 assert.equal(s.social.romance.relationshipTension,15);
});
test('repeated marriage does not stack bonuses or reset anniversary counters',()=>{
 const s=state('marriage-repeat');marryPartner(s);
 s.social.romance.marriageYears=8;
 s.player.age=42;s.year=2068;
 const before=structuredClone(s);
 marryPartner(s);
 assert.deepEqual(s,before);
});
test('marriage replay is safe for a married legacy partner with no start age',()=>{
 const s=state('marriage-legacy');s.social.romance.status='married';s.social.romance.marriageYears=6;
 const before=structuredClone(s);
 marryPartner(s);
 assert.deepEqual(s,before);
});
test('cohabiting partners can marry without losing their cohabitation history',()=>{
 const s=state('cohabit-marry');moveInTogether(s);
 s.social.romance.yearsTogether=7;
 marryPartner(s);
 assert.equal(s.social.romance.status,'married');
 assert.equal(s.social.romance.yearsTogether,7);
 assert.equal(s.social.romance.relationship,66);
});
test('marriage idempotence persists after save and restore',()=>{
 const g=new Game('marriage-save');g.state=state('marriage-save-state');
 marryPartner(g.state);
 const restored=Game.fromSave(serializeGame(g));
 restored.state.social.romance.marriageYears=2;
 const before=structuredClone(restored.state);
 marryPartner(restored.state);
 assert.deepEqual(restored.state,before);
});
test('cohabitation applies the housing and relationship change once',()=>{
 const s=state('cohabit-once');moveInTogether(s);
 assert.equal(s.social.romance.status,'cohabiting');
 assert.equal(s.finance.lifestyle.housing,'shared');
 assert.equal(s.social.romance.relationship,62);
 assert.equal(s.social.romance.relationshipTension,18);
});
test('repeated cohabitation does not accumulate relationship points',()=>{
 const s=state('cohabit-repeat');moveInTogether(s);
 const before=structuredClone(s);
 moveInTogether(s);
 assert.deepEqual(s,before);
});
test('cohabitation replay remains safe in later years',()=>{
 const s=state('cohabit-next-year');moveInTogether(s);
 s.year++;s.player.age++;
 const before=structuredClone(s);
 moveInTogether(s);
 assert.deepEqual(s,before);
});
test('cohabitation does not downgrade or re-reward an existing marriage',()=>{
 const s=state('married-cohabit');marryPartner(s);
 const before=structuredClone(s);
 moveInTogether(s);
 assert.deepEqual(s,before);
});
test('cohabitation idempotence survives save and restore',()=>{
 const g=new Game('cohabit-save');g.state=state('cohabit-save-state');
 moveInTogether(g.state);
 const restored=Game.fromSave(serializeGame(g));
 const before=structuredClone(restored.state);
 moveInTogether(restored.state);
 assert.deepEqual(restored.state,before);
});
test('deceased partner commitment attempts remain mutation-free',()=>{
 const s=state('dead-commit');s.social.romance.alive=false;
 const before=structuredClone(s);
 for(const action of [marryPartner,moveInTogether]){
  assert.throws(()=>action(s),/hayatta değil/);
  assert.deepEqual(s,before);
 }
});

function childState(involvement){
 const s=state('attachment-'+involvement);
 s.children=[{
  id:'child',name:'Child',age:8,alive:true,relationship:60,
  personality:{discipline:50,sociability:50,ambition:50},
  parenting:{involvement,emotionalSecurity:70,stability:65,conflict:0,accumulatedSupport:0},
  development:{confidence:50,independence:35,academicDrive:50,socialSecurity:50,parentAttachment:70,identityStress:0,milestones:[],lastStage:'child'}
 }];
 return s;
}
test('neutral parental involvement does not raise attachment by itself',()=>{
 const s=childState(50);
 processChildDevelopmentYear(s,fixedRng);
 assert.equal(s.children[0].development.parentAttachment,70);
});
test('low involvement lowers attachment relative to the neutral baseline',()=>{
 const s=childState(0);
 processChildDevelopmentYear(s,fixedRng);
 assert.equal(s.children[0].development.parentAttachment,69);
});
test('high involvement raises attachment by only the normalized bonus',()=>{
 const s=childState(100);
 processChildDevelopmentYear(s,fixedRng);
 assert.equal(s.children[0].development.parentAttachment,71);
});
test('missing involvement uses the intended neutral fallback',()=>{
 const s=childState(50);delete s.children[0].parenting.involvement;
 processChildDevelopmentYear(s,fixedRng);
 assert.equal(s.children[0].development.parentAttachment,70);
});
test('attachment correction respects annual idempotence and advances in next year',()=>{
 const s=childState(100);
 processChildDevelopmentYear(s,fixedRng);
 const first=s.children[0].development.parentAttachment;
 processChildDevelopmentYear(s,fixedRng);
 assert.equal(s.children[0].development.parentAttachment,first);
 s.year++;s.children[0].age++;
 processChildDevelopmentYear(s,fixedRng);
 assert.equal(s.children[0].development.parentAttachment,first+1);
});
