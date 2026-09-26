import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {generateNpcInitiatives,pendingInitiative,resolveNpcInitiative,processNpcInitiativeFollowups} from '../src/life/npc_initiative_system.js';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';
import {applyPartnerGoalAlignment} from '../src/life/npc_goal_system.js';

test('deceased friend does not continue life, request help, or receive follow-ups',()=>{
 const state=new Game('dead-friend-consistency').state;
 state.player.age=35;
 const friend={id:'dead-friend',name:'Deniz',age:35,alive:false,closeFriend:true,needsSupport:true,relationship:40,trust:40,life:{personalStress:90,workStability:20,majorEvents:0}};
 state.social.friends=[friend];
 state.npcInitiatives={pending:[{id:'npc-1',type:'friend-support-request',actorId:friend.id,actorName:friend.name,status:'pending',expiresAtAge:36}],history:[],nextId:2};
 assert.deepEqual(processFriendLivesYear(state,new RNG('dead-friend-year')),[]);
 assert.equal(friend.life.personalStress,90);
 assert.equal(pendingInitiative(state,'friend-support-request'),null);
 assert.deepEqual(generateNpcInitiatives(state,new RNG('dead-friend-request')),[]);
 assert.equal(state.npcInitiatives.pending.length,0);
 assert.throws(()=>resolveNpcInitiative(state,'friend-support-request','accept'),/artık geçerli değil/);
});

test('deceased partner cannot change work, relationship, or shared goals',()=>{
 const state=new Game('dead-partner-consistency').state;
 state.player.age=35;
 state.social.romance={id:'partner',name:'Ece',age:35,alive:false,status:'married',relationship:60,trust:60,sharedGoals:60,life:{careerSatisfaction:20,workStress:90,careerYears:5}};
 const before=structuredClone(state.social.romance);
 assert.deepEqual(processPartnerLifeYear(state,new RNG('dead-partner-year')),[]);
 assert.equal(applyPartnerGoalAlignment(state),null);
 assert.deepEqual(state.social.romance,before);
});

test('player death prevents NPC initiatives and delayed relationship changes',()=>{
 const state=new Game('dead-player-initiatives').state;
 state.player.age=35;state.player.alive=false;
 assert.deepEqual(generateNpcInitiatives(state,new RNG('dead-player')),[]);
 assert.equal(pendingInitiative(state),null);
 assert.deepEqual(processNpcInitiativeFollowups(state),[]);
 assert.throws(()=>resolveNpcInitiative(state,'partner-relocation','accept'),/Hayat sona erdi/);
});
