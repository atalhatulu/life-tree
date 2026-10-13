import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processSocialYear} from '../src/social/social_simulation.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';
import {recordNpcActivity,npcActivitySummary,settleNpcActivityYear} from '../src/social/npc_activity_ledger.js';

const weekday=(year,day)=>{
 const date=new Date(0);date.setUTCFullYear(year,0,day);
 return (date.getUTCDay()+6)%7+1;
};
const friend=(id)=>({id,name:id,surname:'Test',alive:true,age:25,yearsKnown:2,relationship:80,
 lastContactAge:24,health:{current:75}});
function socialState(){
 const state=new Game('cycle91-social').state;
 state.year=2050;state.player.age=25;state.player.personality.sociability=60;
 state.social={friends:[friend('one'),friend('two')],friendsCreated:2};
 state.healthProfile={stress:40};state.lateLife={isolation:10};
 return state;
}
function failingSocialRng(failAt,{killFirst=false}={}){
 return {fork(label){if(label===failAt)throw new Error('injected social failure');return this;},
  int:()=>0,chance:()=>killFirst};
}
test('social year restores prior friends and array identities when later friend RNG throws',()=>{
 const state=socialState(),before=structuredClone(state);
 const social=state.social,friends=social.friends,first=friends[0],second=friends[1];
 assert.throws(()=>processSocialYear(state,failingSocialRng('health-two')),/injected/);
 assert.deepEqual(state,before);
 assert.strictEqual(state.social,social);
 assert.strictEqual(state.social.friends,friends);
 assert.strictEqual(friends[0],first);
 assert.strictEqual(friends[1],second);
});
test('social year restores death archives and health consequences after later RNG failure',()=>{
 const state=socialState(),before=structuredClone(state),health=state.healthProfile,late=state.lateLife;
 assert.throws(()=>processSocialYear(state,failingSocialRng('health-two',{killFirst:true})),/injected/);
 assert.deepEqual(state,before);
 assert.strictEqual(state.healthProfile,health);
 assert.strictEqual(state.lateLife,late);
 assert.equal(state.social.deceasedFriends,undefined);
});
test('social rollback preserves existing archive arrays and nested health references',()=>{
 const state=socialState();
 state.social.deceasedFriends=[{id:'old-dead',alive:false}];
 state.social.formerFriends=[{id:'old-former'}];
 const before=structuredClone(state),deceased=state.social.deceasedFriends,
  former=state.social.formerFriends,friendHealth=state.social.friends[0].health;
 assert.throws(()=>processSocialYear(state,failingSocialRng('health-two',{killFirst:true})),/injected/);
 assert.deepEqual(state,before);
 assert.strictEqual(state.social.deceasedFriends,deceased);
 assert.strictEqual(state.social.formerFriends,former);
 assert.strictEqual(state.social.friends[0].health,friendHealth);
});
test('social year restores prior state when new friend generation fails',()=>{
 const state=socialState();state.social.friends=[friend('one')];
 const before=structuredClone(state);
 assert.throws(()=>processSocialYear(state,{
  fork(label){if(label==='friend-2050-3')throw Error('injected friend creation');return {int:()=>0,chance:()=>false};},
  chance:()=>true
 }),/injected/);
 assert.deepEqual(state,before);
});
test('social year removes newly initialized social ledger on failure',()=>{
 const state=socialState();delete state.social;
 const before=structuredClone(state);
 assert.throws(()=>processSocialYear(state,{chance(){throw Error('injected chance');}}),/injected/);
 assert.deepEqual(state,before);
});
test('social year still commits once and replay consumes no RNG',()=>{
 const state=socialState();
 const rng={fork(){return this;},int:()=>0,chance:()=>false};
 processSocialYear(state,rng);
 const before=structuredClone(state);
 assert.deepEqual(processSocialYear(state,{chance(){throw Error('unexpected');}}),[]);
 assert.deepEqual(state,before);
});
const student=()=>({age:14,alive:true,life:{},personality:{sociability:70}});
const add=(p,year,day=100,activity='study')=>recordNpcActivity(p,{year,dayOfYear:day,weekday:weekday(year,day),activity});
function withHistory(){const p=student();add(p,2026);add(p,2027,101,'recover');return p;}
function assertHistoryRejected(mutate,call){
 const p=withHistory();mutate(p);const before=structuredClone(p);
 assert.throws(()=>call(p),/Invalid|Mismatched|history|duplicate|future/i);
 assert.deepEqual(p,before);
}
test('NPC history validates all saved years, not only requested year',()=>{
 assertHistoryRejected(p=>{p.activityLedgerHistory['2026'].entries['100'].weekday=9;},p=>npcActivitySummary(p,2027));
 assertHistoryRejected(p=>{p.activityLedgerHistory['2026'].totals.academic=10;},p=>add(p,2028,101,'recover'));
});
test('NPC history rejects mismatched, noncanonical and future year keys',()=>{
 assertHistoryRejected(p=>{p.activityLedgerHistory['2025']=p.activityLedgerHistory['2026'];},p=>npcActivitySummary(p,2027));
 assertHistoryRejected(p=>{p.activityLedgerHistory['02026']=p.activityLedgerHistory['2026'];},p=>npcActivitySummary(p,2027));
 assertHistoryRejected(p=>{p.activityLedgerHistory['2028']={...p.activityLedgerHistory['2026'],year:2028};},p=>npcActivitySummary(p,2027));
});
test('NPC history rejects unsafe year keys and malformed unrelated ledgers',()=>{
 assertHistoryRejected(p=>{p.activityLedgerHistory['9007199254740993']=p.activityLedgerHistory['2026'];},
  p=>npcActivitySummary(p,2027));
 assertHistoryRejected(p=>{p.activityLedgerHistory['2025']={year:2025,entries:[],totals:{academic:0,social:0,stress:0}};},
  p=>npcActivitySummary(p,2027));
});
test('NPC history rejects duplicate current-year ledgers before settlement',()=>{
 assertHistoryRejected(p=>{p.activityLedgerHistory['2027']=structuredClone(p.activityLedger);},p=>settleNpcActivityYear(p,{year:2027}));
});
test('valid multi-year NPC history remains readable and settleable',()=>{
 const p=withHistory();add(p,2028,102,'recover');
 assert.equal(npcActivitySummary(p,2026).days,1);
 assert.equal(npcActivitySummary(p,2027).days,1);
 assert.equal(npcActivitySummary(p,2028).days,1);
 assert.equal(settleNpcActivityYear(p,{year:2026}).status,'settled');
});
function partnerState(){
 const state=new Game('cycle91-partner').state;
 state.year=2061;state.player.age=35;
 state.social.romance={id:'partner-1',name:'Deniz',age:34,alive:true,status:'married',
  relationship:75,trust:70,intimacy:65,resentment:15,sharedGoals:65,
  personality:{ambition:55,sociability:60},monthlyIncome:50000,
  jobId:'engineer',job:'Mühendis',life:{careerSatisfaction:50,workStress:30,
   ambition:55,careerYears:1,careerChanges:0,personalSavings:10000,lifeSatisfaction:60}};
 return state;
}
test('partner annual rollback restores native RNG draw position',()=>{
 const state=partnerState(),before=structuredClone(state);
 const rng=new RNG('cycle91-native-rng'),initial=rng.state;
 const int=rng.int.bind(rng);let calls=0;
 rng.int=(min,max)=>{const value=int(min,max);if(++calls===2)throw Error('injected after RNG draw');return value;};
 assert.throws(()=>processPartnerLifeYear(state,rng),/injected/);
 assert.deepEqual(state,before);
 assert.equal(rng.state,initial);
});
test('successful partner annual pass retains RNG advancement',()=>{
 const state=partnerState(),rng=new RNG('cycle91-native-rng'),initial=rng.state;
 processPartnerLifeYear(state,rng);
 assert.notEqual(rng.state,initial);
});
