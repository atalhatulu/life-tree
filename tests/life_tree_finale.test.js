import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {classifyEnding,ensureLifeFinale} from '../src/life/ending_system.js';

function deadGame(seed='ending-test'){
 const g=new Game(seed);
 g.state.player.alive=false;
 g.state.death={cause:'Doğal nedenler'};
 return g;
}

test('early death with unfinished direction produces an unfinished-road ending',()=>{
 const g=deadGame('unfinished-ending');
 g.state.player.age=39;
 g.state.year=2065;
 g.state.lifeGoals.active={id:'career-mastery',label:'Kariyerde ustalaşmak',startedAtAge:20,progress:72};
 g.state.lifeTree.nodes=[
  {age:18,eventId:'a',title:'A',choiceId:'x',label:'X',alternatives:[{id:'y',label:'Y'}]},
  {age:24,eventId:'b',title:'B',choiceId:'x',label:'X',alternatives:[{id:'y',label:'Y'}]},
  {age:31,eventId:'c',title:'C',choiceId:'x',label:'X',alternatives:[{id:'y',label:'Y'}]}
 ];
 assert.equal(classifyEnding(g.state).id,'unfinished-road');
});

test('strong older family life can resolve to dynasty-heart',()=>{
 const g=deadGame('family-ending');
 g.state.player.age=82;
 g.state.year=2108;
 g.state.social.romance={name:'Ece',relationship:94,trust:92,yearsTogether:51};
 g.state.children=[
  {id:'c1',relationship:92,development:{parentAttachment:88}},
  {id:'c2',relationship:89,development:{parentAttachment:91}},
  {id:'c3',relationship:86,development:{parentAttachment:85}}
 ];
 const ending=classifyEnding(g.state);
 assert.equal(ending.id,'dynasty-heart');
 assert.equal(ending.age,82);
});

test('Life Tree finale is frozen once the life has ended',()=>{
 const g=deadGame('frozen-ending');
 g.state.player.age=76;
 g.state.year=2102;
 g.state.lifeTree.nodes=[{
  age:25,eventId:'career-choice',title:'Büyük iş teklifi',
  choiceId:'accept',label:'Kabul et',
  alternatives:[{id:'reject',label:'Reddet'}]
 }];
 const first=ensureLifeFinale(g.state);
 assert.ok(first.ending.id);
 assert.equal(first.majorDecisions,1);
 g.state.player.age=99;
 g.state.children.push({id:'late-edit',relationship:100,development:{parentAttachment:100}});
 const second=ensureLifeFinale(g.state);
 assert.deepEqual(second,first);
 assert.equal(second.lifespan.age,76);
});

test('critical decision alternatives remain available for future counterfactual branches',()=>{
 const g=deadGame('branch-data');
 g.state.player.age=70;
 g.state.lifeTree.nodes=[{
  age:28,eventId:'move-choice',title:'Şehir değişikliği',
  choiceId:'move',label:'Taşın',
  alternatives:[
   {id:'stay',label:'Kal'},
   {id:'delay',label:'Kararı ertele'}
  ],
  snapshot:{version:2,state:{marker:true}}
 }];
 ensureLifeFinale(g.state);
 const node=g.state.lifeTree.nodes[0];
 assert.equal(node.alternatives.length,2);
 assert.equal(node.alternatives[0].id,'stay');
 assert.ok(node.snapshot);
});
