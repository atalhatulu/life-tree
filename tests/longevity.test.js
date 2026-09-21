import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

test('300 random lives remain valid through age 100 or natural death',()=>{
 let deaths=0;
 let summaries=0;
 let estates=0;
 let centenarians=0;

 for(let i=0;i<300;i++){
  const g=new Game('century-life-'+i);
  autoplay(g,{toAge:100,policy:'random'});

  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
  assert.ok(g.state.player.age<=100);

  if(!g.state.player.alive){
   deaths++;
   if(g.state.deathSummary)summaries++;
   if(g.state.estate)estates++;
   assert.equal(g.state.death?.age,g.state.player.age);
  }else if(g.state.player.age===100){
   centenarians++;
  }
 }

 assert.ok(deaths>=240,'expected most simulated lives to end before 100, got '+deaths);
 assert.equal(summaries,deaths);
 assert.equal(estates,deaths);
 assert.ok(centenarians<=60,'too many centenarians: '+centenarians);
});
