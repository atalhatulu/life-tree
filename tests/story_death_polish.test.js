import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {finalizeDeath} from '../src/life/death_summary.js';

test('story event mutates cloned state, not stale relationship reference',()=>{
 const g=new Game('story-event-clone');
 g.state.player.age=25;
 g.state.year=2051;
 g.state.social.friends=[{
  id:'friend-test',name:'Deniz',surname:'Kaya',alive:true,relationship:50,
  age:25,health:{current:80},appearance:{heightCm:170,attractiveness:60},
  education:{level:3},interests:{},personality:{}
 }];
 g.state.nextFriendSupportAge=20;
 const event=g.events.events.find(e=>e.id==='friend-needs-support');
 const before=g.state.social.friends[0].relationship;
 const result=g.makeChoice(event,'support-friend');
 assert.match(result,/yanında oldun/);
 assert.equal(g.state.social.friends[0].relationship,before+6);
});

test('death summary includes structured highlights and contextual decisions',()=>{
 const g=new Game('death-summary-highlights');
 g.state.player.age=70;
 g.state.year=2096;
 g.state.lifeTree.nodes.push({
  age:30,year:2056,eventId:'career-switch',title:'Kariyerini Değiştirme Fırsatı',
  choiceId:'stay',label:'Mevcut işimde kal',
  alternatives:[{id:'switch:x',label:'Başka işe geç'}],
  context:['Mevcut iş memnuniyeti 72/100','Mevcut maaş ₺90.000/ay']
 });
 g.state.player.alive=false;
 g.state.death={age:70,year:2096,cause:'test'};
 const summary=finalizeDeath(g.state);
 assert.ok(Array.isArray(summary.highlights));
 assert.ok(summary.highlights.length>0);
 assert.deepEqual(summary.recap.decisions[0].context,[
  'Mevcut iş memnuniyeti 72/100','Mevcut maaş ₺90.000/ay'
 ]);
 assert.equal(typeof summary.recap.finances.savings,'number');
});

test('expanded story event pool covers multiple life stages',()=>{
 const g=new Game('story-pool');
 const ids=new Set(g.events.events.map(e=>e.id));
 for(const id of [
  'childhood-friend-invite','exam-pressure-moment','work-burnout-warning',
  'friend-needs-support','couple-finance-talk','parent-child-time',
  'midlife-priority-check','retirement-social-rhythm','late-life-independence'
 ])assert.ok(ids.has(id),id+' should be registered');
});
