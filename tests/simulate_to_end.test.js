import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {simulateToEnd} from '../src/simulation/autoplay.js';

test('simulateToEnd advances a living game directly to a terminal life state',()=>{
 const g=new Game('simulate-to-end');
 const start=g.state.player.age;
 const result=simulateToEnd(g,{policy:'human-like',maxAge:130});
 assert.equal(result.startAge,start);
 assert.equal(result.finalAge,g.state.player.age);
 assert.ok(result.yearsSimulated>0);
 assert.equal(result.reachedEnd,!g.state.player.alive);
 if(result.reachedEnd){
  assert.ok(g.state.lifeTree.finale);
  assert.ok(g.state.lifeTree.finale.ending.id);
 }
});

test('simulateToEnd can continue from the middle of an existing life',()=>{
 const g=new Game('simulate-midlife');
 for(let i=0;i<30&&g.state.player.alive;i++){
  const event=g.ageOneYear();
  if(event&&g.state.player.alive){
   const choice=g.eventChoices(event)[0];
   if(choice)g.makeChoice(event,choice.id);
  }
 }
 const start=g.state.player.age;
 const result=simulateToEnd(g,{policy:'human-like',maxAge:130});
 assert.equal(result.startAge,start);
 assert.ok(result.finalAge>=start);
 assert.equal(result.reachedEnd,!g.state.player.alive);
});
