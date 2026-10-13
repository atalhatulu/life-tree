import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {addDebt, ensurePersonalFinance, payDownDebt, processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {EventEngine} from '../src/events/event_engine.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';

const reserve=systemicStorylets.find(e=>e.id==='storylet-emergency-reserve');
const reserveChoice=(s,id)=>new EventEngine().choicesFor(s,reserve).find(c=>c.id===id);
function adult(seed){
 const s=new Game(seed).state;
 s.player.age=40;
 ensurePersonalFinance(s);
 s.finance.cash=0;
 s.finance.savings=0;
 return s;
}
function withShock(s,amount,oldEmergency=0){
 addDebt(s,'emergency',oldEmergency+amount);
 s.householdDynamics={recentShock:{age:s.player.age,type:'car-repair',cost:amount,remainingDebt:amount}};
}

test('manual debt repayment settles recent shock first without billing older emergency debt twice',()=>{
 const s=adult('manual-shock-repayment');
 withShock(s,4000,1000);
 payDownDebt(s,2000);
 assert.equal(s.finance.debts.emergency,3000);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,2000);
 s.finance.cash=3000;
 const pay=reserveChoice(s,'pay-cash');
 assert.ok(pay);
 pay.effect(s);
 assert.equal(s.finance.cash,1000);
 assert.equal(s.finance.debts.emergency,1000);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,0);
 assert.equal(reserveChoice(s,'pay-cash'),undefined);
});

test('automatic annual debt service clears shock provenance when emergency debt is paid',()=>{
 const s=adult('annual-shock-repayment');
 withShock(s,3500,1500);
 s.career={employed:true,monthlyIncome:120000};
 processPersonalFinanceYear(s);
 assert.equal(s.finance.debts.emergency,0);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,0);
 assert.equal(reserveChoice(s,'pay-cash'),undefined);
});

test('emergency debt restructuring reduces tracked shock principal by the written-off amount',()=>{
 const before=adult('restructure-shock');
 before.career={employed:false,monthlyIncome:0};
 withShock(before,3000000,2000000);
 before.finance.financialDistressYears=2;
 const control=structuredClone(before);
 control.finance.financialDistressYears=0;
 processPersonalFinanceYear(control);
 processPersonalFinanceYear(before);
 assert.equal(before.finance.debtRestructured,true);
 const discount=control.finance.debts.emergency-before.finance.debts.emergency;
 assert.ok(discount>0);
 assert.equal(before.householdDynamics.recentShock.remainingDebt,Math.max(0,3000000-discount));
});

test('annual deficit never erases pre-existing negative cash or creates extra debt for it',()=>{
 const baseline=adult('negative-reserve');
 baseline.career={employed:false,monthlyIncome:0};
 const negative=structuredClone(baseline);
 negative.finance.cash=-200;
 processPersonalFinanceYear(baseline);
 processPersonalFinanceYear(negative);
 assert.equal(negative.finance.cash,-200);
 assert.equal(negative.finance.debt,baseline.finance.debt);
});
