import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {daysInYear,calendarDate,scheduleYearPresentation} from '../src/experimental/year_flow_scheduler.js';

test('calendar handles leap years and rejects invalid days',()=>{
  assert.equal(daysInYear(2028),366);
  assert.equal(daysInYear(2100),365);
  assert.equal(daysInYear(2000),366);
  assert.equal(calendarDate(2028,60).toISOString().slice(0,10),'2028-02-29');
  assert.throws(()=>calendarDate(2027,366),RangeError);
});
test('same seed and events yield identical chronological schedule',()=>{
  const args={seed:'test-seed',year:2028,history:[{text:'Aile haberi'},{text:'İş değişikliği'}],decision:{id:'holiday',title:'Yaz tatili'}};
  const a=scheduleYearPresentation(args);
  assert.deepEqual(a,scheduleYearPresentation(args));
  assert.equal(a.totalDays,366);
  assert.ok(a.timeline.every(e=>e.day>=1&&e.day<=366));
  assert.ok(a.timeline.every((e,i)=>i===0||a.timeline[i-1].day<=e.day));
  assert.ok(a.timeline.find(e=>e.type==='decision').day>=165);
  assert.ok(a.timeline.find(e=>e.type==='decision').day<=200);
});
test('scheduling does not mutate game state or its RNG',()=>{
  const game=new Game('isolation-test');
  const before=structuredClone(game.state);
  const rngState=game.rng.state;
  scheduleYearPresentation({seed:game.seedText,year:game.state.year+1,history:game.state.history,decision:{title:'Okul açılıyor'}});
  assert.deepEqual(game.state,before);
  assert.equal(game.rng.state,rngState);
});
test('one decision only and no invented choices',()=>{
  const schedule=scheduleYearPresentation({seed:'simple',year:2027,history:[{text:'Haber'}],decision:{id:'real-event',title:'Bir karar'}});
  assert.equal(schedule.timeline.filter(e=>e.type==='decision').length,1);
  assert.equal(schedule.timeline.find(e=>e.type==='decision').id,'real-event');
  assert.equal(schedule.timeline.filter(e=>e.type==='notice').length,1);
});
