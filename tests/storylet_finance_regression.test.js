import test from 'node:test';
import assert from 'node:assert/strict';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';

const event=id=>systemicStorylets.find(storylet=>storylet.id===id);
const choice=(storylet,state,id)=>{
 const choices=typeof storylet.choices==='function'?storylet.choices(state):storylet.choices;
 return choices.find(option=>option.id===id);
};

function coupleState(cash,savings=1200){
 return {
  player:{age:36},finance:{cash,savings},
  social:{romance:{trust:85,sharedGoals:80,moneyAlignment:60}},
  storyletCooldowns:{},storyletCounts:{}
 };
}

test('financial-goal moves funds from cash to savings without creating wealth',()=>{
 for(const cash of [0,2000,7000]){
  const state=coupleState(cash);
  const before=state.finance.cash+state.finance.savings;
  choice(event('storylet-secure-couple-future'),state,'financial-goal').effect(state);
  const moved=Math.min(cash,5000);
  assert.equal(state.finance.cash,cash-moved);
  assert.equal(state.finance.savings,1200+moved);
  assert.equal(state.finance.cash+state.finance.savings,before);
  assert.equal(state.storyletCounts['future-plan'],1);
 }
});

function childState(cash){
 return {
  player:{age:39},finance:{cash},children:[{
   id:'kid',name:'Child',age:12,relationship:70,
   parenting:{emotionalSecurity:40,accumulatedSupport:0}
  }],storyletCooldowns:{},storyletCounts:{}
 };
}

test('paid child support cannot be chosen or awarded without sufficient cash',()=>{
 const state=childState(4000);
 const buy=choice(event('storylet-child-needs-you'),state,'buy-support');
 assert.equal(buy.condition(state),false);
 assert.ok(!new EventEngine().choicesFor(state,event('storylet-child-needs-you')).some(option=>option.id==='buy-support'));
 buy.effect(state);
 assert.equal(state.finance.cash,4000);
 assert.equal(state.children[0].parenting.accumulatedSupport,0);
 assert.equal(state.children[0].relationship,70);
 assert.equal(state.storyletCounts['child-needs']??0,0);
});

test('paid child support deducts the full cost and grants the expected benefit',()=>{
 const state=childState(5000);
 const buy=choice(event('storylet-child-needs-you'),state,'buy-support');
 assert.equal(buy.condition(state),true);
 assert.ok(new EventEngine().choicesFor(state,event('storylet-child-needs-you')).some(option=>option.id==='buy-support'));
 buy.effect(state);
 assert.equal(state.finance.cash,0);
 assert.equal(state.children[0].parenting.accumulatedSupport,5);
 assert.equal(state.children[0].relationship,73);
 assert.equal(state.storyletCounts['child-needs'],1);
});
