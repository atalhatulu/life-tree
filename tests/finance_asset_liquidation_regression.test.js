import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance, processPersonalFinanceYear} from '../src/finance/personal_finance.js';

function adult(seed){
 const state=new Game(seed).state;
 state.player.age=48;
 ensurePersonalFinance(state);
 state.career={employed:false,monthlyIncome:0};
 state.finance.cash=0;
 state.finance.savings=0;
 state.finance.debts={consumer:1_000_000,medical:0,housing:0,car:0,emergency:0};
 state.finance.debt=1_000_000;
 state.finance.lifestyle={housing:'family',food:'standard',clothing:'basic',transport:'public'};
 state.assets={car:null,home:null};
 return state;
}

function assertLiquidationProceedsCredited(state,asset,price,years,securedBalance){
 state.assets[asset]={price,remainingDebt:securedBalance,purchasedAtAge:state.player.age-4};
 const bucket=asset==='car'?'car':'housing';
 state.finance.debts[bucket]=securedBalance;
 state.finance.debt+=securedBalance;
 state.finance.financialDistressYears=years;
 const control=structuredClone(state);
 control.finance.financialDistressYears=0;
 processPersonalFinanceYear(control);
 processPersonalFinanceYear(state);
 assert.equal(state.assets[asset],null,`${asset} should have been liquidated`);
 const expectedProceeds=Math.round(price*(asset==='car'?.45:.88));
 const proceedsAppliedToDebt=control.finance.debt-state.finance.debt;
 const proceedsCreditedToCash=state.finance.cash-control.finance.cash;
 assert.ok(proceedsCreditedToCash>0,'surplus sale proceeds must reach cash');
 assert.equal(proceedsAppliedToDebt+proceedsCreditedToCash,expectedProceeds,
  'sale proceeds must be conserved across debt repayment and cash');
 assert.equal(state.finance.debts[bucket],0,'secured loan should be paid before unsecured debt');
 assert.equal(state.finance.debt,Object.values(state.finance.debts).reduce((a,b)=>a+b,0));
}

test('forced car sale credits unused proceeds to cash instead of destroying them',()=>{
 const state=adult('forced-car-sale-proceeds');
 assertLiquidationProceedsCredited(state,'car',6_000_000,1,500_000);
});

test('forced home sale credits unused proceeds to cash instead of destroying them',()=>{
 const state=adult('forced-home-sale-proceeds');
 assertLiquidationProceedsCredited(state,'home',20_000_000,2,1_000_000);
});

test('car collateral balance tracks annual accrued interest',()=>{
 const state=adult('car-interest-sync');
 state.finance.debts={consumer:0,medical:0,housing:0,car:100_000,emergency:0};
 state.finance.debt=100_000;
 state.assets.car={price:300_000,remainingDebt:100_000,purchasedAtAge:state.player.age};
 processPersonalFinanceYear(state);
 assert.ok(state.finance.debts.car>100_000,'interest should accrue');
 assert.equal(state.assets.car.remainingDebt,state.finance.debts.car);
});

test('home collateral balance tracks annual accrued interest',()=>{
 const state=adult('home-interest-sync');
 state.finance.debts={consumer:0,medical:0,housing:300_000,car:0,emergency:0};
 state.finance.debt=300_000;
 state.assets.home={price:1_000_000,remainingDebt:300_000,purchasedAtAge:state.player.age};
 processPersonalFinanceYear(state);
 assert.ok(state.finance.debts.housing>300_000,'interest should accrue');
 assert.equal(state.assets.home.remainingDebt,state.finance.debts.housing);
});
