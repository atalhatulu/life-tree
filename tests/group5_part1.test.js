import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {ensureMilitaryState,refreshMilitaryEligibility,completeMilitaryService,deferMilitaryService,paidMilitaryFee,processMilitaryYear} from '../src/life/military_service.js';
import {ensureMiddleAgeState,processMiddleAgeYear} from '../src/life/middle_age_system.js';

test('military service applies only to eligible male characters',()=>{
 const g=new Game('military-eligibility');
 g.state.player.age=20;
 g.state.player.sex='male';
 const m=refreshMilitaryEligibility(g.state);
 assert.equal(m.eligible,true);
 assert.equal(m.status,'pending');
 g.state.player.sex='female';
 g.state.militaryService=null;
 assert.equal(ensureMilitaryState(g.state).status,'not-applicable');
});

test('university enrollment defers military service',()=>{
 const g=new Game('military-defer-university');
 g.state.player.sex='male';
 g.state.player.age=21;
 g.state.higherEducation={enrolled:true};
 const m=refreshMilitaryEligibility(g.state);
 assert.equal(m.status,'deferred');
 assert.ok(m.deferredUntilAge>g.state.player.age);
});

test('paid military service charges fee and completes in one month',()=>{
 const g=new Game('military-paid');
 g.state.player.sex='male';
 g.state.player.age=24;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=1000000;
 const fee=paidMilitaryFee(g.state);
 const before=g.state.finance.cash;
 const m=completeMilitaryService(g.state,'paid');
 assert.equal(m.status,'completed');
 assert.equal(m.serviceMonths,1);
 assert.equal(m.paidFee,fee);
 assert.equal(g.state.finance.cash,before-fee);
});

test('standard military service creates career leave and restores income next year',()=>{
 const g=new Game('military-standard');
 g.state.player.sex='male';
 g.state.player.age=25;
 g.state.year=2051;
 g.state.career={employed:true,title:'Mühendis',jobId:'engineer',monthlyIncome:90000,stability:60};
 g.state.player.monthlyIncome=90000;
 const m=completeMilitaryService(g.state,'standard');
 assert.equal(m.serviceMonths,6);
 assert.ok(g.state.career.serviceLeave);
 assert.equal(g.state.player.monthlyIncome,0);
 g.state.player.age++;
 g.state.year++;
 const entries=processMilitaryYear(g.state);
 assert.equal(g.state.player.monthlyIncome,90000);
 assert.equal(g.state.career.serviceLeave,undefined);
 assert.ok(entries.length>0);
});

test('middle-age state starts only in middle adulthood',()=>{
 const g=new Game('middle-age-state');
 g.state.player.age=34;
 assert.equal(ensureMiddleAgeState(g.state),null);
 g.state.player.age=40;
 assert.ok(ensureMiddleAgeState(g.state));
});

test('middle-age burnout pressure reacts to sustained stress and work streak',()=>{
 const g=new Game('middle-age-burnout');
 g.state.player.age=45;
 g.state.healthProfile={conditions:[],stress:85,fitness:45,lastCheckupAge:null,riskExposure:{}};
 g.state.career={employed:true,satisfaction:25};
 g.state.activityMemory={'work-hard':{streak:6}};
 const m=ensureMiddleAgeState(g.state);
 const before=m.burnoutPressure;
 processMiddleAgeYear(g.state,{chance:()=>false});
 assert.ok(m.burnoutPressure>before);
});

test('middle-age milestone creates reflective content',()=>{
 const g=new Game('middle-age-reflection');
 g.state.player.age=50;
 g.state.healthProfile={conditions:[],stress:30,fitness:50,lastCheckupAge:null,riskExposure:{}};
 g.state.career={employed:true,satisfaction:60};
 const entries=processMiddleAgeYear(g.state,{chance:()=>false});
 assert.ok(entries.some(e=>e.kind==='life'));
});
