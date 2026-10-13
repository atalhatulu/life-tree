import test from 'node:test';
import assert from 'node:assert/strict';
import {processHouseholdDepthYear} from '../src/finance/household_depth.js';
import {moveToCity,isCurrentPartnerMoveOpportunity,generatePartnerMoveOpportunity,resolvePartnerMove} from '../src/world/migration_system.js';

const MAX=Number.MAX_SAFE_INTEGER;
const noShock={fork(){return {chance(){return false;}};},int(){return 0;}};
const repair={fork(){return {chance(){return true;}};},int(){return 0;}};
function household(){return {year:2060,player:{age:40},assets:{car:{purchasedAtAge:40}},
 finance:{cash:100,savings:50,debt:0,monthlyExpenses:1000,ownershipCostsMonthly:200,monthlyIncome:5000},
 healthProfile:{stress:30},householdDynamics:{stability:72}};}
function migrant(){return {year:2060,player:{age:40},location:{countryId:'TR',cityId:'ankara',cityName:'Ankara'},
 origin:{countryId:'TR',cityId:'konya',cityName:'Konya'},
 finance:{cash:100000,savings:1000,debt:0,debts:{consumer:0,medical:0,housing:0,car:0,emergency:0},
  lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}},
 social:{romance:{id:'partner',alive:true,status:'married',relationship:75,monthlyIncome:40000}},
 children:[],healthProfile:{stress:30},pendingPartnerMove:{partnerId:'partner',previousCityId:'ankara',cityId:'izmir',newIncome:50000}};}

// 1. Annual household metrics should not accept unsafe aggregates or corrupt money.
test('household rejects unsafe monthly expense sum before annual marker or RNG',()=>{
 const s=household();s.finance.monthlyExpenses=MAX;s.finance.ownershipCostsMonthly=MAX;
 const before=structuredClone(s);
 assert.throws(()=>processHouseholdDepthYear(s,noShock),/household|finance|safe|expense|balance/i);
 assert.deepEqual(s,before);
});
test('household rejects unsafe combined liquidity before shock or stats',()=>{
 const s=household();s.finance.cash=MAX;s.finance.savings=MAX;
 const before=structuredClone(s);
 assert.throws(()=>processHouseholdDepthYear(s,repair),/household|finance|safe|liquid|balance/i);
 assert.deepEqual(s,before);
});
test('household emergency reserve months stay bounded with a huge but safe balance',()=>{
 const s=household();s.finance.cash=MAX;s.finance.savings=0;
 s.finance.monthlyExpenses=1;s.finance.ownershipCostsMonthly=0;
 processHouseholdDepthYear(s,noShock);
 assert.equal(s.householdDynamics.emergencyReserveMonths,120);
});
test('household rejects malformed monthly finance fields without mutation',()=>{
 for(const [key,value] of [['monthlyIncome',Infinity],['monthlyExpenses','1000'],['debt',NaN],['savings',-5]]){
  const s=household();s.finance[key]=value;
  const before=structuredClone(s);
  assert.throws(()=>processHouseholdDepthYear(s,noShock),/household|finance|safe|invalid|balance/i,key);
  assert.deepEqual(s,before,key);
 }
});
test('household rejects malformed repair cost without writing NaN to cash',()=>{
 const s=household(),before=structuredClone(s);
 const badRepair={fork(){return {chance(){return true;}};},int(){return NaN;}};
 assert.throws(()=>processHouseholdDepthYear(s,badRepair),/repair|shock|cost|safe|invalid/i);
 assert.deepEqual(s,before);
});
test('household validates health stress before a paid repair',()=>{
 const s=household();s.healthProfile.stress=NaN;
 const before=structuredClone(s);
 assert.throws(()=>processHouseholdDepthYear(s,repair),/stress|health|invalid/i);
 assert.deepEqual(s,before);
});
test('household rejects corrupt high-pressure relationship metrics before paid repair',()=>{
 for(const field of ['resentment','relationshipTension']){
  const s=household();s.finance.debt=500000;s.finance.monthlyIncome=0;
  s.social={romance:{resentment:25,relationshipTension:20}};
  s.social.romance[field]=NaN;
  const before=structuredClone(s);
  assert.throws(()=>processHouseholdDepthYear(s,repair),/relationship|romance|household|invalid/i);
  assert.deepEqual(s,before);
 }
});
test('household ordinary no-shock annual metrics remain finite and once-only',()=>{
 const s=household();assert.deepEqual(processHouseholdDepthYear(s,noShock),[]);
 assert.equal(s.householdDynamics.emergencyReserveMonths,.1);
 assert.ok(Number.isFinite(s.householdDynamics.financialPressure));
 const after=structuredClone(s);assert.deepEqual(processHouseholdDepthYear(s,noShock),[]);assert.deepEqual(s,after);
});

// 2. Moving options and health stress must be validated before a paid move.
test('moving rejects malformed stress options without moving or charging',()=>{
 for(const stress of [NaN,Infinity,-1,'4']){
  const s=migrant(),before=structuredClone(s);
  assert.throws(()=>moveToCity(s,'istanbul','personal',{stress}),/stress|invalid/i);
  assert.deepEqual(s,before);
 }
});
test('moving rejects corrupt health stress before finance reconciliation',()=>{
 const s=migrant();s.healthProfile.stress=NaN;
 const before=structuredClone(s);
 assert.throws(()=>moveToCity(s,'istanbul'),/stress|invalid/i);
 assert.deepEqual(s,before);
});
test('moving rejects unsupported housing override before changing lifestyle',()=>{
 const s=migrant(),before=structuredClone(s);
 assert.throws(()=>moveToCity(s,'istanbul','personal',{housing:'not-a-home'}),/housing|invalid/i);
 assert.deepEqual(s,before);
});
test('moving with valid stress caps stress at 100 and retains normal charge',()=>{
 const s=migrant();s.healthProfile.stress=99;
 const result=moveToCity(s,'istanbul','personal',{stress:4,housing:'shared'});
 assert.equal(s.healthProfile.stress,100);
 assert.equal(s.finance.cash,100000-result.cost);
 assert.equal(s.location.cityId,'istanbul');
});

// 3. A stale or corrupt partner job offer must never grant free income or move.
test('partner move rejects invalid offered salaries without moving or changing salary',()=>{
 for(const income of [NaN,Infinity,-1,'50000',MAX+1]){
  const s=migrant();s.pendingPartnerMove.newIncome=income;
  const before=structuredClone(s);
  assert.equal(isCurrentPartnerMoveOpportunity(s),false);
  assert.throws(()=>resolvePartnerMove(s,true),/Aktif eş taşınma fırsatı yok/);
  assert.deepEqual(s,before);
 }
});
test('same-city partner offer cannot grant salary or relationship rewards',()=>{
 const s=migrant();s.pendingPartnerMove.cityId='ankara';
 const before=structuredClone(s);
 assert.equal(isCurrentPartnerMoveOpportunity(s),false);
 assert.throws(()=>resolvePartnerMove(s,true),/Aktif eş taşınma fırsatı yok/);
 assert.deepEqual(s,before);
});
test('unknown partner offer destination is rejected instead of falling back to Istanbul',()=>{
 const s=migrant();s.pendingPartnerMove.cityId='unknown-city';
 const before=structuredClone(s);
 assert.equal(isCurrentPartnerMoveOpportunity(s),false);
 assert.throws(()=>resolvePartnerMove(s,true),/Aktif eş taşınma fırsatı yok/);
 assert.deepEqual(s,before);
});
test('partner move rejects corrupt relationship without creating NaN or consuming offer',()=>{
 const s=migrant();s.social.romance.relationship=NaN;
 const before=structuredClone(s);
 assert.equal(isCurrentPartnerMoveOpportunity(s),false);
 assert.throws(()=>resolvePartnerMove(s,false),/Aktif eş taşınma fırsatı yok/);
 assert.deepEqual(s,before);
});
test('partner job generation rejects unsafe existing salary without a pending offer',()=>{
 const s=migrant();s.pendingPartnerMove=null;s.social.romance.monthlyIncome=Infinity;
 const before=structuredClone(s);
 const rng={chance:()=>true,int:()=>110,weighted:options=>options[0].value};
 assert.equal(generatePartnerMoveOpportunity(s,rng),null);
 assert.deepEqual(s,before);
});
test('valid partner relocation still moves and grants the offered income once',()=>{
 const s=migrant();const result=resolvePartnerMove(s,true);
 assert.equal(result.moved,true);
 assert.equal(s.location.cityId,'izmir');
 assert.equal(s.social.romance.monthlyIncome,50000);
 assert.equal(s.social.romance.relationship,77);
 assert.equal(s.pendingPartnerMove,null);
 assert.throws(()=>resolvePartnerMove(s,true),/Aktif eş taşınma fırsatı yok/);
});
