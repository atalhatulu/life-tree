import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear,payDownDebt} from '../src/finance/personal_finance.js';

function adult(seed){
 const s=new Game('cycle51-'+seed).state;
 s.player.age=48;
 ensurePersonalFinance(s);
 s.career={employed:false,monthlyIncome:0};
 s.finance.cash=0;s.finance.savings=0;
 s.finance.debts={consumer:2_000_000,medical:0,housing:0,car:0,emergency:0};
 s.finance.debt=2_000_000;
 s.finance.financialDistressYears=0;
 s.finance.lifestyle={housing:'family',food:'standard',clothing:'basic',transport:'public'};
 s.assets={car:null,home:null};
 return s;
}

// 1. Annual budget must not commit reserves, lifestyle, or debt before interest validates.
test('invalid annual credit conditions reject without spending cash or advancing the year',()=>{
 const s=adult('invalid-interest');s.finance.cash=25_000;
 s.world.economy.creditConditions=NaN;
 const before=structuredClone(s);
 assert.throws(()=>processPersonalFinanceYear(s),/interest|invalid|safe|credit/i);
 assert.deepEqual(s,before);
});
test('annual finance commit retains existing finance and assets object references',()=>{
 const s=adult('identity');s.finance.cash=10_000;
 const f=s.finance,assets=s.assets;
 assert.equal(processPersonalFinanceYear(s).length,1);
 assert.equal(s.finance,f);assert.equal(s.assets,assets);
 assert.deepEqual(processPersonalFinanceYear(s),[]);
});

// 2. Forced liquidation is the last annual step: invalid collateral cannot leave a half-year.
for(const [asset,years,price,bucket] of [
 ['car',1,Infinity,'car'],['car',1,-200,'car'],
 ['home',2,NaN,'housing'],['home',2,-300,'housing']
]){
 test(`distress rejects invalid ${asset} collateral price ${String(price)} atomically`,()=>{
  const s=adult(`distress-${asset}-${years}-${String(price)}`);
  s.assets[asset]={price,remainingDebt:200_000};
  s.finance.debts[bucket]=200_000;s.finance.debt+=200_000;
  s.finance.financialDistressYears=years;
  const before=structuredClone(s);
  assert.throws(()=>processPersonalFinanceYear(s),/sale|price|monetary|safe|invalid|finite/i);
  assert.deepEqual(s,before);
 });
}

// 3. Recent-shock provenance is part of the debt transaction, not optional metadata.
for(const remainingDebt of [NaN,Infinity,-1,'3000',9000]){
 test(`manual repayment rejects inconsistent shock principal ${String(remainingDebt)} atomically`,()=>{
  const s=adult('shock-'+String(remainingDebt));
  s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:5000};
  s.finance.debt=5000;
  s.householdDynamics={recentShock:{age:48,type:'car-repair',cost:5000,remainingDebt}};
  const before=structuredClone(s);
  assert.throws(()=>payDownDebt(s,2000),/shock|invalid|safe|debt/i);
  assert.deepEqual(s,before);
 });
}
test('valid recent-shock repayment remains exact and preserves finance identity',()=>{
 const s=adult('shock-valid');
 s.finance.debts={consumer:1000,medical:0,housing:0,car:0,emergency:5000};
 s.finance.debt=6000;
 s.householdDynamics={recentShock:{age:48,type:'car-repair',cost:4000,remainingDebt:4000}};
 const f=s.finance,h=s.householdDynamics;
 assert.equal(payDownDebt(s,3000),3000);
 assert.equal(s.finance,f);assert.equal(s.householdDynamics,h);
 assert.equal(s.finance.debts.emergency,3000);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,2000);
});
test('annual emergency debt service rejects invalid shock provenance without partial repayment',()=>{
 const s=adult('annual-shock');s.career={employed:true,monthlyIncome:120000};
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:5000};
 s.finance.debt=5000;
 s.householdDynamics={recentShock:{age:48,type:'car-repair',cost:5000,remainingDebt:NaN}};
 const before=structuredClone(s);
 assert.throws(()=>processPersonalFinanceYear(s),/shock|invalid|safe|debt/i);
 assert.deepEqual(s,before);
});
