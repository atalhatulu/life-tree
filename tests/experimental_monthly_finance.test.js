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
