import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {treatCondition} from '../src/health/treatment_system.js';
import {moveHousing} from '../src/assets/asset_system.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';

const MAX=Number.MAX_SAFE_INTEGER;
function patient(){
 const s=new Game('cycle48-treatment').state;
 s.player.age=45;
 ensurePersonalFinance(s);
 s.finance.cash=0;
 s.finance.debt=0;
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 s.healthProfile={conditions:[{id:'illness',label:'Illness',severity:3}],fitness:40,stress:40};
 return s;
}

test('medical treatment rejects debt capacity overflow before charging cash or treating',()=>{
 const s=patient();s.finance.debt=MAX-1;s.finance.debts.consumer=MAX-1;
 const before=structuredClone(s);
 assert.throws(()=>treatCondition(s,'illness',new RNG('medical-overflow')),/safe|limit|exceed|overflow/i);
 assert.deepEqual(s,before);
});

for(const bad of [Infinity,NaN,'1000',-10,MAX+1]){
 test(`medical treatment rejects malformed cash ${String(bad)} without mutation`,()=>{
  const s=patient();s.finance.cash=bad;
  const before=structuredClone(s);
  assert.throws(()=>treatCondition(s,'illness',new RNG('bad-cash')),/cash|balance|safe|invalid/i);
  assert.deepEqual(s,before);
 });
}
for(const bad of [Infinity,-1]){
 test(`medical treatment rejects malformed healthcare multiplier ${String(bad)}`,()=>{
  const s=patient();s.world.economy.healthcareCost=bad;
  const before=structuredClone(s);
  assert.throws(()=>treatCondition(s,'illness',new RNG('bad-macro')),/cost|amount|safe|invalid/i);
  assert.deepEqual(s,before);
 });
}
test('fully cash-funded medical treatment still charges exactly once with no debt',()=>{
 const s=patient();s.finance.cash=200000;
 const {cost}=treatCondition(s,'illness',new RNG('cash-treatment'));
 assert.equal(s.finance.cash,200000-cost);
 assert.equal(s.finance.debt,0);
 assert.equal(s.healthProfile.conditions[0].treated,true);
});

function tenant(){
 const s=new Game('cycle48-housing').state;
 s.player.age=32;ensurePersonalFinance(s);
 s.assets={home:null,car:null};
 s.finance.cash=38000;s.finance.lifestyle.housing='family';
 return s;
}
for(const bad of ['38000',Infinity,NaN,-1,MAX+1]){
 test(`housing deposit rejects malformed cash ${String(bad)} atomically`,()=>{
  const s=tenant();s.finance.cash=bad;
  const before=structuredClone(s);
  assert.throws(()=>moveHousing(s,'studio'),/cash|balance|safe|invalid|nakit/i);
  assert.deepEqual(s,before);
 });
}
test('valid housing deposit charges once, and repeat is free',()=>{
 const s=tenant();moveHousing(s,'studio');
 assert.equal(s.finance.cash,14000);
 const after=structuredClone(s);
 assert.deepEqual(moveHousing(s,'studio'),{mode:'studio',cost:0,changed:false});
 assert.deepEqual(s,after);
});

const reserve=systemicStorylets.find(e=>e.id==='storylet-emergency-reserve');
const payChoice=s=>new EventEngine().choicesFor(s,reserve).find(c=>c.id==='pay-cash');
function shock(){return {
 player:{age:40},finance:{cash:1200,debt:1800,debts:{consumer:0,medical:0,housing:0,car:0,emergency:1800}},
 householdDynamics:{recentShock:{age:40,cost:1800,remainingDebt:1800}},
 storyletCooldowns:{},storyletCounts:{},healthProfile:{stress:30},lifeMemory:{tags:{}}
};}
for(const change of [
 s=>{s.finance.cash=Infinity;},
 s=>{s.finance.cash='1200';},
 s=>{s.finance.debt=NaN;},
 s=>{s.finance.debt=100;},
 s=>{s.finance.debts.emergency='1800';},
 s=>{s.householdDynamics.recentShock.remainingDebt=Infinity;}
]){
 test('emergency reserve rejects malformed or contradictory debt ledger without reward',()=>{
  const s=shock();const cached=payChoice(s);assert.ok(cached);
  change(s);
  const before=structuredClone(s);
  assert.equal(payChoice(s),undefined);
  cached.effect(s);
  assert.deepEqual(s,before);
 });
}
test('valid reserve settlement preserves net worth and is idempotent',()=>{
 const s=shock();const pay=payChoice(s);
 const before=s.finance.cash-s.finance.debt;
 pay.effect(s);
 assert.equal(s.finance.cash,0);
 assert.equal(s.finance.debt,600);
 assert.equal(s.finance.debts.emergency,600);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,600);
 assert.equal(s.finance.cash-s.finance.debt,before);
 const after=structuredClone(s);pay.effect(s);assert.deepEqual(s,after);
});

test('reserve settlement preserves unrelated debt buckets',()=>{
 const s=shock();s.finance.debts.consumer=500;s.finance.debt=2300;
 const pay=payChoice(s);assert.ok(pay);pay.effect(s);
 assert.equal(s.finance.debts.consumer,500);
 assert.equal(s.finance.debts.emergency,600);
 assert.equal(s.finance.debt,1100);
});

test('reserve settlement rejects shock provenance larger than emergency debt',()=>{
 const s=shock();const pay=payChoice(s);assert.ok(pay);
 s.householdDynamics.recentShock.remainingDebt=1801;
 const before=structuredClone(s);
 assert.equal(payChoice(s),undefined);
 pay.effect(s);
 assert.deepEqual(s,before);
});
