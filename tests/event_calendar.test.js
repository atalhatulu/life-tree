import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/core/rng.js';
import {eventWindow,eventTriggerDay,scheduleEventDay} from '../src/experimental/event_calendar.js';
import {scheduleYearPresentation,calendarDate,daysInYear} from '../src/experimental/year_flow_scheduler.js';
test('school starts in August or September, never July',()=>{
 for(let i=0;i<100;i++){
  const year=2027+i,decision={id:'school-start',title:'Okula başlama'};
  const scheduled=scheduleYearPresentation({seed:'school-'+i,year,decision}).timeline.find(e=>e.type==='decision');
  const month=calendarDate(year,scheduled.day).getUTCMonth()+1;
  assert.ok(month===8||month===9);
 }
});
test('explicit event window overrides catalog and leap day is supported',()=>{
 const event={id:'school-start',calendar:{earliest_date:'02-29',latest_date:'02-29'}};
 assert.equal(scheduleEventDay({event,year:2028,rng:new RNG('leap'),totalDays:366}),60);
 assert.throws(()=>eventWindow(event,2027,365),RangeError);
});
test('follow-up cannot be scheduled after its remaining window',()=>{
 const event={id:'school-start'};
 assert.equal(scheduleEventDay({event,year:2027,rng:new RNG('late'),afterDay:300,totalDays:365}),null);
});
test('same seed preserves exact event dates',()=>{
 const args={seed:'stable',year:2028,decision:{id:'after-high-school',title:'Lise sonrası'}};
 assert.deepEqual(scheduleYearPresentation(args),scheduleYearPresentation(args));
});
test('health treatment has an explicit trigger and full-year window',()=>{
 const w=eventWindow({id:'health-treatment'},2028,daysInYear(2028));
 assert.equal(w.trigger,'diagnosed-condition');assert.equal(w.start,1);assert.ok(w.end>=350);
});

test('newly precomputed illness cannot produce an early treatment decision',()=>{
 const event={id:'health-treatment'};
 const trigger=eventTriggerDay(event,{year:2027,yearStartState:{healthProfile:{conditions:[]}}});
 assert.equal(trigger,null);
 assert.equal(scheduleEventDay({event,year:2027,rng:new RNG('new-illness'),totalDays:365,triggerDay:trigger}),null);
});
test('existing diagnosed illness can be treated, dated trigger is respected',()=>{
 const event={id:'health-treatment'};
 const prior={healthProfile:{conditions:[{id:'back-pain',diagnosedOn:'2027-05-12'}]}};
 const trigger=eventTriggerDay(event,{year:2027,yearStartState:prior});
 const day=scheduleEventDay({event,year:2027,rng:new RNG('diagnosis'),totalDays:365,triggerDay:trigger});
 assert.ok(day>=132);
});
