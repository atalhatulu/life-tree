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
  let found=false;
  for(let i=0;i<60&&!found;i++){
    const session=new ExperimentalYearSession(new Game('pause-'+i),{maxDecisions:2});
    session.start();
    for(let step=0;step<20&&session.phase==='running';step++){
      const item=session.advance();
      if(item.type==='decision'){
        found=true;
        assert.throws(()=>session.advance(),/Resolve/);
        assert.throws(()=>session.choose('invalid-choice-id'),/Unknown|unavailable/);
        assert.equal(session.phase,'waiting');
        session.choose(item.pending.choices[0].id);
      }
    }
  }
  assert.ok(found,'expected at least one seed to produce an event');
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
