import test from 'node:test';
import assert from 'node:assert/strict';
import {processHouseholdDepthYear} from '../src/finance/household_depth.js';
import {moveToCity,returnHome} from '../src/world/migration_system.js';

const MAX=Number.MAX_SAFE_INTEGER;
const debts=(consumer=0)=>({consumer,medical:0,housing:0,car:0,emergency:0});
const repairRng={fork(){return {chance(){return true;}};},int(){return 0;}};
function household(){return {year:2060,player:{age:40},assets:{car:{purchasedAtAge:40}},
 finance:{cash:100,savings:0,debt:MAX-1,debts:debts(MAX-1),monthlyExpenses:1000},
 healthProfile:{stress:30},householdDynamics:{stability:72}};}
function migrant(){return {year:2060,player:{age:40,job:'Teacher',jobId:'teacher',monthlyIncome:45000},
 location:{countryId:'TR',cityId:'ankara',cityName:'Ankara'},
 origin:{countryId:'TR',cityId:'konya',cityName:'Konya'},
 finance:{cash:100,savings:0,debt:MAX-1,debts:debts(MAX-1)},
 career:{employed:true,jobId:'teacher',title:'Teacher',years:5,totalYears:5,monthlyIncome:45000,previousJobs:[]},
 social:{romance:null},children:[],healthProfile:{stress:20}};}

test('household repair debt overflow leaves all household and cash fields unchanged',()=>{
 const s=household(),before=structuredClone(s);
 assert.throws(()=>processHouseholdDepthYear(s,repairRng),/debt|safe|limit/i);
 assert.deepEqual(s,before);
});
test('household rejects corrupt cash before shock and annual marker changes',()=>{
 for(const cash of [NaN,Infinity,'100',MAX+1]){
  const s=household();s.finance.cash=cash;
  const before=structuredClone(s);
  assert.throws(()=>processHouseholdDepthYear(s,repairRng),/cash|balance|safe/i);
  assert.deepEqual(s,before);
 }
});
test('household shock with existing negative cash still charges only new debt',()=>{
 const s=household();s.finance.cash=-300;s.finance.debt=0;s.finance.debts=debts();
 processHouseholdDepthYear(s,repairRng);
 assert.equal(s.finance.cash,-300);
 assert.equal(s.finance.debts.emergency,4500);
 assert.equal(s.householdDynamics.recentShock.remainingDebt,4500);
});
test('migration debt overflow does not move, spend, reconcile or append history',()=>{
 const s=migrant(),before=structuredClone(s);
 assert.throws(()=>moveToCity(s,'istanbul'),/debt|safe|limit/i);
 assert.deepEqual(s,before);
});
test('migration rejects malformed balances without altering location',()=>{
 for(const cash of [NaN,Infinity,'500',MAX+1]){
  const s=migrant();s.finance.cash=cash;
  const before=structuredClone(s);
  assert.throws(()=>moveToCity(s,'istanbul'),/cash|balance|safe/i);
  assert.deepEqual(s,before);
 }
});
test('migration with enough cash does not create debt',()=>{
 const s=migrant();s.finance.cash=100000;s.finance.debt=0;s.finance.debts=debts();
 const result=moveToCity(s,'istanbul');
 assert.equal(s.location.cityId,'istanbul');
 assert.equal(s.finance.cash,100000-result.cost);
 assert.equal(s.finance.debt,0);
});
test('return home on failed moving debt does not terminate job or archive career',()=>{
 const s=migrant(),before=structuredClone(s);
 assert.throws(()=>returnHome(s),/debt|safe|limit/i);
 assert.deepEqual(s,before);
});
test('return home with invalid cash leaves employment and profile untouched',()=>{
 const s=migrant();s.finance.cash=Infinity;
 const before=structuredClone(s);
 assert.throws(()=>returnHome(s),/cash|balance|safe/i);
 assert.deepEqual(s,before);
});
test('successful return home still archives career and sets unemployment',()=>{
 const s=migrant();s.finance.cash=100000;s.finance.debt=0;s.finance.debts=debts();
 const result=returnHome(s);
 assert.equal(result.moved,true);
 assert.equal(result.leftJob,true);
 assert.equal(s.location.cityId,'konya');
 assert.equal(s.career.employed,false);
 assert.equal(s.player.job,null);
 assert.equal(s.career.previousJobs.length,1);
 assert.equal(s.hasReturnedHome,true);
});
