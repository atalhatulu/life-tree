import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {historyText} from '../src/life/history_text.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

function adult(seed){
 const g=new Game(seed);
 g.state.player.age=30;
 g.state.year=2056;
 g.state.actions={remaining:3,max:3};
 g.state.healthProfile={conditions:[],stress:30,fitness:60,lastCheckupAge:null};
 ensurePersonalFinance(g.state);
 g.state.finance.cash=500000;
 return g;
}

test('specialized yearly actions consume the same shared three-action budget',()=>{
 const g=adult('year-action-shared-budget');
 const mother=g.state.parents.mother;
 const physical=g.availablePhysicalActivities()[0];
 const hobby=g.availableHobbies()[0];
 const social=g.availableSocialActivities(mother.id)[0];
 assert.ok(physical&&hobby&&social);
 g.performPhysicalActivity(physical.id);
 g.performHobby(hobby.id);
 g.performSocialActivity(mother.id,social.id);
 assert.equal(g.state.actions.remaining,0);
 assert.throws(()=>g.performActivity('checkup'),/aksiyon hakkın kalmadı/i);
});

test('major decision stores player-facing context in the Life Tree node',()=>{
 const g=adult('decision-context-tree');
 g.state.career={
  employed:true,jobId:'developer',title:'Yazılımcı',monthlyIncome:80000,
  satisfaction:40,stability:60,years:6,totalYears:6,performance:70
 };
 g.state.player.job='Yazılımcı';
 g.state.player.jobId='developer';
 g.state.pendingCareerOffers=[{
  id:'engineer',title:'Mühendis',family:'engineering',salary:105000,
  related:true,transitionReason:'adjacent-family',experienceYears:4,
  cityId:g.state.location.cityId,cityName:g.state.location.cityName,requiresMove:false,moveCost:0
 }];
 const event=g.events.events.find(e=>e.id==='career-switch');
 const choice=g.eventChoices(event).find(c=>c.id==='switch:engineer');
 assert.ok(choice);
 g.makeChoice(event,choice.id);
 const node=g.state.lifeTree.nodes.at(-1);
 assert.equal(node.eventId,'career-switch');
 assert.ok(node.context.some(x=>x.includes('Maaş farkı')));
 assert.ok(node.context.some(x=>x.includes('iş memnuniyeti')));
});

test('history formatter renders structured action result text instead of object coercion',()=>{
 const item={
  age:30,kind:'physical-activity',
  result:{activityId:'walk',fitnessGain:1.2,text:'Yürüyüş yaptın. Fitness +1.2.'}
 };
 assert.equal(historyText(item),'Yürüyüş yaptın. Fitness +1.2.');
 assert.notEqual(historyText(item),'[object Object]');
});
