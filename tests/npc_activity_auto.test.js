import test from 'node:test';
import assert from 'node:assert/strict';
import {generateNpcYearActivities} from '../src/social/npc_activity_auto.js';
import {npcActivitySummary,settleNpcActivityYear} from '../src/social/npc_activity_ledger.js';
const make=(age=12)=>({age,alive:true,personality:{sociability:65},life:{personalStress:20}});
test('13: representative year automatically generates bounded activities',()=>{
 const p=make();const r=generateNpcYearActivities(p,{year:2028});
 assert.ok(r.recorded>=52&&r.recorded<=53);
 assert.equal(npcActivitySummary(p,2028).days,r.recorded);
});
test('14: school academic activity is present only in school term',()=>{
 const p=make();generateNpcYearActivities(p,{year:2028});
 const entries=Object.values(p.activityLedger.entries);
 assert.ok(entries.some(e=>e.activity==='study'));
 assert.ok(entries.some(e=>e.dayOfYear>=170&&e.dayOfYear<258&&e.activity!=='study'));
});
test('15: adults do not gain academic credit from school',()=>{
 const p=make(35);generateNpcYearActivities(p,{year:2028});
 assert.equal(npcActivitySummary(p,2028).totals.academic,0);
});
test('16: repeat generation and settlement never duplicate gains',()=>{
 const p=make();generateNpcYearActivities(p,{year:2028});
 const before=npcActivitySummary(p,2028);const again=generateNpcYearActivities(p,{year:2028});
 assert.equal(again.recorded,0);assert.deepEqual(npcActivitySummary(p,2028),before);
 assert.equal(settleNpcActivityYear(p,{year:2028,annualGains:{academic:1,social:1}}).status,'settled');
 assert.equal(settleNpcActivityYear(p,{year:2028,annualGains:{academic:1,social:1}}).status,'already-settled');
});
test('17: year rollover preserves previous totals and blocks deceased activity',()=>{
 const p=make();generateNpcYearActivities(p,{year:2028});const before=npcActivitySummary(p,2028);
 generateNpcYearActivities(p,{year:2029});assert.deepEqual(npcActivitySummary(p,2028),before);
 p.alive=false;assert.equal(generateNpcYearActivities(p,{year:2030}).recorded,0);
});

test('representative sampling covers weekdays and weekends without duplicate days',()=>{
 const p=make(12);generateNpcYearActivities(p,{year:2028});
 const entries=Object.values(p.activityLedger.entries);
 assert.ok(entries.some(e=>e.weekday<=5&&e.activity==='study'));
 assert.ok(entries.some(e=>e.weekday>=6));
 assert.equal(new Set(entries.map(e=>e.dayOfYear)).size,entries.length);
});

for(const anchorDay of [1,2,3,4,5,6,7]){
 test(`weekend sampling remains valid for anchor ${anchorDay}`,()=>{
  const p=make(12);generateNpcYearActivities(p,{year:2028,anchorDay});
  const entries=Object.values(p.activityLedger.entries);
  assert.ok(entries.some(e=>e.weekday>=6), 'weekend sample required');
  assert.ok(entries.some(e=>e.weekday<=5), 'weekday sample required');
  assert.equal(new Set(entries.map(e=>e.dayOfYear)).size,entries.length);
 });
}
