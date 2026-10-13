import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {ensurePersonalFinance,spendActivityCash,repayBudgetDebt} from '../src/finance/personal_finance.js';
import {saveChildAllowance,spendChildAllowance} from '../src/finance/child_money.js';
import {performActivity} from '../src/life/activity_system.js';

const MAX=Number.MAX_SAFE_INTEGER;
function adult(seed){
 const s=new Game('cycle46-'+seed).state;
 s.player.age=35;
 ensurePersonalFinance(s);
 s.actions={remaining:3,max:3};
 s.finance.cash=30000;
 s.finance.activitySpendingAnnual=0;
 s.finance.debt=0;
 s.finance.debts={consumer:0,medical:0,housing:0,car:0,emergency:0};
 return s;
}
function child(seed){
 const s=new Game('cycle46-child-'+seed).state;
 s.player.age=12;
 s.childMoney={wallet:1000,saved:250,totalAllowance:2000,totalSpent:500,lastAllowanceAge:12};
 return s;
}
const unchanged=(s,action,pattern=/safe|invalid|balance|limit|cash|fund|money|insufficient|debt/i)=>{
 const before=structuredClone(s);
 assert.throws(action,pattern);
 assert.deepEqual(s,before);
};

test('adult discretionary spending updates both ledgers with exact amount',()=>{
 const s=adult('spend-normal');
 assert.equal(spendActivityCash(s,900),900);
 assert.equal(s.finance.cash,29100);
 assert.equal(s.finance.activitySpendingAnnual,900);
 assert.equal(spendActivityCash(s,0),0);
 assert.equal(s.finance.cash,29100);
});

test('adult spending rejects unsafe, negative, nonnumeric and insufficient charges without mutation',()=>{
 for(const value of [-1,NaN,Infinity,'500',30001,MAX+2]){
  const s=adult('spend-invalid');
  unchanged(s,()=>spendActivityCash(s,value));
 }
});

test('adult spending rejects corrupt balances and activity-spending overflow atomically',()=>{
 for(const [cash,spent,cost] of [['1000',0,500],[Infinity,0,500],[30000,-1,500],[30000,NaN,500],[30000,MAX-2,3]]){
  const s=adult('spend-ledger');s.finance.cash=cash;s.finance.activitySpendingAnnual=spent;
  unchanged(s,()=>spendActivityCash(s,cost));
 }
});

test('adult spending accepts exact annual-spending safe ceiling',()=>{
 const s=adult('spend-ceiling');s.finance.activitySpendingAnnual=MAX-3;
 spendActivityCash(s,3);
 assert.equal(s.finance.activitySpendingAnnual,MAX);
 assert.equal(s.finance.cash,29997);
});

test('browser and terminal leisure/person actions share checked discretionary spending',()=>{
 const ui=readFileSync(new URL('../src/ui/app.js',import.meta.url),'utf8');
 const cli=readFileSync(new URL('../src/cli/text_mode.js',import.meta.url),'utf8');
 assert.match(ui,/spendActivityCash\(/);
 assert.match(cli,/spendActivityCash\(/);
 assert.doesNotMatch(ui,/f\.activitySpendingAnnual\s*=\s*\(f\.activitySpendingAnnual\?\?0\)\+cost/);
 assert.doesNotMatch(cli,/s\.finance\.activitySpendingAnnual\s*=\s*\(s\.finance\.activitySpendingAnnual\?\?0\)\+/);
});

test('child wallet spending and saving conserve balances and track spending',()=>{
 const s=child('normal');
 assert.equal(saveChildAllowance(s),600);
 assert.equal(s.childMoney.wallet,400);
 assert.equal(s.childMoney.saved,850);
 assert.equal(spendChildAllowance(s,120),120);
 assert.equal(s.childMoney.wallet,280);
 assert.equal(s.childMoney.totalSpent,620);
});

test('child wallet rejects invalid charges and insufficient funds atomically',()=>{
 for(const cost of [-1,NaN,Infinity,'120',1001,MAX+2]){
  const s=child('bad-spend');
  unchanged(s,()=>spendChildAllowance(s,cost));
 }
});

test('child wallet refuses corrupt balances and total-spending overflow without changes',()=>{
 for(const [wallet,saved,spent,cost] of [['1000',250,500,120],[1000,NaN,500,120],[1000,250,MAX-3,4],[-1,250,500,120]]){
  const s=child('bad-ledger');s.childMoney.wallet=wallet;s.childMoney.saved=saved;s.childMoney.totalSpent=spent;
  unchanged(s,()=>spendChildAllowance(s,cost));
 }
});

test('child savings reject overflow and invalid wallet without mutation',()=>{
 for(const [wallet,saved] of [[1000,MAX-100],['1000',250],[NaN,250],[-1,250]]){
  const s=child('bad-save');s.childMoney.wallet=wallet;s.childMoney.saved=saved;
  unchanged(s,()=>saveChildAllowance(s));
 }
});

test('child savings permit the exact safe ceiling and empty-wallet no-op',()=>{
 const s=child('exact-save');s.childMoney.saved=MAX-600;
 assert.equal(saveChildAllowance(s),600);
 assert.equal(s.childMoney.saved,MAX);
 s.childMoney.wallet=0;
 assert.equal(saveChildAllowance(s),0);
 assert.equal(s.childMoney.saved,MAX);
});

test('browser and terminal child money decisions use checked shared functions',()=>{
 for(const file of ['../src/ui/app.js','../src/cli/text_mode.js']){
  const code=readFileSync(new URL(file,import.meta.url),'utf8');
  assert.match(code,/saveChildAllowance\(/);
  assert.match(code,/spendChildAllowance\(/);
  assert.doesNotMatch(code,/childMoney\.saved\s*\+=\s*moved/);
 }
});

test('budget debt payment settles debt and cash once with preserved action budget',()=>{
 const s=adult('budget-normal');s.finance.debt=10000;s.finance.debts.consumer=10000;
 assert.equal(repayBudgetDebt(s),6000);
 assert.equal(s.finance.cash,24000);
 assert.equal(s.finance.debt,4000);
 assert.equal(s.actions.remaining,3);
});

test('budget debt payment rejects corrupt cash without rewriting finance or debt',()=>{
 for(const cash of ['30000',NaN,Infinity,-1]){
  const s=adult('budget-bad');s.finance.cash=cash;s.finance.debt=10000;s.finance.debts.consumer=10000;
  unchanged(s,()=>repayBudgetDebt(s));
 }
});

test('budget activity refuses invalid repayment before stress, memory or action mutation',()=>{
 const s=adult('budget-activity-bad');s.finance.cash='30000';s.finance.debt=10000;s.finance.debts.consumer=10000;
 const before=structuredClone(s);
 assert.throws(()=>performActivity(s,'budget',new RNG('budget-activity')),/safe|invalid|cash|balance/i);
 assert.deepEqual(s,before);
});

test('budget activity applies debt repayment exactly once and records use',()=>{
 const s=adult('budget-activity-normal');s.finance.debt=10000;s.finance.debts.consumer=10000;
 performActivity(s,'budget',new RNG('budget-activity'));
 assert.equal(s.finance.cash,24000);
 assert.equal(s.finance.debt,4000);
 assert.equal(s.actions.remaining,2);
 assert.equal(s.activityMemory.budget.uses,1);
 const before=structuredClone(s);
 assert.throws(()=>performActivity(s,'budget',new RNG('budget-again')),/zaten yaptın/i);
 assert.deepEqual(s,before);
});
