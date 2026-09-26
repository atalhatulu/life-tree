import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ExperimentalYearSession,restoreExperimentalYearSession} from '../src/experimental/year_session.js';
function finish(session){
 for(let steps=0;steps<50&&session.phase!=='complete';steps++){
  const next=session.timeline[session.cursor],target=next?.day??session.snapshot().totalDays;
  while(session.day<target)session.tickDay();
  const item=session.advance();
  if(item.type==='decision')session.choose(item.pending.choices[0].id);
 }
 assert.equal(session.phase,'complete');
 session.commit();
 return session.game.state;
}
test('midyear checkpoint resumes deterministically without duplicate monthly payments',()=>{
 const original=new ExperimentalYearSession(new Game('checkpoint-determinism'),{maxDecisions:3});
 original.start();
 while(original.day<40){const next=original.timeline[original.cursor];if(next&&next.day<=original.day){const item=original.advance();if(item.type==='decision')original.choose(item.pending.choices[0].id);}else original.tickDay();}
 const checkpoint=JSON.parse(JSON.stringify(original.exportCheckpoint()));
 const restored=restoreExperimentalYearSession(Game,checkpoint);
 assert.deepEqual(restored.snapshot(),original.snapshot());
 assert.deepEqual(finish(restored),finish(original));
});
test('paused checkpoint stays paused and can resume',()=>{
 const session=new ExperimentalYearSession(new Game('checkpoint-paused'));session.start();session.pause();
 const restored=restoreExperimentalYearSession(Game,JSON.parse(JSON.stringify(session.exportCheckpoint())));
 assert.equal(restored.phase,'paused');
 assert.throws(()=>restored.tickDay(),/running/);
 restored.resume();restored.tickDay();assert.equal(restored.day,2);
});
test('pending choice survives checkpoint and cannot advance without resolution',()=>{
 const session=new ExperimentalYearSession(new Game('checkpoint-pending'));session.start();
 const decision=session.timeline.find(e=>e.type==='decision');
 if(!decision)return;
 while(session.day<decision.day){const next=session.timeline[session.cursor];if(next&&next.day===session.day)session.advance();else session.tickDay();}
 const item=session.advance();
 if(item.type!=='decision')return;
 const restored=restoreExperimentalYearSession(Game,JSON.parse(JSON.stringify(session.exportCheckpoint())));
 assert.equal(restored.phase,'waiting');
 assert.equal(restored.snapshot().pending.id,item.pending.id);
 assert.throws(()=>restored.tickDay(),/running/);
 restored.choose(restored.snapshot().pending.choices[0].id);
 assert.equal(restored.phase,'running');
});
