import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {ensurePersonalFinance,processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {evaluateParentCareNeed,setParentCareMode,processElderFamilyYear} from '../src/family/elder_system.js';
import {auditContentDensity} from '../src/simulation/content_density.js';
import {RNG} from '../src/core/rng.js';

function adultWithElder(seed='elder-care'){
 const g=new Game(seed);
 g.state.player.age=45;
 g.state.year=2071;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=500000;
 g.state.finance.savings=200000;
 g.state.career={employed:true,monthlyIncome:90000};
 g.state.healthProfile={conditions:[],stress:25,fitness:55,lastCheckupAge:null,riskExposure:{}};
 g.state.parents.mother.age=78;
 g.state.parents.mother.health.current=38;
 g.state.parents.mother.alive=true;
 return g;
}

test('aging parent can create a care need before player old age',()=>{
 const g=adultWithElder('elder-need');
 const parent=evaluateParentCareNeed(g.state);
 assert.ok(parent);
 assert.equal(g.state.parentCare.pendingParentId,parent.id);
});

test('sibling-shared elder care reduces direct monthly burden',()=>{
 const g=adultWithElder('elder-shared');
 g.state.siblings.push({...g.state.player,id:'adult-sibling',age:40,alive:true});
 evaluateParentCareNeed(g.state);
 const shared=setParentCareMode(g.state,'sibling-share');
 assert.equal(shared.active,true);
 assert.ok(shared.siblingShare>0);
 assert.ok(shared.monthlyCost<15000);
});

test('family elder care affects stress and relationship',()=>{
 const g=adultWithElder('elder-family');
 evaluateParentCareNeed(g.state);
 const parentId=g.state.parentCare.pendingParentId;
 const beforeStress=g.state.healthProfile.stress;
 const beforeRel=g.state.player.relationships?.[parentId]??60;
 setParentCareMode(g.state,'family');
 assert.ok(g.state.healthProfile.stress>beforeStress);
 assert.ok(g.state.player.relationships[parentId]>beforeRel);
});

test('active parent care contributes to household expenses',()=>{
 const g=adultWithElder('elder-cost');
 evaluateParentCareNeed(g.state);
 setParentCareMode(g.state,'home-care');
 processPersonalFinanceYear(g.state);
 assert.ok(g.state.finance.parentCareMonthlyCost>0);
 assert.ok(g.state.finance.monthlyExpenses>=g.state.finance.parentCareMonthlyCost);
});

test('parent death closes active care responsibility',()=>{
 const g=adultWithElder('elder-close');
 evaluateParentCareNeed(g.state);
 setParentCareMode(g.state,'family');
 const parent=[g.state.parents.mother,g.state.parents.father].find(p=>p.id===g.state.parentCare.parentId);
 parent.alive=false;
 processElderFamilyYear(g.state,new RNG('elder-close-year'));
 assert.equal(g.state.parentCare.active,false);
 assert.equal(g.state.parentCare.monthlyCost,0);
});

test('content density distinguishes active and quiet age bands',()=>{
 const g=new Game('density');
 g.state.player.age=65;
 g.state.history=[
  {age:10,kind:'education',text:'school'},
  {age:14,kind:'choice',eventId:'path'},
  {age:20,kind:'career',text:'job'},
  {age:21,kind:'finance',text:'routine'},
  {age:30,kind:'relationship',text:'partner'},
  {age:45,kind:'family',text:'family'},
  {age:62,kind:'health',text:'health'}
 ];
 const d=auditContentDensity(g.state);
 assert.ok(d['13-18'].densityPct>0);
 assert.ok(d['19-25'].meaningfulEntries===1);
 assert.ok(d['26-40'].quietYears>0);
 assert.ok(d['61+'].densityPct>0);
});
