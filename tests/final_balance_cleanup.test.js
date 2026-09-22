import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {scoreSocialActivity} from '../src/social/social_activity_system.js';
import {proceduralActionPlan} from '../src/simulation/procedural_player.js';
import {switchJob} from '../src/career/career_system.js';
import {archiveCareer} from '../src/career/career_profile.js';
import {processPartnershipYear} from '../src/social/partnership_system.js';
import {RNG} from '../src/core/rng.js';

function adult(seed='cleanup'){
 const g=new Game(seed);
 g.state.player.age=32;
 g.state.actions={remaining:3,max:3};
 g.state.healthProfile={conditions:[],stress:30,fitness:58,lastCheckupAge:null};
 g.state.finance={cash:500000,savings:300000,debt:0,monthlyIncome:85000,lifestyle:{housing:'shared'}};
 return g;
}

test('social gains diminish strongly once a relationship is already very high',()=>{
 const low=adult('social-low');
 const high=adult('social-high');
 const a=low.state.parents.mother;
 const b=high.state.parents.mother;
 low.state.player.relationships.mother=60;
 high.state.player.relationships.mother=95;
 a.preferencesProfile.food.pizza=1;
 b.preferencesProfile.food.pizza=1;
 const lowScore=scoreSocialActivity(low.state,'mother','pizza');
 const highScore=scoreSocialActivity(high.state,'mother','pizza');
 assert.ok(highScore.expectedDelta<lowScore.expectedDelta*.4);
});

test('stale unrelated voluntary career switch is rejected at execution time',()=>{
 const g=adult('career-stale-guard');
 g.state.career={
  employed:true,jobId:'engineer',title:'Mühendis',family:'engineering',
  monthlyIncome:90000,years:5,totalYears:5,performance:65,satisfaction:50,stability:60,previousJobs:[]
 };
 const offer={
  id:'designer',title:'Tasarımcı',family:'creative',salary:110000,
  cityId:g.state.location.cityId,cityName:g.state.location.cityName,requiresMove:false,
  transitionReason:'adjacent-family',related:true
 };
 g.state.pendingCareerOffers=[offer];
 assert.throws(()=>switchJob(g.state,offer),/tutarlı değil/i);
 assert.equal(g.state.pendingCareerOffers,null);
});

test('career event hides unrelated stale offers',()=>{
 const g=adult('career-event-filter');
 g.state.career={
  employed:true,jobId:'engineer',title:'Mühendis',family:'engineering',
  monthlyIncome:90000,years:5,totalYears:5,performance:65,satisfaction:50,stability:60,previousJobs:[]
 };
 g.state.pendingCareerOffers=[
  {id:'designer',title:'Tasarımcı',salary:120000,cityId:g.state.location.cityId,cityName:g.state.location.cityName,requiresMove:false},
  {id:'developer',title:'Yazılımcı',salary:105000,cityId:g.state.location.cityId,cityName:g.state.location.cityName,requiresMove:false}
 ];
 const event=g.events.events.find(e=>e.id==='career-switch');
 const choices=g.eventChoices(event);
 assert.ok(choices.some(c=>c.id==='switch:developer'));
 assert.ok(!choices.some(c=>c.id==='switch:designer'));
});

test('balanced procedural physical choice stays varied instead of collapsing to running',()=>{
 const counts={};
 for(let i=0;i<100;i++){
  const g=adult('physical-variety-'+i);
  g.state.player.age=38;
  g.state.healthProfile.fitness=58;
  const plan=proceduralActionPlan(g,'balanced',new RNG('physical-variety-plan-'+i));
  const physical=plan.find(x=>x.type==='physical');
  assert.ok(physical);
  counts[physical.id]=(counts[physical.id]??0)+1;
 }
 assert.ok(Object.keys(counts).length>=4,'physical plan should use several activity types');
 assert.ok((counts.run??0)<50,'running should not dominate most balanced physical choices');
});

test('balanced procedural hobby choice does not collapse to running',()=>{
 const counts={};
 for(let i=0;i<100;i++){
  const g=adult('hobby-variety-'+i);
  for(const key of Object.keys(g.state.player.interests??{}))g.state.player.interests[key]=50;
  const plan=proceduralActionPlan(g,'balanced',new RNG('hobby-variety-plan-'+i));
  const hobby=plan.find(x=>x.type==='hobby');
  assert.ok(hobby);
  counts[hobby.id]=(counts[hobby.id]??0)+1;
 }
 assert.ok(Object.keys(counts).length>=7,'hobby plan should remain broad');
 assert.ok((counts.running??0)<30,'running should not dominate hobby selection');
});


test('relationship far above compatibility gently returns toward a sustainable equilibrium',()=>{
 const g=adult('relationship-equilibrium');
 g.state.social.romance={
  id:'partner-eq',name:'Ece',surname:'Kaya',alive:true,age:32,status:'cohabiting',
  relationship:100,compatibility:82,yearsTogether:8,
  health:{current:85},personality:{ambition:g.state.player.personality.ambition},
  preferencesProfile:{food:{},activities:{}}
 };
 g.state.relationshipMemories={'partner-eq':{
  interactions:5,lastInteractionAge:32,recentActivities:['tea'],positiveImpact:20,negativeImpact:0,knownPreferences:{}
 }};
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processPartnershipYear(g.state,rng);
 assert.ok(g.state.social.romance.relationship<100);
 assert.ok(g.state.social.romance.relationship>90);
});

test('same career exit cannot be archived twice in the same year',()=>{
 const g=adult('career-archive-dedupe');
 g.state.career={
  employed:true,jobId:'developer',title:'Yazılımcı',family:'tech',
  monthlyIncome:90000,years:4,totalYears:4,performance:60,satisfaction:50,stability:60
 };
 archiveCareer(g.state,'career-switch');
 archiveCareer(g.state,'career-switch');
 assert.equal(g.state.careerProfile.recentJobs.filter(x=>x.jobId==='developer'&&x.leftAtAge===32&&x.reason==='career-switch').length,1);
});
