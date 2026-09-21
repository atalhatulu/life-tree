import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

test('age 14 always produces a high-school path decision when school progression is normal',()=>{
 const g=new Game('teen-path');
 let highSchoolEvent=null;
 while(g.state.player.age<14){
  const event=g.ageOneYear();
  if(event){
   const choices=g.eventChoices(event);
   const pick=choices.find(c=>c.id==='embrace')??choices[0];
   g.makeChoice(event,pick.id);
  }
  if(g.state.player.age===14) highSchoolEvent=event;
 }
 assert.equal(highSchoolEvent?.id,'high-school-path');
 assert.ok(g.eventChoices(highSchoolEvent).some(c=>c.id==='academic'));
});

test('high-school choice creates first major Life Tree node',()=>{
 const g=new Game('teen-tree');
 while(g.state.player.age<14){
  const event=g.ageOneYear();
  if(event){
   const choices=g.eventChoices(event);
   const choice=event.id==='high-school-path'
    ? choices.find(c=>c.id==='academic')
    : (choices.find(c=>c.id==='embrace')??choices[0]);
   g.makeChoice(event,choice.id);
  }
 }
 assert.equal(g.state.lifeTree.nodes.length,1);
 assert.equal(g.state.lifeTree.nodes[0].eventId,'high-school-path');
 assert.equal(g.state.education.stage,'high');
});

test('age 18 creates a second major Life Tree branch for post-school direction',()=>{
 const g=new Game('age18-tree');
 autoplay(g,{toAge:18,policy:'balanced'});
 const ids=g.state.lifeTree.nodes.map(n=>n.eventId);
 assert.ok(ids.includes('high-school-path'));
 assert.ok(ids.includes('after-high-school'));
 assert.equal(g.state.nextPath,'university');
});

test('same seed and same autoplay policy are deterministic',()=>{
 const a=new Game('deterministic-life');
 const b=new Game('deterministic-life');
 autoplay(a,{toAge:18,policy:'balanced'});
 autoplay(b,{toAge:18,policy:'balanced'});
 assert.deepEqual(a.state,b.state);
});

test('different policies can produce different life-tree paths',()=>{
 const a=new Game('policy-life');
 const b=new Game('policy-life');
 autoplay(a,{toAge:18,policy:'academic'});
 autoplay(b,{toAge:18,policy:'vocational'});
 assert.notDeepEqual(
  a.state.lifeTree.nodes.map(n=>n.choiceId),
  b.state.lifeTree.nodes.map(n=>n.choiceId)
 );
});

test('500 automated lives reach 18 without invariant violations',()=>{
 for(let i=0;i<500;i++){
  const g=new Game('stress-'+i);
  autoplay(g,{toAge:18,policy:i%2?'balanced':'social'});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
  assert.equal(g.state.player.age,18);
  assert.equal(g.state.education?.stage,'high');
  assert.ok(g.state.lifeTree.nodes.length>=2);
 }
});
