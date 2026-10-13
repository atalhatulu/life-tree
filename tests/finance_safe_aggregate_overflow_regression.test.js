import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {addDebt, ensurePersonalFinance, processPersonalFinanceYear, settleSecuredAssetSale} from '../src/finance/personal_finance.js';

const MAX=Number.MAX_SAFE_INTEGER;
function ledger(){
 const s={player:{age:40},household:{economicClass:'orta'},assets:{home:null,car:null},
  finance:{cash:2000,savings:0,debt:0,debts:{consumer:0,medical:0,housing:0,car:0,emergency:0}}};
 ensurePersonalFinance(s);
 return s;
}

test('adding a valid individual loan cannot overflow an already large aggregate',()=>{
 const s=ledger();
 s.finance.debts.consumer=MAX-3;
 s.finance.debt=MAX-3;
 const before=structuredClone(s);
 assert.throws(()=>addDebt(s,'medical',4),/safe|limit|overflow|maximum/i);
 assert.deepEqual(s,before,'rejected loan must not even normalize the original state');
});

test('adding to a nearly full typed bucket cannot exceed safe total',()=>{
 const s=ledger();
 s.finance.debts.emergency=MAX-1;
 s.finance.debt=MAX-1;
 const before=structuredClone(s);
 assert.throws(()=>addDebt(s,'emergency',2),/safe|limit|overflow|maximum/i);
 assert.deepEqual(s,before);
});

test('exact safe aggregate limit and zero-sized loans remain supported',()=>{
 const s=ledger();
 s.finance.debts.consumer=MAX-3;
 s.finance.debt=MAX-3;
 assert.equal(addDebt(s,'medical',3),MAX);
 assert.equal(addDebt(s,'consumer',0),MAX);
 assert.equal(s.finance.debts.medical,3);
 assert.equal(s.finance.debt,MAX);
});

test('secured sale cannot overflow cash, even when proceeds are individually safe',()=>{
 const s=ledger();
 s.assets.car={price:3000,remainingDebt:1000};
 s.finance.debts.car=1000;
 s.finance.debt=1000;
 s.finance.cash=MAX-4;
 const before=structuredClone(s);
 assert.throws(()=>settleSecuredAssetSale(s,'car',1010),/safe|limit|overflow|maximum/i);
 assert.deepEqual(s,before,'sale rejection must preserve collateral and debt ledger');
});

test('secured sale permits exact cash limit and preserves sale accounting',()=>{
 const s=ledger();
 s.assets.car={price:3000,remainingDebt:1000};
 s.finance.debts.car=1000;
 s.finance.debt=1000;
 s.finance.cash=MAX-4;
 assert.equal(settleSecuredAssetSale(s,'car',1004).net,4);
 assert.equal(s.finance.cash,MAX);
 assert.equal(s.finance.debt,0);
});

test('secured sale refuses corrupt nonnumeric legacy cash without mutation',()=>{
 const s=ledger();
 s.assets.car={price:3000,remainingDebt:1000};
 s.finance.debts.car=1000;
 s.finance.debt=1000;
 s.finance.cash='100';
 const before=structuredClone(s);
 assert.throws(()=>settleSecuredAssetSale(s,'car',1010),/cash|safe|limit|invalid/i);
 assert.deepEqual(s,before);
});

test('annual interest cannot push typed or aggregate debt past safe integer limit',()=>{
 const s=new Game('annual-overflow-cap').state;
 s.player.age=48;
 ensurePersonalFinance(s);
 s.career={employed:true,monthlyIncome:400000};
 s.finance.cash=2_000_000;
 s.finance.savings=0;
 s.finance.debts={consumer:MAX-10_000,medical:9000,housing:0,car:0,emergency:0};
 s.finance.debt=MAX-1000;
 s.assets={car:null,home:null};
 const result=processPersonalFinanceYear(s);
 assert.equal(result.length,1);
 assert.equal(s.finance.debt,MAX);
 assert.ok(Number.isSafeInteger(s.finance.debt));
 assert.ok(Object.values(s.finance.debts).every(Number.isSafeInteger));
 assert.equal(Object.values(s.finance.debts).reduce((a,b)=>a+b,0),s.finance.debt);
});

test('forced secured sale may use proceeds to retire consumer debt without overflowing cash',()=>{
 const s=ledger();
 s.assets.home={price:5000,remainingDebt:1000};
 s.finance.debts.housing=1000;
 s.finance.debts.consumer=500;
 s.finance.debt=1500;
 s.finance.cash=MAX;
 const outcome=settleSecuredAssetSale(s,'housing',1500,true);
 assert.equal(outcome.extraPaid,500);
 assert.equal(s.finance.cash,MAX);
 assert.equal(s.finance.debt,0);
});

test('overflow rejection leaves an unnormalized legacy debt record untouched',()=>{
 const s=ledger();
 s.finance.debts={consumer:MAX-1,medical:NaN};
 s.finance.debt=MAX-1;
 const before=structuredClone(s);
 assert.throws(()=>addDebt(s,'emergency',2),/safe|limit|overflow|maximum/i);
 assert.deepEqual(s,before);
});
