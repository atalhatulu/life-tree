import test from 'node:test';
import assert from 'node:assert/strict';
import {processSocialYear} from '../src/social/social_simulation.js';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';

const socialState=()=>({year:2050,player:{age:25,personality:{sociability:60}},social:{friends:[],friendsCreated:0}});
const friend=id=>({id,name:id,surname:'Test',age:25,alive:true,relationship:75,
 personality:{sociability:60},life:{workStability:55,personalStress:25,lifeSatisfaction:55,
 relationshipStatus:'single',movedAway:false,majorEvents:0}});
const friendState=()=>({year:2050,player:{age:25},social:{friends:[friend('first'),friend('second')]}});
const partnerState=()=>({year:2050,player:{age:30},social:{romance:{id:'p',name:'Partner',age:30,alive:true,
 relationship:65,trust:60,intimacy:60,resentment:20,sharedGoals:60,
 personality:{ambition:55,sociability:65},monthlyIncome:50000,jobId:'engineer',
 life:{careerSatisfaction:50,workStress:30,ambition:55,careerYears:1,careerChanges:0,
 personalSavings:10000,lifeSatisfaction:60},
 lifeGoals:{active:{id:'career',progress:40},history:[{id:'family',progress:100}]},
 routine:{week:[{day:1,available:true}],lastYear:2049}}}});
function customRng({failAt=Infinity}={}){
 return {position:0,failAt,
  snapshotState(){return this.position;},restoreState(position){this.position=position;},
  draw(){this.position++;if(this.position===this.failAt)throw Error('injected RNG failure');},
  int(){this.draw();return 0;},chance(){this.draw();return false;},fork(){this.draw();return this;}};
}

test('social custom RNG opt-in checkpoint restores draw position after failure',()=>{
 const state=socialState(),before=structuredClone(state),rng=customRng({failAt:1});
 assert.throws(()=>processSocialYear(state,rng),/injected/);
 assert.deepEqual(state,before);assert.equal(rng.position,0);
});
test('friend custom RNG opt-in checkpoint restores draws and friend state',()=>{
 const state=friendState(),before=structuredClone(state),rng=customRng({failAt:5});
 assert.throws(()=>processFriendLivesYear(state,rng),/injected/);
 assert.deepEqual(state,before);assert.equal(rng.position,0);
});
test('partner custom RNG opt-in checkpoint restores draws and partner state',()=>{
 const state=partnerState(),before=structuredClone(state),rng=customRng({failAt:2});
 assert.throws(()=>processPartnerLifeYear(state,rng),/injected/);
 assert.deepEqual(state,before);assert.equal(rng.position,0);
});
test('custom RNG successful social year commits checkpoint and replay does not snapshot',()=>{
 const state=socialState(),rng=customRng();
 processSocialYear(state,rng);assert.ok(rng.position>0);
 const position=rng.position,before=structuredClone(state);
 rng.snapshotState=()=>{throw Error('unexpected snapshot on replay');};
 assert.deepEqual(processSocialYear(state,rng),[]);
 assert.equal(rng.position,position);assert.deepEqual(state,before);
});
test('incomplete RNG snapshot protocol is rejected before mutation in each annual system',()=>{
 for(const [run,state] of [[processSocialYear,socialState()],[processFriendLivesYear,friendState()],
  [processPartnerLifeYear,partnerState()]]){
  const before=structuredClone(state),rng={snapshotState(){return 0;},fork(){throw Error('draw called');}};
  assert.throws(()=>run(state,rng),/RNG.*snapshot|RNG.*restore|checkpoint/i);
  assert.deepEqual(state,before);
 }
});
test('RNG snapshot failure occurs before mutation in each annual system',()=>{
 for(const [run,state] of [[processSocialYear,socialState()],[processFriendLivesYear,friendState()],
  [processPartnerLifeYear,partnerState()]]){
  const before=structuredClone(state),rng={snapshotState(){throw Error('snapshot failed');},restoreState(){}};
  assert.throws(()=>run(state,rng),/snapshot failed/);
  assert.deepEqual(state,before);
 }
});
test('custom RNG without opt-in protocol remains supported',()=>{
 const state=socialState();
 assert.doesNotThrow(()=>processSocialYear(state,{chance:()=>false}));
 assert.equal(state.social.lastProcessedYear,2050);
});

test('friend preflight rejects invalid later friend age before any RNG draw',()=>{
 const state=friendState(),beforeFriend=state.social.friends[0];state.social.friends[1].age=Number.MAX_SAFE_INTEGER;
 const before=structuredClone(state);
 assert.throws(()=>processFriendLivesYear(state,{fork(){throw Error('RNG consumed');}}),/age|counter|overflow/i);
 assert.deepEqual(state,before);assert.strictEqual(state.social.friends[0],beforeFriend);
});
test('friend preflight rejects malformed later friend score before any RNG draw',()=>{
 for(const field of ['workStability','personalStress','lifeSatisfaction']){
  const state=friendState();state.social.friends[1].life[field]=NaN;
  const before=structuredClone(state);
  assert.throws(()=>processFriendLivesYear(state,{fork(){throw Error('RNG consumed');}}),/invalid|score|NPC/i);
  assert.deepEqual(state,before);
 }
});
test('friend preflight rejects overflowing annual major-event counter',()=>{
 const state=friendState();state.social.friends[1].life.majorEvents=Number.MAX_SAFE_INTEGER;
 const before=structuredClone(state);
 assert.throws(()=>processFriendLivesYear(state,{fork(){throw Error('RNG consumed');}}),/majorEvents|counter|overflow/i);
 assert.deepEqual(state,before);
});
test('friend preflight rejects malformed lifeGoals before annual goal mutation',()=>{
 const state=friendState();state.social.friends[1].lifeGoals={active:{id:'career',progress:NaN},history:[]};
 const before=structuredClone(state);
 assert.throws(()=>processFriendLivesYear(state,{fork(){throw Error('RNG consumed');}}),/goal|progress|invalid/i);
 assert.deepEqual(state,before);
});
test('friend preflight allows missing legacy fields and ignores dead malformed records',()=>{
 const state=friendState();delete state.social.friends[0].life;
 state.social.friends.push({alive:false,life:{personalStress:NaN},age:Infinity});
 const rng={fork(){return {int:()=>0,chance:()=>false};}};
 assert.doesNotThrow(()=>processFriendLivesYear(state,rng));
 assert.equal(state.social.friends[0].life.lastProcessedYear,2050);
 assert.equal(state.social.friends[2].life.personalStress,NaN);
});
test('friend replay does not inspect unrelated invalid scores or consume RNG',()=>{
 const state=friendState();for(const f of state.social.friends){f.life.lastProcessedYear=2050;f.life.personalStress=NaN;}
 const before=structuredClone(state);
 assert.deepEqual(processFriendLivesYear(state,{fork(){throw Error('unexpected');}}),[]);
 assert.deepEqual(state,before);
});

test('partner rollback preserves nested life, goal and routine object identities',()=>{
 const state=partnerState(),p=state.social.romance;
 state.lifeGoals={active:{id:'career-mastery'}};p.lifeGoals.active.id='family';
 const life=p.life,goals=p.lifeGoals,active=goals.active,history=goals.history,
  historyItem=history[0],routine=p.routine,week=routine.week,day=week[0],personality=p.personality;
 const before=structuredClone(state),rng={int:()=>0,chance:()=>false,fork(){throw Error('injected fork');}};
 assert.throws(()=>processPartnerLifeYear(state,rng),/injected fork/);
 assert.deepEqual(state,before);
 for(const [current,original] of [[p.life,life],[p.lifeGoals,goals],[p.lifeGoals.active,active],
  [p.lifeGoals.history,history],[p.lifeGoals.history[0],historyItem],[p.routine,routine],
  [p.routine.week,week],[p.routine.week[0],day],[p.personality,personality]])assert.strictEqual(current,original);
});
test('partner rollback removes newly initialized nested ledgers without replacing root',()=>{
 const state=partnerState(),p=state.social.romance;delete p.life;delete p.lifeGoals;delete p.routine;
 const before=structuredClone(state);
 assert.throws(()=>processPartnerLifeYear(state,{int(){throw Error('injected');}}),/injected/);
 assert.deepEqual(state,before);assert.strictEqual(state.social.romance,p);
});

test('partial legacy NPC life initializes missing counters before random events',()=>{
 const state=friendState(),f=state.social.friends[0];f.life={};
 const rng={fork(){return {int:()=>0,chance:()=>true};}};
 assert.doesNotThrow(()=>processFriendLivesYear(state,rng));
 assert.ok(Number.isSafeInteger(f.life.majorEvents));
 assert.ok(f.life.majorEvents>=1);
 assert.ok(Number.isFinite(f.life.personalStress));
 assert.ok(Number.isFinite(f.life.workStability));
});
test('friend preflight reserves room for multiple annual major events',()=>{
 const state=friendState();state.social.friends[1].life.majorEvents=Number.MAX_SAFE_INTEGER-2;
 const before=structuredClone(state);
 assert.throws(()=>processFriendLivesYear(state,{fork(){throw Error('RNG consumed');}}),/majorEvents|overflow/i);
 assert.deepEqual(state,before);
});
test('failed custom RNG restoration reports both errors, without claiming rollback',()=>{
 const state=socialState(),before=structuredClone(state),rng=customRng({failAt:1});
 rng.restoreState=()=>{throw Error('restore failed');};
 assert.throws(()=>processSocialYear(state,rng),error=>{
  assert.ok(error instanceof AggregateError);
  assert.equal(error.errors.length,2);
  assert.match(error.errors[0].message,/injected/);
  assert.match(error.errors[1].message,/restore failed/);
  return true;
 });
 assert.deepEqual(state,before);
 assert.equal(rng.position,1,'failed restore cannot guarantee RNG rollback');
});
