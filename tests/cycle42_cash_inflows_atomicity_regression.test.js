import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processInheritance} from '../src/finance/inheritance_system.js';
import {addToTrustFund,releaseTrustFund} from '../src/finance/trust_fund.js';
import {retire} from '../src/career/retirement_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

const MAX=Number.MAX_SAFE_INTEGER;
const game=(name)=>{const s=new Game('cycle42-'+name).state;ensurePersonalFinance(s);return s;};

test('inheritance rejects aggregate cash overflow without consuming pending estate',()=>{
 const s=game('estate-overflow');s.player.age=40;s.finance.cash=MAX-5;
 s.pendingInheritance=[{sourceId:'a',amount:6}];const before=structuredClone(s);
 assert.throws(()=>processInheritance(s),RangeError);assert.deepEqual(s,before);
});
test('inheritance rejects unsafe combined estate even with ample cash',()=>{
 const s=game('estate-combined');s.player.age=40;s.finance.cash=0;
 s.pendingInheritance=[{amount:MAX-1},{amount:3}];const before=structuredClone(s);
 assert.throws(()=>processInheritance(s),RangeError);assert.deepEqual(s,before);
});
test('inheritance rejects invalid entries atomically',()=>{
 const s=game('estate-invalid');s.player.age=40;s.pendingInheritance=[{amount:100},{amount:NaN}];
 const before=structuredClone(s);assert.throws(()=>processInheritance(s),RangeError);assert.deepEqual(s,before);
});
test('inheritance rejects string amount and malformed cash before mutation',()=>{
 const s=game('estate-legacy');s.player.age=40;s.finance.cash='100';s.pendingInheritance=[{amount:200}];
 const before=structuredClone(s);assert.throws(()=>processInheritance(s),RangeError);assert.deepEqual(s,before);
 s.finance.cash=100;s.pendingInheritance=[{amount:'200'}];const before2=structuredClone(s);
 assert.throws(()=>processInheritance(s),RangeError);assert.deepEqual(s,before2);
});
test('inheritance can initialize a missing finance record on valid estate',()=>{
 const s=game('estate-no-finance');delete s.finance;s.player.age=30;
 s.pendingInheritance=[{amount:400}];assert.equal(processInheritance(s).length,1);
 assert.equal(s.finance.cash,400);assert.equal(s.inheritanceHistory.length,1);
});
test('inheritance accepts exact safe cash ceiling and consumes pending once',()=>{
 const s=game('estate-boundary');s.player.age=40;s.finance.cash=MAX-9;
 s.pendingInheritance=[{amount:4},{amount:5}];assert.equal(processInheritance(s).length,1);
 assert.equal(s.finance.cash,MAX);assert.equal(s.inheritanceHistory.length,2);
 assert.equal(processInheritance(s).length,0);assert.equal(s.finance.cash,MAX);
});

test('trust fund contributions reject unsafe total without appending source',()=>{
 const s=game('trust-overflow');s.trustFund={balance:MAX-1,sources:[{amount:MAX-1}],released:false};
 const before=structuredClone(s);assert.throws(()=>addToTrustFund(s,2,{sourceId:'x'}),RangeError);assert.deepEqual(s,before);
});
test('trust fund contributions reject nonnumeric, negative and nonfinite amounts',()=>{
 for(const amount of [-1,NaN,Infinity,'10']){
  const s=game('trust-invalid');const before=structuredClone(s);
  assert.throws(()=>addToTrustFund(s,amount,{sourceId:'x'}),RangeError);
  assert.deepEqual(s,before);
 }
});
test('trust fund does not accept a new contribution after release',()=>{
 const s=game('trust-after-release');s.trustFund={balance:100,sources:[],released:true};
 const before=structuredClone(s);assert.throws(()=>addToTrustFund(s,10,{sourceId:'x'}));assert.deepEqual(s,before);
});
test('trust release rejects cash overflow without marking released',()=>{
 const s=game('trust-release-overflow');s.player.age=18;s.finance.cash=MAX-1;
 s.trustFund={balance:2,sources:[],released:false};const before=structuredClone(s);
 assert.throws(()=>releaseTrustFund(s),RangeError);assert.deepEqual(s,before);
});
test('trust release rejects invalid old balance and cash atomically',()=>{
 const s=game('trust-release-legacy');s.player.age=18;s.finance.cash='100';
 s.trustFund={balance:10,sources:[],released:false};const before=structuredClone(s);
 assert.throws(()=>releaseTrustFund(s),RangeError);assert.deepEqual(s,before);
 s.finance.cash=100;s.trustFund.balance=NaN;const before2=structuredClone(s);
 assert.throws(()=>releaseTrustFund(s),RangeError);assert.deepEqual(s,before2);
});
test('trust fund accepts valid contributions and preserves sources',()=>{
 const s=game('trust-valid');addToTrustFund(s,125.4,{sourceId:'parent'});
 addToTrustFund(s,74.6,{sourceId:'grandparent'});
 assert.equal(s.trustFund.balance,200);assert.equal(s.trustFund.sources.length,2);
 assert.equal(s.trustFund.sources[0].amount,125);assert.equal(s.trustFund.sources[1].amount,75);
});
test('trust release at exact cash limit is idempotent',()=>{
 const s=game('trust-release-boundary');s.player.age=18;s.finance.cash=MAX-10;
 s.trustFund={balance:10,sources:[],released:false};assert.equal(releaseTrustFund(s).length,1);
 assert.equal(s.finance.cash,MAX);assert.equal(releaseTrustFund(s).length,0);assert.equal(s.finance.cash,MAX);
});

function businessState(name){
 const s=game(name);s.player.age=65;s.career={employed:false,totalYears:0};
 s.business={active:true,mode:'full-time',years:10,capital:100,health:65,monthlyProfit:12000};
 return s;
}
test('business retirement refuses cash overflow without closing business',()=>{
 const s=businessState('business-overflow');s.finance.cash=MAX-50;
 const before=structuredClone(s);assert.throws(()=>retire(s),RangeError);assert.deepEqual(s,before);
});
test('business retirement rejects malformed cash and sale valuation atomically',()=>{
 const s=businessState('business-invalid');s.finance.cash='100';const before=structuredClone(s);
 assert.throws(()=>retire(s),RangeError);assert.deepEqual(s,before);
 s.finance.cash=0;s.business.capital=Infinity;const before2=structuredClone(s);
 assert.throws(()=>retire(s),RangeError);assert.deepEqual(s,before2);
});
test('business retirement rejects nonfinite profit before any sale or lifecycle change',()=>{
 const s=businessState('business-profit');s.business.monthlyProfit=NaN;
 const before=structuredClone(s);assert.throws(()=>retire(s),RangeError);assert.deepEqual(s,before);
});
test('business retirement permits exact limit, then refuses duplicate retirement',()=>{
 const s=businessState('business-boundary');s.finance.cash=MAX-100;
 assert.equal(retire(s).businessSaleValue,100);assert.equal(s.finance.cash,MAX);
 const before=structuredClone(s);assert.throws(()=>retire(s),/zaten emekli|already retired/i);assert.deepEqual(s,before);
});
test('career retirement also refuses a second retirement without mutation',()=>{
 const s=game('career-repeat');s.player.age=65;
 s.career={employed:true,totalYears:25,monthlyIncome:60000,title:'Engineer'};
 retire(s);const before=structuredClone(s);
 assert.throws(()=>retire(s),/zaten emekli|already retired/i);assert.deepEqual(s,before);
});
