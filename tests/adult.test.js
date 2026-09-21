import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

test('work path produces procedural job offers after age 18',()=>{
 const g=new Game('adult-work-offers');
 autoplay(g,{toAge:18,policy:'vocational'});
 const event=g.ageOneYear();
 assert.equal(g.state.player.age,19);
 assert.equal(event?.id,'first-job');
 const choices=g.eventChoices(event);
 assert.ok(choices.length>=1);
 assert.ok(choices.every(c=>c.id.startsWith('job:')));
});

test('university path produces procedural program applications',()=>{
 const g=new Game('adult-university-offers');
 autoplay(g,{toAge:18,policy:'balanced'});
 const event=g.ageOneYear();
 assert.equal(g.state.player.age,19);
 assert.equal(event?.id,'university-application');
 const choices=g.eventChoices(event);
 assert.ok(choices.length>=1);
 assert.ok(choices.every(c=>c.id.startsWith('program:')));
});

test('completed degree prioritizes degree-related career when available',()=>{
 const g=new Game('adult-seed-c');
 autoplay(g,{toAge:30,policy:'balanced'});
 assert.equal(g.state.higherEducation?.completed,true);
 assert.equal(g.state.career?.degreeRelated,true);
});

test('personal finance never has negative cash or debt values',()=>{
 for(let i=0;i<200;i++){
  const g=new Game('finance-'+i);
  autoplay(g,{toAge:30,policy:i%2?'balanced':'random'});
  assert.ok((g.state.finance?.cash??0)>=0);
  assert.ok((g.state.finance?.debt??0)>=0);
 }
});

test('300 random adult lives reach age 30 without state violations',()=>{
 let employed=0;
 for(let i=0;i<300;i++){
  const g=new Game('adult-stress-'+i);
  autoplay(g,{toAge:30,policy:'random'});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
  assert.equal(g.state.player.age,30);
  if(g.state.career?.employed) employed++;
 }
 assert.ok(employed>=270);
});
