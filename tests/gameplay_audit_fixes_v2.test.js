import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensureNpcInitiatives,resolveNpcInitiative,pendingInitiative} from '../src/life/npc_initiative_system.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';

function partner(){
 return {
  id:'p1',name:'Ece',status:'married',relationship:70,trust:65,intimacy:65,resentment:20,sharedGoals:50,
  personality:{ambition:70,sociability:60,patience:55},
  life:{careerSatisfaction:40,workStress:75,personalSavings:100000,lifeSatisfaction:50}
 };
}

test('accepted partner topic cannot immediately recur',()=>{
 const g=new Game('topic-cooldown');
 g.state.player.age=35;
 g.state.social.romance=partner();
 const s=ensureNpcInitiatives(g.state);
 s.pending.push({id:'n1',type:'partner-life-balance',actorId:'p1',actorName:'Ece',createdAtAge:35,expiresAtAge:36,status:'pending',data:{severity:75,stage:1}});
 resolveNpcInitiative(g.state,'partner-life-balance','accept');
 assert.equal(g.state.npcInitiatives.history.at(-1).response,'accept');
 g.state.player.age=40;
 assert.equal(pendingInitiative(g.state,'partner-life-balance'),null);
});

test('NPC topic history records escalation stage and severity',()=>{
 const g=new Game('topic-stage');
 g.state.player.age=35;
 g.state.social.romance=partner();
 const s=ensureNpcInitiatives(g.state);
 s.pending.push({id:'n1',type:'partner-family-priority',actorId:'p1',actorName:'Ece',createdAtAge:35,expiresAtAge:36,status:'pending',data:{severity:50,stage:2}});
 resolveNpcInitiative(g.state,'partner-family-priority','compromise');
 const h=g.state.npcInitiatives.history.at(-1);
 assert.equal(h.data.stage,2);
 assert.equal(h.data.severity,50);
});

test('repetitive systemic storylet is capped after two resolved uses',()=>{
 const g=new Game('storylet-cap');
 g.state.player.age=40;
 g.state.social.romance=partner();
 g.state.career={employed:true,performance:70,satisfaction:60,workplace:{recognition:90,workload:50,burnout:30}};
 g.state.storyletCounts={'recognition-life':2};
 g.state.storyletCooldowns={'recognition-life':20};
 const e=systemicStorylets.find(x=>x.id==='storylet-recognition-vs-life');
 assert.equal(e.condition(g.state),false);
});

test('storylet remains eligible before its lifetime motif budget is exhausted',()=>{
 const g=new Game('storylet-budget');
 g.state.player.age=40;
 g.state.social.romance=partner();
 g.state.career={employed:true,performance:70,satisfaction:60,workplace:{recognition:90,workload:50,burnout:30}};
 g.state.storyletCounts={'recognition-life':1};
 g.state.storyletCooldowns={'recognition-life':30};
 const e=systemicStorylets.find(x=>x.id==='storylet-recognition-vs-life');
 assert.equal(e.condition(g.state),true);
});
