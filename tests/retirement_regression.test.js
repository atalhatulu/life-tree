import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';
import {retire} from '../src/career/retirement_system.js';
import {acceptJob,generateJobOffers} from '../src/career/job_market.js';
import {RNG} from '../src/core/rng.js';
import {switchJob} from '../src/career/career_system.js';

test('retirement clears stale job offers and prevents reemployment',()=>{
 const g=new Game('retirement-offers');
 const s=g.state;
 s.player.age=66;
 s.player.jobId='developer';
 s.career={employed:true,monthlyIncome:50000,totalYears:25,title:'Developer'};
 s.pendingJobOffers=[{id:'developer'}];
 s.pendingCareerOffers=[{id:'developer'}];
 retire(s);
 assert.equal(s.career.employed,false);
 assert.equal(s.player.jobId,null);
 assert.equal(s.pendingJobOffers,null);
 assert.equal(s.pendingCareerOffers,null);
 assert.throws(()=>acceptJob(s,'developer'),/Emeklilik/);
 assert.throws(()=>switchJob(s,{id:'developer'}),/Emeklilik/);
 assert.equal(s.career.employed,false);
 assert.deepEqual(generateJobOffers(s,new RNG('retirement-offers')),[]);
});

test('balance-regression-5 does not resume employment after retirement',()=>{
 const g=new Game('balance-regression-5');
 autoplay(g,{toAge:75,policy:'human-like'});
 assert.deepEqual(validateState(g.state),[]);
 assert.equal(Boolean(g.state.retirement?.retired&&g.state.career?.employed),false);
});

test('business retirement removes pending employment offers',()=>{
 const g=new Game('business-retirement-offers');
 const s=g.state;
 s.player.age=66;
 s.career={employed:false,totalYears:0};
 s.business={active:true,mode:'full-time',years:10,capital:120000,health:75,monthlyProfit:15000};
 s.pendingJobOffers=[{id:'cleaner'}];
 s.pendingCareerOffers=[{id:'cook'}];
 retire(s);
 assert.equal(s.retirement.source,'business');
 assert.equal(s.pendingJobOffers,null);
 assert.equal(s.pendingCareerOffers,null);
 assert.deepEqual(generateJobOffers(s,new RNG('business-retirement-offers')),[]);
});
