import test from 'node:test';
import assert from 'node:assert/strict';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
const rng={fork(){return {int(){return 0},chance(){return false}}}};
test('NPC autonomous social activity never increases relationship with player',()=>{
 const friend={id:'friend-1',name:'Deniz',age:25,alive:true,relationship:42,personality:{sociability:80},life:{personalStress:20,workStability:65}};
 const state={year:2028,player:{age:25},social:{friends:[friend]}};
 processFriendLivesYear(state,rng);
 assert.equal(friend.relationship,42);
 assert.ok(friend.life.socialCapital>50);
 const capital=friend.life.socialCapital;
 processFriendLivesYear(state,rng);
 assert.equal(friend.relationship,42);
 assert.equal(friend.life.socialCapital,capital);
});
