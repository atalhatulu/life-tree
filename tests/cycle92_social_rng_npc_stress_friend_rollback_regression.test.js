import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/core/rng.js';
import {processSocialYear} from '../src/social/social_simulation.js';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
import {recordNpcActivity,npcActivitySummary,settleNpcActivityYear} from '../src/social/npc_activity_ledger.js';

const weekday=(year,day)=>{const date=new Date(0);date.setUTCFullYear(year,0,day);return (date.getUTCDay()+6)%7+1;};
const socialState=()=>({year:2050,player:{age:25,personality:{sociability:60}},social:{friends:[],friendsCreated:0}});

test('social native RNG draw and state are rolled back after throwing chance',()=>{
 const state=socialState(),before=structuredClone(state),rng=new RNG('cycle92-social'),start=rng.state;
 rng.chance=function(){this.next();throw Error('injected social chance');};
 assert.throws(()=>processSocialYear(state,rng),/injected/);
 assert.deepEqual(state,before);
 assert.equal(rng.state,start);
});
test('social native RNG draw is restored if friend creation fork throws',()=>{
 const state=socialState(),before=structuredClone(state),rng=new RNG('cycle92-social-fork'),start=rng.state;
 rng.chance=function(){this.next();return true;};
 rng.fork=function(){throw Error('injected social fork');};
 assert.throws(()=>processSocialYear(state,rng),/injected/);
 assert.deepEqual(state,before);
 assert.equal(rng.state,start);
});
test('social successful native RNG pass commits its draw and replay is inert',()=>{
 const state=socialState(),rng=new RNG('cycle92-social-success'),start=rng.state;
 rng.chance=function(){this.next();return false;};
 processSocialYear(state,rng);
 assert.notEqual(rng.state,start);
 const committed=rng.state,before=structuredClone(state);
 assert.deepEqual(processSocialYear(state,rng),[]);
 assert.equal(rng.state,committed);
 assert.deepEqual(state,before);
});

const student=()=>({age:14,alive:true,life:{},personality:{sociability:70}});
function add(person,year,day,activity){return recordNpcActivity(person,{year,dayOfYear:day,weekday:weekday(year,day),activity});}
function stressSequence(reverse=false){
 const p=student(),days=[];
 for(let day=40;day<=155;day++)if(weekday(2026,day)<=5)days.push([day,'study']);
 for(let day=190;day<=300;day++)days.push([day,'recover']);
 if(reverse)days.reverse();
 for(const [day,activity] of days)assert.equal(add(p,2026,day,activity).status,'recorded');
 return p;
}
test('NPC stress totals are chronological and independent of insertion order',()=>{
 const forward=stressSequence(),reverse=stressSequence(true);
 assert.equal(forward.activityLedger.stressOrder,'calendar');
 assert.equal(reverse.activityLedger.stressOrder,'calendar');
 assert.equal(forward.activityLedger.totals.stress,reverse.activityLedger.totals.stress);
 assert.equal(forward.activityLedger.totals.stress,-12);
 assert.deepEqual(npcActivitySummary(forward,2026).totals,npcActivitySummary(reverse,2026).totals);
});
test('NPC canonical stress marker detects tampered totals without settling',()=>{
 const p=student();add(p,2026,190,'recover');
 p.activityLedger.totals.stress=0;
 const before=structuredClone(p);
 assert.throws(()=>npcActivitySummary(p,2026),/stress|coherence/i);
 assert.throws(()=>settleNpcActivityYear(p,{year:2026}),/stress|coherence/i);
 assert.deepEqual(p,before);
});
test('NPC invalid stress-order metadata is rejected',()=>{
 const p=student();add(p,2026,190,'recover');p.activityLedger.stressOrder='random';
 assert.throws(()=>npcActivitySummary(p,2026),/stress|order|invalid/i);
});
test('NPC legacy stress ledger remains readable and normalizes on new activity',()=>{
 const p=student();add(p,2026,190,'recover');
 delete p.activityLedger.stressOrder;
 p.activityLedger.totals.stress=9; // Legacy insertion-order total: bounded but not canonical.
 assert.equal(npcActivitySummary(p,2026).totals.stress,9);
 assert.equal(add(p,2026,191,'recover').status,'recorded');
 assert.equal(p.activityLedger.stressOrder,'calendar');
 assert.ok(Math.abs(p.activityLedger.totals.stress-(-.36))<1e-9);
});

const friend=id=>({id,name:id,surname:'Test',age:25,alive:true,relationship:80,
 personality:{sociability:65},life:{workStability:55,personalStress:25,lifeSatisfaction:55,
 relationshipStatus:'single',movedAway:false,majorEvents:0}});
const friendState=()=>({year:2050,player:{age:25},social:{friends:[friend('one'),friend('two')]}});
const failingFriendRng=()=>({fork(label){if(label==='two-stress')throw Error('injected friend failure');
 return {int:()=>0,chance:()=>false};}});
test('friend year restores all earlier friends after a later RNG exception',()=>{
 const state=friendState(),before=structuredClone(state),friends=state.social.friends,
 first=friends[0],second=friends[1],firstLife=first.life;
 assert.throws(()=>processFriendLivesYear(state,failingFriendRng()),/injected/);
 assert.deepEqual(state,before);
 assert.strictEqual(state.social.friends,friends);
 assert.strictEqual(friends[0],first);
 assert.strictEqual(friends[1],second);
 assert.strictEqual(first.life,firstLife);
});
test('friend rollback restores existing nested ledger and goal object identities',()=>{
 const state=friendState(),first=state.social.friends[0];
 add(first,2049,100,'recover');
 first.lifeGoals={active:{id:'career',progress:25},history:[]};
 const ledger=first.activityLedger,entries=ledger.entries,totals=ledger.totals,goals=first.lifeGoals,
 active=goals.active,history=goals.history,before=structuredClone(state);
 assert.throws(()=>processFriendLivesYear(state,failingFriendRng()),/injected/);
 assert.deepEqual(state,before);
 assert.strictEqual(first.activityLedger,ledger);
 assert.strictEqual(ledger.entries,entries);
 assert.strictEqual(ledger.totals,totals);
 assert.strictEqual(first.lifeGoals,goals);
 assert.strictEqual(goals.active,active);
 assert.strictEqual(goals.history,history);
});
test('friend rollback removes new life and ledger when the first friend fails',()=>{
 const state=friendState();delete state.social.friends[0].life;
 const before=structuredClone(state);
 assert.throws(()=>processFriendLivesYear(state,{fork(){throw Error('injected first friend');}}),/injected/);
 assert.deepEqual(state,before);
});
test('friend native RNG state is restored after a consumed draw and failure',()=>{
 const state=friendState(),before=structuredClone(state),rng=new RNG('cycle92-friend'),start=rng.state,
 fork=rng.fork.bind(rng);
 rng.fork=function(label){this.next();if(label==='two-stress')throw Error('injected friend RNG');return fork(label);};
 assert.throws(()=>processFriendLivesYear(state,rng),/injected/);
 assert.deepEqual(state,before);
 assert.equal(rng.state,start);
});
test('friend successful year commits once and replay does not touch RNG',()=>{
 const state=friendState(),rng=new RNG('cycle92-friend-success'),fork=rng.fork.bind(rng);
 rng.fork=function(label){this.next();return fork(label);};
 const start=rng.state;
 processFriendLivesYear(state,rng);
 assert.notEqual(rng.state,start);
 const after=rng.state,before=structuredClone(state);
 assert.deepEqual(processFriendLivesYear(state,rng),[]);
 assert.equal(rng.state,after);
 assert.deepEqual(state,before);
});
