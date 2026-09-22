import test from 'node:test';
import assert from 'node:assert/strict';
import {annualActionCapacity} from '../src/life/action_capacity.js';
import {processHouseholdYear} from '../src/family/household_simulation.js';

test('young children and severe stress consume real yearly action capacity',()=>{
 const state={
  player:{age:32,health:{current:80}},
  healthProfile:{stress:82},
  children:[{age:2}]
 };
 assert.equal(annualActionCapacity(state),1);
});

test('healthy adult without care load keeps three yearly actions',()=>{
 const state={
  player:{age:32,health:{current:80}},
  healthProfile:{stress:35},
  children:[]
 };
 assert.equal(annualActionCapacity(state),3);
});

test('cohabiting partner career changes household income causally',()=>{
 const state={
  player:{age:35},
  healthProfile:{stress:30},
  social:{romance:{
   id:'p1',name:'Deniz',alive:true,status:'cohabiting',relationship:80,
   jobId:'office',monthlyIncome:50000
  }}
 };
 const rng={
  int:()=>2,
  fork:label=>({chance:()=>label==='partner-job-loss'})
 };
 const entries=processHouseholdYear(state,rng);
 assert.equal(state.social.romance.monthlyIncome,0);
 assert.equal(state.social.romance.career.employed,false);
 assert.ok(entries.some(entry=>entry.text.includes('işini kaybetti')));
});

test('stable married partner contribution responds to relationship and career income',()=>{
 const state={
  player:{age:40},
  healthProfile:{stress:30},
  social:{romance:{
   id:'p2',name:'Ece',alive:true,status:'married',relationship:88,
   jobId:'office',monthlyIncome:60000
  }}
 };
 const rng={int:()=>0,fork:()=>({chance:()=>false})};
 processHouseholdYear(state,rng);
 assert.ok(state.social.romance.householdContributionRate>.58);
 assert.equal(state.social.romance.monthlyIncome,60000);
});
