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


test('sustained financial and goal strain can make a weak marriage vulnerable without instant divorce',()=>{
 const g=adult('marriage-strain');
 g.state.player.age=40;
 g.state.finance.debt=3500000;
 g.state.social.romance={
  id:'partner-strain',name:'Ece',surname:'Kaya',alive:true,age:40,status:'married',
  relationship:68,compatibility:62,yearsTogether:10,marriageYears:5,
  strain:2.4,strainedYears:1,health:{current:85},personality:{ambition:10},
  preferencesProfile:{food:{},activities:{}}
 };
 g.state.player.personality.ambition=90;
 g.state.relationshipMemories={'partner-strain':{
  interactions:4,lastInteractionAge:37,recentActivities:[],positiveImpact:8,negativeImpact:2,knownPreferences:{}
 }};
 let seenChance=0;
 const rng={int:()=>0,chance:p=>{seenChance=Math.max(seenChance,p);return false;},fork:()=>({chance:()=>false})};
 processPartnershipYear(g.state,rng);
 assert.ok(g.state.social.romance.strain>2.4);
 assert.ok(seenChance>0,'sustained strain should create a bounded divorce risk');
 assert.ok(g.state.social.romance,'a single strained year should not force divorce deterministically');
});

test('healthy low-strain marriage does not receive arbitrary divorce risk',()=>{
 const g=adult('marriage-stable');
 g.state.social.romance={
  id:'partner-stable',name:'Ece',surname:'Kaya',alive:true,age:32,status:'married',
  relationship:86,compatibility:86,yearsTogether:8,marriageYears:5,
  strain:0,health:{current:90},personality:{ambition:g.state.player.personality.ambition},
  preferencesProfile:{food:{},activities:{}}
 };
 g.state.relationshipMemories={'partner-stable':{
  interactions:5,lastInteractionAge:32,recentActivities:['tea'],positiveImpact:15,negativeImpact:0,knownPreferences:{}
 }};
 const chances=[];
 const rng={int:()=>0,chance:p=>{chances.push(p);return false;},fork:()=>({chance:()=>false})};
 processPartnershipYear(g.state,rng);
 assert.ok(g.state.social.romance);
 assert.ok((g.state.social.romance.strain??0)<1);
 assert.ok(!chances.some(p=>p>=.025&&p<=.16),'healthy marriage should not get divorce RNG merely for existing');
});


test('older balanced procedural exercise favors sustainable activities over high intensity',()=>{
 const counts={};
 for(let i=0;i<80;i++){
  const g=adult('older-physical-'+i);
  g.state.player.age=72;
  g.state.healthProfile.fitness=42;
  const plan=proceduralActionPlan(g,'balanced',new RNG('older-plan-'+i));
  const physical=plan.find(x=>x.type==='physical');
  assert.ok(physical);
  counts[physical.id]=(counts[physical.id]??0)+1;
 }
 const sustainable=(counts.walk??0)+(counts.yoga??0)+(counts.swim??0);
 const intense=(counts.run??0)+(counts.gym??0);
 assert.ok(sustainable>intense,'older adults should prefer sustainable activity mix');
});

test('low fitness increases physical action urgency without forcing one activity type',()=>{
 const low=adult('low-fitness-urgency');
 const high=adult('high-fitness-urgency');
 low.state.healthProfile.fitness=32;
 high.state.healthProfile.fitness=78;
 const lowPlan=proceduralActionPlan(low,'balanced',new RNG('low-fitness-plan'));
 const highPlan=proceduralActionPlan(high,'balanced',new RNG('high-fitness-plan'));
 const lowPhysical=lowPlan.find(x=>x.type==='physical');
 const highPhysical=highPlan.find(x=>x.type==='physical');
 assert.ok(lowPhysical&&highPhysical);
 assert.ok(lowPhysical.utility>highPhysical.utility);
});

test('sustainable low intensity exercise has meaningful fitness gain',()=>{
 const g=adult('sustainable-gain');
 g.state.player.age=60;
 g.state.healthProfile.fitness=45;
 const before=g.state.healthProfile.fitness;
 const result=g.performPhysicalActivity('walk');
 assert.ok(result.fitnessGain>=0.5);
 assert.ok(g.state.healthProfile.fitness>before);
});
