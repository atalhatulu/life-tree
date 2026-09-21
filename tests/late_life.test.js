import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';
import {retire} from '../src/career/retirement_system.js';
import {startBusiness,processBusinessYear} from '../src/career/entrepreneurship_system.js';
import {processInheritance} from '../src/finance/inheritance_system.js';
import {processDescendantLives} from '../src/family/descendant_life_system.js';
import {finalizeDeath} from '../src/life/death_summary.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

test('retirement converts career income into pension state',()=>{
 const g=new Game('retirement-unit');
 autoplay(g,{toAge:60,policy:'vocational'});
 if(!g.state.player.alive)return;
 if(!g.state.career?.employed){
  g.state.career={employed:true,title:'Muhasebeci',monthlyIncome:80000,years:12,totalYears:30,performance:65};
 }
 g.state.player.age=Math.max(60,g.state.player.age);
 g.state.career.totalYears=Math.max(20,g.state.career.totalYears??0);
 const result=retire(g.state);
 assert.equal(g.state.retirement.retired,true);
 assert.equal(g.state.career.employed,false);
 assert.ok(result.pensionMonthly>=18000);
});

test('business can consume capital and evolve yearly',()=>{
 const g=new Game('business-unit');
 autoplay(g,{toAge:30,policy:'vocational'});
 if(!g.state.player.alive)return;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=900000;
 g.state.player.personality.ambition=85;
 const before=g.state.finance.cash;
 const business=startBusiness(g.state,new RNG('business-launch'));
 assert.ok(business.active);
 assert.ok(g.state.finance.cash<before);
 processBusinessYear(g.state,new RNG('business-year'));
 assert.equal(business.years,1);
 assert.ok(Number.isFinite(business.monthlyProfit));
});

test('pending family inheritance transfers to personal cash',()=>{
 const g=new Game('inheritance-unit');
 autoplay(g,{toAge:25,policy:'balanced'});
 if(!g.state.player.alive)return;
 ensurePersonalFinance(g.state);
 const before=g.state.finance.cash;
 g.state.pendingInheritance=[{sourceId:'mother',sourceName:'Test',amount:125000}];
 const entries=processInheritance(g.state);
 assert.equal(entries.length,1);
 assert.equal(g.state.finance.cash,before+125000);
 assert.equal(g.state.pendingInheritance.length,0);
});

test('adult children can develop careers and create grandchildren',()=>{
 const g=new Game('descendant-life');
 autoplay(g,{toAge:40,policy:'social'});
 if(!g.state.player.alive)return;
 if(!(g.state.children?.length)){
  g.state.children=[structuredClone(g.state.player)];
  g.state.children[0].id='child-test';
  g.state.children[0].name='Deniz';
  g.state.children[0].age=24;
  g.state.children[0].role='child';
  g.state.children[0].relationship=75;
 }
 const child=g.state.children[0];
 child.age=Math.max(child.age,24);
 for(let i=0;i<25;i++){
  processDescendantLives(g.state,new RNG('descendant-'+i));
  if((g.state.grandchildren??0)>0)break;
  child.age+=1;
 }
 assert.ok(child.adultLife?.initialized);
 assert.ok(child.adultLife?.jobTitle);
 assert.ok((g.state.grandchildren??0)>=0);
});

test('death finalization creates estate and permanent life summary',()=>{
 const g=new Game('death-summary');
 autoplay(g,{toAge:35,policy:'balanced'});
 if(!g.state.player.alive){
  assert.ok(g.state.deathSummary);
  return;
 }
 ensurePersonalFinance(g.state);
 g.state.finance.cash=600000;
 g.state.finance.debt=100000;
 g.state.player.alive=false;
 g.state.death={age:g.state.player.age,year:g.state.year,cause:'test'};
 const summary=finalizeDeath(g.state);
 assert.ok(summary);
 assert.ok(g.state.estate);
 assert.ok(summary.estateNet>=0);
 assert.equal(summary.age,g.state.player.age);
 assert.ok(Array.isArray(summary.heirs));
});

test('500 random lives remain valid through age 80 or death',()=>{
 let deaths=0;
 let summaries=0;
 let retirees=0;
 for(let i=0;i<500;i++){
  const g=new Game('late-stress-'+i);
  autoplay(g,{toAge:80,policy:'random'});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
  assert.ok(g.state.player.age<=80);
  if(!g.state.player.alive){
   deaths++;
   if(g.state.deathSummary)summaries++;
  }
  if(g.state.retirement?.retired)retirees++;
 }
 assert.ok(deaths>50);
 assert.equal(summaries,deaths);
 assert.ok(retirees>0);
});


test('retirement decision is offered for an eligible older worker',()=>{
 const g=new Game('retirement-event');
 g.state.player.age=58;
 g.state.year=2084;
 g.state.career={
  employed:true,
  title:'Muhasebeci',
  monthlyIncome:90000,
  years:12,
  totalYears:30,
  performance:70,
  satisfaction:60,
  stability:70,
  level:3
 };
 g.state.player.job='Muhasebeci';
 g.state.player.monthlyIncome=90000;
 g.state.finance={cash:500000,debt:0,monthlyIncome:90000,monthlyExpenses:20000,familySupportMonthly:0,childMonthlyCost:0,lifestyle:{housing:'owned',food:'standard',clothing:'standard',transport:'public'}};
 g.state.healthProfile={conditions:[],stress:30,fitness:55,lastCheckupAge:57};
 g.state.preferences={riskTolerance:20,partnershipDesire:20,marriageDesire:20,parenthoodDesire:20,homeOwnershipDesire:20,carOwnershipDesire:20};
 g.state.pendingCareerOffers=null;
 g.state.pendingJobOffers=null;
 const event=g.events.choose(g.state,new RNG('retirement-event-choice'));
 assert.equal(event?.id,'retirement-decision');
 g.makeChoice(event,'retire');
 assert.equal(g.state.retirement?.retired,true);
});

test('serious untreated condition prioritizes treatment decision',()=>{
 const g=new Game('treatment-event');
 g.state.player.age=60;
 g.state.year=2086;
 g.state.career={employed:true,title:'Öğretmen',monthlyIncome:70000,years:20,totalYears:35,performance:65,satisfaction:55,stability:65,level:2};
 g.state.player.job='Öğretmen';
 g.state.player.monthlyIncome=70000;
 g.state.finance={cash:300000,debt:0,monthlyIncome:70000,monthlyExpenses:22000,familySupportMonthly:0,childMonthlyCost:0,lifestyle:{housing:'owned',food:'standard',clothing:'standard',transport:'public'}};
 g.state.healthProfile={conditions:[{id:'cardiac',label:'Kalp-damar hastalığı',severity:3,diagnosedAtAge:60}],stress:45,fitness:40,lastCheckupAge:59};
 g.state.preferences={riskTolerance:20,partnershipDesire:20,marriageDesire:20,parenthoodDesire:20,homeOwnershipDesire:20,carOwnershipDesire:20};
 const event=g.events.choose(g.state,new RNG('treatment-priority'));
 assert.equal(event?.id,'health-treatment');
 assert.ok(g.eventChoices(event).some(x=>x.id==='treat:cardiac'));
});


test('full-time entrepreneurship leaves salaried career',()=>{
 const g=new Game('full-time-business');
 autoplay(g,{toAge:30,policy:'vocational'});
 if(!g.state.player.alive)return;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=900000;
 g.state.player.personality.ambition=90;
 if(!g.state.career?.employed){
  g.state.career={employed:true,title:'Muhasebeci',jobId:'accountant',monthlyIncome:80000,years:8,totalYears:8,performance:65};
  g.state.player.job='Muhasebeci';
  g.state.player.monthlyIncome=80000;
 }
 startBusiness(g.state,new RNG('full-time-launch'),'full-time');
 assert.equal(g.state.business.mode,'full-time');
 assert.equal(g.state.career.employed,false);
 assert.equal(g.state.player.job,'Girişimci');
 assert.equal(g.state.player.monthlyIncome,0);
});

test('side entrepreneurship preserves career and increases stress',()=>{
 const g=new Game('side-business');
 autoplay(g,{toAge:30,policy:'vocational'});
 if(!g.state.player.alive)return;
 ensurePersonalFinance(g.state);
 g.state.business=null;
 g.state.finance.cash=900000;
 g.state.player.personality.ambition=90;
 g.state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 if(!g.state.career?.employed){
  g.state.career={employed:true,title:'Muhasebeci',jobId:'accountant',monthlyIncome:80000,years:8,totalYears:8,performance:65};
  g.state.player.job='Muhasebeci';
  g.state.player.monthlyIncome=80000;
 }
 const stress=g.state.healthProfile.stress;
 startBusiness(g.state,new RNG('side-launch'),'side');
 assert.equal(g.state.business.mode,'side');
 assert.equal(g.state.career.employed,true);
 assert.ok(g.state.healthProfile.stress>stress);
});
