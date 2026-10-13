import test from 'node:test';
import assert from 'node:assert/strict';
import {processBusinessYear} from '../src/career/entrepreneurship_system.js';
import {moveToCity,movingCost} from '../src/world/migration_system.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';
import {ensurePersonalFinance,payDownDebt} from '../src/finance/personal_finance.js';

const debts=()=>({consumer:0,medical:0,housing:0,car:0,emergency:0});
const rng={int:(min,max)=>min===-24000?-24000:0,chance:()=>false};
function business(cash=0){
 return {year:2055,player:{age:35,personality:{ambition:70,discipline:65,sociability:60}},
  business:{active:true,mode:'full-time',health:50,capital:10000,years:0,employees:0},
  finance:{cash,debt:0,debts:debts()},healthProfile:{stress:20}};
}
function migrant(cash=0){
 return {year:2058,player:{age:32},location:{countryId:'TR',cityId:'ankara',cityName:'Ankara'},
  origin:{countryId:'TR',cityId:'ankara'},children:[],social:{romance:null},
  finance:{cash,debt:0,debts:debts()}};
}
const storylet=id=>systemicStorylets.find(event=>event.id===id);

test('business annual loss is classified as consumer debt, not untyped aggregate',()=>{
 const s=business(0);
 processBusinessYear(s,rng);
 const loss=Math.abs(s.business.monthlyProfit*12);
 assert.ok(loss>0);
 assert.equal(s.finance.debts.consumer,loss);
 assert.equal(s.finance.debt,loss);
 assert.equal(ensurePersonalFinance(s).debt,loss);
});
test('business losses spend available cash before creating typed debt',()=>{
 const s=business(100);
 processBusinessYear(s,rng);
 assert.equal(s.finance.cash,0);
 assert.equal(s.finance.debts.consumer,Math.abs(s.business.monthlyProfit*12)-100);
});
test('business losses preserve an existing negative cash balance',()=>{
 const s=business(-250);
 processBusinessYear(s,rng);
 assert.equal(s.finance.cash,-250);
 assert.equal(s.finance.debts.consumer,Math.abs(s.business.monthlyProfit*12));
});
test('business loss ledger remains consistent after debt repayment and replay',()=>{
 const s=business(0);
 processBusinessYear(s,rng);
 const after=structuredClone(s);
 assert.deepEqual(processBusinessYear(s,{int(){throw Error('RNG replay');},chance(){throw Error('RNG replay');}}),[]);
 assert.deepEqual(s,after);
 payDownDebt(s,150);
 assert.equal(s.finance.debts.consumer,s.finance.debt);
 assert.equal(s.finance.debt,after.finance.debt-150);
});
test('migration shortfall is recorded as emergency debt alongside existing typed debt',()=>{
 const s=migrant(0);
 s.finance.debts.consumer=400;
 s.finance.debt=400;
 const cost=movingCost('ankara','istanbul',1);
 const result=moveToCity(s,'istanbul');
 assert.equal(result.cost,cost);
 assert.equal(s.finance.debts.emergency,cost);
 assert.equal(s.finance.debts.consumer,400);
 assert.equal(s.finance.debt,cost+400);
 assert.equal(ensurePersonalFinance(s).debt,cost+400);
});
test('migration with negative cash preserves deficit rather than creating cash',()=>{
 const s=migrant(-300);
 const cost=movingCost('ankara','istanbul',1);
 moveToCity(s,'istanbul');
 assert.equal(s.finance.cash,-300);
 assert.equal(s.finance.debts.emergency,cost);
 assert.equal(s.finance.debt,cost);
});
test('invalid migration cost multipliers reject atomically before finance initialization',()=>{
 for(const multiplier of [-1,NaN,Infinity,-Infinity,'0.5',Number.MAX_VALUE]){
  const s=migrant(5000);
  delete s.finance.debts;
  const before=structuredClone(s);
  assert.throws(()=>moveToCity(s,'istanbul','personal',{costMultiplier:multiplier}),/cost|multiplier|maliyet/i);
  assert.deepEqual(s,before);
 }
});
test('zero-cost sponsored relocation remains valid and incurs no debt',()=>{
 const s=migrant(0);
 const result=moveToCity(s,'istanbul','sponsored',{costMultiplier:0});
 assert.equal(result.cost,0);
 assert.equal(s.finance.cash,0);
 assert.equal(s.finance.debt,0);
 assert.equal(s.migrationHistory.length,1);
});
test('repeated migration to current city is a no-op even with an invalid multiplier',()=>{
 const s=migrant(300);
 const before=structuredClone(s);
 assert.equal(moveToCity(s,'ankara','personal',{costMultiplier:-1}).moved,false);
 assert.deepEqual(s,before);
});
test('storylet condition queries never create cooldown state on empty records',()=>{
 for(const id of ['storylet-work-follows-home','storylet-money-argument','storylet-emergency-reserve','storylet-debt-career-risk']){
  const s={player:{age:36}};
  const before=structuredClone(s);
  storylet(id).condition(s);
  assert.deepEqual(s,before,id);
 }
});
test('storylet eligibility scan is read-only with missing cooldowns',()=>{
 const s={player:{age:35},career:{employed:true,satisfaction:40,workplace:{burnout:80}},social:{romance:{alive:true}},
  finance:{debt:700000},householdDynamics:{financialPressure:60}};
 const before=structuredClone(s);
 new EventEngine([storylet('storylet-work-follows-home'),storylet('storylet-debt-career-risk')]).eligible(s);
 assert.deepEqual(s,before);
});
test('existing cooldowns continue to gate events without modification',()=>{
 const s={player:{age:36},career:{workplace:{burnout:80}},social:{romance:{}},storyletCooldowns:{'work-home':34}};
 const before=structuredClone(s);
 assert.equal(storylet('storylet-work-follows-home').condition(s),false);
 assert.deepEqual(s,before);
 s.player.age=40;
 const later=structuredClone(s);
 assert.equal(storylet('storylet-work-follows-home').condition(s),true);
 assert.deepEqual(s,later);
});
