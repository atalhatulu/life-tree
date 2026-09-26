import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ExperimentalYearSession} from '../src/experimental/year_session.js';

test('experimental session leaves live game untouched until explicit commit',()=>{
  const game=new Game('session-isolation');
  const state=structuredClone(game.state),rng=game.rng.state;
  const session=new ExperimentalYearSession(game,{maxDecisions:2});
  session.start();
  assert.deepEqual(game.state,state);
  assert.equal(game.rng.state,rng);
  assert.throws(()=>session.commit(),/Complete/);
  let steps=0;
  while(session.phase!=='complete'&&steps++<30){
    const next=session.timeline[session.cursor];
    const target=next?.day??session.snapshot().totalDays;
    while(session.day<target)session.tickDay();
    const item=session.advance();
    if(item.type==='decision')session.choose(item.pending.choices[0].id);
  }
  assert.equal(session.phase,'complete');
  assert.deepEqual(game.state,state);
  session.commit();
  assert.equal(game.state.year,state.year+1);
  assert.equal(game.state.player.age,state.player.age+1);
});
test('a pending decision blocks calendar progression and invalid choices do not resolve it',()=>{
  const session=new ExperimentalYearSession(new Game('pause-test'),{maxDecisions:1});
  session.start();
  // Inject a deterministic fixture: newborn years may legitimately have no event.
  const fixture={id:'experiment-pause-fixture',title:'Test kararı',
    choices:[{id:'accept',label:'Kabul et',result:'Karar uygulandı.'}]};
  session.preview.events.events.push(fixture);
  session.timeline=[{type:'decision',day:100,id:fixture.id,title:fixture.title}];
  session.cursor=0;
  assert.throws(()=>session.advance(),/scheduled day/);
  while(session.day<100)session.tickDay();
  const item=session.advance();
  assert.equal(item.type,'decision');
  assert.throws(()=>session.tickDay(),/running/);
  assert.throws(()=>session.advance(),/Resolve/);
  assert.throws(()=>session.choose('invalid-choice-id'),/Unknown|unavailable/);
  assert.equal(session.phase,'waiting');
  session.choose(item.pending.choices[0].id);
  assert.equal(session.phase,'running');
});
test('same seed and same decisions reproduce identical annual preview',()=>{
  const play=()=>{
    const session=new ExperimentalYearSession(new Game('repro-session'),{maxDecisions:3});
    session.start();
    const log=[];
    for(let step=0;step<40&&session.phase!=='complete';step++){
      const item=session.advance();
      log.push([item.type,item.day,item.pending?.id??null]);
      if(item.type==='decision')session.choose(item.pending.choices[0].id);
    }
    assert.equal(session.phase,'complete');
    return {log,state:session.preview.state};
  };
  assert.deepEqual(play(),play());
});

test('calendar pause, resume, month boundaries, and single commit',()=>{
  const game=new Game('calendar-month-boundaries');
  const session=new ExperimentalYearSession(game);
  session.start();
  session.timeline=[];session.cursor=0;
  assert.equal(session.snapshot().isoDate,'2027-01-01');
  session.pause();
  assert.throws(()=>session.tickDay(),/running/);
  assert.throws(()=>session.advance(),/Resume/);
  session.resume();
  for(let i=0;i<58;i++)session.tickDay();
  assert.equal(session.snapshot().isoDate,'2027-02-28');
  session.tickDay();
  assert.equal(session.snapshot().isoDate,'2027-03-01');
  while(session.day<365)session.tickDay();
  assert.equal(session.snapshot().isoDate,'2027-12-31');
  assert.throws(()=>session.tickDay(),/completion/);
  assert.equal(session.advance().type,'complete');
  session.commit();
  assert.throws(()=>session.commit(),/already committed/);
});
