import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processRelationshipMaintenanceYear} from '../src/social/relationship_maintenance.js';
import {processPartnershipYear} from '../src/social/partnership_system.js';
import {knownPreference} from '../src/social/relationship_memory.js';
import {performSocialActivity} from '../src/social/social_activity_system.js';
import {performPhysicalActivity} from '../src/health/physical_activity_system.js';
import {processHealthYear} from '../src/health/health_system.js';
import {processDiseaseProgressionYear} from '../src/health/disease_progression.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {performProceduralYearActions} from '../src/simulation/procedural_player.js';
import {performHobby} from '../src/life/hobby_system.js';
import {RNG} from '../src/core/rng.js';

function adult(seed='agency'){
 const g=new Game(seed);
 g.state.player.age=30;
 g.state.actions={remaining:3,max:3};
 g.state.healthProfile={conditions:[],stress:30,fitness:55,lastCheckupAge:null};
 ensurePersonalFinance(g.state);
 g.state.finance.cash=100000;
 return g;
}

test('liked social activity produces a better relationship outcome than disliked one',()=>{
 const liked=adult('social-liked');
 const disliked=adult('social-disliked');
 const a=liked.state.parents.mother;
 const b=disliked.state.parents.mother;
 liked.state.player.relationships.mother=60;
 disliked.state.player.relationships.mother=60;
 a.preferencesProfile.food.pizza=2;
 b.preferencesProfile.food.pizza=-2;
 const rng={int:()=>0};
 const ra=performSocialActivity(liked.state,'mother','pizza',rng);
 const rb=performSocialActivity(disliked.state,'mother','pizza',rng);
 assert.ok(ra.relationshipDelta>rb.relationshipDelta);
});

test('repeating the same activity has diminishing relationship value',()=>{
 const g=adult('social-repeat');
 g.state.player.relationships.mother=50;
 g.state.parents.mother.preferencesProfile.food.doner=1;
 const rng={int:()=>0};
 const first=performSocialActivity(g.state,'mother','doner',rng);
 g.state.actions.remaining=3;
 const second=performSocialActivity(g.state,'mother','doner',rng);
 assert.ok(second.repetitionPenalty<first.repetitionPenalty);
 assert.ok(second.relationshipDelta<=first.relationshipDelta);
});

test('neglect lowers relationship while recent interaction protects it',()=>{
 const neglected=adult('neglected');
 const active=adult('active');
 neglected.state.player.relationships.mother=70;
 active.state.player.relationships.mother=70;
 neglected.state.relationshipMemories={mother:{interactions:1,lastInteractionAge:25,recentActivities:[],positiveImpact:0,negativeImpact:0}};
 active.state.relationshipMemories={mother:{interactions:1,lastInteractionAge:30,recentActivities:[],positiveImpact:0,negativeImpact:0}};
 processRelationshipMaintenanceYear(neglected.state);
 processRelationshipMaintenanceYear(active.state);
 assert.ok(neglected.state.player.relationships.mother<70);
 assert.equal(active.state.player.relationships.mother,70);
});

test('physical activity raises fitness but does not directly grant health',()=>{
 const g=adult('physical-causal');
 g.state.player.health.current=80;
 const beforeHealth=g.state.player.health.current;
 const beforeFitness=g.state.healthProfile.fitness;
 const rng={int:()=>0};
 performPhysicalActivity(g.state,'walk',rng);
 assert.ok(g.state.healthProfile.fitness>beforeFitness);
 assert.equal(g.state.player.health.current,beforeHealth);
 assert.equal(g.state.healthProfile.lastExerciseAge,30);
});

test('yearly health processing cannot randomly improve fitness without exercise',()=>{
 const g=adult('fitness-no-random-growth');
 g.state.player.age=35;
 g.state.healthProfile.fitness=70;
 g.state.healthProfile.lastExerciseAge=20;
 const before=g.state.healthProfile.fitness;
 const rng={int:()=>2,chance:()=>false,fork:()=>({chance:()=>false})};
 processHealthYear(g.state,rng);
 assert.ok(g.state.healthProfile.fitness<before);
});

test('procedural player spends real action slots through public action APIs',()=>{
 const g=adult('procedural-player');
 const before=g.state.actions.remaining;
 const results=performProceduralYearActions(g,'balanced',new RNG('procedural-player-actions'));
 assert.ok(results.length>0);
 assert.ok(g.state.actions.remaining<before);
 assert.ok(g.state.history.length>0,'procedural player must use public Game actions so history matches real play');
});

test('selected hobby improves its own interest and physical hobbies improve fitness',()=>{
 const g=adult('hobby-causal');
 g.state.player.interests.koşu=20;
 const beforeFitness=g.state.healthProfile.fitness;
 const rng={int:()=>0};
 const result=performHobby(g.state,'running',rng);
 assert.ok(g.state.player.interests.koşu>20);
 assert.ok(g.state.healthProfile.fitness>beforeFitness);
 assert.equal(result.hobbyId,'running');
});

test('procedural social choice respects affordability and preferences through real actions',()=>{
 const g=adult('procedural-social');
 g.state.player.personality.sociability=90;
 g.state.player.relationships.mother=35;
 g.state.parents.mother.preferencesProfile.food.doner=2;
 g.state.finance.cash=1200;
 const results=performProceduralYearActions(g,'social',new RNG('procedural-social-actions'));
 assert.ok(results.length>0);
 assert.ok(g.state.history.some(x=>['social-activity','physical-activity','hobby','activity'].includes(x.kind)));
 assert.ok(g.state.finance.cash>=0);
});

test('NPC preference becomes known only after sharing that activity',()=>{
 const g=adult('preference-learning');
 g.state.parents.mother.preferencesProfile.food.pizza=2;
 assert.equal(knownPreference(g.state,'mother','food','pizza'),null);
 performSocialActivity(g.state,'mother','pizza',{int:()=>0});
 assert.equal(knownPreference(g.state,'mother','food','pizza'),2);
});

test('cohabiting partner is not penalized for one quiet year without explicit activity',()=>{
 const g=adult('cohabiting-maintenance');
 const partner={
  id:'partner-1',name:'Deniz',alive:true,relationship:72,status:'cohabiting',
  preferencesProfile:{food:{},activities:{}}
 };
 g.state.social.romance=partner;
 g.state.relationshipMemories={'partner-1':{
  interactions:2,lastInteractionAge:g.state.player.age-1,recentActivities:[],positiveImpact:4,negativeImpact:0,knownPreferences:{}
 }};
 processRelationshipMaintenanceYear(g.state);
 assert.equal(g.state.social.romance.relationship,72);
});

test('compatible dating relationship deepens over time without random bonus',()=>{
 const g=adult('compatible-growth');
 g.state.social.romance={
  id:'partner-growth',name:'Ece',alive:true,age:31,status:'dating',
  relationship:50,compatibility:85,yearsTogether:1,
  health:{current:80},preferencesProfile:{food:{},activities:{}},
  personality:{ambition:50}
 };
 g.state.relationshipMemories={'partner-growth':{
  interactions:2,lastInteractionAge:g.state.player.age,recentActivities:[],positiveImpact:4,negativeImpact:0,knownPreferences:{}
 }};
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processPartnershipYear(g.state,rng);
 assert.ok(g.state.social.romance.relationship>50);
});

test('higher fitness preserves more health reserve at the same age without direct healing',()=>{
 const fit=adult('fitness-protection-high');
 const unfit=adult('fitness-protection-low');
 for(const g of [fit,unfit]){
  g.state.player.age=65;
  g.state.player.health.current=78;
  g.state.player.health.constitution=60;
  g.state.healthProfile.stress=40;
  g.state.healthProfile.lastExerciseAge=50;
  g.state.finance.lifestyle={food:'standard'};
 }
 fit.state.healthProfile.fitness=75;
 unfit.state.healthProfile.fitness=35;
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processHealthYear(fit.state,rng,{healthBeforeYear:78});
 processHealthYear(unfit.state,rng,{healthBeforeYear:78});
 assert.ok(fit.state.player.health.current>unfit.state.player.health.current);
});

test('higher fitness slows chronic disease progression under otherwise identical conditions',()=>{
 const fit=adult('progression-fit');
 const unfit=adult('progression-unfit');
 for(const g of [fit,unfit]){
  g.state.player.age=60;
  g.state.player.health.current=70;
  g.state.healthProfile.stress=45;
  g.state.healthProfile.conditions=[{
   id:'hypertension',
   label:'Yüksek tansiyon',
   severity:2,
   diagnosedAtAge:55,
   geneticCourse:{progressionMultiplier:1,complicationMultiplier:1,initialProgressionBonus:0}
  }];
 }
 fit.state.healthProfile.fitness=75;
 unfit.state.healthProfile.fitness=35;
 const rng={int:()=>0,chance:()=>false};
 processDiseaseProgressionYear(fit.state,rng);
 processDiseaseProgressionYear(unfit.state,rng);
 assert.ok(
  fit.state.healthProfile.conditions[0].progression.score<
  unfit.state.healthProfile.conditions[0].progression.score
 );
});

test('fitness protects against chronic disease reserve loss without healing health',()=>{
 const fit=adult('burden-fit');
 const unfit=adult('burden-unfit');
 for(const g of [fit,unfit]){
  g.state.player.age=62;
  g.state.player.health.current=72;
  g.state.player.health.constitution=60;
  g.state.healthProfile.stress=48;
  g.state.healthProfile.lastExerciseAge=40;
  g.state.healthProfile.conditions=[{
   id:'hypertension',label:'Yüksek tansiyon',severity:2,diagnosedAtAge:55,
   progression:{score:55,stage:'severe',status:'active',stableYears:0,complicationCount:0,lastProgressionAge:61},
   geneticCourse:{progressionMultiplier:1,complicationMultiplier:1,initialProgressionBonus:0}
  }];
  g.state.finance.lifestyle={food:'standard'};
 }
 fit.state.healthProfile.fitness=75;
 unfit.state.healthProfile.fitness=35;
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processHealthYear(fit.state,rng,{healthBeforeYear:72});
 processHealthYear(unfit.state,rng,{healthBeforeYear:72});
 assert.ok(fit.state.player.health.current>unfit.state.player.health.current);
 assert.ok(fit.state.player.health.current<72,'fitness must protect reserve, not heal it');
});

test('ordinary baseline stress does not independently inflate disease onset risk',()=>{
 const g=adult('baseline-stress-onset');
 g.state.player.age=50;
 g.state.player.health.current=90;
 g.state.healthProfile.fitness=60;
 g.state.healthProfile.stress=40;
 g.state.healthProfile.conditions=[];
 let highestChance=0;
 const rng={
  int:()=>0,
  chance:p=>{highestChance=Math.max(highestChance,p); return false;},
  fork:()=>({chance:()=>false})
 };
 processHealthYear(g.state,rng,{healthBeforeYear:90});
 assert.ok(highestChance<0.02,'baseline stress should not add a large unconditional disease hazard');
});
