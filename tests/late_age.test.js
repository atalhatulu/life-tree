import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {setRetirementStyle,setCareMode,ensureLateLifeState} from '../src/life/late_age_system.js';
import {setEstatePlan} from '../src/finance/estate_planning.js';
import {settleEstate} from '../src/finance/estate_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

test('active retirement improves mobility and fitness',()=>{
 const g=new Game('active-retirement');
 g.state.player.age=68;
 g.state.healthProfile={conditions:[],stress:40,fitness:45,lastCheckupAge:67};
 ensureLateLifeState(g.state);
 const mobility=g.state.lateLife.mobility;
 const fitness=g.state.healthProfile.fitness;
 setRetirementStyle(g.state,'active');
 assert.equal(g.state.lateLife.retirementStyle,'active');
 assert.ok(g.state.lateLife.mobility>mobility);
 assert.ok(g.state.healthProfile.fitness>fitness);
});

test('family elder care reduces isolation',()=>{
 const g=new Game('family-care');
 g.state.player.age=78;
 g.state.healthProfile={conditions:[],stress:50,fitness:30,lastCheckupAge:76};
 ensureLateLifeState(g.state);
 g.state.lateLife.isolation=65;
 setCareMode(g.state,'family');
 assert.equal(g.state.lateLife.careMode,'family');
 assert.ok(g.state.lateLife.isolation<65);
});

test('children-first estate plan allocates most family estate to children',()=>{
 const g=new Game('children-estate');
 g.state.player.age=75;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=1000000;
 g.state.finance.debt=0;
 g.state.children=[
  {id:'c1',name:'A',age:40,relationship:80},
  {id:'c2',name:'B',age:38,relationship:75}
 ];
 g.state.social.romance={name:'Eş',status:'married',alive:true};
 setEstatePlan(g.state,'children-first');
 const estate=settleEstate(g.state);
 const childAmount=estate.heirs.filter(h=>h.type==='child').reduce((s,h)=>s+h.amount,0);
 const spouseAmount=estate.heirs.filter(h=>h.type==='spouse').reduce((s,h)=>s+h.amount,0);
 assert.ok(childAmount>spouseAmount);
 assert.equal(estate.plan,'children-first');
});

test('charity estate plan creates a charitable heir share',()=>{
 const g=new Game('charity-estate');
 g.state.player.age=75;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=800000;
 setEstatePlan(g.state,'charity');
 const estate=settleEstate(g.state);
 assert.ok(estate.heirs.some(h=>h.type==='charity'&&h.amount>0));
});

test('elder-care event becomes eligible when care need is active',()=>{
 const g=new Game('elder-care-event');
 g.state.player.age=80;
 g.state.year=2106;
 g.state.healthProfile={conditions:[{id:'cardiac',severity:3,label:'Kalp-damar hastalığı',treated:true}],stress:40,fitness:25,lastCheckupAge:79};
 g.state.lateLife={mobility:30,isolation:40,careNeed:true,careMode:null,retirementStyle:'quiet'};
 const ids=g.events.eligible(g.state).map(e=>e.id);
 assert.ok(ids.includes('elder-care'));
});
