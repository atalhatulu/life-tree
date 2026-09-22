import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {deepenCareerState,processCareerDynamics} from '../src/career/career_system.js';
import {affordableHomeOptions,buyHome} from '../src/assets/asset_system.js';
import {processPersonalFinanceYear,ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {validateState} from '../src/simulation/invariants.js';

test('lead promotion requires deep experience and strong career signals',()=>{
 const g=new Game('lead-gate');
 g.state.player.age=40;
 g.state.career={employed:true,jobId:'developer',title:'Yazılımcı',monthlyIncome:100000,years:13,totalYears:13,performance:95,degreeRelated:true,level:3,levelTitle:'senior',satisfaction:65,stability:70,network:90,companyFit:90,sector:'private'};
 deepenCareerState(g.state);
 const rng={int:()=>0,chance:()=>true,fork:()=>rng};
 processCareerDynamics(g.state,rng);
 assert.notEqual(g.state.career.levelTitle,'lead');
});

test('home purchase accepts a 12 percent down payment',()=>{
 const g=new Game('home-down-payment');
 g.state.player.age=35;
 ensurePersonalFinance(g.state);
 g.state.career={employed:true,monthlyIncome:100000};
 g.state.finance.cash=1000000;
 const options=affordableHomeOptions(g.state);
 assert.ok(options.length>0);
 const home=options[0];
 const before=g.state.finance.cash;
 buyHome(g.state,home.id);
 assert.equal(g.state.finance.cash,before-Math.round(home.price*.12));
 assert.ok(g.state.finance.debts.housing>0);
});

test('moderate unresolved deficit becomes consumer debt before emergency debt',()=>{
 const g=new Game('consumer-deficit');
 g.state.player.age=30;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=0;g.state.finance.savings=0;
 g.state.career={employed:true,monthlyIncome:25000};
 g.state.finance.lifestyle={housing:'apartment',food:'premium',clothing:'premium',transport:'public'};
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.debts.consumer>0);
});

test('calibration C remains invariant-valid after finance processing',()=>{
 const g=new Game('cal-c-invariant');
 ensurePersonalFinance(g.state);
 g.state.career={employed:true,monthlyIncome:80000};
 processPersonalFinanceYear(g.state);
 assert.deepEqual(validateState(g.state),[]);
});
