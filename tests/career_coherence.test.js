import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {generateJobOffers} from '../src/career/job_market.js';
import {ensureCareerProfile,recordCareerYear,archiveCareer} from '../src/career/career_profile.js';

function employed(game,{jobId,title,income=90000,years=8,satisfaction=55}){
 game.state.player.age=35;
 game.state.career={
  employed:true,jobId,title,monthlyIncome:income,years,totalYears:years,
  performance:70,degreeRelated:false,level:2,satisfaction,stability:60,
  previousJobs:[]
 };
 game.state.player.job=title;
 game.state.player.jobId=jobId;
 game.state.player.monthlyIncome=income;
 const profile=ensureCareerProfile(game.state);
 for(let i=0;i<years;i++)recordCareerYear(game.state);
 return profile;
}

test('developer career switch never offers unrelated mechanic or cleaner roles',()=>{
 const g=new Game('dev-coherence');
 employed(g,{jobId:'developer',title:'Yazılımcı',income:120000,years:9});
 const offers=generateJobOffers(g.state,new RNG('dev-switch'),10,{mode:'career-switch'});
 const ids=offers.map(x=>x.id);
 assert.equal(ids.includes('mechanic'),false);
 assert.equal(ids.includes('cleaner'),false);
 assert.equal(ids.includes('cook'),false);
 assert.ok(ids.every(id=>['designer','engineer'].includes(id)));
});

test('mechanic cannot jump directly into regulated or professional degree careers',()=>{
 const g=new Game('mechanic-coherence');
 employed(g,{jobId:'mechanic',title:'Oto tamircisi',income:60000,years:10});
 const offers=generateJobOffers(g.state,new RNG('mechanic-switch'),20,{mode:'career-switch'});
 const ids=offers.map(x=>x.id);
 for(const forbidden of ['doctor','nurse','lawyer','teacher','developer','designer']){
  assert.equal(ids.includes(forbidden),false,forbidden+' should not be offered');
 }
 assert.ok(ids.includes('driver'));
});

test('regulated professions require matching completed degree',()=>{
 const g=new Game('regulated-jobs');
 g.state.player.age=24;
 g.state.higherEducation={completed:true,careerTags:['developer'],programTitle:'Bilgisayar Bilimleri'};
 const offers=generateJobOffers(g.state,new RNG('regulated'),20,{mode:'entry'});
 const ids=offers.map(x=>x.id);
 assert.equal(ids.includes('doctor'),false);
 assert.equal(ids.includes('lawyer'),false);
 assert.equal(ids.includes('teacher'),false);
 assert.equal(ids.includes('nurse'),false);
 assert.ok(ids.includes('developer'));
});

test('first graduate job stays tied to degree when a matching job exists',()=>{
 const g=new Game('degree-first-job');
 g.state.player.age=24;
 g.state.higherEducation={completed:true,careerTags:['designer'],programTitle:'Sanat ve Tasarım'};
 const offers=generateJobOffers(g.state,new RNG('arts-entry'),10,{mode:'entry'});
 assert.ok(offers.length>0);
 assert.ok(offers.every(x=>x.id==='designer'));
});

test('reemployment prioritizes prior occupation and career family',()=>{
 const g=new Game('reemployment-memory');
 const profile=employed(g,{jobId:'accountant',title:'Muhasebeci',income:80000,years:7});
 archiveCareer(g.state,'fired');
 g.state.career.employed=false;
 g.state.career.exitReason='fired';
 g.state.player.job=null;
 g.state.player.jobId=null;
 const offers=generateJobOffers(g.state,new RNG('reemploy'),8,{mode:'reemployment'});
 assert.ok(offers.length>0);
 assert.equal(offers[0].id,'accountant');
 assert.equal(profile.coreFamily,'business');
});

test('recent voluntary career exit blocks immediate ping-pong return',()=>{
 const g=new Game('ping-pong');
 employed(g,{jobId:'developer',title:'Yazılımcı',income:110000,years:6});
 archiveCareer(g.state,'career-switch');
 g.state.career={
  employed:true,jobId:'designer',title:'Tasarımcı',monthlyIncome:100000,
  years:2,totalYears:8,performance:65,degreeRelated:true,level:1,satisfaction:45,stability:60,previousJobs:[]
 };
 g.state.player.job='Tasarımcı';
 g.state.player.jobId='designer';
 const offers=generateJobOffers(g.state,new RNG('ping-pong-switch'),10,{mode:'career-switch'});
 assert.equal(offers.some(x=>x.id==='developer'),false);
});

test('satisfied worker does not voluntarily accept a huge unexplained salary collapse',()=>{
 const g=new Game('salary-cliff');
 employed(g,{jobId:'developer',title:'Yazılımcı',income:150000,years:12,satisfaction:70});
 const offers=generateJobOffers(g.state,new RNG('salary-cliff-switch'),10,{mode:'career-switch'});
 assert.ok(offers.every(x=>x.salary>=97500));
});
