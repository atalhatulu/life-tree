import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseProceduralEventChoice} from '../src/simulation/procedural_decision_agent.js';
import {Game} from '../src/core/game.js';
import {processPartnershipYear} from '../src/social/partnership_system.js';

const maxRng={
 weighted(items){
  return items.reduce((best,item)=>item.weight>best.weight?item:best,items[0]).value;
 }
};

function fakeGame(state,choices){
 return {state,eventChoices:()=>choices};
}

test('procedural career decision rejects a severe pay cut when current career is healthy',()=>{
 const state={
  player:{age:35,health:{current:85},personality:{ambition:55,sociability:50}},
  finance:{cash:500000,savings:500000,debt:0,monthlyIncome:100000},
  healthProfile:{stress:30,fitness:65},
  career:{jobId:'developer',monthlyIncome:100000,satisfaction:72,stability:75},
  pendingCareerOffers:[{
   id:'engineer-cut',title:'Mühendis',salary:65000,experienceYears:2,
   requiresMove:false,transitionReason:'adjacent-family',related:true
  }],
  preferences:{}
 };
 const choices=[{id:'switch:engineer-cut'},{id:'stay'}];
 const picked=chooseProceduralEventChoice(fakeGame(state,choices),{id:'career-switch'},'random',maxRng);
 assert.equal(picked.id,'stay');
});

test('procedural career decision can take a coherent adjacent promotion with meaningful pay growth',()=>{
 const state={
  player:{age:35,health:{current:85},personality:{ambition:75,sociability:50}},
  finance:{cash:700000,savings:800000,debt:0,monthlyIncome:80000},
  healthProfile:{stress:30,fitness:65},
  career:{jobId:'developer',monthlyIncome:80000,satisfaction:42,stability:60},
  pendingCareerOffers:[{
   id:'engineer-up',title:'Mühendis',salary:105000,experienceYears:5,
   requiresMove:false,transitionReason:'adjacent-family',related:true
  }],
  preferences:{}
 };
 const choices=[{id:'switch:engineer-up'},{id:'stay'}];
 const picked=chooseProceduralEventChoice(fakeGame(state,choices),{id:'career-switch'},'random',maxRng);
 assert.equal(picked.id,'switch:engineer-up');
});

test('strong compatible long-term relationship and marriage desire favor commitment',()=>{
 const state={
  player:{age:31,health:{current:90},personality:{ambition:55,sociability:65}},
  finance:{cash:800000,savings:500000,debt:0,monthlyIncome:90000},
  healthProfile:{stress:25,fitness:65},
  social:{romance:{relationship:82,compatibility:88,yearsTogether:6}},
  preferences:{partnershipDesire:78,marriageDesire:85}
 };
 const choices=[{id:'marry'},{id:'cohabit'},{id:'wait'}];
 const picked=chooseProceduralEventChoice(fakeGame(state,choices),{id:'relationship-commitment'},'random',maxRng);
 assert.equal(picked.id,'marry');
});

test('neglected partnership does not passively grow just because compatibility is high',()=>{
 const g=new Game('neglected-partnership-causality');
 g.state.player.age=35;
 g.state.finance={debt:0};
 g.state.social.romance={
  id:'partner-causal',name:'Deniz',surname:'Kaya',alive:true,age:35,status:'cohabiting',
  relationship:60,compatibility:90,yearsTogether:6,
  personality:{ambition:50},health:{current:85}
 };
 g.state.relationshipMemories={
  'partner-causal':{interactions:3,lastInteractionAge:30,recentActivities:[],positiveImpact:5,negativeImpact:0,knownPreferences:{}}
 };
 const before=g.state.social.romance.relationship;
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processPartnershipYear(g.state,rng);
 assert.ok(g.state.social.romance.relationship<=before);
});
