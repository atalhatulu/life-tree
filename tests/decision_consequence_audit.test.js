import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

// Separate qualitative flags from regressions: an unaffordable relocation
// that creates emergency debt is not a crash, but deserves a design review.
const COUNT=60;
function runJob(index){
 const seed='consequence-job-2026-'+index;
 const game=new Game(seed);
 autoplay(game,{toAge:18,policy:'vocational'});
 if(!game.state.player.alive)return {seed,skipped:'early-death'};
 const event=game.ageOneYear();
 if(event?.id!=='first-job')return {seed,skipped:event?.id??'no-event'};
 const s=game.state;
 const offers=s.pendingJobOffers??[];
 const option=offers.find(o=>o.requiresMove)??offers[0];
 if(!option)return {seed,skipped:'no-job-offer'};
 const before={
  city:s.location.cityId,
  liquid:(s.finance?.cash??0)+(s.finance?.savings??0),
  cash:s.finance?.cash??0,
  debt:s.finance?.debt??0,
  emergency:s.finance?.debts?.emergency??0
 };
 const choiceId='job:'+option.id;
 assert.ok(game.eventChoices(event).some(c=>c.id===choiceId),seed+': offer not shown');
 const outcome=game.makeChoice(event,choiceId);
 const after=game.state;
 assert.equal(after.career?.jobId,option.id,seed+': wrong job accepted');
 assert.equal(after.career?.employed,true,seed+': job not active');
 assert.equal(after.location?.cityId,option.cityId,seed+': job city mismatch');
 assert.equal(after.pendingJobOffers,null,seed+': accepted offers should clear');
 assert.ok(typeof outcome==='string'&&outcome.length>0,seed+': missing outcome');
 assert.deepEqual(validateState(after),[],seed+': state invalid');
 const financedByDebt=option.requiresMove&&option.moveCost>before.cash;
 const newEmergency=(after.finance?.debts?.emergency??0)-before.emergency;
 if(option.requiresMove){
  assert.equal(newEmergency,Math.max(0,option.moveCost-before.cash),
   seed+': relocation financing does not match move cost');
 }
 return {seed,jobId:option.id,requiresMove:option.requiresMove,
  moveCost:option.moveCost,liquidBefore:before.liquid,cashBefore:before.cash,
  financedByDebt,emergencyDebtAdded:newEmergency,
  debtBefore:before.debt,debtAfter:after.finance?.debt??0,
  outcome};
}
function runUniversity(index){
 const seed='consequence-university-2026-'+index;
 const game=new Game(seed);
 autoplay(game,{toAge:18,policy:'balanced'});
 if(!game.state.player.alive)return {seed,skipped:'early-death'};
 const event=game.ageOneYear();
 if(event?.id!=='university-application')return {seed,skipped:event?.id??'no-event'};
 const s=game.state;
 const option=s.pendingUniversityApplications?.[0];
 if(!option)return {seed,skipped:'no-application'};
 const before={city:s.location.cityId,cash:s.finance?.cash??0,debt:s.finance?.debt??0};
 const choiceId='program:'+option.id;
 assert.ok(game.eventChoices(event).some(c=>c.id===choiceId),seed+': program not shown');
 const outcome=game.makeChoice(event,choiceId);
 const after=game.state;
 const admitted=after.higherEducation?.programId===option.id;
 assert.equal(admitted,Boolean(after.higherEducation?.enrolled&&after.higherEducation?.programId===option.id));
 assert.equal(after.pendingUniversityApplications,null,seed+': application not cleared');
 if(admitted){
  assert.equal(after.location.cityId,option.cityId,seed+': admission city mismatch');
  assert.ok(outcome.includes('kabul edildin'),seed+': admission outcome inconsistent');
 }else{
  assert.ok(outcome.includes('kabul edilmedi'),seed+': rejection outcome inconsistent');
  assert.equal(after.location.cityId,before.city,seed+': rejection moved character');
 }
 assert.deepEqual(validateState(after),[],seed+': state invalid');
 return {seed,admitted,programId:option.id,requiresMove:option.cityId!==before.city,
  cashBefore:before.cash,debtBefore:before.debt,debtAfter:after.finance?.debt??0,
  outcome};
}
test('choice consequence audit: 60 work-path and 60 university-path decisions',()=>{
 const jobs=Array.from({length:COUNT},(_,i)=>runJob(i));
 const universities=Array.from({length:COUNT},(_,i)=>runUniversity(i));
 const attemptedJobs=jobs.filter(x=>!x.skipped),applications=universities.filter(x=>!x.skipped);
 const borrow=attemptedJobs.filter(x=>x.financedByDebt);
 const summary={
  jobDecisions:attemptedJobs.length,universityDecisions:applications.length,
  workSkipped:jobs.filter(x=>x.skipped),
  universitySkipped:universities.filter(x=>x.skipped),
  jobMoves:attemptedJobs.filter(x=>x.requiresMove).length,
  movesFinancedByEmergencyDebt:borrow.length,
  emergencyDebtExamples:borrow.slice(0,5),
  admissions:applications.filter(x=>x.admitted).length,
  universityRejections:applications.filter(x=>!x.admitted).length,
  universityExamples:applications.slice(0,3)
 };
 console.log('DECISION_CONSEQUENCE_AUDIT_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('DECISION_CONSEQUENCE_AUDIT_END');
 assert.ok(attemptedJobs.length>=45,'too few job offers to audit');
 assert.ok(applications.length>=45,'too few university applications to audit');
});
