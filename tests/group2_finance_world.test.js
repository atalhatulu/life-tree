import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {ensurePersonalFinance,addDebt,payDownDebt,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {buyCar} from '../src/assets/asset_system.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';
import {migrationScore,moveToCity} from '../src/world/migration_system.js';
import {createWorldState,processWorldYear} from '../src/world/world_state.js';

function adult(seed='group2'){
 const g=new Game(seed);
 g.state.player.age=35;
 g.state.year=2061;
 ensurePersonalFinance(g.state);
 g.state.career={employed:true,monthlyIncome:120000,performance:70,satisfaction:60};
 g.state.finance.cash=600000;
 g.state.finance.savings=0;
 return g;
}

test('typed debt buckets stay synchronized with aggregate debt',()=>{
 const g=adult('typed-debt');
 addDebt(g.state,'medical',100000);
 addDebt(g.state,'emergency',50000);
 assert.equal(g.state.finance.debt,150000);
 payDownDebt(g.state,60000);
 const sum=Object.values(g.state.finance.debts).reduce((s,v)=>s+v,0);
 assert.equal(g.state.finance.debt,sum);
 assert.equal(g.state.finance.debt,90000);
});

test('asset financing is classified as car debt',()=>{
 const g=adult('asset-debt');
 g.state.finance.cash=1000000;
 buyCar(g.state,'used');
 assert.ok(g.state.finance.debts.car>0);
 assert.equal(g.state.finance.debt,Object.values(g.state.finance.debts).reduce((s,v)=>s+v,0));
});

test('high income produces consumption leakage instead of unlimited savings',()=>{
 const g=adult('finance-cap');
 g.state.career.monthlyIncome=250000;
 g.state.finance.lifestyle={housing:'family',food:'standard',clothing:'basic',transport:'public'};
 for(let i=0;i<12;i++){
  g.state.player.age+=1;
  processPersonalFinanceYear(g.state);
 }
 assert.ok(g.state.finance.savings>0);
 assert.ok(g.state.finance.activitySpendingAnnual>0);
 assert.ok(g.state.finance.savings<30000000);
});

test('checkups have a two-year cooldown',()=>{
 const g=adult('checkup-cooldown');
 g.state.actions={remaining:3,max:3};
 performActivity(g.state,'checkup',new RNG('checkup'));
 assert.equal(availableActivities(g.state).some(a=>a.id==='checkup'),false);
 g.state.player.age+=2;
 assert.equal(availableActivities(g.state).some(a=>a.id==='checkup'),true);
});

test('repeated work focus builds streak memory',()=>{
 const g=adult('work-streak');
 for(let i=0;i<5;i++){
  g.state.actions={remaining:3,max:3};
  performActivity(g.state,'work-hard',new RNG('work-'+i));
  g.state.player.age+=1;
 }
 assert.ok(g.state.activityMemory['work-hard'].streak>=5);
});

test('recent move and children reduce relocation score',()=>{
 const g=adult('migration-friction');
 g.state.location={countryId:'TR',cityId:'konya',cityName:'Konya',sinceYear:2059};
 g.state.origin={countryId:'TR',cityId:'konya',cityName:'Konya'};
 g.state.preferences={hometownAttachment:70};
 const before=migrationScore(g.state,'istanbul',{newMonthlyIncome:160000,reason:'job'});
 g.state.children=[{age:4}];
 g.state.migrationHistory=[{age:34,year:2060,fromCityId:'ankara',toCityId:'konya'}];
 const after=migrationScore(g.state,'istanbul',{newMonthlyIncome:160000,reason:'job'});
 assert.ok(after<before);
});

test('moving without cash creates emergency debt',()=>{
 const g=adult('migration-debt');
 g.state.location={countryId:'TR',cityId:'konya',cityName:'Konya',sinceYear:2058};
 g.state.finance.cash=0;
 moveToCity(g.state,'istanbul','test');
 assert.ok(g.state.finance.debts.emergency>0);
});

test('world economy v2 remains deterministic and bounded',()=>{
 const a={player:{age:20},year:2026,world:createWorldState(2026)};
 const b=structuredClone(a);
 const ra=new RNG('macro-v2'),rb=new RNG('macro-v2');
 for(let i=0;i<80;i++){
  a.player.age++;a.year++;b.player.age++;b.year++;
  processWorldYear(a,ra.fork('y'+i));
  processWorldYear(b,rb.fork('y'+i));
 }
 assert.deepEqual(a.world,b.world);
 const e=a.world.economy;
 assert.ok(e.housingMarket>=.75&&e.housingMarket<=1.38);
 assert.ok(e.creditConditions>=.78&&e.creditConditions<=1.35);
 assert.ok(e.entrepreneurship>=.72&&e.entrepreneurship<=1.32);
});
