import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload} from '../src/core/save_system.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {affordableCarOptions,affordableHomeOptions,buyCar,buyHome,sellCar,sellHome} from '../src/assets/asset_system.js';

function adult(seed){
 const s=new Game(seed).state;
 s.player.age=45;
 ensurePersonalFinance(s);
 s.finance.cash=2_000_000;
 s.finance.savings=0;
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 s.finance.debt=0;
 s.career={employed:true,monthlyIncome:120_000};
 s.assets={home:null,car:null};
 return s;
}
const totalDebt=s=>Object.values(s.finance.debts).reduce((sum,value)=>sum+value,0);

test('a second car purchase is unavailable and cannot overwrite an existing financed car',()=>{
 const s=adult('guard-second-car');
 const id=affordableCarOptions(s)[0].id;
 buyCar(s,id);
 const before=structuredClone(s);
 assert.deepEqual(affordableCarOptions(s),[]);
 assert.throws(()=>buyCar(s,id),/araç|aracı|araba/i);
 assert.deepEqual(s,before);
});

test('a second home purchase is unavailable and cannot overwrite an existing mortgage',()=>{
 const s=adult('guard-second-home');
 const id=affordableHomeOptions(s)[0].id;
 buyHome(s,id);
 const before=structuredClone(s);
 assert.deepEqual(affordableHomeOptions(s),[]);
 assert.throws(()=>buyHome(s,id),/ev|konut/i);
 assert.deepEqual(s,before);
});

for(const [asset,bucket,sell,ratio] of [
 ['car','car',sellCar,.72],['home','housing',sellHome,.90]
]){
 test(`underwater voluntary ${asset} sale converts unpaid collateral debt to consumer debt`,()=>{
  const s=adult(`underwater-voluntary-${asset}`);
  const price=100_000,loan=130_000,oldConsumer=7_000;
  s.assets[asset]={price,remainingDebt:loan};
  s.finance.debts[bucket]=loan;
  s.finance.debts.consumer=oldConsumer;
  s.finance.debt=loan+oldConsumer;
  const cashBefore=s.finance.cash;
  const result=sell(s);
  const sale=Math.round(price*ratio),deficiency=loan-sale;
  assert.equal(s.assets[asset],null);
  assert.equal(s.finance.debts[bucket],0);
  assert.equal(s.finance.debts.consumer,oldConsumer+deficiency);
  assert.equal(s.finance.cash,cashBefore);
  assert.equal(s.finance.debt,oldConsumer+deficiency);
  assert.equal(s.finance.debt,totalDebt(s));
  assert.equal(result.net,-deficiency);
 });
}

for(const [asset,bucket,ratio,years] of [
 ['car','car',.45,1],['home','housing',.88,2]
]){
 test(`underwater forced ${asset} sale does not leave an orphaned secured loan`,()=>{
  const s=adult(`underwater-forced-${asset}`);
  s.career={employed:false,monthlyIncome:0};
  s.finance.cash=0;
  s.finance.debts.consumer=2_000_000;
  s.finance.debts[bucket]=130_000;
  s.finance.debt=2_130_000;
  s.finance.financialDistressYears=years;
  s.finance.lastRestructureAge=s.player.age; // isolate liquidation from debt restructuring
  s.assets[asset]={price:100_000,remainingDebt:130_000,purchasedAtAge:s.player.age};
  const control=structuredClone(s);
  control.finance.financialDistressYears=0;
  processPersonalFinanceYear(control);
  processPersonalFinanceYear(s);
  assert.equal(s.assets[asset],null);
  assert.equal(s.finance.debts[bucket],0);
  assert.equal(s.finance.debt,totalDebt(s));
  assert.equal(control.finance.debt-s.finance.debt,Math.round(100_000*ratio));
  assert.equal(s.finance.cash,control.finance.cash);
 });
}

test('legacy aggregate-only debt is split into asset-backed balances and unsecured remainder',()=>{
 const s=adult('legacy-secured-buckets');
 s.assets.car={price:90_000,remainingDebt:45_000};
 s.assets.home={price:300_000,remainingDebt:100_000};
 s.finance.debt=160_000;
 delete s.finance.debts;
 const payload=createSavePayload({state:s,seedText:'legacy-secured-buckets',rng:{seed:1,state:1},activeEventId:null});
 // Save schema may insert empty buckets before finance initialization.
 const loaded=Game.fromSave(payload).state;
 const f=ensurePersonalFinance(loaded);
 assert.equal(f.debts.housing,100_000);
 assert.equal(f.debts.car,45_000);
 assert.equal(f.debts.consumer,15_000);
 assert.equal(f.debt,totalDebt(loaded));
 assert.equal(loaded.assets.home.remainingDebt,f.debts.housing);
 assert.equal(loaded.assets.car.remainingDebt,f.debts.car);
});

test('legacy secured loan is repaid from sale proceeds rather than creating free cash',()=>{
 const s=adult('legacy-sale');
 s.assets.car={price:100_000,remainingDebt:60_000};
 s.finance.debt=70_000;
 delete s.finance.debts;
 const cashBefore=s.finance.cash;
 sellCar(s);
 assert.equal(s.finance.cash,cashBefore+12_000);
 assert.equal(s.finance.debts.car,0);
 assert.equal(s.finance.debts.consumer,10_000);
 assert.equal(s.finance.debt,10_000);
});

for(const [asset,bucket,sell,ratio] of [
 ['car','car',sellCar,.72],['home','housing',sellHome,.90]
]){
 test(`positive-equity ${asset} sale preserves cash, unsecured debt, and debt ledger`,()=>{
  const s=adult(`positive-equity-${asset}`);
  s.assets[asset]={price:100_000,remainingDebt:20_000};
  s.finance.debts[bucket]=20_000;
  s.finance.debts.consumer=5_000;
  s.finance.debt=25_000;
  const cashBefore=s.finance.cash;
  const result=sell(s);
  const net=Math.round(100_000*ratio)-20_000;
  assert.equal(result.net,net);
  assert.equal(s.finance.cash,cashBefore+net);
  assert.equal(s.finance.debts[bucket],0);
  assert.equal(s.finance.debts.consumer,5_000);
  assert.equal(s.finance.debt,5_000);
 });
}

test('new car loan does not inherit deficiency from a previously sold car',()=>{
 const s=adult('car-deficiency-repurchase');
 s.assets.car={price:100_000,remainingDebt:130_000};
 s.finance.debts.car=130_000;
 s.finance.debt=130_000;
 sellCar(s);
 assert.equal(s.finance.debts.consumer,58_000);
 const next=affordableCarOptions(s)[0];
 buyCar(s,next.id);
 assert.equal(s.finance.debts.car,s.assets.car.remainingDebt);
 assert.equal(s.finance.debts.consumer,58_000);
 processPersonalFinanceYear(s);
 assert.equal(s.finance.debts.car,s.assets.car.remainingDebt);
 assert.equal(s.finance.debt,totalDebt(s));
});

test('partially typed legacy debt prioritizes recorded collateral before emergency debt',()=>{
 const s=adult('legacy-partial-secured');
 s.assets.home={price:300_000,remainingDebt:100_000};
 s.assets.car={price:90_000,remainingDebt:40_000};
 s.finance.debts={consumer:10_000,medical:0,housing:0,car:0,emergency:0};
 s.finance.debt=170_000;
 ensurePersonalFinance(s);
 assert.deepEqual(s.finance.debts,{
  consumer:10_000,medical:0,housing:100_000,car:40_000,emergency:20_000
 });
 assert.equal(s.finance.debt,totalDebt(s));
});
