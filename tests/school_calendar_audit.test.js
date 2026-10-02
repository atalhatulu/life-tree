import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolSeason,schoolCalendarNotices,SCHOOL_DATES} from '../src/life/school_calendar.js';
import {npcDaySchedule,simulateNpcRoutineWeek} from '../src/social/npc_daily_routine.js';
test('school year transitions and age boundaries',()=>{
 assert.equal(schoolSeason(169),'term');assert.equal(schoolSeason(170),'summer');
 assert.equal(schoolSeason(257),'summer');assert.equal(schoolSeason(258),'term');
 assert.equal(schoolSeason(25),'midyear-break');
 assert.deepEqual(schoolCalendarNotices(5),[]);assert.deepEqual(schoolCalendarNotices(18),[]);
 assert.deepEqual(schoolCalendarNotices(12).map(x=>x.day),[20,35,170,258]);
 assert.throws(()=>schoolSeason(0),RangeError);
});
test('student does not attend school in summer, weekends or midyear break',()=>{
 const student={age:13,alive:true,life:{personalStress:20}};
 assert.equal(npcDaySchedule(student,{dayOfYear:100,weekday:2}).duty,'school');
 assert.equal(npcDaySchedule(student,{dayOfYear:190,weekday:2}).duty,'home');
 assert.equal(npcDaySchedule(student,{dayOfYear:25,weekday:2}).duty,'home');
 assert.equal(npcDaySchedule(student,{dayOfYear:100,weekday:6}).duty,'home');
});
test('adult work is unaffected by school holiday and deceased NPC unavailable',()=>{
 const adult={age:34,alive:true,jobId:'cook',life:{personalStress:20}};
 assert.equal(npcDaySchedule(adult,{dayOfYear:190,weekday:2}).duty,'work');
 assert.equal(npcDaySchedule({...adult,alive:false},{dayOfYear:190,weekday:2}).available,false);
});


test('weekly student routine respects summer and midyear break while adults keep working',()=>{
 const pupil={age:12,alive:true,life:{personalStress:20},personality:{sociability:60}};
 const worker={age:35,alive:true,jobId:'teacher-independent-job',life:{personalStress:20}};
 const term=simulateNpcRoutineWeek(pupil,{year:2028,dayOfYear:100});
 assert.equal(term.workload,5);
 const summer=simulateNpcRoutineWeek(pupil,{year:2028,dayOfYear:190});
 assert.equal(summer.workload,0);
 assert.equal(summer.pattern,'student-break');
 assert.equal(simulateNpcRoutineWeek(pupil,{year:2028,dayOfYear:25}).workload,0);
 assert.equal(simulateNpcRoutineWeek(worker,{year:2028,dayOfYear:190}).workload,5);
});

test('weekly routine rejects invalid day of year instead of silently misclassifying',()=>{
 assert.throws(()=>simulateNpcRoutineWeek({age:12,alive:true},{dayOfYear:367}),RangeError);
});
