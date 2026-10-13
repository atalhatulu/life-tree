import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear,transferToSavings,saveMonthlySurplus} from '../src/finance/personal_finance.js';

const MAX=Number.MAX_SAFE_INTEGER;
function adult(seed){
 const s=new Game('cycle45-'+seed).state;
 s.player.age=40;
 ensurePersonalFinance(s);
 s.assets={home:null,car:null};
 s.finance.debt=0;
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 return s;
}

test('explicit savings transfer moves exactly the requested amount and preserves total liquidity',()=>{
 const s=adult('transfer-normal');s.finance.cash=2000;s.finance.savings=900;
 assert.equal(transferToSavings(s,1200),1200);
 assert.equal(s.finance.cash,800);assert.equal(s.finance.savings,2100);
 assert.equal(transferToSavings(s,0),0);
 assert.equal(s.finance.cash+s.finance.savings,2900);
});

test('invalid transfers and insufficient cash reject without touching even a legacy finance record',()=>{
 for(const amount of [-1,NaN,Infinity,'100',3000,MAX+2]){
  const s=adult('transfer-invalid');s.finance.cash=2000;s.finance.savings=500;
  const before=structuredClone(s);
  assert.throws(()=>transferToSavings(s,amount),/safe|invalid|fund|cash|amount|limit|balance/i);
  assert.deepEqual(s,before);
 }
});

test('transfers cannot overflow savings or silently accept corrupt account balances',()=>{
 for(const [cash,savings,amount] of [[100,MAX-3,4],['100',0,10],[100,NaN,10],[100,-1,10],[100,MAX+2,1]]){
  const s=adult('transfer-overflow');s.finance.cash=cash;s.finance.savings=savings;
  const before=structuredClone(s);
  assert.throws(()=>transferToSavings(s,amount),/safe|invalid|limit|balance/i);
  assert.deepEqual(s,before);
 }
});

test('exact savings ceiling remains possible',()=>{
 const s=adult('transfer-exact');s.finance.cash=4;s.finance.savings=MAX-4;
 assert.equal(transferToSavings(s,4),4);
 assert.equal(s.finance.savings,MAX);assert.equal(s.finance.cash,0);
});

test('monthly saving suggestion respects available cash and savings headroom',()=>{
 const s=adult('monthly-suggest');s.finance.cash=1200;s.finance.savings=MAX-1;s.finance.monthlyIncome=40000;
 assert.equal(saveMonthlySurplus(s),1);
 assert.equal(s.finance.cash,1199);assert.equal(s.finance.savings,MAX);
 assert.equal(saveMonthlySurplus(s),0);
});

test('invalid monthly income rejects without partial savings transfer',()=>{
 const s=adult('monthly-invalid');s.finance.cash=5000;s.finance.savings=100;s.finance.monthlyIncome=Infinity;
 const before=structuredClone(s);
 assert.throws(()=>saveMonthlySurplus(s),/income|safe|invalid/i);
 assert.deepEqual(s,before);
});

test('browser and terminal savings decisions use the shared checked transfer',()=>{
 const ui=readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
 const cli=readFileSync(new URL('../src/cli/text_mode.js',import.meta.url),'utf8');
 assert.match(ui,/saveMonthlySurplus\(s\)/);
 assert.match(cli,/saveMonthlySurplus\(s\)/);
 assert.doesNotMatch(ui,/f\.savings\s*=\s*\(f\.savings\?\?0\)\+moved/);
 assert.doesNotMatch(cli,/s\.finance\.savings\s*=\s*\(s\.finance\.savings\?\?0\)\+moved/);
});

test('annual deficit at debt ceiling rejects before any year mutation',()=>{
 const s=adult('annual-debt-cap');s.career={employed:false,monthlyIncome:0};
 s.finance.cash=0;s.finance.savings=0;s.finance.debt=MAX-2;s.finance.debts.consumer=MAX-2;
 const before=structuredClone(s);
 assert.throws(()=>processPersonalFinanceYear(s),/safe|limit|debt|overflow/i);
 assert.deepEqual(s,before);
});

test('annual processing refuses invalid existing cash or savings before ledger reconciliation',()=>{
 for(const [cash,savings] of [['100',0],[Infinity,0],[0,NaN],[0,-1],[0,MAX+2]]){
  const s=adult('annual-invalid');s.finance.cash=cash;s.finance.savings=savings;
  const before=structuredClone(s);
  assert.throws(()=>processPersonalFinanceYear(s),/safe|invalid|balance/i);
  assert.deepEqual(s,before);
 }
});

test('annual income with unsafe aggregate rejects before any mutation',()=>{
 const s=adult('annual-income');s.career={employed:true,monthlyIncome:MAX};
 const before=structuredClone(s);
 assert.throws(()=>processPersonalFinanceYear(s),/safe|annual|invalid|limit/i);
 assert.deepEqual(s,before);
});

test('very high but safe annual income never overflows a nearly full savings balance',()=>{
 const s=adult('annual-surplus');s.career={employed:true,monthlyIncome:700_000_000_000_000};
 s.finance.cash=200000;s.finance.savings=MAX-2;
 const result=processPersonalFinanceYear(s);
 assert.equal(result.length,1);
 assert.ok(Number.isSafeInteger(s.finance.savings));
 assert.ok(s.finance.savings<=MAX);
 assert.ok(Number.isSafeInteger(s.finance.cash));
 assert.ok(Number.isSafeInteger(s.finance.activitySpendingAnnual));
});

test('ordinary annual deficit continues to use reserves then debt',()=>{
 const s=adult('annual-deficit-normal');s.career={employed:false,monthlyIncome:0};
 s.finance.cash=100;s.finance.savings=200;
 const result=processPersonalFinanceYear(s);
 assert.equal(result.length,1);
 assert.equal(s.finance.cash,0);assert.equal(s.finance.savings,0);
 assert.ok(s.finance.debt>0);
});
