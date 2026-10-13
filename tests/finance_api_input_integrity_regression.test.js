import test from 'node:test';
import assert from 'node:assert/strict';
import {addDebt, payDownDebt, settleSecuredAssetSale, ensurePersonalFinance} from '../src/finance/personal_finance.js';

function state(){
 const s={
  player:{age:40},
  finance:{cash:12000,savings:3000,debt:0,debts:{consumer:0,medical:0,housing:0,car:0,emergency:0}},
  assets:{car:null,home:null},
  householdDynamics:{recentShock:{age:40,remainingDebt:0}}
 };
 ensurePersonalFinance(s);
 return s;
}
function carLoan(){
 const s=state();
 s.assets.car={price:50000,remainingDebt:0};
 addDebt(s,'car',32000);
 s.assets.car.remainingDebt=32000;
 return s;
}
const badAmounts=[NaN,Infinity,-Infinity,-10,'100',undefined,Number.MAX_SAFE_INTEGER+1];

for(const amount of badAmounts){
 test(`addDebt rejects invalid amount ${String(amount)} without mutating state`,()=>{
  const s=state();
  const before=structuredClone(s);
  assert.throws(()=>addDebt(s,'medical',amount),/amount|tutar|finite|number|safe/i);
  assert.deepEqual(s,before);
 });
}

test('addDebt rejects unknown debt category without mutating state',()=>{
 const s=state(),before=structuredClone(s);
 assert.throws(()=>addDebt(s,'misc',500),/type|category|kategori|tür/i);
 assert.deepEqual(s,before);
});

test('addDebt preserves supported rounding and the typed aggregate ledger',()=>{
 const s=state();
 addDebt(s,'medical',100.6);
 addDebt(s,'consumer',0);
 assert.equal(s.finance.debts.medical,101);
 assert.equal(s.finance.debt,101);
});

for(const amount of badAmounts){
 test(`payDownDebt rejects invalid amount ${String(amount)} without mutating state`,()=>{
  const s=state();
  addDebt(s,'emergency',900);
  s.householdDynamics.recentShock.remainingDebt=500;
  const before=structuredClone(s);
  assert.throws(()=>payDownDebt(s,amount),/amount|tutar|finite|number|safe/i);
  assert.deepEqual(s,before);
 });
}

test('payDownDebt still settles legitimate emergency debt and shock provenance',()=>{
 const s=state();
 addDebt(s,'emergency',900);
 s.householdDynamics.recentShock.remainingDebt=500;
 assert.equal(payDownDebt(s,300.5),599);
 assert.equal(s.finance.debts.emergency,599);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,199);
});

for(const proceeds of badAmounts){
 test(`secured sale rejects invalid proceeds ${String(proceeds)} without mutating state`,()=>{
  const s=carLoan(),before=structuredClone(s);
  assert.throws(()=>settleSecuredAssetSale(s,'car',proceeds),/proceeds|sale|tutar|finite|number|safe/i);
  assert.deepEqual(s,before);
 });
}

test('secured sale still transfers shortfall to consumer debt and retains remaining cash',()=>{
 const s=carLoan();
 const before=s.finance.cash;
 const result=settleSecuredAssetSale(s,'car',20000);
 assert.deepEqual(result,{sale:20000,payoff:20000,extraPaid:0,net:-12000});
 assert.equal(s.finance.debts.car,0);
 assert.equal(s.finance.debts.consumer,12000);
 assert.equal(s.finance.debt,12000);
 assert.equal(s.finance.cash,before);
});
