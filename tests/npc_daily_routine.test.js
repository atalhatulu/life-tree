import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateNpcRoutineWeek,npcCanMeet} from '../src/social/npc_daily_routine.js';
test('employed adult has weekday work and weekends free when rested',()=>{
 const person={age:30,alive:true,jobId:'cook',personality:{sociability:70},life:{personalStress:20}};
 const routine=simulateNpcRoutineWeek(person,{year:2027});
 assert.equal(routine.pattern,'employed');
 assert.equal(routine.workload,5);
 assert.equal(routine.week[0].duty,'work');
 assert.equal(routine.week[5].duty,'home');
 assert.equal(npcCanMeet(person,6),true);
});
test('job loss changes schedule and stress can suppress weekend meetings',()=>{
 const person={age:35,alive:true,jobId:'cook',life:{personalStress:20,workStability:60}};
 const before=simulateNpcRoutineWeek(person,{year:2027}).availability;
 person.jobId='unemployed';person.life.workStability=20;person.life.personalStress=90;
 const after=simulateNpcRoutineWeek(person,{year:2028});
 assert.equal(after.pattern,'home');
 assert.equal(after.workload,0);
 assert.equal(npcCanMeet(person,6),false);
 assert.notEqual(after.availability,before);
});
test('deceased NPC cannot be scheduled and existing routine remains unchanged',()=>{
 const person={age:55,alive:true,jobId:'cook',life:{personalStress:25}};
 simulateNpcRoutineWeek(person,{year:2027});
 const before=structuredClone(person.routine);
 person.alive=false;
 assert.equal(simulateNpcRoutineWeek(person,{year:2028}),null);
 assert.deepEqual(person.routine,before);
 assert.equal(npcCanMeet(person,6),false);
});
test('same state yields identical weekly routine',()=>{
 const a={age:16,alive:true,life:{}},b=structuredClone(a);
 assert.deepEqual(simulateNpcRoutineWeek(a,{year:2027}),simulateNpcRoutineWeek(b,{year:2027}));
});
