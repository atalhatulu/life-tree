import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {startBusiness,canStartBusiness,processBusinessYear} from '../src/career/entrepreneurship_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
const MAX=Number.MAX_SAFE_INTEGER;
function setup(label){
 const s=new Game('cycle43-'+label).state;
 s.player.age=35;s.player.personality.ambition=90;
 ensurePersonalFinance(s);
 s.finance.cash=500000;
 s.business={active:true,mode:'full-time',years:2,health:55,capital:100000,monthlyProfit:0};
 s.year=2080;
 return s;
}
const profitable={int:(min,max)=>min===-18?0:min===-24000?26000:1,chance:()=>false};
const losing={int:(min,max)=>min===-18?0:min===-24000?-24000:1,chance:()=>false};
test('annual profit cannot overflow cash or update business before rejection',()=>{
 const s=setup('profit-overflow');s.finance.cash=MAX-10;
 const before=structuredClone(s);
 assert.throws(()=>processBusinessYear(s,profitable),RangeError);
 assert.deepEqual(s,before);
});
test('annual profit rejects legacy string cash without any lifecycle writes',()=>{
 const s=setup('profit-string');s.finance.cash='100';
 const before=structuredClone(s);
 assert.throws(()=>processBusinessYear(s,profitable),RangeError);
 assert.deepEqual(s,before);
});
test('annual profit at safe cash boundary is credited once',()=>{
 const s=setup('profit-boundary');s.finance.cash=0;
 processBusinessYear(s,profitable);
 const draw=Math.round(s.business.monthlyProfit*12*.65);
 assert.equal(s.finance.cash,draw);
 assert.equal(s.business.lastProcessedYear,2080);
 const before=structuredClone(s);
 assert.deepEqual(processBusinessYear(s,profitable),[]);
 assert.deepEqual(s,before);
});
test('annual profit rejects invalid capital before modifying business',()=>{
 for(const capital of [NaN,Infinity,-1,'100']){
  const s=setup('capital-invalid');s.business.capital=capital;
  const before=structuredClone(s);
  assert.throws(()=>processBusinessYear(s,profitable),RangeError);
  assert.deepEqual(s,before);
 }
});
test('annual loss rejects debt aggregate overflow without reducing cash',()=>{
 const s=setup('loss-debt-overflow');s.finance.cash=0;
 s.finance.debt=MAX-10;s.finance.debts.consumer=MAX-10;
 const before=structuredClone(s);
 assert.throws(()=>processBusinessYear(s,losing),RangeError);
 assert.deepEqual(s,before);
});
test('annual loss refuses malformed cash before altering business or debt',()=>{
 for(const cash of [NaN,Infinity,'100']){
  const s=setup('loss-invalid');s.finance.cash=cash;
  const before=structuredClone(s);
  assert.throws(()=>processBusinessYear(s,losing),RangeError);
  assert.deepEqual(s,before);
 }
});
test('annual loss preserves a negative cash deficit and records consumer debt',()=>{
 const s=setup('loss-negative');s.finance.cash=-300;
 processBusinessYear(s,losing);
 assert.equal(s.finance.cash,-300);
 assert.equal(s.finance.debts.consumer,Math.abs(s.business.monthlyProfit*12));
 assert.equal(s.finance.debt,s.finance.debts.consumer);
});
test('annual loss can consume available cash without creating debt',()=>{
 const s=setup('loss-funded');s.finance.cash=1_000_000;
 processBusinessYear(s,losing);
 assert.equal(s.finance.cash,1_000_000-Math.abs(s.business.monthlyProfit*12));
 assert.equal(s.finance.debt,0);
});
test('business startup refuses malformed or unsafe cash without mutating state',()=>{
 for(const cash of ['900000',Infinity,MAX+1]){
  const s=setup('startup-cash');s.business=null;s.finance.cash=cash;
  const before=structuredClone(s);
  assert.equal(canStartBusiness(s),false);
  assert.throws(()=>startBusiness(s,{int:()=>300000}));
  assert.deepEqual(s,before);
 }
});
test('business startup rejects invalid random investment atomically',()=>{
 for(const investment of [NaN,Infinity,-5,'250000']){
  const s=setup('startup-rng');s.business=null;
  const before=structuredClone(s);
  assert.throws(()=>startBusiness(s,{int:()=>investment}),RangeError);
  assert.deepEqual(s,before);
 }
});
test('business startup still funds legitimate full-time and side ventures',()=>{
 for(const mode of ['full-time','side']){
  const s=setup('startup-valid-'+mode);s.business=null;
  const result=startBusiness(s,{int:()=>300000},mode);
  assert.equal(result.capital,mode==='side'?150000:275000);
  assert.equal(s.finance.cash,500000-result.capital);
  assert.equal(result.active,true);
 }
});
