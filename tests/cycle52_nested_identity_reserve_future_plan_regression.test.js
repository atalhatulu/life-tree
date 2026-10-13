import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear,payDownDebt} from '../src/finance/personal_finance.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';

const event=id=>systemicStorylets.find(e=>e.id===id);
const choice=(id,state,option)=>new EventEngine().choicesFor(state,event(id)).find(c=>c.id===option);
const ledger=()=>({consumer:0,emergency:0,medical:0,car:0,housing:0});
function reserveState(){return {
 player:{age:45},finance:{cash:3000,savings:0,debt:1000,debts:{...ledger(),emergency:1000}},
 householdDynamics:{recentShock:{age:45,cost:1000,remainingDebt:1000}},
 healthProfile:{stress:30},storyletCounts:{},storyletCooldowns:{}
};}
function coupleState(){return {
 player:{age:35},finance:{cash:8000,savings:1000},
 social:{romance:{alive:true,trust:90,sharedGoals:80,moneyAlignment:50}},
 storyletCounts:{},storyletCooldowns:{}
};}

test('reserve cash settlement rejects a shock whose outstanding principal exceeds its original cost',()=>{
 const s=reserveState();s.householdDynamics.recentShock.cost=500;
 assert.equal(choice('storylet-emergency-reserve',s,'pay-cash'),undefined);
});
test('reserve cash settlement rejects invalid original shock costs',()=>{
 for(const cost of [NaN,Infinity,-1,'1000']){
  const s=reserveState();s.householdDynamics.recentShock.cost=cost;
  assert.equal(choice('storylet-emergency-reserve',s,'pay-cash'),undefined);
 }
});
test('cached reserve payment cannot charge cash after shock provenance is corrupted',()=>{
 const s=reserveState();const pay=choice('storylet-emergency-reserve',s,'pay-cash');assert.ok(pay);
 s.householdDynamics.recentShock.cost=400;
 const before=structuredClone(s);pay.effect(s);assert.deepEqual(s,before);
});
test('reserve cash settlement still pays a valid original bill exactly once',()=>{
 const s=reserveState();const pay=choice('storylet-emergency-reserve',s,'pay-cash');assert.ok(pay);
 pay.effect(s);assert.equal(s.finance.cash,2000);assert.equal(s.finance.debt,0);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,0);
 pay.effect(s);assert.equal(s.finance.cash,2000);
});

test('cached couple savings choice does not transfer money after romance disappears',()=>{
 const s=coupleState();const save=choice('storylet-secure-couple-future',s,'financial-goal');assert.ok(save);
 s.social.romance=null;const before=structuredClone(s);
 assert.doesNotThrow(()=>save.effect(s));assert.deepEqual(s,before);
});
test('cached couple savings choice does not reward a deceased partner',()=>{
 const s=coupleState();const save=choice('storylet-secure-couple-future',s,'financial-goal');assert.ok(save);
 s.social.romance.alive=false;const before=structuredClone(s);
 save.effect(s);assert.deepEqual(s,before);
});
test('couple savings transfer keeps exact balances and cannot be replayed',()=>{
 const s=coupleState();const save=choice('storylet-secure-couple-future',s,'financial-goal');assert.ok(save);
 save.effect(s);assert.equal(s.finance.cash,3000);assert.equal(s.finance.savings,6000);
 assert.equal(s.social.romance.moneyAlignment,56);
 save.effect(s);assert.equal(s.finance.cash,3000);assert.equal(s.finance.savings,6000);
});

test('annual finance commit preserves live nested ledger, lifestyle and collateral references',()=>{
 const s=new Game('cycle52-annual-nested').state;s.player.age=40;
 ensurePersonalFinance(s);s.career={employed:true,monthlyIncome:100000};
 s.finance.cash=20000;s.finance.debts={...ledger(),car:1000};s.finance.debt=1000;
 s.assets={car:{price:50000,remainingDebt:1000},home:null};
 const debts=s.finance.debts,lifestyle=s.finance.lifestyle,car=s.assets.car;
 assert.equal(processPersonalFinanceYear(s).length,1);
 assert.equal(s.finance.debts,debts);assert.equal(s.finance.lifestyle,lifestyle);
 assert.equal(s.assets.car,car);assert.equal(car.remainingDebt,s.finance.debts.car);
});
test('manual debt repayment preserves nested debt and recent shock references',()=>{
 const s=reserveState();const debts=s.finance.debts,shock=s.householdDynamics.recentShock;
 assert.equal(payDownDebt(s,300),700);
 assert.equal(s.finance.debts,debts);assert.equal(s.householdDynamics.recentShock,shock);
 assert.equal(debts.emergency,700);assert.equal(shock.remainingDebt,700);
});

test('finance draft commit does not mutate prototypes for legacy __proto__ data keys',()=>{
 const s=reserveState();
 Object.defineProperty(s.finance,'__proto__',{value:{legacyMarker:1},enumerable:true,writable:true,configurable:true});
 const f=s.finance;payDownDebt(s,100);
 assert.equal(Object.getPrototypeOf(f),Object.prototype);
 assert.equal(Object.prototype.legacyMarker,undefined);
 assert.equal(Object.hasOwn(f,'__proto__'),true);
 assert.equal(f.__proto__.legacyMarker,1);
});
