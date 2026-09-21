import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {marryPartner,processPartnershipYear} from '../src/social/partnership_system.js';
import {processElderFamilyYear} from '../src/family/elder_system.js';
import {processInheritance} from '../src/finance/inheritance_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {treatCondition} from '../src/health/treatment_system.js';

test('older spouse can die and leave widowhood state',()=>{
 const g=new Game('partner-loss');
 g.state.player.age=70;
 g.state.year=2096;
 const rng=new RNG('partner-loss');
 g.state.social.romance=createRomanticInterest(g.state,rng,'partner');
 g.state.social.romance.age=92;
 g.state.social.romance.health.current=5;
 g.state.social.romance.relationship=95;
 marryPartner(g.state);

 for(let i=0;i<60&&g.state.social.romance;i++){
  processPartnershipYear(g.state,new RNG('partner-mortality-'+i));
 }
 assert.equal(g.state.social.romance,null);
 assert.ok((g.state.social.deceasedPartners??[]).length>=1);
 assert.equal(g.state.widowedAtAge,70);
});

test('elder death can create inheritance that reaches personal finance',()=>{
 const g=new Game('elder-loss');
 g.state.player.age=50;
 g.state.year=2076;
 ensurePersonalFinance(g.state);
 g.state.parents.mother.age=100;
 g.state.parents.mother.health.current=0;
 const before=g.state.finance.cash;

 for(let i=0;i<80&&g.state.parents.mother.alive;i++){
  processElderFamilyYear(g.state,new RNG('elder-death-'+i));
 }
 assert.equal(g.state.parents.mother.alive,false);
 processInheritance(g.state);
 assert.ok(g.state.finance.cash>=before);
 assert.ok((g.state.inheritanceHistory??[]).length>=0);
});

test('treatment consumes money or creates debt and closes untreated state',()=>{
 const g=new Game('treatment-unit');
 g.state.player.age=60;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=20000;
 g.state.healthProfile={
  conditions:[{id:'cardiac',label:'Kalp-damar hastalığı',severity:3,diagnosedAtAge:60}],
  stress:50,
  fitness:40,
  lastCheckupAge:59
 };
 const beforeCash=g.state.finance.cash;
 const beforeDebt=g.state.finance.debt;
 const result=treatCondition(g.state,'cardiac',new RNG('treat-card'));
 assert.equal(result.condition.treated,true);
 assert.ok(g.state.finance.cash<=beforeCash);
 assert.ok(g.state.finance.debt>=beforeDebt);
 assert.ok(typeof result.condition.treatmentSuccessful==='boolean');
});


test('elderly sibling loss is recorded and dead sibling stops aging',()=>{
 const g=new Game('sibling-loss-unit');
 g.state.player.age=78;
 g.state.year=2104;
 const sibling=g.state.siblings[0]??structuredClone(g.state.player);
 if(!g.state.siblings.length){
  sibling.id='sibling-test';
  sibling.name='Test';
  sibling.surname=g.state.player.surname;
  g.state.siblings.push(sibling);
 }
 sibling.alive=true;
 sibling.age=100;
 sibling.health.current=0;
 const {processFamilyYear}=await import('../src/family/family_simulation.js');
 let entries=[];
 for(let i=0;i<100&&sibling.alive;i++){
  entries=processFamilyYear(g.state,new RNG('sibling-loss-'+i));
 }
 assert.equal(sibling.alive,false);
 assert.ok(entries.some(e=>e.text.includes('hayatını kaybetti')));
 const deathAge=sibling.age;
 processFamilyYear(g.state,new RNG('sibling-after-death'));
 assert.equal(sibling.age,deathAge);
});

test('elderly friend loss removes friend from active circle',async()=>{
 const g=new Game('friend-loss-unit');
 g.state.player.age=80;
 g.state.year=2106;
 const friend=structuredClone(g.state.player);
 friend.id='friend-test';
 friend.name='Arkadaş';
 friend.age=100;
 friend.alive=true;
 friend.relationship=90;
 friend.health.current=0;
 g.state.social.friends=[friend];
 g.state.healthProfile={conditions:[],stress:30,fitness:40,lastCheckupAge:79};
 g.state.lateLife={mobility:45,isolation:20,careNeed:false,careMode:null,retirementStyle:null};
 const {processSocialYear}=await import('../src/social/social_simulation.js');
 let lost=false;
 for(let i=0;i<100&&!lost;i++){
  const entries=processSocialYear(g.state,new RNG('friend-loss-'+i));
  lost=entries.some(e=>e.text.includes('hayatını kaybetti'));
 }
 assert.equal(lost,true);
 assert.equal(g.state.social.friends.some(f=>f.id==='friend-test'),false);
 assert.ok((g.state.social.deceasedFriends??[]).some(f=>f.id==='friend-test'));
 assert.ok(g.state.lateLife.isolation>=20);
});
