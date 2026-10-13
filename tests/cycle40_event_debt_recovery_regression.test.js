import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEngine} from '../src/events/event_engine.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {ensurePersonalFinance, payDownDebt, addDebt} from '../src/finance/personal_finance.js';

const reserve=systemicStorylets.find(event=>event.id==='storylet-emergency-reserve');
const engine=new EventEngine();
const choice=(state,id)=>engine.choicesFor(state,reserve).find(option=>option.id===id);
function shockState(){
 return {player:{age:42},year:2070,
  finance:{cash:2500,savings:0,debt:1800,debts:{consumer:0,medical:0,housing:0,car:0,emergency:1800},lifestyle:{food:'premium',clothing:'premium'}},
  householdDynamics:{recentShock:{age:42,cost:1800,remainingDebt:1800}},
  healthProfile:{stress:30},social:{romance:{resentment:20}},lifeMemory:{tags:{}},
  storyletCooldowns:{},storyletCounts:{}};
}

test('cached tighten option cannot apply twice during the same shock',()=>{
 const s=shockState();
 const tighten=choice(s,'tighten');
 tighten.effect(s);
 const after=structuredClone(s);
 tighten.effect(s);
 assert.deepEqual(s,after);
 assert.equal(s.storyletCounts['reserve-choice'],1);
});

test('cached defer option cannot repeatedly raise stress and resentment',()=>{
 const s=shockState();
 const defer=choice(s,'ignore-debt');
 defer.effect(s);
 const after=structuredClone(s);
 defer.effect(s);
 assert.deepEqual(s,after);
 assert.equal(s.healthProfile.stress,34);
});

test('cached cash option cannot settle a second debt after first resolution',()=>{
 const s=shockState();
 const pay=choice(s,'pay-cash');
 pay.effect(s);
 // A later emergency bill in the same year must not be charged by a stale option.
 addDebt(s,'emergency',1000);
 s.householdDynamics.recentShock.remainingDebt=1000;
 const before=structuredClone(s);
 pay.effect(s);
 assert.deepEqual(s,before);
});

test('cached reserve option cannot act in later year without a current-year shock',()=>{
 const s=shockState();
 const tighten=choice(s,'tighten');
 s.player.age=43;
 const before=structuredClone(s);
 tighten.effect(s);
 assert.deepEqual(s,before);
});

test('a fresh emergency in a later year remains actionable after cooldown',()=>{
 const s=shockState();
 choice(s,'tighten').effect(s);
 s.player.age=46;
 s.householdDynamics.recentShock={age:46,cost:900,remainingDebt:900};
 const defer=choice(s,'ignore-debt');
 assert.ok(reserve.condition(s));
 defer.effect(s);
 assert.equal(s.storyletCounts['reserve-choice'],2);
 assert.equal(s.healthProfile.stress,36);
});

test('legacy NaN, Infinity and negative debt buckets are sanitized without corrupting aggregate',()=>{
 const s=shockState();
 s.finance.debts={consumer:500,medical:NaN,housing:Infinity,car:-50,emergency:400};
 s.finance.debt=1500;
 ensurePersonalFinance(s);
 assert.deepEqual(s.finance.debts,{consumer:500,medical:0,housing:0,car:0,emergency:1000});
 assert.equal(s.finance.debt,1500);
});

test('invalid aggregate debt is reconstructed from finite typed buckets',()=>{
 for(const invalid of [NaN,Infinity,-Infinity,'not-a-number']){
  const s=shockState();
  s.finance.debts={consumer:100,medical:250,housing:0,car:0,emergency:300};
  s.finance.debt=invalid;
  ensurePersonalFinance(s);
  assert.equal(s.finance.debt,650,String(invalid));
  assert.equal(s.finance.debts.emergency,300);
 }
});

test('unknown and malformed debt bucket records cannot poison debt reconciliation',()=>{
 for(const broken of [null,[],42,'corrupted']){
  const s=shockState();
  s.finance.debts=broken;
  s.finance.debt=700;
  ensurePersonalFinance(s);
  assert.equal(s.finance.debt,700);
  assert.deepEqual(s.finance.debts,{consumer:700,medical:0,housing:0,car:0,emergency:0});
 }
 const s=shockState();
 s.finance.debts={consumer:200,emergency:100,unrecognized:Infinity};
 s.finance.debt=300;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debt,300);
 assert.equal(Object.hasOwn(s.finance.debts,'unrecognized'),false);
});

test('debt recovery is stable across repeated initialization and repayments',()=>{
 const s=shockState();
 s.finance.debts={consumer:'200',medical:NaN,emergency:'1000'};
 s.finance.debt=1200;
 ensurePersonalFinance(s);
 const before=structuredClone(s.finance);
 ensurePersonalFinance(s);
 assert.deepEqual(s.finance,before);
 assert.equal(payDownDebt(s,500),700);
 assert.equal(s.finance.debt,Object.values(s.finance.debts).reduce((a,b)=>a+b,0));
});

test('once-only event cannot resolve twice from cached event reference',()=>{
 const once={id:'test-once-event',once:true,choices:[{id:'yes',effect:s=>{s.points=(s.points??0)+10;}}]};
 const eventEngine=new EventEngine([once]);
 const initial={player:{age:25},points:0,flags:{completedEvents:[]}};
 const result=eventEngine.resolve(initial,once,'yes',{});
 assert.equal(result.state.points,10);
 assert.deepEqual(result.state.flags.completedEvents,['test-once-event']);
 const before=structuredClone(result.state);
 assert.throws(()=>eventEngine.resolve(result.state,once,'yes',{}),/completed|already|used|available/i);
 assert.deepEqual(result.state,before);
});

test('once-only event stays blocked after state serialization roundtrip',()=>{
 const once={id:'saved-once',once:true,choices:[{id:'ok',effect:s=>{s.points++;}}]};
 const eventEngine=new EventEngine([once]);
 const state={player:{age:25},points:0};
 const saved=JSON.parse(JSON.stringify(eventEngine.resolve(state,once,'ok',{}).state));
 assert.throws(()=>eventEngine.resolve(saved,once,'ok',{}),/completed|already|used|available/i);
 assert.equal(saved.points,1);
});

test('repeatable event can still resolve on successive turns',()=>{
 const recurring={id:'repeatable',once:false,choices:[{id:'yes',effect:s=>{s.points++;}}]};
 const eventEngine=new EventEngine([recurring]);
 const state={player:{age:25},points:0};
 const first=eventEngine.resolve(state,recurring,'yes',{});
 const second=eventEngine.resolve(first.state,recurring,'yes',{});
 assert.equal(second.state.points,2);
});

test('oversized legacy bucket sum is bounded to a safe integer and stays idempotent',()=>{
 const s=shockState();
 s.finance.debts={consumer:Number.MAX_SAFE_INTEGER,medical:0,housing:0,car:0,emergency:900};
 delete s.finance.debt;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debt,Number.MAX_SAFE_INTEGER);
 assert.equal(s.finance.debts.consumer,Number.MAX_SAFE_INTEGER-900);
 assert.equal(s.finance.debts.emergency,900);
 const before=structuredClone(s.finance);
 ensurePersonalFinance(s);
 assert.deepEqual(s.finance,before);
});

test('corrupt collateral balances cannot turn into NaN or Infinity loans',()=>{
 const s=shockState();
 s.assets={car:{price:50000,remainingDebt:Infinity},home:{price:100000,remainingDebt:NaN}};
 s.finance.debts={consumer:200,medical:0,car:NaN,housing:Infinity,emergency:0};
 s.finance.debt=200;
 ensurePersonalFinance(s);
 assert.equal(s.finance.debt,200);
 assert.equal(s.assets.car.remainingDebt,0);
 assert.equal(s.assets.home.remainingDebt,0);
 assert.deepEqual(s.finance.debts,{consumer:200,medical:0,housing:0,car:0,emergency:0});
});

test('event engine rejects a cached reserve event after it has been resolved',()=>{
 const s=shockState();
 const rng={};
 const first=engine.resolve(s,reserve,'tighten',rng);
 assert.equal(first.state.storyletCounts['reserve-choice'],1);
 const before=structuredClone(first.state);
 assert.throws(()=>engine.resolve(first.state,reserve,'tighten',rng),/no longer available/i);
 assert.deepEqual(first.state,before);
});
