import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {
 canPresentPacedEvent,
 shouldPresentEventThisYear,
 pacingSummary
} from '../src/life/pacing_system.js';
import {RNG} from '../src/core/rng.js';

test('major adult decisions cannot stack in consecutive years',()=>{
 const state={
  player:{age:30},
  lifeTree:{nodes:[{age:29,eventId:'relationship-commitment',pacingCategory:'relationship'}]}
 };
 assert.equal(canPresentPacedEvent(state,{id:'buy-home'}),false);
 assert.equal(canPresentPacedEvent(state,{id:'career-switch'}),false);
});

test('same pacing category has a longer cooldown',()=>{
 const state={
  player:{age:33},
  lifeTree:{nodes:[{age:30,eventId:'career-switch',pacingCategory:'career'}]}
 };
 assert.equal(canPresentPacedEvent(state,{id:'start-business'}),false);
 state.player.age=35;
 assert.equal(canPresentPacedEvent(state,{id:'start-business'}),true);
});

test('critical education and first-job transitions bypass pacing',()=>{
 const state={
  player:{age:19},
  lifeTree:{nodes:[{age:18,eventId:'after-high-school'}]}
 };
 assert.equal(canPresentPacedEvent(state,{id:'university-application'}),true);
 assert.equal(canPresentPacedEvent(state,{id:'first-job'}),true);
});

test('quiet-year governor sometimes suppresses nonurgent adult events',()=>{
 const state={player:{age:30},pacing:{lastEventAge:29}};
 let suppressed=0;
 for(let i=0;i<100;i++){
  if(!shouldPresentEventThisYear(state,[{id:'adult-dating',priority:18}],new RNG('quiet-'+i)))suppressed++;
 }
 assert.ok(suppressed>40);
});

test('paced full lives do not produce adjacent paced major decisions',()=>{
 for(let i=0;i<150;i++){
  const g=new Game('paced-life-'+i);
  autoplay(g,{toAge:70,policy:'random'});
  const paced=g.state.lifeTree.nodes.filter(node=>node.age>=21&&node.pacingCategory);
  for(let j=1;j<paced.length;j++){
   assert.ok(
    paced[j].age-paced[j-1].age>=2,
    g.seedText+' stacked '+paced[j-1].eventId+' and '+paced[j].eventId
   );
  }
 }
});

test('pacing summary exposes adult decision density',()=>{
 const g=new Game('pacing-summary');
 autoplay(g,{toAge:60,policy:'random'});
 const summary=pacingSummary(g.state);
 assert.ok(summary.adultMajorDecisions>=0);
 assert.ok(summary.shortestAdultMajorGap==null||summary.shortestAdultMajorGap>=1);
});
