import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {availableLifeActions,performLifeAction} from '../src/life/agency_system.js';

test('death prevents all agency actions without spending an action',()=>{
 const state=new Game('agency-death-regression').state;
 state.player.age=30;state.actions.remaining=3;
 state.lifeGoals.active={id:'test',lastFocusedAge:null};
 state.player.alive=false;
 assert.deepEqual(availableLifeActions(state),[]);
 assert.throws(()=>performLifeAction(state,'focus-goal'),/Hayat sona erdi/);
 assert.equal(state.actions.remaining,3);
});

test('deceased friends cannot request support or receive relationship changes',()=>{
 const state=new Game('agency-friend-death').state;
 state.player.age=30;state.actions.remaining=3;
 const friend={id:'friend-dead',name:'Deniz',alive:false,needsSupport:true,relationship:40,trust:40};
 state.social.friends=[friend];
 assert.ok(!availableLifeActions(state).some(action=>action.id==='support-friend:friend-dead'));
 assert.throws(()=>performLifeAction(state,'support-friend:friend-dead'),/artık kullanılamıyor/);
 assert.equal(friend.relationship,40);
 assert.equal(state.actions.remaining,3);
});

test('deceased partner and child cannot be supported or mentored',()=>{
 const state=new Game('agency-family-death').state;
 state.player.age=40;state.actions.remaining=3;
 state.social.romance={id:'partner',name:'Ece',alive:false,resentment:90,trust:30};
 state.children=[{id:'child-dead',name:'Ada',age:12,alive:false,relationship:40,development:{confidence:10,identityStress:90}}];
 assert.ok(!availableLifeActions(state).some(action=>action.id==='support-partner'||action.id==='mentor-child:child-dead'));
 assert.throws(()=>performLifeAction(state,'mentor-child:child-dead'),/artık kullanılamıyor/);
 assert.throws(()=>performLifeAction(state,'support-partner'),/Bilinmeyen yaşam aksiyonu/);
 assert.equal(state.actions.remaining,3);
});
