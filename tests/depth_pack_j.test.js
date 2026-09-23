import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processLifeGoalsYear} from '../src/life/life_goal_system.js';
import {processNarrativeEchoesYear} from '../src/life/narrative_echo_system.js';

test('long-term goal can be selected and focused through Game API',()=>{
 const game=new Game('goal-api');
 game.state.player.age=25;
 game.state.actions={remaining:3,max:3};
 const goal=game.setLifeGoal('wellbeing');
 assert.equal(goal.id,'wellbeing');
 assert.ok(game.availableLifeActions().some(a=>a.id==='focus-goal'));
 const before=goal.progress;
 const result=game.performLifeAction('focus-goal');
 assert.match(result,/hedefin için/);
 assert.equal(game.state.actions.remaining,2);
 assert.ok(game.state.lifeGoals.active.progress>before);
});

test('contextual support actions bridge NPC lives and player agency',()=>{
 const game=new Game('support-api');
 game.state.player.age=30;
 game.state.actions={remaining:3,max:3};
 game.state.social.friends=[{
  id:'friend-test',name:'Deniz',surname:'Test',age:30,alive:true,
  relationship:55,trust:50,needsSupport:true,lastContactAge:28,
  life:{personalStress:80}
 }];
 const action=game.availableLifeActions().find(a=>a.id==='support-friend:friend-test');
 assert.ok(action);
 game.performLifeAction(action.id);
 const friend=game.state.social.friends[0];
 assert.equal(friend.needsSupport,false);
 assert.ok(friend.relationship>55);
 assert.ok(friend.trust>50);
 assert.ok(friend.life.personalStress<80);
 assert.equal(game.state.actions.remaining,2);
});

test('life goals complete from sustained systemic state, not a one-off event',()=>{
 const game=new Game('goal-completion');
 const s=game.state;
 s.player.age=30;
 s.player.health.current=100;
 s.healthProfile={conditions:[],stress:0,fitness:100,lastCheckupAge:null,riskExposure:{}};
 s.mentalHealth={strain:0,resilience:80,status:'stable'};
 s.lifeGoals={active:{id:'wellbeing',label:'Sağlıklı ve dengeli yaşam',startedAtAge:25,progress:100,lastFocusedAge:29},completed:[],history:[]};
 const entries=processLifeGoalsYear(s);
 assert.equal(s.lifeGoals.active,null);
 assert.ok(s.lifeGoals.completed.includes('wellbeing'));
 assert.ok(entries.some(e=>e.kind==='life-goal'));
});

test('old memories can echo into the present and leave a small systemic effect',()=>{
 const game=new Game('echo');
 const s=game.state;
 s.player.age=35;
 s.healthProfile={conditions:[],stress:40,fitness:50,lastCheckupAge:null,riskExposure:{}};
 s.lifeMemory={memories:[{id:'old-win',label:'Kariyer başarısı',age:25,valence:1,intensity:8,tags:['confidence']}],tags:{confidence:8},resilience:55,scarLoad:0};
 s.lifeTree.nodes=[];
 s.narrativeEcho={lastAge:20,total:0};
 const rng={
  chance:()=>true,
  weighted:items=>items[0].value
 };
 const entries=processNarrativeEchoesYear(s,rng);
 assert.equal(entries.length,1);
 assert.equal(entries[0].kind,'narrative-echo');
 assert.equal(s.narrativeEcho.total,1);
 assert.ok(s.healthProfile.stress<40);
 assert.ok(s.lifeMemory.resilience>55);
});
