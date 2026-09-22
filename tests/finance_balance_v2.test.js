import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {settleEstate} from '../src/finance/estate_system.js';
import {spendingSummary} from '../src/finance/life_spending_system.js';

function adult(seed='finance-v2'){
 const g=new Game(seed);
 g.state.player.age=40;
 ensurePersonalFinance(g.state);
 return g;
}

test('large annual surplus fills emergency cash then long-term savings',()=>{
 const g=adult('finance-surplus');
 g.state.career={employed:true,monthlyIncome:180000};
 g.state.finance.cash=0;
 g.state.finance.savings=0;
 g.state.finance.lifestyle={housing:'family',food:'standard',clothing:'basic',transport:'public'};
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.cash>0);
 assert.ok(g.state.finance.savings>0);
 assert.ok(g.state.finance.cash<g.state.finance.savings);
});

test('annual deficit consumes cash and savings before creating new debt',()=>{
 const g=adult('finance-deficit');
 g.state.career={employed:false,monthlyIncome:0};
 g.state.finance.cash=100000;
 g.state.finance.savings=250000;
 g.state.finance.debt=0;
 g.state.finance.lifestyle={housing:'apartment',food:'premium',clothing:'premium',transport:'car'};
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.cash<100000);
 assert.ok(g.state.finance.savings<250000);
 assert.ok(g.state.finance.debt>=0);
});

test('persistent debt distress downgrades lifestyle and records distress',()=>{
 const g=adult('finance-distress');
 g.state.career={employed:false,monthlyIncome:0};
 g.state.finance.cash=0;
 g.state.finance.savings=0;
 g.state.finance.debt=5000000;
 g.state.finance.lifestyle={housing:'apartment',food:'premium',clothing:'premium',transport:'public'};
 for(let i=0;i<2;i++)processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.financialDistressEvents>=1);
 assert.notEqual(g.state.finance.lifestyle.clothing,'premium');
 assert.notEqual(g.state.finance.lifestyle.food,'premium');
});

test('estate includes long-term savings',()=>{
 const g=adult('finance-estate');
 g.state.finance.cash=100000;
 g.state.finance.savings=900000;
 g.state.finance.debt=0;
 const estate=settleEstate(g.state);
 assert.ok(estate.gross>=1000000);
});


test('prolonged insolvency without assets is capped to sustainable debt capacity',()=>{
 const g=new Game('insolvency-resolution');
 g.state.player.age=78;
 g.state.career={employed:false};
 g.state.retirement={retired:true,pensionMonthly:18000};
 g.state.assets={home:null,car:null};
 g.state.finance={
  cash:0,savings:0,debt:9000000,monthlyIncome:0,monthlyExpenses:0,
  familySupportMonthly:0,childMonthlyCost:0,financialDistressYears:8,
  financialDistressEvents:8,debtRestructured:true,
  lifestyle:{housing:'shared',food:'frugal',clothing:'basic',transport:'public'}
 };
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.debt<3000000,'debt should be resolved toward sustainable capacity');
 assert.equal(g.state.finance.insolvencyResolved,true);
});


test('minimum wage baseline is 30000 TRY and entry salary floor respects it',async()=>{
 const {TURKEY_2026_ECONOMY}=await import('../src/data/countries/turkey/economy.js');
 const {JOBS}=await import('../src/data/countries/turkey/jobs.js');
 assert.equal(TURKEY_2026_ECONOMY.netMinimumWage,30000);
 const paid=JOBS.filter(job=>job.id!=='unemployed');
 assert.ok(paid.every(job=>job.income[0]>=30000));
 assert.equal(JOBS.find(job=>job.id==='cleaner').income[0],30000);
});


test('annual discretionary spending is split across real life categories without changing total spend',()=>{
 const g=adult('finance-spending-ledger');
 g.state.career={employed:true,monthlyIncome:120000};
 g.state.finance.cash=0;
 g.state.finance.savings=0;
 g.state.finance.lifestyle={housing:'family',food:'standard',clothing:'standard',transport:'public'};
 processPersonalFinanceYear(g.state);
 const summary=spendingSummary(g.state);
 assert.ok(g.state.finance.discretionaryAnnual>0);
 assert.ok(summary.byCategory['daily-life']>0);
 assert.ok(summary.byCategory.experiences>0);
 assert.ok(summary.byCategory['durable-goods']>0);
 assert.equal(summary.total,g.state.finance.discretionaryAnnual);
 assert.equal(summary.entries,3);
});
