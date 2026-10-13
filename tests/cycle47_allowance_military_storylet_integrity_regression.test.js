import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {creditChildAllowance} from '../src/finance/child_money.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {processChildhoodYear} from '../src/life/childhood_simulation.js';
import {completeMilitaryService,paidMilitaryFee} from '../src/life/military_service.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
const MAX=Number.MAX_SAFE_INTEGER;
const unchanged=(s,fn,pattern=/safe|limit|invalid|money|funds|yeterli|fee/i)=>{
 const before=structuredClone(s);
 assert.throws(fn,pattern);
 assert.deepEqual(s,before);
};
const child=()=>{
 const s=new Game('cycle47-child').state;
 s.player.age=12;s.year=2038;
 s.childMoney={wallet:500,saved:200,totalAllowance:1000,totalSpent:100,lastAllowanceAge:11};
 return s;
};
test('child allowance credit adds exact amount to both ledgers',()=>{
 const s=child();creditChildAllowance(s,125);
 assert.equal(s.childMoney.wallet,625);
 assert.equal(s.childMoney.totalAllowance,1125);
});
test('child allowance credit rejects malformed and unsafe amounts atomically',()=>{
 for(const amount of [-1,NaN,Infinity,'200',MAX+1]){
  const s=child();unchanged(s,()=>creditChildAllowance(s,amount));
 }
});
test('child allowance rejects wallet and cumulative credit overflow without mutation',()=>{
 for(const [wallet,total] of [[MAX-50,1000],[500,MAX-50],[Infinity,1000],[500,'1000'],[500,1000]]){
  const s=child();s.childMoney.wallet=wallet;s.childMoney.totalAllowance=total;
  if(wallet===500&&total===1000)s.childMoney.saved=NaN;
  unchanged(s,()=>creditChildAllowance(s,100));
 }
});
test('child annual allowance failure leaves year marker and education unchanged',()=>{
 const s=child();s.childMoney.totalAllowance=MAX-1;
 const rng=new RNG('child-year-failure');
 unchanged(s,()=>processChildhoodYear(s,rng));
});
test('child annual allowance is credited once and is idempotent within year',()=>{
 const s=child();const entries=processChildhoodYear(s,new RNG('child-year-success'));
 assert.equal(entries.filter(e=>e.kind==='child-money').length,1);
 assert.equal(s.childMoney.lastAllowanceAge,12);
 const after=structuredClone(s);
 assert.deepEqual(processChildhoodYear(s,new RNG('child-year-replay')),[]);
 assert.deepEqual(s,after);
});
const military=()=>{
 const s=new Game('cycle47-military').state;
 s.player.sex='male';s.player.age=24;s.year=2050;
 s.higherEducation=null;
 s.militaryService={eligible:true,status:'pending',deferredUntilAge:null};
 ensurePersonalFinance(s);
 s.finance.cash=200000;s.finance.savings=200000;
 return s;
};
test('paid military rejects insufficient combined liquidity without changing status or finance',()=>{
 const s=military();unchanged(s,()=>completeMilitaryService(s,'paid'));
});
test('paid military rejects corrupt money and unsafe or negative fee atomically',()=>{
 for(const [cash,savings,macro] of [[NaN,1000000,1],[1000000,-1,1],['1000000',0,1],[1000000,0,Infinity],[1000000,0,-1],[1000000,0,MAX]]){
  const s=military();s.finance.cash=cash;s.finance.savings=savings;s.world.economy.costOfLiving=macro;
  unchanged(s,()=>completeMilitaryService(s,'paid'));
 }
});
test('paid military correctly splits fee across cash and savings',()=>{
 const s=military();const fee=paidMilitaryFee(s);
 s.finance.cash=100000;s.finance.savings=fee-100000;
 completeMilitaryService(s,'paid');
 assert.equal(s.finance.cash,0);assert.equal(s.finance.savings,0);
 assert.equal(s.militaryService.paidFee,fee);
 assert.equal(s.militaryService.status,'completed');
});
test('unknown military mode cannot silently complete service',()=>{
 const s=military();unchanged(s,()=>completeMilitaryService(s,'unknown'),/mode/);
});
const storylet=(id)=>systemicStorylets.find(e=>e.id===id);
const choice=(e,s,id)=>(typeof e.choices==='function'?e.choices(s):e.choices).find(c=>c.id===id);
const childSupport=()=>({
 player:{age:40},finance:{cash:20000},
 children:[{id:'kid',name:'Test',age:12,relationship:70,parenting:{emotionalSecurity:40,accumulatedSupport:0}}],
 storyletCooldowns:{},storyletCounts:{}
});
test('child support rejects malformed cash without charging or rewarding',()=>{
 const e=storylet('storylet-child-needs-you');
 for(const cash of ['20000',Infinity,NaN,-5]){
  const s=childSupport();s.finance.cash=cash;const before=structuredClone(s);
  const c=choice(e,s,'buy-support');assert.equal(c.condition(s),false);
  c.effect(s);assert.deepEqual(s,before);
 }
});
test('child support stale purchase cannot charge or reward twice',()=>{
 const s=childSupport(),e=storylet('storylet-child-needs-you');
 const c=choice(e,s,'buy-support');c.effect(s);
 const after=structuredClone(s);c.effect(s);assert.deepEqual(s,after);
 assert.equal(s.finance.cash,15000);
});
test('vacation rejects malformed funds and replayed choice',()=>{
 const e=storylet('storylet-burnout-crossroads');
 const mk=()=>({player:{age:42},finance:{cash:18000},career:{workplace:{burnout:90}},healthProfile:{stress:50},storyletCooldowns:{},storyletCounts:{}});
 for(const cash of [Infinity,'18000',NaN]){
  const s=mk();s.finance.cash=cash;const c=choice(e,s,'vacation');const before=structuredClone(s);
  assert.equal(c.condition(s),false);c.effect(s);assert.deepEqual(s,before);
 }
 const s=mk(),c=choice(e,s,'vacation');c.effect(s);
 assert.equal(s.finance.cash,6000);const after=structuredClone(s);c.effect(s);assert.deepEqual(s,after);
});
test('adult-child financial support rejects corrupt cash and stale repeated choice',()=>{
 const e=storylet('storylet-adult-child-request');
 const mk=()=>({player:{age:55},finance:{cash:40000},children:[{id:'adult',name:'Adult',age:26,relationship:70,alive:true}],storyletCooldowns:{},storyletCounts:{}});
 for(const cash of [NaN,'40000',Infinity]){
  const s=mk();s.finance.cash=cash;const c=choice(e,s,'help-money');const before=structuredClone(s);
  assert.equal(c.condition(s),false);c.effect(s);assert.deepEqual(s,before);
 }
 const s=mk(),c=choice(e,s,'help-money');c.effect(s);
 assert.equal(s.finance.cash,25000);assert.equal(s.children[0].relationship,76);
 const after=structuredClone(s);c.effect(s);assert.deepEqual(s,after);
});
