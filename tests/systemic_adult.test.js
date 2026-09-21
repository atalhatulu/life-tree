import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';
import {lifestyleMonthlyCost,setLifestyle} from '../src/lifestyle/lifestyle_system.js';
import {ensureAssets,buyCar,affordableCarOptions,buyHome,affordableHomeOptions} from '../src/assets/asset_system.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {marryPartner} from '../src/social/partnership_system.js';
import {addChild} from '../src/family/parenting_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

test('independent housing costs more than living with family',()=>{
 const g=new Game('lifestyle-cost');
 autoplay(g,{toAge:22,policy:'vocational'});
 ensurePersonalFinance(g.state);
 const familyCost=lifestyleMonthlyCost(g.state);
 setLifestyle(g.state,{housing:'studio'});
 const studioCost=lifestyleMonthlyCost(g.state);
 assert.ok(studioCost>familyCost);
});

test('car purchase creates asset, debt and car lifestyle',()=>{
 const g=new Game('asset-car');
 autoplay(g,{toAge:30,policy:'vocational'});
 ensurePersonalFinance(g.state);
 ensureAssets(g.state);
 g.state.finance.cash=1000000;
 const option=affordableCarOptions(g.state)[0];
 assert.ok(option);
 const before=g.state.finance.cash;
 buyCar(g.state,option.id);
 assert.ok(g.state.assets.car);
 assert.equal(g.state.finance.lifestyle.transport,'car');
 assert.ok(g.state.finance.cash<before);
 assert.ok(g.state.finance.debt>0);
});

test('home purchase creates owned housing and mortgage debt',()=>{
 const g=new Game('asset-home');
 autoplay(g,{toAge:32,policy:'balanced'});
 ensurePersonalFinance(g.state);
 ensureAssets(g.state);
 g.state.finance.cash=1500000;
 if(!g.state.career?.employed){
  g.state.career={employed:true,monthlyIncome:80000,performance:60};
 }
 g.state.career.monthlyIncome=Math.max(80000,g.state.career.monthlyIncome??0);
 const option=affordableHomeOptions(g.state)[0];
 assert.ok(option);
 buyHome(g.state,option.id);
 assert.ok(g.state.assets.home);
 assert.equal(g.state.finance.lifestyle.housing,'owned');
 assert.ok(g.state.finance.debt>0);
});

test('married partners can generate a genetically bounded child',()=>{
 const g=new Game('descendant');
 autoplay(g,{toAge:26,policy:'vocational'});
 ensurePersonalFinance(g.state);
 const rng=new RNG('descendant-partner');
 g.state.social.romance=createRomanticInterest(g.state,rng,'partner-test');
 g.state.social.romance.relationship=85;
 marryPartner(g.state);
 const child=addChild(g.state,rng.fork('child'));
 assert.equal(g.state.children.length,1);
 assert.equal(child.age,0);
 assert.ok(child.appearance.heightCm>=145&&child.appearance.heightCm<=205);
 assert.ok(child.health.constitution>=1&&child.health.constitution<=100);
 assert.ok(g.state.finance.childMonthlyCost>0);
});

test('balanced adulthood can create major adult Life Tree decisions',()=>{
 let foundAdultDecision=false;
 for(let i=0;i<80&&!foundAdultDecision;i++){
  const g=new Game('tree-adult-'+i);
  autoplay(g,{toAge:38,policy:'balanced'});
  foundAdultDecision=g.state.lifeTree.nodes.some(n=>[
   'adult-lifestyle','move-out','relationship-commitment','marriage-after-cohabiting',
   'child-decision','buy-car','buy-home','career-switch'
  ].includes(n.eventId));
 }
 assert.equal(foundAdultDecision,true);
});

test('1000 random lives remain valid through age 50 or death',()=>{
 let deaths=0;
 let reached40=0;
 for(let i=0;i<1000;i++){
  const g=new Game('long-life-'+i);
  autoplay(g,{toAge:50,policy:'random'});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
  assert.ok(g.state.player.age<=50);
  if(!g.state.player.alive){
   deaths++;
   assert.ok(g.state.death);
   assert.equal(g.state.death.age,g.state.player.age);
  }
  if(g.state.player.age>=40)reached40++;
 }
 assert.ok(reached40>900);
 assert.ok(deaths>=0);
});
