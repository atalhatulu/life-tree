import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleNpcJobs,npcMonthlyIncome,processFriendLivesYear} from '../src/social/friend_life_system.js';
const rng={fork:()=>({int:a=>a,chance:()=>true})};
test('NPC education limits available professions',()=>{
 const basic=eligibleNpcJobs({life:{schoolOutcome:'developing'}});
 const advanced=eligibleNpcJobs({life:{schoolOutcome:'advanced'}});
 assert.equal(basic.some(j=>j.id==='engineer'),false);
 assert.equal(advanced.some(j=>j.id==='engineer'),true);
 assert.equal(advanced.some(j=>j.id==='doctor'),false);
});
test('unemployed NPC has zero income and employment gives a real occupation',()=>{
 const friend={id:'f',name:'Ada',age:28,alive:true,jobId:'unemployed',monthlyIncome:5000,life:{workStability:50,schoolOutcome:'advanced',movedAway:true}};
 processFriendLivesYear({year:2030,player:{age:28},social:{friends:[friend]}},rng);
 assert.notEqual(friend.jobId,'employed');
 assert.ok(friend.monthlyIncome>0);
 assert.equal(friend.monthlyIncome,npcMonthlyIncome(friend));
});
test('retired NPC cannot lose work or be rehired',()=>{
 const friend={id:'f',name:'Ada',age:70,alive:true,jobId:'unemployed',life:{workStability:5,movedAway:true}};
 processFriendLivesYear({year:2030,player:{age:70},social:{friends:[friend]}},rng);
 assert.equal(friend.jobId,'unemployed');
});
