import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {generateJobOffers,acceptJob} from '../src/career/job_market.js';
import {ensureCareerProfile,recordCareerYear,archiveCareer} from '../src/career/career_profile.js';
import {deepenCareerState,processCareerDynamics,beginRetraining,processRetrainingYear} from '../src/career/career_system.js';
import {ensureUnemploymentState,processUnemploymentYear} from '../src/career/unemployment_system.js';

function employed(game,{jobId='developer',title='Yazılımcı',years=8,income=120000}={}){
 game.state.player.age=35;
 game.state.career={employed:true,jobId,title,monthlyIncome:income,years,totalYears:years,performance:82,degreeRelated:true,satisfaction:60,stability:65,previousJobs:[]};
 game.state.player.job=title;
 game.state.player.jobId=jobId;
 game.state.player.monthlyIncome=income;
 const p=ensureCareerProfile(game.state);
 for(let i=0;i<years;i++)recordCareerYear(game.state);
 return p;
}

test('career depth initializes human-readable level and workplace factors',()=>{
 const g=new Game('career-depth');
 employed(g,{years:8});
 deepenCareerState(g.state);
 assert.equal(g.state.career.levelTitle,'senior');
 assert.ok(Number.isFinite(g.state.career.network));
 assert.ok(Number.isFinite(g.state.career.companyFit));
});

test('career promotion progression respects experience bands',()=>{
 const g=new Game('career-promotion');
 employed(g,{years:20});
 g.state.career.levelTitle='senior';
 g.state.career.performance=95;
 g.state.career.network=90;
 g.state.career.companyFit=90;
 const rng={int:()=>0,chance:()=>true,fork:()=>rng};
 const entries=processCareerDynamics(g.state,rng);
 assert.equal(g.state.career.levelTitle,'lead');
 assert.ok(entries.some(e=>String(e.text).includes('Terfi')));
});

test('unrelated professional switch requires retraining rather than normal offer',()=>{
 const g=new Game('retrain-required');
 employed(g,{jobId:'accountant',title:'Muhasebeci',years:8,income:90000});
 const offers=generateJobOffers(g.state,new RNG('switch'),20,{mode:'career-switch'});
 assert.equal(offers.some(x=>x.id==='designer'),false);
 const r=beginRetraining(g.state,'designer');
 assert.equal(r.requiredYears,2);
 processRetrainingYear(g.state);
 processRetrainingYear(g.state);
 assert.equal(r.completed,true);
});

test('completed retraining can unlock a distant reemployment target',()=>{
 const g=new Game('retrained-reentry');
 employed(g,{jobId:'accountant',title:'Muhasebeci',years:8,income:90000});
 beginRetraining(g.state,'designer');
 g.state.retraining.yearsCompleted=2;
 g.state.retraining.completed=true;
 archiveCareer(g.state,'career-switch');
 g.state.career.employed=false;
 g.state.unemployedSinceAge=g.state.player.age;
 g.state.nextPath='work';
 const offers=generateJobOffers(g.state,new RNG('retrained-offers'),20,{mode:'reemployment'});
 assert.ok(offers.some(x=>x.id==='designer'));
});

test('long unemployment records duration and opens fallback work',()=>{
 const g=new Game('long-unemployment-depth');
 employed(g,{jobId:'developer',title:'Yazılımcı'});
 archiveCareer(g.state,'fired');
 g.state.career.employed=false;
 g.state.nextPath='work';
 g.state.unemployedSinceAge=31;
 g.state.player.age=35;
 g.state.healthProfile={conditions:[],stress:25,fitness:50,lastCheckupAge:null,riskExposure:{}};
 const u=ensureUnemploymentState(g.state);
 processUnemploymentYear(g.state);
 assert.equal(u.durationYears,4);
 assert.equal(u.longTerm,true);
 assert.equal(u.fallbackOpened,true);
 assert.equal(u.retrainingSuggested,true);
});

test('accepting a job clears active unemployment state on next normalization',()=>{
 const g=new Game('unemployment-clear');
 g.state.player.age=30;
 g.state.nextPath='work';
 g.state.unemployedSinceAge=27;
 ensureUnemploymentState(g.state);
 g.state.pendingJobOffers=generateJobOffers(g.state,new RNG('entry'),5,{mode:'entry'});
 const offer=g.state.pendingJobOffers[0];
 assert.ok(offer);
 acceptJob(g.state,offer.id);
 assert.equal(ensureUnemploymentState(g.state),null);
});
