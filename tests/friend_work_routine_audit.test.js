import test from 'node:test';
import assert from 'node:assert/strict';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';

const rng={fork:()=>({int:(a)=>a,chance:()=>true})};
const makeFriend=()=>({id:'f1',name:'Deniz',age:30,alive:true,jobId:'cook',relationship:55,life:{workStability:25,relationshipStatus:'partnered',personalStress:25,lifeSatisfaction:50,movedAway:true,majorEvents:0}});
test('job loss and same-year reemployment refresh routine after career events',()=>{
 const friend=makeFriend();
 const state={year:2030,player:{age:30},social:{friends:[friend]}};
 const entries=processFriendLivesYear(state,rng);
 assert.ok(entries.some(e=>e.text.includes('işini kaybetti')));
 assert.ok(entries.some(e=>e.text.includes('yeniden iş buldu')));
 assert.equal(friend.jobId,'cleaner');
 assert.ok(friend.monthlyIncome>0);
 assert.equal(friend.routine.pattern,'employed');
 assert.equal(friend.socialAvailability,friend.routine.availability);
});
test('job loss without reemployment leaves no phantom work schedule',()=>{
 const friend=makeFriend();
 const neverRehire={fork:(key)=>({int:(a)=>a,chance:()=>!key.includes('reemployment')})};
 processFriendLivesYear({year:2030,player:{age:30},social:{friends:[friend]}},neverRehire);
 assert.equal(friend.jobId,'unemployed');
 assert.equal(friend.routine.workload,0);
 assert.equal(friend.routine.pattern,'home');
});
