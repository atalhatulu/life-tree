import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensureCareerProfile} from '../src/career/career_profile.js';
import {humanCapitalFor,promotionChance} from '../src/career/human_capital.js';
import {processOwnershipYear} from '../src/assets/ownership_lifecycle.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

function careerState(seed='capital'){
 const g=new Game(seed);
 g.state.player.age=36;
 g.state.career={employed:true,jobId:'developer',title:'Yazılımcı',years:8,performance:82,stability:75,monthlyIncome:100000};
 g.state.player.jobId='developer';
 g.state.higherEducation={completed:true,careerTags:['developer']};
 const p=ensureCareerProfile(g.state);
 p.experienceByJob.developer=8;
 p.experienceByFamily.tech=8;
 p.totalExperience=8;
 return g;
}

test('matching education and experience produce substantial human capital',()=>{
 const g=careerState('capital-strong');
 const capital=humanCapitalFor(g.state,'developer');
 assert.ok(capital.score>=65);
 assert.ok(capital.education>=90);
 assert.ok(capital.experience>=50);
});

test('career progression probability rises with accumulated human capital',()=>{
 const strong=careerState('capital-promotion');
 const weak=careerState('capital-weak');
 weak.state.career.years=2;
 weak.state.career.performance=71;
 weak.state.career.stability=45;
 weak.state.higherEducation={completed:false,careerTags:[]};
 weak.state.careerProfile.experienceByJob.developer=1;
 weak.state.careerProfile.experienceByFamily.tech=1;
 assert.ok(promotionChance(strong.state)>promotionChance(weak.state));
});

test('aging car creates concrete maintenance spending and condition wear',()=>{
 const g=new Game('ownership-car');
 g.state.player.age=45;
 ensurePersonalFinance(g.state);
 g.state.assets={home:null,car:{
  id:'compact',assetType:'car',price:1000000,purchasedAtAge:35,
  remainingDebt:300000,condition:60,maintenanceSpent:0
 }};
 const beforeDebt=g.state.assets.car.remainingDebt;
 const rng={int:(a,b)=>b,fork:()=>({int:(a,b)=>b})};
 const entries=processOwnershipYear(g.state,rng);
 assert.ok(g.state.assets.car.condition>60-20);
 assert.ok(g.state.assets.car.maintenanceSpent>0);
 assert.ok(g.state.assets.car.remainingDebt<beforeDebt);
 assert.ok(g.state.finance.spendingTotals.ownership>0);
 assert.ok(entries.length>0);
});

test('healthy owned home still ages without inventing maintenance every year',()=>{
 const g=new Game('ownership-home');
 g.state.player.age=42;
 ensurePersonalFinance(g.state);
 g.state.assets={car:null,home:{
  id:'flat',assetType:'home',price:5000000,purchasedAtAge:40,
  remainingDebt:3500000,condition:100,maintenanceSpent:0
 }};
 const rng={fork:()=>({int:()=>1})};
 processOwnershipYear(g.state,rng);
 assert.equal(g.state.assets.home.condition,99);
 assert.equal(g.state.assets.home.maintenanceSpent,0);
 assert.ok(g.state.assets.home.remainingDebt<3500000);
});
