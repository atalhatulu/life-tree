import test from 'node:test';
import assert from 'node:assert/strict';
import {processHouseholdDepthYear} from '../src/finance/household_depth.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';

const reserve=systemicStorylets.find(e=>e.id==='storylet-emergency-reserve');
const options=s=>new EventEngine().choicesFor(s,reserve);
const choice=(s,id)=>options(s).find(c=>c.id===id);
const rng={fork:()=>({chance:()=>true}),int:()=>0};
function state(cash=1000,oldDebt=0){
 return {
  player:{age:40},assets:{car:{purchasedAtAge:40}},
  finance:{cash,savings:0,debt:oldDebt,debts:{consumer:0,medical:0,housing:0,car:0,emergency:oldDebt},monthlyExpenses:1000},
  healthProfile:{stress:30},lifeMemory:{tags:{}},storyletCooldowns:{},storyletCounts:{}
 };
}
function shock(s){processHouseholdDepthYear(s,rng);return s.householdDynamics.recentShock;}

test('household shock does not erase an already negative cash balance',()=>{
 const s=state(-200);const h=shock(s);
 assert.equal(h.cost,4500);
 assert.equal(s.finance.cash,-200);
 assert.equal(s.finance.debt,4500);
 assert.equal(s.finance.debts.emergency,4500);
});

test('household shock records only the unpaid part and keeps typed debt in sync',()=>{
 const s=state(1000,2000);const h=shock(s);
 assert.equal(s.finance.cash,0);
 assert.equal(h.remainingDebt,3500);
 assert.equal(s.finance.debt,5500);
 assert.equal(s.finance.debts.emergency,5500);
});

test('reserve cash choice pays shock debt with actual cash and conserves net worth',()=>{
 const s=state(1000);shock(s);
 s.finance.cash=1200; // Later cash inflow, after the shock was charged.
 const before=s.finance.cash-s.finance.debt;
 const pay=choice(s,'pay-cash');assert.ok(pay);
 pay.effect(s);
 assert.equal(s.finance.cash,0);
 assert.equal(s.finance.debt,2300);
 assert.equal(s.finance.debts.emergency,2300);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,2300);
 assert.equal(s.finance.cash-s.finance.debt,before);
 assert.equal(s.storyletCounts['reserve-choice'],1);
});

test('cash settlement cannot overpay the shock or charge a second time',()=>{
 const s=state(4000);shock(s); // Only 500 in new emergency debt.
 s.finance.cash=5000;
 const pay=choice(s,'pay-cash');assert.ok(pay);
 pay.effect(s);
 assert.equal(s.finance.cash,4500);
 assert.equal(s.finance.debt,0);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,0);
 assert.ok(!choice(s,'pay-cash'));
 assert.ok(!choice(s,'ignore-debt'));
 pay.effect(s); // Stale option must not double-charge.
 assert.equal(s.finance.cash,4500);
 assert.equal(s.finance.debt,0);
 assert.equal(s.storyletCounts['reserve-choice'],1);
});

test('fully prepaid shock does not offer fictional cash or debt settlement',()=>{
 const s=state(10000);shock(s);
 assert.equal(s.finance.debt,0);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,0);
 assert.ok(!choice(s,'pay-cash'));
 assert.ok(!choice(s,'ignore-debt'));
 assert.ok(choice(s,'tighten'));
});

test('legacy shocks without debt provenance cannot charge cash for an unknown bill',()=>{
 const s=state(10000,5000);
 s.householdDynamics={recentShock:{age:40,cost:3000,type:'car-repair'}};
 assert.ok(!choice(s,'pay-cash'));
 assert.ok(!choice(s,'ignore-debt'));
});

test('stale cash choice is a no-op when cash or debt disappears',()=>{
 for(const changed of ['cash','debt']){
  const s=state(1000);shock(s);s.finance.cash=1000;
  const pay=choice(s,'pay-cash');assert.ok(pay);
  if(changed==='cash')s.finance.cash=0;
  else {s.finance.debts.emergency=0;s.finance.debt=0;}
  const snapshot=structuredClone(s);
  pay.effect(s);
  assert.deepEqual(s,snapshot);
 }
});

test('stale debt-deferral choice does not add stress after debt is settled',()=>{
 const s=state(1000);shock(s);
 const defer=choice(s,'ignore-debt');assert.ok(defer);
 s.finance.debts.emergency=0;s.finance.debt=0;
 const snapshot=structuredClone(s);
 defer.effect(s);
 assert.deepEqual(s,snapshot);
});
