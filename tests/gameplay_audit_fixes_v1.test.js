import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensureNpcInitiatives,pendingInitiative,resolveNpcInitiative} from '../src/life/npc_initiative_system.js';

test('stale partner initiative disappears instead of crashing',()=>{
 const game=new Game('stale-partner');
 game.state.player.age=50;
 game.state.social.romance=null;
 ensureNpcInitiatives(game.state).pending.push({
  id:'npc-stale-p',type:'partner-family-priority',actorId:'old-partner',actorName:'Eski Partner',
  createdAtAge:49,expiresAtAge:51,status:'pending',data:{goalId:'family'}
 });
 assert.equal(pendingInitiative(game.state,'partner-family-priority'),null);
 assert.throws(()=>resolveNpcInitiative(game.state,'partner-family-priority','accept'),/artık geçerli değil/);
});

test('stale friend initiative disappears instead of crashing',()=>{
 const game=new Game('stale-friend');
 game.state.player.age=60;
 game.state.social.friends=[];
 ensureNpcInitiatives(game.state).pending.push({
  id:'npc-stale-f',type:'friend-support-request',actorId:'gone-friend',actorName:'Eski Arkadaş',
  createdAtAge:59,expiresAtAge:61,status:'pending',data:{supportType:'emotional'}
 });
 assert.equal(pendingInitiative(game.state,'friend-support-request'),null);
});

test('same activity cannot be spammed multiple times in one annual turn',()=>{
 const game=new Game('activity-limit');
 game.state.player.age=25;
 game.state.actions={remaining:3,max:3};
 game.performActivity('hobby');
 assert.equal(game.availableActivities().some(a=>a.id==='hobby'),false);
 assert.throws(()=>game.performActivity('hobby'),/bu yıl zaten yaptın/i);
 assert.equal(game.state.actions.remaining,2);
});

test('life-goal focus requires breathing room between deliberate focus years',()=>{
 const game=new Game('goal-cooldown');
 game.state.player.age=25;
 game.state.actions={remaining:3,max:3};
 game.setLifeGoal('wellbeing');
 game.performLifeAction('focus-goal');
 assert.equal(game.availableLifeActions().some(a=>a.id==='focus-goal'),false);
 game.state.player.age=26;
 assert.equal(game.availableLifeActions().some(a=>a.id==='focus-goal'),false);
 game.state.player.age=27;
 assert.equal(game.availableLifeActions().some(a=>a.id==='focus-goal'),true);
});

test('child direction compromise cannot immediately recur every two years',()=>{
 const game=new Game('child-request-cooldown');
 game.state.player.age=45;
 game.state.children=[{
  id:'child-x',name:'Ada',age:18,relationship:60,health:{current:80},
  personality:{ambition:35,sociability:40,patience:40},
  educationPlan:'university',
  development:{confidence:50,independence:75,academicDrive:45,socialSecurity:50,parentAttachment:60,identityStress:20},
  lifeGoals:{active:{id:'freedom',label:'Bağımsız ve özgür yaşamak',progress:80},history:[]}
 }];
 ensureNpcInitiatives(game.state).pending.push({
  id:'npc-child-x',type:'child-direction',actorId:'child-x',actorName:'Ada',
  createdAtAge:45,expiresAtAge:46,status:'pending',
  data:{desiredPlan:'work',currentPlan:'university',goalId:'freedom',urgency:80}
 });
 resolveNpcInitiative(game.state,'child-direction','compromise');
 const h=game.state.npcInitiatives.history.at(-1);
 assert.equal(h.response,'compromise');
 assert.equal(h.resolvedAtAge,45);
});
