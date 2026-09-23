import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensureNpcGoal,goalAlignment,applyPartnerGoalAlignment} from '../src/life/npc_goal_system.js';
import {processLongTermConsequences} from '../src/life/long_term_consequence_system.js';

test('NPC goals emerge from personality and persist',()=>{
 const person={age:30,personality:{ambition:82,sociability:40,patience:50}};
 const goal=ensureNpcGoal(person);
 assert.equal(goal.id,'career');
 assert.equal(person.lifeGoals.active.id,'career');
 assert.equal(ensureNpcGoal(person),goal);
});

test('player and partner goals can align or conflict',()=>{
 assert.equal(goalAlignment('career-mastery','career'),1);
 assert.equal(goalAlignment('career-mastery','family'),-1);
 const game=new Game('goal-alignment');
 game.state.player.age=30;
 game.state.lifeGoals={active:{id:'career-mastery',label:'Kariyerde ustalaşmak',progress:50},completed:[],history:[]};
 game.state.social.romance={
  id:'p1',name:'Ece',surname:'Test',age:30,alive:true,status:'dating',
  relationship:65,trust:60,sharedGoals:60,resentment:20,monthlyIncome:50000,
  personality:{ambition:80,sociability:40,patience:45}
 };
 const result=applyPartnerGoalAlignment(game.state);
 assert.equal(result.alignment,1);
 assert.equal(game.state.social.romance.goalAlignment,1);
 assert.ok(game.state.social.romance.trust>60);
});

test('5 10 20 year Life Tree consequences fire once at exact milestone',()=>{
 const game=new Game('long-consequence');
 const s=game.state;
 s.player.age=30;
 s.career={employed:true,satisfaction:50,stability:50};
 s.lifeTree.nodes=[{
  age:25,eventId:'career-switch',choiceId:'take-offer',label:'Yeni işi kabul et',
  pacingCategory:'career'
 }];
 let entries=processLongTermConsequences(s);
 assert.equal(entries.length,1);
 assert.match(entries[0].text,/Beş yıl/);
 assert.deepEqual(s.lifeTree.nodes[0].longTermMilestones,[5]);
 entries=processLongTermConsequences(s);
 assert.equal(entries.length,0);
 s.player.age=35;
 entries=processLongTermConsequences(s);
 assert.equal(entries.length,1);
 assert.match(entries[0].text,/On yıl/);
 s.player.age=45;
 entries=processLongTermConsequences(s);
 assert.equal(entries.length,1);
 assert.match(entries[0].text,/Yirmi yıl/);
 assert.deepEqual(s.lifeTree.nodes[0].longTermMilestones,[5,10,20]);
});

test('family milestone consequence affects current child bonds',()=>{
 const game=new Game('family-consequence');
 const s=game.state;
 s.player.age=40;
 s.children=[
  {id:'c1',name:'Ada',age:12,relationship:60,health:{current:80}},
  {id:'c2',name:'Can',age:8,relationship:65,health:{current:80}}
 ];
 s.lifeTree.nodes=[{
  age:30,eventId:'child-decision',choiceId:'yes',label:'Çocuk sahibi ol',
  pacingCategory:'family'
 }];
 const entries=processLongTermConsequences(s);
 assert.equal(entries.length,1);
 assert.equal(s.children[0].relationship,62);
 assert.equal(s.children[1].relationship,67);
});
