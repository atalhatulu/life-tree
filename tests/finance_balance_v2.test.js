import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {settleEstate} from '../src/finance/estate_system.js';
import {spendingSummary} from '../src/finance/life_spending_system.js';
import {processDurableGoodsBudget} from '../src/finance/durable_goods_system.js';

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
 assert.ok(summary.entries>=3);
});


test('durable spending share responds to lifestyle and interests while preserving total spend',()=>{
 const premium=adult('finance-spending-premium');
 premium.state.career={employed:true,monthlyIncome:120000};
 premium.state.finance.cash=0;
 premium.state.finance.savings=0;
 premium.state.finance.lifestyle={housing:'apartment',food:'premium',clothing:'premium',transport:'car'};
 premium.state.player.interests={...(premium.state.player.interests??{}),teknoloji:90,otomobil:90,fotoğraf:80,oyun:80};
 processPersonalFinanceYear(premium.state);
 const premiumSummary=spendingSummary(premium.state);

 const frugal=adult('finance-spending-frugal');
 frugal.state.career={employed:true,monthlyIncome:120000};
 frugal.state.finance.cash=0;
 frugal.state.finance.savings=0;
 frugal.state.finance.lifestyle={housing:'family',food:'frugal',clothing:'basic',transport:'public'};
 frugal.state.player.interests={...(frugal.state.player.interests??{}),teknoloji:10,otomobil:10,fotoğraf:10,oyun:10};
 processPersonalFinanceYear(frugal.state);
 const frugalSummary=spendingSummary(frugal.state);

 assert.equal(premiumSummary.total,premium.state.finance.discretionaryAnnual);
 assert.equal(frugalSummary.total,frugal.state.finance.discretionaryAnnual);
 assert.ok(
  premiumSummary.byCategory['durable-goods']/premiumSummary.total>
  frugalSummary.byCategory['durable-goods']/frugalSummary.total
 );
});


test('durable goods budget creates owned items without double charging the annual budget',()=>{
 const g=adult('durable-goods-first-purchase');
 g.state.player.age=30;
 g.state.year=2056;
 g.state.finance.lifestyle={housing:'apartment',food:'standard',clothing:'standard',transport:'public'};
 g.state.player.interests={...(g.state.player.interests??{}),teknoloji:90,oyun:80};
 const result=processDurableGoodsBudget(g.state,100000);
 const summary=spendingSummary(g.state);
 assert.equal(summary.total,100000);
 assert.equal(result.spent,100000);
 assert.ok(g.state.finance.durableGoods.phone||g.state.finance.durableGoods.computer);
});

test('durable goods are replaced after their useful lifespan',()=>{
 const g=adult('durable-goods-replacement');
 g.state.player.age=30;
 g.state.year=2056;
 g.state.finance.lifestyle={housing:'family',food:'standard',clothing:'standard',transport:'public'};
 processDurableGoodsBudget(g.state,30000);
 assert.equal(g.state.finance.durableGoods.phone.generation,1);
 g.state.player.age=34;
 g.state.year=2060;
 processDurableGoodsBudget(g.state,30000);
 assert.equal(g.state.finance.durableGoods.phone.generation,2);
 assert.equal(g.state.finance.durableGoods.phone.purchasedAtAge,34);
});
