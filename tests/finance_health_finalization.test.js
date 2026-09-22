import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {processHealthYear} from '../src/health/health_system.js';

test('excess liquid reserves repay unsecured debt before it can compound',()=>{
 const g=new Game('unsecured-debt-sweep');
 g.state.player.age=40;
 ensurePersonalFinance(g.state);
 g.state.career={employed:true,monthlyIncome:90000,satisfaction:60};
 g.state.finance.cash=300000;
 g.state.finance.savings=3000000;
 g.state.finance.debt=2500000;
 g.state.finance.lifestyle={housing:'shared',food:'standard',clothing:'basic',transport:'public'};
 g.state.assets={home:null,car:null};
 const beforeDebt=g.state.finance.debt;
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.debt<beforeDebt,'unsecured debt should be repaid from liquidity above the emergency reserve');
 assert.ok(g.state.finance.cash>=0);
 assert.ok(g.state.finance.savings>=0);
});

test('secured mortgage debt does not drain long-term savings through unsecured-debt sweep',()=>{
 const g=new Game('secured-debt-preserve');
 g.state.player.age=40;
 ensurePersonalFinance(g.state);
 g.state.career={employed:true,monthlyIncome:110000,satisfaction:60};
 g.state.finance.cash=250000;
 g.state.finance.savings=900000;
 g.state.finance.debt=2400000;
 g.state.finance.lifestyle={housing:'owned',food:'standard',clothing:'basic',transport:'public'};
 g.state.assets={home:{price:3000000,remainingDebt:2400000},car:null};
 const beforeSavings=g.state.finance.savings;
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.savings>=beforeSavings,'mortgage-only debt should not trigger the unsecured reserve sweep');
});

test('late-life biological wear remains stronger at 85 than at 65 under identical reserve conditions',()=>{
 const young=new Game('wear-65');
 const old=new Game('wear-85');
 for(const [g,age] of [[young,65],[old,85]]){
  g.state.player.age=age;
  g.state.player.health.current=80;
  g.state.player.health.constitution=60;
  g.state.healthProfile={conditions:[],stress:35,fitness:55,lastCheckupAge:null,lastExerciseAge:age-1};
  g.state.finance={debt:0,lifestyle:{food:'standard'}};
 }
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processHealthYear(young.state,rng,{healthBeforeYear:80});
 processHealthYear(old.state,rng,{healthBeforeYear:80});
 assert.ok(old.state.player.health.current<young.state.player.health.current);
});
