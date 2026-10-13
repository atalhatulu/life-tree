import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processWorkplaceYear} from '../src/career/workplace_system.js';
import {processHouseholdDepthYear} from '../src/finance/household_depth.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';

const noRng={fork(){throw Error('RNG consumed');},int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');}};
function adult(seed){
 const s=new Game(seed).state;
 s.year=2075;s.player.age=40;
 return s;
}
function employee(seed){
 const s=adult(seed);
 s.career={employed:true,monthlyIncome:85000,performance:60,satisfaction:50};
 return s;
}
function household(seed){
 const s=adult(seed);
 ensurePersonalFinance(s);
 s.finance.cash=10000;s.finance.savings=0;
 s.assets={car:{price:200000,purchasedAtAge:40,remainingDebt:0},home:null};
 s.healthProfile={conditions:[],stress:30,fitness:50};
 return s;
}
const repairRng={fork(){return {chance(){return true;}};},int(){return 0;}};

// Workplace changes performance, reputation and health: these must happen once per calendar year.
test('workplace year replay is a no-op without consuming RNG',()=>{
 const s=employee('workplace-replay');
 processWorkplaceYear(s,new RNG('first'));
 const after=structuredClone(s);
 assert.deepEqual(processWorkplaceYear(s,noRng),[]);
 assert.deepEqual(s,after);
});
test('workplace rejects earlier year without mutating career or initializing a workplace',()=>{
 const s=employee('workplace-past');
 s.career.lastWorkplaceProcessedYear=2076;
 const before=structuredClone(s);
 assert.throws(()=>processWorkplaceYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('workplace save/restore, next year and old saves are supported',()=>{
 const g=new Game('workplace-save');g.state=employee('workplace-save');
 processWorkplaceYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processWorkplaceYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processWorkplaceYear(restored.state,new RNG('next'));
 assert.equal(restored.state.career.lastWorkplaceProcessedYear,2076);
 delete restored.state.career.lastWorkplaceProcessedYear;
 processWorkplaceYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.career.lastWorkplaceProcessedYear,2076);
});
test('unemployed workplace processing does not mark or mutate career',()=>{
 const s=employee('workplace-unemployed');s.career.employed=false;
 const before=structuredClone(s);
 assert.deepEqual(processWorkplaceYear(s,noRng),[]);
 assert.deepEqual(s,before);
});

test('household shock and debt are never charged twice in a year',()=>{
 const s=household('household-replay');
 const first=processHouseholdDepthYear(s,repairRng);
 assert.equal(first.length,1);
 const after=structuredClone(s);
 assert.deepEqual(processHouseholdDepthYear(s,noRng),[]);
 assert.deepEqual(s,after);
});
test('household rejects a past year before initializing state or consuming RNG',()=>{
 const s=household('household-past');
 s.householdDynamics={lastProcessedYear:2076};
 const before=structuredClone(s);
 assert.throws(()=>processHouseholdDepthYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('household saves the marker, processes next year and accepts old records',()=>{
 const g=new Game('household-save');g.state=household('household-save');
 processHouseholdDepthYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processHouseholdDepthYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processHouseholdDepthYear(restored.state,new RNG('next'));
 assert.equal(restored.state.householdDynamics.lastProcessedYear,2076);
 delete restored.state.householdDynamics.lastProcessedYear;
 processHouseholdDepthYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.householdDynamics.lastProcessedYear,2076);
});
test('household without finance remains inactive and unmarked',()=>{
 const s=adult('household-no-finance');delete s.finance;
 const before=structuredClone(s);
 assert.deepEqual(processHouseholdDepthYear(s,noRng),[]);
 assert.deepEqual(s,before);
});

test('annual finance cannot duplicate interest, debt or savings in one year',()=>{
 const s=adult('finance-replay');
 ensurePersonalFinance(s);
 s.career={employed:false,monthlyIncome:0};
 s.finance.cash=0;s.finance.savings=0;
 s.finance.debts={consumer:100000,medical:0,housing:0,car:0,emergency:0};
 s.finance.debt=100000;
 const first=processPersonalFinanceYear(s);
 assert.equal(first.length,1);
 const after=structuredClone(s);
 assert.deepEqual(processPersonalFinanceYear(s),[]);
 assert.deepEqual(s,after);
});
test('annual finance rejects earlier year before reconciling legacy debt',()=>{
 const s=adult('finance-past');
 s.finance={lastProcessedYear:2076,debt:1500};
 const before=structuredClone(s);
 assert.throws(()=>processPersonalFinanceYear(s),/earlier year/);
 assert.deepEqual(s,before);
});
test('annual finance marker persists across saves and next year still accrues',()=>{
 const g=new Game('finance-save');g.state=adult('finance-save');
 ensurePersonalFinance(g.state);
 g.state.career={employed:false,monthlyIncome:0};
 g.state.finance.cash=0;g.state.finance.savings=0;
 g.state.finance.debts={consumer:100000,medical:0,housing:0,car:0,emergency:0};
 g.state.finance.debt=100000;
 processPersonalFinanceYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processPersonalFinanceYear(restored.state),[]);
 const before=restored.state.finance.debt;
 restored.state.year++;restored.state.player.age++;
 processPersonalFinanceYear(restored.state);
 assert.ok(restored.state.finance.debt>before);
 assert.equal(restored.state.finance.lastProcessedYear,2076);
});
test('legacy finance without annual marker remains processable',()=>{
 const s=adult('finance-legacy');ensurePersonalFinance(s);
 delete s.finance.lastProcessedYear;
 assert.equal(processPersonalFinanceYear(s).length,1);
 assert.equal(s.finance.lastProcessedYear,2075);
});
