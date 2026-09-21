import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {settleEstate} from '../src/finance/estate_system.js';

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
