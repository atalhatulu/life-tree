import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';
import {recordNpcActivity,npcActivitySummary,settleNpcActivityYear} from '../src/social/npc_activity_ledger.js';

const weekday=(year,day)=>{
 const date=new Date(0);date.setUTCFullYear(year,0,day);
 return (date.getUTCDay()+6)%7+1;
};
const student=()=>({age:14,alive:true,life:{},personality:{sociability:70}});
function withStudy(){
 const p=student();
 assert.equal(recordNpcActivity(p,{year:2026,dayOfYear:100,weekday:weekday(2026,100),activity:'study'}).status,'recorded');
 return p;
}
function rejectLedger(modify,read=(p)=>npcActivitySummary(p,2026)){
 const p=withStudy();modify(p);const before=structuredClone(p);
 assert.throws(()=>read(p),/Invalid|Mismatched/i);
 assert.deepEqual(p,before);
}

test('saved NPC entries reject mismatched day keys and weekday without mutation',()=>{
 rejectLedger(p=>{p.activityLedger.entries['100'].dayOfYear=101;});
 rejectLedger(p=>{p.activityLedger.entries['100'].weekday=weekday(2026,100)%7+1;});
 rejectLedger(p=>{p.activityLedger.entries['100'].weekday='Friday';});
});
test('saved NPC entries reject invalid or extra activity effects',()=>{
 rejectLedger(p=>{p.activityLedger.entries['100'].effects.academic=NaN;});
 rejectLedger(p=>{p.activityLedger.entries['100'].effects.academic=-0.15;});
 rejectLedger(p=>{p.activityLedger.entries['100'].effects.stress=Infinity;});
 rejectLedger(p=>{p.activityLedger.entries['100'].effects.bonus=1;});
 rejectLedger(p=>{delete p.activityLedger.entries['100'].effects.academic;});
});
test('saved NPC academic/social totals cannot drift from entry effects',()=>{
 rejectLedger(p=>{p.activityLedger.totals.academic=0.2;});
 rejectLedger(p=>{p.activityLedger.totals.social=0.1;});
});
test('saved NPC entries reject impossible leap-day and calendar year',()=>{
 rejectLedger(p=>{p.activityLedger.entries['366']={...p.activityLedger.entries['100'],dayOfYear:366};});
 rejectLedger(p=>{p.activityLedger.year=Number.MAX_SAFE_INTEGER;});
});
test('NPC entry semantics are checked before rollover or settlement',()=>{
 rejectLedger(p=>{p.activityLedger.entries['100'].effects.academic=100;},
  p=>recordNpcActivity(p,{year:2027,dayOfYear:101,weekday:weekday(2027,101),activity:'recover'}));
 rejectLedger(p=>{p.activityLedger.entries['100'].weekday=8;},
  p=>settleNpcActivityYear(p,{year:2026}));
});
test('valid saved leap day and unchanged totals survive validation',()=>{
 const p=student();
 assert.equal(recordNpcActivity(p,{year:2028,dayOfYear:366,weekday:weekday(2028,366),activity:'recover'}).status,'recorded');
 assert.equal(npcActivitySummary(p,2028).days,1);
 assert.equal(settleNpcActivityYear(p,{year:2028}).status,'settled');
});

function partnerState(){
 const state=new Game('partner-cycle90').state;
 state.year=2061;state.player.age=35;
 state.social.romance={id:'partner-1',name:'Deniz',age:34,alive:true,status:'married',
  relationship:75,trust:70,intimacy:65,resentment:15,sharedGoals:65,
  personality:{ambition:55,sociability:60},monthlyIncome:50000,
  jobId:'engineer',job:'Mühendis',life:{careerSatisfaction:50,workStress:30,
   ambition:55,careerYears:1,careerChanges:0,personalSavings:10000,lifeSatisfaction:60}};
 return state;
}
const stableRng={int:()=>0,chance:()=>false,fork(){return this;}};
function assertRollback(rng,prepare=()=>{}){
 const state=partnerState();prepare(state);
 const partner=state.social.romance,before=structuredClone(state);
 assert.throws(()=>processPartnerLifeYear(state,rng),/injected/i);
 assert.strictEqual(state.social.romance,partner,'partner identity should remain stable');
 assert.deepEqual(state,before,'failed annual update should leave state unchanged');
}
test('partner annual processing rolls back after second RNG draw fails',()=>{
 let calls=0;
 assertRollback({int(){if(++calls===2)throw new Error('injected RNG failure');return 0;},fork(){return this;},chance(){return false;}});
 assert.equal(calls,2);
});
test('partner annual processing rolls back if RNG fork fails after goals and routine',()=>{
 assertRollback({int:()=>0,fork(){throw new Error('injected fork failure');},chance:()=>false},state=>{
  state.lifeGoals={active:{id:'career-mastery'}};
  state.social.romance.lifeGoals={active:{id:'career',progress:35},history:[]};
 });
});
test('partner job reroll failure restores job, income, goals and annual counters',()=>{
 assertRollback({
  int:()=>0,chance:()=>true,
  fork(label){
   if(label==='partner-new-job')return {
    weighted:choices=>choices[0].value,
    int(){throw new Error('injected job income failure');}
   };
   return this;
  }
 },state=>{
  state.social.romance.life.careerSatisfaction=0;
  state.social.romance.life.careerYears=3;
 });
});
test('partner annual processing still commits valid year once and replay is unchanged',()=>{
 const state=partnerState();
 processPartnerLifeYear(state,stableRng);
 const before=structuredClone(state);
 assert.equal(state.social.romance.life.lastProcessedYear,2061);
 assert.deepEqual(processPartnerLifeYear(state,{int(){throw Error('unexpected');}}),[]);
 assert.deepEqual(state,before);
});
