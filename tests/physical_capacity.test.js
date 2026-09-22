import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {physicalCapacity,activityEfficiency,treatmentResilience} from '../src/health/physical_capacity.js';
import {progressCareerYear} from '../src/career/job_market.js';
import {treatCondition} from '../src/health/treatment_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

function adult(seed,health,fitness){
 const g=new Game(seed);
 g.state.player.age=45;
 g.state.player.health.current=health;
 g.state.player.health.constitution=60;
 g.state.healthProfile={conditions:[],stress:35,fitness,lastCheckupAge:null};
 return g;
}

test('physical capacity combines current health and fitness',()=>{
 const strong=adult('capacity-strong',90,85);
 const weak=adult('capacity-weak',25,20);
 assert.ok(physicalCapacity(strong.state)>80);
 assert.ok(physicalCapacity(weak.state)<30);
 assert.ok(activityEfficiency(strong.state)>activityEfficiency(weak.state));
});

test('low physical capacity produces lower career performance trajectory',()=>{
 const strong=adult('career-capacity-strong',90,90);
 const weak=adult('career-capacity-weak',20,20);
 for(const g of [strong,weak]){
  g.state.player.personality.discipline=70;
  g.state.player.personality.sociability=60;
  g.state.career={employed:true,jobId:'accountant',title:'Muhasebeci',monthlyIncome:70000,years:2,totalYears:2,performance:60,degreeRelated:false,level:1,satisfaction:55,stability:60};
 }
 const rng={int:()=>0,chance:()=>false};
 progressCareerYear(strong.state,rng);
 progressCareerYear(weak.state,rng);
 assert.ok(strong.state.career.performance>weak.state.career.performance);
});

test('treatment resilience falls when current physical condition is poor',()=>{
 const strong=adult('treatment-strong',90,90);
 const weak=adult('treatment-weak',20,20);
 assert.ok(treatmentResilience(strong.state)>treatmentResilience(weak.state));
});

test('same treatment roll can succeed in strong body and fail in weak body',()=>{
 const strong=adult('treatment-outcome-strong',90,90);
 const weak=adult('treatment-outcome-weak',20,20);
 for(const g of [strong,weak]){
  ensurePersonalFinance(g.state);
  g.state.finance.cash=200000;
  g.state.healthProfile.conditions=[{id:'cardiac',label:'Kalp-damar hastalığı',severity:3,diagnosedAtAge:45}];
 }
 const rng={next:()=>0,chance:p=>p>=.50};
 const a=treatCondition(strong.state,'cardiac',rng);
 const b=treatCondition(weak.state,'cardiac',rng);
 assert.equal(a.condition.treatmentSuccessful,true);
 assert.equal(b.condition.treatmentSuccessful,false);
});
