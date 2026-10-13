import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {sellCar,buyCar,affordableCarOptions} from '../src/assets/asset_system.js';

function adult(seed){
 const s=new Game(seed).state;
 s.player.age=43;
 ensurePersonalFinance(s);
 s.finance.cash=2_000_000;
 s.finance.savings=0;
 s.finance.debt=0;
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 s.assets={home:null,car:null};
 return s;
}
const ledger=s=>Object.values(s.finance.debts).reduce((sum,value)=>sum+value,0);

test('legacy bucket-only debt without aggregate is preserved rather than erased',()=>{
 const s=adult('legacy-no-aggregate');
 s.assets.car={price:200_000,remainingDebt:35_000};
 s.finance.debts={consumer:12_000,medical:3_000,housing:0,car:35_000,emergency:0};
 delete s.finance.debt;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debt,50_000);
 assert.equal(s.finance.debts.car,35_000);
 assert.equal(s.finance.debts.consumer,12_000);
 assert.equal(s.finance.debts.medical,3_000);
 assert.equal(s.assets.car.remainingDebt,35_000);
});

test('orphan secured debt is unsecured after legacy vehicle removal and cannot attach to replacement',()=>{
 const s=adult('legacy-orphan-car');
 s.finance.debts.car=75_000;
 s.finance.debts.consumer=5_000;
 s.finance.debt=80_000;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debts.car,0);
 assert.equal(s.finance.debts.consumer,80_000);
 assert.equal(s.finance.debt,ledger(s));
 const next=affordableCarOptions(s)[0];
 buyCar(s,next.id);
 assert.equal(s.finance.debts.car,s.assets.car.remainingDebt);
 assert.equal(s.finance.debts.consumer,80_000);
});

test('orphan mortgage is reclassified without reducing total debt',()=>{
 const s=adult('legacy-orphan-home');
 s.finance.debts.housing=240_000;
 s.finance.debt=240_000;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debts.housing,0);
 assert.equal(s.finance.debts.consumer,240_000);
 assert.equal(s.finance.debt,240_000);
});

test('underreported aggregate clips collateral balance consistently and a sale settles the reconciled lien',()=>{
 const s=adult('legacy-underreported-aggregate');
 s.assets.car={price:100_000,remainingDebt:90_000};
 s.finance.debts.car=90_000;
 s.finance.debts.consumer=10_000;
 s.finance.debt=60_000;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debt,60_000);
 assert.equal(s.finance.debts.car,60_000);
 assert.equal(s.assets.car.remainingDebt,60_000);
 const cashBefore=s.finance.cash;
 sellCar(s);
 assert.equal(s.finance.cash,cashBefore+12_000);
 assert.equal(s.finance.debt,0);
});

test('collateral reconciliation is idempotent and remains stable through annual finance processing',()=>{
 const s=adult('legacy-idempotent-collateral');
 s.assets.home={price:500_000,remainingDebt:125_000};
 s.finance.debts.housing=80_000;
 s.finance.debts.car=15_000; // vehicle was removed in an old save
 s.finance.debt=95_000;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debts.housing,80_000);
 assert.equal(s.finance.debts.car,0);
 assert.equal(s.finance.debts.consumer,15_000);
 assert.equal(s.assets.home.remainingDebt,80_000);
 const before=structuredClone(s.finance.debts);
 ensurePersonalFinance(s);
 assert.deepEqual(s.finance.debts,before);
 s.career={employed:false,monthlyIncome:0};
 processPersonalFinanceYear(s);
 assert.equal(s.finance.debt,ledger(s));
 assert.equal(s.assets.home.remainingDebt,s.finance.debts.housing);
});
