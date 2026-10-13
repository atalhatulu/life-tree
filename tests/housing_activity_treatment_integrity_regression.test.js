import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {setLifestyle} from '../src/lifestyle/lifestyle_system.js';
import {moveHousing} from '../src/assets/asset_system.js';
import {adultEvents} from '../src/events/adult_events.js';
import {EventEngine} from '../src/events/event_engine.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';
import {ensurePersonalFinance,payDownDebt} from '../src/finance/personal_finance.js';
import {treatCondition} from '../src/health/treatment_system.js';

const snapshot=state=>structuredClone(state);
function adult(seed){
 const s=new Game('cycle37-'+seed).state;
 s.player.age=30;
 ensurePersonalFinance(s);
 s.finance.cash=100000;
 s.finance.lifestyle.housing='family';
 s.assets={home:null,car:null};
 return s;
}

test('lifestyle housing change uses the same deposit as the asset move API',()=>{
 const a=adult('housing-api'),b=snapshot(a);
 setLifestyle(a,{housing:'studio'});
 moveHousing(b,'studio');
 assert.deepEqual(a,b);
 assert.equal(a.finance.cash,76000);
});

test('invalid companion preference prevents a deposit from being charged',()=>{
 const s=adult('housing-invalid-batch');
 const before=snapshot(s);
 assert.throws(()=>setLifestyle(s,{housing:'studio',food:'invalid'}));
 assert.deepEqual(s,before);
});

test('repeating housing preference does not charge again',()=>{
 const s=adult('housing-repeat');
 setLifestyle(s,{housing:'shared'});
 const before=snapshot(s);
 setLifestyle(s,{housing:'shared'});
 assert.deepEqual(s,before);
});

test('insufficient funds reject a mixed lifestyle update atomically',()=>{
 const s=adult('housing-atomic');
 s.finance.cash=1000;
 const before=snapshot(s);
 assert.throws(()=>setLifestyle(s,{food:'healthy',housing:'apartment'}),/nakit|depozito|taşın/i);
 assert.deepEqual(s,before);
});

test('lifestyle cannot invent home ownership or move while owning a home',()=>{
 const s=adult('housing-owned');
 const before=snapshot(s);
 assert.throws(()=>setLifestyle(s,{housing:'owned'}));
 assert.deepEqual(s,before);
 s.assets.home={id:'owned-home',price:2000000};
 const owned=snapshot(s);
 assert.throws(()=>setLifestyle(s,{housing:'studio',food:'healthy'}));
 assert.deepEqual(s,owned);
});

test('move-out event only offers affordable moves and uses the same deposit',()=>{
 const event=adultEvents.find(e=>e.id==='move-out');
 const s=adult('move-event');
 s.career={employed:true,monthlyIncome:80000};
 s.finance.cash=10000;
 assert.equal(event.condition(s),true);
 let ids=event.choices.filter(c=>!c.condition||c.condition(s)).map(c=>c.id);
 assert.deepEqual(ids,['stay-family']);
 s.finance.cash=30000;
 ids=event.choices.filter(c=>!c.condition||c.condition(s)).map(c=>c.id);
 assert.ok(ids.includes('shared'));
 assert.ok(ids.includes('studio'));
 event.choices.find(c=>c.id==='shared').effect(s);
 assert.equal(s.finance.cash,18000);
 assert.equal(s.finance.lifestyle.housing,'shared');
});

test('resolving move-out through the event engine charges the cloned next state only',()=>{
 const event=adultEvents.find(e=>e.id==='move-out');
 const s=adult('move-engine');
 s.career={employed:true,monthlyIncome:80000};
 const before=snapshot(s);
 const resolved=new EventEngine([event]).resolve(s,event,'studio',new RNG('move-engine'));
 assert.deepEqual(s,before);
 assert.equal(resolved.state.finance.cash,76000);
 assert.equal(resolved.state.finance.lifestyle.housing,'studio');
});

test('checking activity availability does not initialize activity memory',()=>{
 const s=adult('activity-pure');
 delete s.activityMemory;
 const before=snapshot(s);
 const choices=availableActivities(s);
 assert.ok(choices.some(a=>a.id==='exercise'));
 assert.deepEqual(s,before);
 assert.deepEqual(availableActivities(s),choices);
});

test('invalid activity does not initialize action or activity memory',()=>{
 const s=adult('activity-invalid');
 delete s.actions;
 delete s.activityMemory;
 const before=snapshot(s);
 assert.throws(()=>performActivity(s,'nonexistent',new RNG('invalid')),/kullanılamıyor/i);
 assert.deepEqual(s,before);
});

test('valid activity still records usage and blocks same-year replay',()=>{
 const s=adult('activity-valid');
 s.actions={remaining:3,max:3};
 delete s.activityMemory;
 performActivity(s,'exercise',new RNG('activity-valid'));
 assert.equal(s.activityMemory.exercise.uses,1);
 const before=snapshot(s);
 assert.throws(()=>performActivity(s,'exercise',new RNG('activity-valid-2')),/zaten yaptın/i);
 assert.deepEqual(s,before);
});

function patient(seed,cash){
 const s=adult(seed);
 s.player.age=50;
 s.finance.cash=cash;
 s.healthProfile={conditions:[{id:'cardiac',label:'Cardiac',severity:3,diagnosedAtAge:49}],fitness:45,stress:50};
 return s;
}

test('treatment shortfall is recorded as medical debt in typed and aggregate ledgers',()=>{
 const s=patient('medical-ledger',20000);
 const before=s.finance.debt;
 const result=treatCondition(s,'cardiac',new RNG('medical-ledger'));
 const shortfall=result.cost-20000;
 assert.ok(shortfall>0);
 assert.equal(s.finance.cash,0);
 assert.equal(s.finance.debts.medical,shortfall);
 assert.equal(s.finance.debt,before+shortfall);
});

test('medical debt survives reconciliation and can be repaid without unrelated bucket changes',()=>{
 const s=patient('medical-repay',0);
 s.finance.debts.consumer=5000;
 s.finance.debt=5000;
 const result=treatCondition(s,'cardiac',new RNG('medical-repay'));
 ensurePersonalFinance(s);
 assert.equal(s.finance.debts.medical,result.cost);
 assert.equal(s.finance.debts.consumer,5000);
 assert.equal(s.finance.debt,result.cost+5000);
 payDownDebt(s,5000);
 assert.equal(s.finance.debts.consumer,0);
 assert.equal(s.finance.debts.medical,result.cost);
});

test('minor family-covered treatment creates no debt or cash charge',()=>{
 const s=patient('medical-child',0);
 s.player.age=17;
 const result=treatCondition(s,'cardiac',new RNG('medical-child'));
 assert.equal(result.cost,0);
 assert.equal(result.familyCovered,true);
 assert.equal(s.finance.debt,0);
 assert.equal(s.finance.debts.medical,0);
});

test('repeated treatment rejects without a second charge',()=>{
 const s=patient('medical-repeat',0);
 treatCondition(s,'cardiac',new RNG('medical-repeat'));
 const before=snapshot(s);
 assert.throws(()=>treatCondition(s,'cardiac',new RNG('medical-repeat-2')));
 assert.deepEqual(s,before);
});
