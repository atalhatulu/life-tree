import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {affordableCarOptions,affordableHomeOptions,buyCar,buyHome} from '../src/assets/asset_system.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';

const MAX=Number.MAX_SAFE_INTEGER;
function adult(seed){
 const s=new Game(seed).state;
 s.player.age=40;
 ensurePersonalFinance(s);
 s.finance.cash=3_000_000;
 s.finance.savings=0;
 s.finance.debt=0;
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 s.career={employed:true,monthlyIncome:120_000};
 s.assets={car:null,home:null};
 return s;
}
function saturated(s){s.finance.debt=MAX-1;s.finance.debts.consumer=MAX-1;}

for(const [name,options,buy,asset] of [
 ['car',affordableCarOptions,buyCar,'car'],
 ['home',affordableHomeOptions,buyHome,'home']
]){
 test(`${name} purchase rejects saturated debt without taking down payment or changing state`,()=>{
  const s=adult(`cycle44-${name}-overflow`);
  const id=options(s)[0].id;
  saturated(s);
  const before=structuredClone(s);
  assert.throws(()=>buy(s,id),/safe|limit|exceed|overflow/i);
  assert.deepEqual(s,before);
 });
 test(`${name} purchase rejects invalid cash without granting a financed asset`,()=>{
  for(const bad of [Infinity,'3000000',NaN]){
   const s=adult(`cycle44-${name}-invalid`);
   s.finance.cash=bad;
   const before=structuredClone(s);
   assert.deepEqual(options(s),[]);
   assert.throws(()=>buy(s,name==='car'?'used':'small-flat'),/afford|karşıla|cash|nakit|safe/i);
   assert.deepEqual(s,before);
  }
 });
 test(`${name} purchase still finances a valid asset with exact cash and loan bookkeeping`,()=>{
  const s=adult(`cycle44-${name}-valid`);
  const item=options(s)[0];
  const down=Math.round(item.price*(name==='car'?.30:.12));
  const before=s.finance.cash;
  buy(s,item.id);
  assert.equal(s.finance.cash,before-down);
  assert.equal(s.assets[asset].remainingDebt,item.price-down);
  assert.equal(s.finance.debts[name==='car'?'car':'housing'],item.price-down);
  assert.equal(s.finance.debt,item.price-down);
 });
}

const future=systemicStorylets.find(s=>s.id==='storylet-secure-couple-future');
function futureState(cash=9000,savings=500){
 return {player:{age:40},social:{romance:{trust:85,sharedGoals:80,moneyAlignment:50}},
  finance:{cash,savings},storyletCooldowns:{},storyletCounts:{}};
}
const financialGoal=future.choices.find(c=>c.id==='financial-goal');
test('future-plan transfer caps deposits at remaining safe savings capacity',()=>{
 const s=futureState(9000,MAX-3);
 financialGoal.effect(s);
 assert.equal(s.finance.cash,8997);
 assert.equal(s.finance.savings,MAX);
 assert.equal(s.storyletCounts['future-plan'],1);
 assert.equal(s.social.romance.moneyAlignment,56);
});
test('future-plan rejects invalid savings atomically before relationship or cooldown updates',()=>{
 for(const bad of [Infinity,NaN,'100']){
  const s=futureState(9000,bad);
  const before=structuredClone(s);
  assert.throws(()=>financialGoal.effect(s),/safe|invalid|monetary|balance/i);
  assert.deepEqual(s,before);
 }
});
test('future-plan rejects invalid cash atomically',()=>{
 const s=futureState(Infinity,500);
 const before=structuredClone(s);
 assert.throws(()=>financialGoal.effect(s),/safe|invalid|monetary|balance/i);
 assert.deepEqual(s,before);
});
test('future-plan cannot replay a stale financial-goal choice for more relationship or savings',()=>{
 const s=futureState();
 financialGoal.effect(s);
 const once=structuredClone(s);
 financialGoal.effect(s);
 assert.deepEqual(s,once);
});
test('future-plan supports zero cash while preserving relationship-only effect',()=>{
 const s=futureState(0,0);
 financialGoal.effect(s);
 assert.equal(s.finance.cash,0);
 assert.equal(s.finance.savings,0);
 assert.equal(s.social.romance.sharedGoals,85);
});
