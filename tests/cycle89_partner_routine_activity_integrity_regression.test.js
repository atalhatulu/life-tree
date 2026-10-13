import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';
import {simulateNpcRoutineWeek,npcDaySchedule} from '../src/social/npc_daily_routine.js';
import {recordNpcActivity,npcActivitySummary,settleNpcActivityYear} from '../src/social/npc_activity_ledger.js';

const noRng={int:()=>0,chance:()=>false,fork(){return this;}};
const trapRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const weekday=(year,day)=>(new Date(Date.UTC(year,0,day)).getUTCDay()+6)%7+1;
function partnerState(){
 const s=new Game('partner-89').state;
 s.year=2061;s.player.age=35;
 s.social.romance={id:'partner-1',name:'Deniz',age:34,alive:true,status:'married',
  relationship:75,trust:70,intimacy:65,resentment:15,sharedGoals:65,
  personality:{ambition:55,sociability:60},monthlyIncome:50000,
  jobId:'engineer',job:'Mühendis',life:{careerSatisfaction:50,workStress:30,
   ambition:55,careerYears:1,careerChanges:0,personalSavings:10000,lifeSatisfaction:60}};
 return s;
}
function rejectPartner(modify,pattern=/Invalid|overflow|earlier/i){
 const s=partnerState();modify(s);const before=structuredClone(s);
 assert.throws(()=>processPartnerLifeYear(s,trapRng),pattern);
 assert.deepEqual(s,before);
}
function npc(){return {age:30,alive:true,jobId:'engineer',life:{workStress:25},personality:{sociability:60}};}
function rejectRoutine(modify,options={year:2061},pattern=/Invalid/i){
 const p=npc();modify(p);const before=structuredClone(p);
 assert.throws(()=>simulateNpcRoutineWeek(p,options),pattern);
 assert.deepEqual(p,before);
}
function student(){return {age:14,alive:true,life:{},personality:{sociability:70}};}
function ledgerPerson(){
 const p=student();recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:weekday(2026,100),activity:'study'});
 return p;
}

test('partner life preflight rejects malformed late financial, score and counter fields without RNG or writes',()=>{
 for(const [field,value] of [
  ['workStress',NaN],['careerSatisfaction','50'],['lifeSatisfaction',101],['ambition',-1],
  ['careerYears',Number.MAX_SAFE_INTEGER],['careerChanges',-2],['personalSavings',Infinity],
  ['personalSavings',-10],['personalSavings',1.5],
  ['personalSavings',Number.MAX_SAFE_INTEGER-1000]
 ])rejectPartner(s=>{s.social.romance.life[field]=value;});
 for(const value of [NaN,-1,'50000',1000000001])
  rejectPartner(s=>{s.social.romance.monthlyIncome=value;});
});
test('partner life validates relationship and personality signals before updating career',()=>{
 for(const field of ['relationship','trust','intimacy','resentment','sharedGoals'])
  rejectPartner(s=>{s.social.romance[field]=NaN;});
 for(const field of ['ambition','sociability','patience'])
  rejectPartner(s=>{s.social.romance.personality[field]=Infinity;});
});
test('partner goal and routine corruption cannot partially advance a year',()=>{
 for(const value of ['broken',[],{history:'invalid'},
  {active:{id:'unknown',progress:35},history:[]},
  {active:{id:'career',progress:NaN},history:[]}])
  rejectPartner(s=>{s.social.romance.lifeGoals=value;});
 for(const value of ['broken',[],{week:'bad'},{week:[null]}])
  rejectPartner(s=>{s.social.romance.routine=value;});
 rejectPartner(s=>{s.social.romance.lastGoalAlignmentProcessedYear=2062;},/earlier/i);
});
test('partial legacy partner life gets finite defaults and annual marker',()=>{
 const s=partnerState();s.social.romance.life={careerSatisfaction:50};
 processPartnerLifeYear(s,noRng);
 const p=s.social.romance;
 assert.ok(Number.isFinite(p.life.workStress));
 assert.ok(Number.isFinite(p.life.personalSavings));
 assert.ok(Number.isFinite(p.life.lifeSatisfaction));
 assert.equal(p.life.careerYears,1);
 assert.equal(p.life.lastProcessedYear,2061);
});
test('partner replay does not validate or mutate corrupted legacy fields',()=>{
 const s=partnerState();s.social.romance.life.lastProcessedYear=2061;
 s.social.romance.life.workStress=NaN;const before=structuredClone(s);
 assert.deepEqual(processPartnerLifeYear(s,trapRng),[]);
 assert.deepEqual(s,before);
});

test('NPC routine refuses malformed age, stress and social signals before creating a routine',()=>{
 for(const [path,value] of [
  ['age',NaN],['age',-1],['life.workStress',NaN],['life.personalStress',101],
  ['life.workStability','55'],['personality.sociability',Infinity],
  ['life.movedAway','yes']
 ])rejectRoutine(p=>{
  if(path.includes('.')){const [part,field]=path.split('.');p[part][field]=value;}
  else p[path]=value;
 });
 for(const value of [[],false,'bad'])rejectRoutine(p=>{p.life=value;});
});
test('NPC routine refuses malformed existing weekly ledger without overwriting it',()=>{
 for(const value of ['broken',[],{week:'bad'},{week:[null]}])
  rejectRoutine(p=>{p.routine=value;});
});
test('NPC weekly routine validates school calendar before creating routine',()=>{
 rejectRoutine(()=>{}, {year:2061,dayOfYear:367},/Invalid/i);
});
test('NPC daily routine rejects bad context without changing person',()=>{
 const p=npc();p.life.workStress=NaN;const before=structuredClone(p);
 assert.throws(()=>npcDaySchedule(p,{dayOfYear:100,weekday:2}),/Invalid/i);
 assert.deepEqual(p,before);
});
test('valid old NPC without life or routine still receives deterministic schedule',()=>{
 const p={age:30,alive:true};const routine=simulateNpcRoutineWeek(p,{year:2061});
 assert.equal(routine.week.length,7);
 assert.ok(Number.isFinite(routine.availability));
});
test('deceased NPC keeps saved routine untouched',()=>{
 const p=npc();p.alive=false;p.routine='legacy-invalid';
 assert.equal(simulateNpcRoutineWeek(p,{year:2061}),null);
 assert.equal(p.routine,'legacy-invalid');
});

test('NPC daily activity rejects corrupted totals before recording a new day',()=>{
 for(const [field,value] of [['academic',NaN],['social',Infinity],['stress',20],['academic','0']]){
  const p=ledgerPerson();p.activityLedger.totals[field]=value;const before=structuredClone(p);
  assert.throws(()=>recordNpcActivity(p,{year:2026,dayOfYear:101,weekday:weekday(2026,101),activity:'recover'}),/Invalid/i);
  assert.deepEqual(p,before);
 }
});
test('NPC daily activity rejects invalid entries and history before rollover',()=>{
 for(const ledger of [{year:2026,entries:null,totals:{}},
  {year:2026,entries:{100:null},totals:{academic:0,social:0,stress:0}},
  {year:'2026',entries:{},totals:{academic:0,social:0,stress:0}}]){
  const p=ledgerPerson();p.activityLedger=ledger;const before=structuredClone(p);
  assert.throws(()=>recordNpcActivity(p,{year:2027,dayOfYear:100,weekday:weekday(2027,100),activity:'recover'}),/Invalid/i);
  assert.deepEqual(p,before);
 }
 for(const value of ['bad',[],{'2027':{year:2026,entries:{},totals:{academic:0,social:0,stress:0}}}]){
  const p=ledgerPerson();p.activityLedgerHistory=value;const before=structuredClone(p);
  assert.throws(()=>recordNpcActivity(p,{year:2027,dayOfYear:100,weekday:weekday(2027,100),activity:'recover'}),/Invalid|Mismatched/i);
  assert.deepEqual(p,before);
 }
});
test('NPC activity settlement rejects corrupted totals without settling',()=>{
 const p=ledgerPerson();p.activityLedger.totals.social=NaN;const before=structuredClone(p);
 assert.throws(()=>settleNpcActivityYear(p,{year:2026}),/Invalid/i);
 assert.deepEqual(p,before);
});
test('NPC activity summary rejects malformed persisted entries',()=>{
 const p=ledgerPerson();p.activityLedger.entries['999']={activity:'study',effects:{academic:.15}};
 assert.throws(()=>npcActivitySummary(p,2026),/Invalid/i);
});
test('valid daily activity rollover, summary and settlement remain intact',()=>{
 const p=ledgerPerson();
 assert.equal(recordNpcActivity(p,{year:2027,dayOfYear:101,weekday:weekday(2027,101),activity:'recover'}).status,'recorded');
 assert.equal(npcActivitySummary(p,2026).days,1);
 assert.equal(npcActivitySummary(p,2027).days,1);
 assert.equal(settleNpcActivityYear(p,{year:2026}).status,'settled');
});
