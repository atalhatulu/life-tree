import test from 'node:test';
import assert from 'node:assert/strict';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';

const event=id=>systemicStorylets.find(item=>item.id===id);
const options=(id,state)=>new EventEngine().choicesFor(state,event(id));
const choice=(id,state,option)=>options(id,state).find(item=>item.id===option);

function adultState(cash,alive=true){
 return {
  player:{age:55},finance:{cash},children:[{id:'adult',name:'Yetişkin',age:26,alive,relationship:60}],
  storyletCooldowns:{},storyletCounts:{}
 };
}

function burnoutState(cash){
 return {
  player:{age:40},finance:{cash},career:{workplace:{burnout:85}},
  healthProfile:{stress:65},storyletCooldowns:{},storyletCounts:{}
 };
}

test('adult child aid cannot create negative cash or grant free benefits when funds change',()=>{
 const insufficient=adultState(14999);
 assert.ok(!options('storylet-adult-child-request',insufficient).some(item=>item.id==='help-money'));
 const s=adultState(15000);
 const give=choice('storylet-adult-child-request',s,'help-money');
 assert.ok(give);
 s.finance.cash=12000; // Balance can change between presentation and execution.
 give.effect(s);
 assert.equal(s.finance.cash,12000);
 assert.equal(s.children[0].relationship,60);
 assert.equal(s.storyletCounts['adult-child-request']??0,0);
 s.finance.cash=15000;
 give.effect(s);
 assert.equal(s.finance.cash,0);
 assert.equal(s.children[0].relationship,66);
 assert.equal(s.storyletCounts['adult-child-request'],1);
});

test('vacation never grants paid relief when funds disappear before effect',()=>{
 const insufficient=burnoutState(11999);
 assert.ok(!options('storylet-burnout-crossroads',insufficient).some(item=>item.id==='vacation'));
 const s=burnoutState(12000);
 const vacation=choice('storylet-burnout-crossroads',s,'vacation');
 assert.ok(vacation);
 s.finance.cash=10000;
 vacation.effect(s);
 assert.equal(s.finance.cash,10000);
 assert.equal(s.career.workplace.burnout,85);
 assert.equal(s.healthProfile.stress,65);
 assert.equal(s.storyletCounts['burnout-crossroads']??0,0);
 s.finance.cash=12000;
 vacation.effect(s);
 assert.equal(s.finance.cash,0);
 assert.equal(s.career.workplace.burnout,71);
 assert.equal(s.healthProfile.stress,55);
 assert.equal(s.storyletCounts['burnout-crossroads'],1);
});

test('deceased children are not eligible for adult support or childhood attention',()=>{
 const adult=adultState(25000,false);
 assert.equal(event('storylet-adult-child-request').condition(adult),false);
 assert.deepEqual(options('storylet-adult-child-request',adult),[]);
 adult.children.push({id:'living',name:'Yaşayan',age:23,alive:true,relationship:70});
 assert.equal(event('storylet-adult-child-request').condition(adult),true);
 const aid=choice('storylet-adult-child-request',adult,'help-money');
 assert.match(aid.label,/Yaşayan/);
 aid.effect(adult);
 assert.equal(adult.children[0].relationship,60);
 assert.equal(adult.children[1].relationship,76);
 assert.equal(adult.finance.cash,10000);

 const minor={player:{age:38},finance:{cash:10000},children:[
  {id:'dead',name:'Ölen',age:12,alive:false,relationship:50,parenting:{emotionalSecurity:40}},
  {id:'living',name:'Yaşayan',age:14,alive:true,relationship:60,parenting:{emotionalSecurity:45}}
 ],storyletCooldowns:{},storyletCounts:{}};
 assert.equal(event('storylet-child-needs-you').condition(minor),true);
 const attention=choice('storylet-child-needs-you',minor,'make-time');
 assert.match(attention.label,/Yaşayan/);
 attention.effect(minor);
 assert.equal(minor.children[0].relationship,50);
 assert.equal(minor.children[1].relationship,68);
 minor.children[1].alive=false;
 assert.equal(event('storylet-child-needs-you').condition(minor),false);
 assert.deepEqual(options('storylet-child-needs-you',minor),[]);
});

test('legacy child records without alive flags remain eligible',()=>{
 const adult=adultState(20000);
 delete adult.children[0].alive;
 assert.equal(event('storylet-adult-child-request').condition(adult),true);
 assert.ok(choice('storylet-adult-child-request',adult,'help-money'));
 const minor={player:{age:36},children:[{id:'legacy',name:'Eski kayıt',age:11,parenting:{emotionalSecurity:40}}],storyletCooldowns:{},storyletCounts:{}};
 assert.equal(event('storylet-child-needs-you').condition(minor),true);
 assert.ok(choice('storylet-child-needs-you',minor,'make-time'));
});

test('aid choices do not charge or change a child who dies after presentation',()=>{
 const adult=adultState(20000);
 const aid=choice('storylet-adult-child-request',adult,'help-money');
 adult.children[0].alive=false;
 aid.effect(adult);
 assert.equal(adult.finance.cash,20000);
 assert.equal(adult.children[0].relationship,60);
 assert.equal(adult.storyletCounts['adult-child-request']??0,0);

 const minor={player:{age:36},finance:{cash:7000},children:[{
  id:'minor',name:'Çocuk',age:12,alive:true,relationship:65,
  parenting:{emotionalSecurity:45,accumulatedSupport:0}
 }],storyletCooldowns:{},storyletCounts:{}};
 const support=choice('storylet-child-needs-you',minor,'buy-support');
 minor.children[0].alive=false;
 support.effect(minor);
 assert.equal(minor.finance.cash,7000);
 assert.equal(minor.children[0].parenting.accumulatedSupport,0);
 assert.equal(minor.storyletCounts['child-needs']??0,0);
});
