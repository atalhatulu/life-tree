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
 assert.ok(choices.some(c=>c.id.startsWith('job:')));
 assert.ok(choices.some(c=>c.id==='reject-job-offers'));
});

test('university path produces procedural program applications',()=>{
 const g=new Game('adult-university-offers');
 autoplay(g,{toAge:18,policy:'balanced'});
 const event=g.ageOneYear();
 assert.equal(g.state.player.age,19);
 assert.equal(event?.id,'university-application');
 const choices=g.eventChoices(event);
 assert.ok(choices.length>=1);
 assert.ok(choices.some(c=>c.id.startsWith('program:')));
 assert.ok(choices.some(c=>c.id==='skip-applications'));
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
 let laborAttached=0;
 for(let i=0;i<300;i++){
  const g=new Game('adult-stress-'+i);
  autoplay(g,{toAge:30,policy:'random'});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
  assert.ok(g.state.player.age<=30);
  if(!g.state.player.alive){
   assert.ok(g.state.death);
   assert.ok(g.state.deathSummary);
  }else{
   assert.equal(g.state.player.age,30);
  }
  if(g.state.career?.employed) employed++;
  if(
   g.state.career?.employed||
   g.state.nextPath==='work'||
   (g.state.pendingJobOffers?.length??0)>0
  ) laborAttached++;
 }
 assert.ok(employed>=210,'too few employed at 30: '+employed);
 assert.ok(laborAttached>=270,'too few attached to labor market at 30: '+laborAttached);
});

test('declining job offers keeps unemployment and schedules a later search',()=>{
 const g=new Game('adult-work-offers');
 autoplay(g,{toAge:18,policy:'vocational'});
 const event=g.ageOneYear();
 assert.equal(event?.id,'first-job');
 const age=g.state.player.age;
 g.makeChoice(event,'reject-job-offers');
 assert.equal(g.state.pendingJobOffers,null);
 assert.equal(g.state.nextPath,'work');
 assert.equal(g.state.nextJobSearchAge,age+2);
 assert.equal(Boolean(g.state.career?.employed),false);
 g.ageOneYear();
 assert.equal(g.state.pendingJobOffers,null,'rejected job offers must not regenerate the next year');
 g.ageOneYear();
 assert.ok(g.state.pendingJobOffers?.length>0,'fresh offers should become available when cooldown expires');
});

test('skipping university applications routes into a later education or work decision',()=>{
 const g=new Game('adult-university-offers');
 autoplay(g,{toAge:18,policy:'balanced'});
 const event=g.ageOneYear();
 assert.equal(event?.id,'university-application');
 const age=g.state.player.age;
 g.makeChoice(event,'skip-applications');
 assert.equal(g.state.pendingUniversityApplications,null);
 assert.equal(g.state.nextPath,'gap');
 assert.equal(g.state.nextGapDecisionAge,age+1);
 assert.equal(Boolean(g.state.higherEducation?.enrolled),false);
 const next=g.ageOneYear();
 assert.equal(next?.id,'gap-year-direction');
 assert.deepEqual(g.eventChoices(next).map(c=>c.id),['retry-university','seek-work','continue-gap']);
 g.makeChoice(next,'seek-work');
 assert.equal(g.state.nextPath,'work');
 assert.ok(g.state.pendingJobOffers?.length>0);
});

test('choosing another gap gives a real two-year respite',()=>{
 const g=new Game('adult-gap-spacing');
 autoplay(g,{toAge:18,policy:'balanced'});
 const first=g.ageOneYear();
 g.makeChoice(first,'skip-applications');
 // Isolate gap pacing: military service is a separate, higher-priority event.
 g.state.militaryService={eligible:false,status:'not-applicable'};
 const gap=g.ageOneYear();
 assert.equal(gap?.id,'gap-year-direction');
 g.makeChoice(gap,'continue-gap');
 assert.equal(g.state.nextGapDecisionAge,g.state.player.age+2);
 const next=g.ageOneYear();
 assert.notEqual(next?.id,'gap-year-direction');
});
