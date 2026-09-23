import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {setLifeGoal,processLifeGoalsYear} from '../src/life/life_goal_system.js';

test('a genuinely strong social circle can complete the social-circle life goal',()=>{
 const g=new Game('social-goal-completion');
 g.state.player.age=24;
 g.state.social.friends=[
  {id:'f1',relationship:92,closeFriend:true},
  {id:'f2',relationship:88,closeFriend:true},
  {id:'f3',relationship:90,closeFriend:true},
  {id:'f4',relationship:82,closeFriend:false}
 ];
 setLifeGoal(g.state,'social-circle');
 for(let i=0;i<12&&!g.state.lifeGoals.completed.includes('social-circle');i++){
  g.state.player.age++;
  processLifeGoalsYear(g.state);
 }
 assert.ok(g.state.lifeGoals.completed.includes('social-circle'));
});
