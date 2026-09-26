import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ExperimentalYearSession} from '../src/experimental/year_session.js';
import {settleExperimentalMonth} from '../src/experimental/monthly_finance.js';

test('a job started in March earns no January or February wages',()=>{
 const game=new Game('monthly-finance-fixture');
 game.state.player.age=22;game.state.year=2048;
 const session=new ExperimentalYearSession(game,{maxDecisions:1});
 session.start();session.timeline=[];session.cursor=0;
 session.preview.state.career={employed:false,monthlyIncome:0};
 while(session.snapshot().isoDate!=='2049-03-01')session.tickDay();
 const ledger=session.preview.state.finance.experimentalMonthlyLedger;
 assert.equal(ledger.length,2);
 assert.equal(ledger[0].income,0);
 assert.equal(ledger[1].income,0);
 session.preview.state.career={employed:true,monthlyIncome:50000};
 while(session.snapshot().isoDate!=='2049-04-01')session.tickDay();
 assert.ok(ledger[2].income>0);
 assert.equal(ledger[2].month,3);
 assert.throws(()=>settleExperimentalMonth(session.preview.state,3),/already settled/);
});
test('a scheduled decision is revalidated when its day arrives',()=>{
 const session=new ExperimentalYearSession(new Game('stale-event-fixture'));
 session.start();
 const fixture={id:'conditional-test-event',title:'Koşullu olay',condition:s=>Boolean(s.testEnabled),
  choices:[{id:'yes',label:'Evet',result:'Tamam'}]};
 session.preview.events.events.push(fixture);
 session.preview.state.testEnabled=false;
 session.timeline=[{type:'decision',day:40,id:fixture.id,title:fixture.title}];
 session.cursor=0;
 while(session.day<40)session.tickDay();
 assert.equal(session.advance().type,'skipped');
 assert.equal(session.phase,'running'); 
});

test('monthly debt interest is charged once and never twice for the same month',()=>{
 const game=new Game('debt-interest-fixture');const state=game.state;
 state.player.age=30;state.year=2056;
 state.career={employed:false,monthlyIncome:0};
 state.nextPath='work';state.finance={cash:0,savings:0,debt:120000,debts:{consumer:120000,medical:0,housing:0,car:0,emergency:0},
  lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 const january=settleExperimentalMonth(state,1);
 assert.ok(january.interestCharged>0);
 assert.ok(january.debt>120000);
 assert.throws(()=>settleExperimentalMonth(state,1),/already settled/);
 assert.equal(state.finance.experimentalMonthlyLedger.length,1);
});
test('monthly family support follows enrollment and living parents',()=>{
 const game=new Game('monthly-family-fixture');const state=game.state;
 state.player.age=20;state.year=2040;state.nextPath='university';
 state.higherEducation={enrolled:true};state.career={employed:false,monthlyIncome:0};
 state.parents.mother.alive=true;state.parents.father.alive=true;
 const january=settleExperimentalMonth(state,1);
 state.higherEducation.enrolled=false;state.nextPath='work';
 const february=settleExperimentalMonth(state,2);
 assert.ok(january.income>february.income);
});
test('twelve monthly settlements create one annual budget summary',()=>{
 const game=new Game('monthly-annual-fixture');const state=game.state;
 state.player.age=25;state.year=2050;state.career={employed:true,monthlyIncome:65000};
 for(let month=1;month<=12;month++)settleExperimentalMonth(state,month);
 assert.equal(state.finance.experimentalMonthlyLedger.filter(e=>e.year===2050).length,12);
 assert.equal(state.history.filter(e=>e.kind==='finance').length,1);
 assert.throws(()=>settleExperimentalMonth(state,12),/already settled/);
});
