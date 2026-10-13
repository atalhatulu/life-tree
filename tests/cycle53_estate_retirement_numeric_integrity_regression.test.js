import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {settleEstate} from '../src/finance/estate_system.js';
import {retire,processRetirementYear} from '../src/career/retirement_system.js';

const MAX=Number.MAX_SAFE_INTEGER;
function estateState(seed){
 const s=new Game(seed).state;
 s.player.age=75;
 s.finance={cash:100,savings:20,debt:10};
 s.assets={home:null,car:null};
 s.business=null;
 s.children=[];
 s.social.romance=null;
 return s;
}
function rejectWithoutMutation(s,action){
 const before=structuredClone(s);
 assert.throws(action,RangeError);
 assert.deepEqual(s,before);
}

// 1: Estate amounts must be exact, safe integers and totals must not overflow.
test('estate rejects corrupt signed cash, savings and debt without finalizing',()=>{
 for(const [key,value] of [['cash',NaN],['cash',Infinity],['cash','100'],['cash',1.5],['savings',-Infinity],['savings',1.1],['debt',-1],['debt','10']]){
  const s=estateState('estate-corrupt-'+key+'-'+value);s.finance[key]=value;
  rejectWithoutMutation(s,()=>settleEstate(s));
 }
});
test('estate rejects malformed collateral and business valuations',()=>{
 for(const [kind,record] of [
  ['home',{price:Infinity}],['home',{price:-1}],['car',{price:'100'}],
  ['business',{active:true,capital:NaN,health:50}],
  ['business',{active:true,capital:100,health:Infinity}]
 ]){
  const s=estateState('estate-asset-'+kind+'-'+JSON.stringify(record));
  if(kind==='business')s.business=record;else s.assets[kind]=record;
  rejectWithoutMutation(s,()=>settleEstate(s));
 }
});
test('estate refuses gross or debt aggregate overflow instead of recording unsafe totals',()=>{
 const gross=estateState('estate-gross-overflow');gross.finance.cash=MAX;gross.finance.savings=1;
 rejectWithoutMutation(gross,()=>settleEstate(gross));
 const debt=estateState('estate-debt-overflow');debt.finance.cash=-MAX;debt.finance.debt=1;
 rejectWithoutMutation(debt,()=>settleEstate(debt));
 const assets=estateState('estate-asset-overflow');assets.finance.cash=MAX;assets.assets.home={price:1};
 rejectWithoutMutation(assets,()=>settleEstate(assets));
});
test('estate supports exact safe monetary boundary and negative cash as liability',()=>{
 const s=estateState('estate-boundary');s.finance.cash=MAX;s.finance.savings=0;s.finance.debt=0;
 const estate=settleEstate(s);
 assert.equal(estate.gross,MAX);assert.equal(estate.net,MAX);
 assert.equal(estate.heirs.reduce((sum,h)=>sum+h.amount,0),MAX);
 assert.strictEqual(settleEstate(s),estate);
 const negative=estateState('estate-negative-valid');negative.finance.cash=-20;
 const e=settleEstate(negative);assert.equal(e.gross,20);assert.equal(e.debt,30);assert.equal(e.net,0);
});

// 2: Career/business pension inputs must not mutate lifecycle on rejection.
function careerState(seed){
 const s=new Game(seed).state;s.player.age=65;
 s.career={employed:true,totalYears:25,monthlyIncome:50000,title:'Engineer'};
 return s;
}
function businessState(seed){
 const s=new Game(seed).state;s.player.age=65;
 s.career={employed:false,totalYears:0};
 s.business={active:true,mode:'full-time',years:10,capital:100,health:65,monthlyProfit:10000};
 return s;
}
test('career retirement rejects invalid income before clearing employment',()=>{
 for(const value of [NaN,Infinity,-1,'50000',MAX+1]){
  const s=careerState('career-income-'+value);s.career.monthlyIncome=value;
  rejectWithoutMutation(s,()=>retire(s));
 }
});
test('career retirement preserves ordinary pension and job exit',()=>{
 const s=careerState('career-income-valid');const result=retire(s);
 assert.equal(result.pensionMonthly,21000);
 assert.equal(s.career.employed,false);assert.equal(s.player.monthlyIncome,21000);
});
test('business retirement rejects invalid health and unsafe profit before sale',()=>{
 for(const [field,value] of [['health',NaN],['health',Infinity],['health','65'],['monthlyProfit',MAX+1],['monthlyProfit','10000']]){
  const s=businessState('business-retirement-'+field+'-'+value);s.business[field]=value;
  rejectWithoutMutation(s,()=>retire(s));
 }
});
test('business retirement retains normal valuation and capped pension',()=>{
 const s=businessState('business-retirement-valid');const result=retire(s);
 assert.equal(result.businessSaleValue,100);
 assert.equal(result.pensionMonthly,18200);
 assert.equal(s.business.active,false);
});

// 3: Annual retirement years and calendar markers must not wrap or coerce.
function retiredState(seed){
 const s=new Game(seed).state;s.year=2075;
 s.retirement={retired:true,years:2,pensionMonthly:20000};return s;
}
test('retirement annual processing rejects corrupt year counters without mutation',()=>{
 for(const value of [NaN,Infinity,-1,'2',MAX]){
  const s=retiredState('retirement-years-'+value);s.retirement.years=value;
  rejectWithoutMutation(s,()=>processRetirementYear(s));
 }
});
test('retirement annual processing rejects malformed calendar markers',()=>{
 for(const value of [NaN,Infinity,'2074',2075.5]){
  const s=retiredState('retirement-marker-'+value);s.retirement.lastProcessedYear=value;
  rejectWithoutMutation(s,()=>processRetirementYear(s));
 }
});
test('retirement annual processing keeps once-per-year semantics and safe limit',()=>{
 const s=retiredState('retirement-valid');s.retirement.years=MAX-1;
 processRetirementYear(s);assert.equal(s.retirement.years,MAX);
 assert.equal(s.retirement.lastProcessedYear,2075);
 assert.deepEqual(processRetirementYear(s),[]);
 s.year=2076;rejectWithoutMutation(s,()=>processRetirementYear(s));
});
