import test from 'node:test';
import assert from 'node:assert/strict';
import {recordNpcActivity,npcActivitySummary} from '../src/social/npc_activity_ledger.js';
const wd=(year,day)=>(new Date(Date.UTC(year,0,day)).getUTCDay()+6)%7+1;
const student=()=>({age:14,alive:true,life:{},personality:{sociability:70}});
test('school study is eligible only in term and cannot be duplicated',()=>{
 const p=student();
 assert.equal(recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:wd(2026,100),activity:'study'}).status,'recorded');
 assert.equal(recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:wd(2026,100),activity:'study'}).status,'already-recorded');
 assert.equal(recordNpcActivity(p,{year:2026,dayOfYear:190,weekday:wd(2026,190),activity:'study'}).status,'not-eligible');
 assert.equal(npcActivitySummary(p,2026).days,1);
});
test('summer socializing is possible and activity ledger does not alter annual stats',()=>{
 const p={...student(),education:{grade:50},social:{friends:2}};
 assert.equal(recordNpcActivity(p,{year:2026,dayOfYear:190,weekday:wd(2026,190),activity:'socialize'}).status,'recorded');
 assert.deepEqual(p.education,{grade:50});
 assert.deepEqual(p.social,{friends:2});
 assert.ok(npcActivitySummary(p,2026).totals.social>0);
});
test('year rollover resets totals, deceased NPC cannot act',()=>{
 const p=student();
 recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:wd(2026,100),activity:'study'});
 recordNpcActivity(p,{year:2027,dayOfYear:101,weekday:wd(2027,101),activity:'recover'});
 assert.equal(npcActivitySummary(p,2026).days,1);
 assert.equal(npcActivitySummary(p,2027).days,1);
 p.alive=false;
 assert.equal(recordNpcActivity(p,{year:2027,dayOfYear:102,weekday:wd(2027,102),activity:'recover'}).status,'unavailable');
});

import {settleNpcActivityYear} from '../src/social/npc_activity_ledger.js';
test('settlement supplements annual gains without double counting',()=>{
 const p=student();
 for(let day=190;day<200;day++)recordNpcActivity(p,{year:2026,dayOfYear:day,weekday:wd(2026,day),activity:'socialize'});
 const first=settleNpcActivityYear(p,{year:2026,annualGains:{social:0.5,academic:0}});
 assert.equal(first.status,'settled');
 assert.ok(Math.abs(first.deltas.social-0.7)<1e-8);
 assert.deepEqual(settleNpcActivityYear(p,{year:2026}).deltas,{academic:0,social:0});
});
test('annual gains larger than daily contributions produce no additional gain',()=>{
 const p=student();
 recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:wd(2026,100),activity:'study'});
 assert.equal(settleNpcActivityYear(p,{year:2026,annualGains:{academic:3}}).deltas.academic,0);
});
test('invalid annual gains do not settle ledger',()=>{
 const p=student();
 recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:wd(2026,100),activity:'study'});
 assert.throws(()=>settleNpcActivityYear(p,{year:2026,annualGains:{academic:-1}}),RangeError);
 assert.equal(settleNpcActivityYear(p,{year:2026}).status,'settled');
});

test('prior year remains available for settlement after rollover',()=>{
 const p=student();
 recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:wd(2026,100),activity:'study'});
 recordNpcActivity(p,{year:2027,dayOfYear:100,weekday:wd(2027,100),activity:'recover'});
 assert.equal(settleNpcActivityYear(p,{year:2026}).status,'settled');
 assert.equal(settleNpcActivityYear(p,{year:2026}).status,'already-settled');
 assert.equal(npcActivitySummary(p,2027).days,1);
 assert.throws(()=>recordNpcActivity(p,{year:2026,dayOfYear:102,weekday:wd(2026,102),activity:'study'}),RangeError);
});
test('calendar input rejects impossible dates and weekdays',()=>{
 const p=student();
 assert.throws(()=>recordNpcActivity(p,{year:2026,dayOfYear:366,weekday:wd(2026,366),activity:'study'}),RangeError);
 assert.throws(()=>recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:8,activity:'study'}),RangeError);
});


test('settled year rejects late entries without changing totals',()=>{
 const p={age:12,alive:true,life:{personalStress:20}};
 const weekday=(new Date(Date.UTC(2028,0,3)).getUTCDay()+6)%7+1;
 recordNpcActivity(p,{year:2028,dayOfYear:3,weekday,activity:'study'});
 settleNpcActivityYear(p,{year:2028,annualGains:{academic:0,social:0}});
 const before=npcActivitySummary(p,2028);
 const later=(new Date(Date.UTC(2028,0,4)).getUTCDay()+6)%7+1;
 assert.equal(recordNpcActivity(p,{year:2028,dayOfYear:4,weekday:later,activity:'study'}).status,'year-settled');
 assert.deepEqual(npcActivitySummary(p,2028),before);
});

test('mismatched weekday is rejected to prevent impossible NPC schedules',()=>{
 const p=student();const actual=wd(2028,101);
 assert.throws(()=>recordNpcActivity(p,{year:2028,dayOfYear:101,weekday:actual%7+1,activity:'recover'}),RangeError);
});
