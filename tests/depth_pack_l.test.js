import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensureNpcInitiatives,resolveNpcInitiative,processNpcInitiativeFollowups} from '../src/life/npc_initiative_system.js';

function partnerFixture(){
 return {
  id:'partner-1',name:'Ece',surname:'Test',age:31,alive:true,status:'married',
  relationship:70,trust:60,intimacy:60,resentment:20,sharedGoals:55,
  monthlyIncome:50000,preferences:{},personality:{ambition:80,sociability:45,patience:45},
  life:{careerSatisfaction:35,workStress:55,personalSavings:100000,lifeSatisfaction:55}
 };
}

test('partner initiative becomes a real player-facing event',()=>{
 const game=new Game('npc-event');
 game.state.player.age=31;
 game.state.social.romance=partnerFixture();
 const store=ensureNpcInitiatives(game.state);
 store.pending.push({
  id:'npc-1',type:'partner-family-priority',actorId:'partner-1',actorName:'Ece',
  createdAtAge:31,expiresAtAge:32,status:'pending',data:{goalId:'family',urgency:70}
 });
 const event=game.events.events.find(e=>e.id==='npc-partner-family-priority');
 assert.ok(event.condition(game.state));
 const choices=game.eventChoices(event);
 assert.deepEqual(choices.map(x=>x.id),['accept','compromise','reject']);
 const result=game.makeChoice(event,'accept');
 assert.match(result,/ciddiye aldın/);
 assert.equal(game.state.npcInitiatives.pending.length,0);
 assert.equal(game.state.npcInitiatives.history.at(-1).response,'accept');
 assert.ok(game.state.social.romance.trust>60);
});

test('rejecting an NPC request leaves relational memory',()=>{
 const game=new Game('npc-reject');
 game.state.player.age=31;
 game.state.social.romance=partnerFixture();
 const store=ensureNpcInitiatives(game.state);
 store.pending.push({
  id:'npc-2',type:'partner-family-priority',actorId:'partner-1',actorName:'Ece',
  createdAtAge:31,expiresAtAge:32,status:'pending',data:{goalId:'family',urgency:70}
 });
 resolveNpcInitiative(game.state,'partner-family-priority','reject');
 assert.ok(game.state.social.romance.resentment>20);
 assert.ok(game.state.social.romance.sharedGoals<55);
 const history=game.state.npcInitiatives.history.at(-1);
 assert.equal(history.followUpAtAge,33);
 assert.equal(history.response,'reject');
});

test('NPC request produces a delayed two-year followup consequence',()=>{
 const game=new Game('npc-followup');
 game.state.player.age=31;
 game.state.social.romance=partnerFixture();
 const store=ensureNpcInitiatives(game.state);
 store.pending.push({
  id:'npc-3',type:'partner-life-balance',actorId:'partner-1',actorName:'Ece',
  createdAtAge:31,expiresAtAge:32,status:'pending',data:{goalId:'wellbeing',urgency:70}
 });
 resolveNpcInitiative(game.state,'partner-life-balance','reject');
 const before=game.state.social.romance.resentment;
 game.state.player.age=33;
 const entries=processNpcInitiativeFollowups(game.state);
 assert.equal(entries.length,1);
 assert.match(entries[0].text,/hâlâ/);
 assert.ok(game.state.social.romance.resentment>before);
 assert.equal(game.state.npcInitiatives.history[0].followedUp,true);
 assert.equal(processNpcInitiativeFollowups(game.state).length,0);
});

test('child autonomy response changes both plan and relationship',()=>{
 const game=new Game('child-autonomy');
 game.state.player.age=45;
 game.state.children=[{
  id:'child-1',name:'Ada',age:18,relationship:60,health:{current:80},
  personality:{ambition:40,sociability:45,patience:45},
  educationPlan:'university',
  development:{confidence:55,independence:75,academicDrive:50,socialSecurity:55,parentAttachment:65,identityStress:20}
 }];
 const store=ensureNpcInitiatives(game.state);
 store.pending.push({
  id:'npc-4',type:'child-direction',actorId:'child-1',actorName:'Ada',
  createdAtAge:45,expiresAtAge:46,status:'pending',
  data:{desiredPlan:'work',currentPlan:'university',goalId:'freedom',urgency:80}
 });
 resolveNpcInitiative(game.state,'child-direction','accept');
 assert.equal(game.state.children[0].educationPlan,'work');
 assert.ok(game.state.children[0].relationship>60);
 assert.ok(game.state.children[0].development.confidence>55);
});

test('friend support request affects future reciprocity',()=>{
 const game=new Game('friend-memory');
 game.state.player.age=30;
 game.state.social.friends=[{
  id:'friend-1',name:'Deniz',surname:'Test',age:30,alive:true,closeFriend:true,
  relationship:65,trust:65,reciprocity:50,needsSupport:true,
  personality:{ambition:40,sociability:70,patience:50},
  life:{personalStress:80,workStability:30}
 }];
 const store=ensureNpcInitiatives(game.state);
 store.pending.push({
  id:'npc-5',type:'friend-support-request',actorId:'friend-1',actorName:'Deniz',
  createdAtAge:30,expiresAtAge:31,status:'pending',data:{supportType:'career',urgency:75}
 });
 resolveNpcInitiative(game.state,'friend-support-request','accept');
 const afterSupport=game.state.social.friends[0].reciprocity;
 game.state.player.age=32;
 const entries=processNpcInitiativeFollowups(game.state);
 assert.equal(entries.length,1);
 assert.ok(game.state.social.friends[0].reciprocity>afterSupport);
});
