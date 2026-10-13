import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {serializeGame} from '../src/core/save_system.js';
import {processMemoryConsequencesYear} from '../src/life/memory_system.js';
import {processConsequenceChainsYear} from '../src/life/consequence_chain_system.js';
import {setLifeGoal,processLifeGoalsYear} from '../src/life/life_goal_system.js';

function adult(seed){const g=new Game(seed);g.state.year=2075;g.state.player.age=40;return g;}
const noRng={fork(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');}};
const safeRng={fork(){return {chance(){return false;}};},chance(){return false;}};
function memory(seed){
 const g=adult(seed);
 g.state.healthProfile={stress:30};
 g.state.lifeMemory={memories:[],tags:{scar:45},resilience:50,scarLoad:0};
 g.state.finance={financialDistressYears:2};
 return g;
}
function chain(seed){
 const g=adult(seed);
 g.state.healthProfile={stress:30};
 g.state.householdDynamics={financialPressure:85};
 return g;
}
function goal(seed){
 const g=adult(seed);
 g.state.career={employed:true,performance:60,satisfaction:60,level:2};
 setLifeGoal(g.state,'career-mastery');
 return g;
}

test('memory stress and memory tags are applied only once in the year',()=>{
 const g=memory('memory-once');
 const entries=processMemoryConsequencesYear(g.state);
 assert.equal(entries.length,1);
 assert.equal(g.state.healthProfile.stress,32);
 const after=structuredClone(g.state);
 assert.deepEqual(processMemoryConsequencesYear(g.state),[]);
 assert.deepEqual(g.state,after);
});
test('memory past year is rejected before initializing a memory ledger',()=>{
 const g=memory('memory-past');delete g.state.lifeMemory;
 g.state.lastMemoryConsequencesProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processMemoryConsequencesYear(g.state),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('memory save/restore, following year and legacy records',()=>{
 const g=memory('memory-save');processMemoryConsequencesYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processMemoryConsequencesYear(restored.state),[]);
 restored.state.year++;restored.state.player.age++;
 processMemoryConsequencesYear(restored.state);
 assert.equal(restored.state.lastMemoryConsequencesProcessedYear,2076);
 delete restored.state.lastMemoryConsequencesProcessedYear;
 processMemoryConsequencesYear(restored.state);
 assert.equal(restored.state.lastMemoryConsequencesProcessedYear,2076);
});
test('memory stress relief cannot be replayed in a calendar year',()=>{
 const g=memory('memory-positive');
 g.state.lifeMemory.tags={support:100};
 g.state.finance.financialDistressYears=0;
 processMemoryConsequencesYear(g.state);
 assert.equal(g.state.healthProfile.stress,28);
 assert.deepEqual(processMemoryConsequencesYear(g.state),[]);
 assert.equal(g.state.healthProfile.stress,28);
});

test('consequence chains do not advance steps or stress twice in one year',()=>{
 const g=chain('chains-once');
 const entries=processConsequenceChainsYear(g.state,safeRng);
 assert.equal(entries.length,1);
 assert.equal(g.state.consequenceChains[0].step,1);
 const after=structuredClone(g.state);
 assert.deepEqual(processConsequenceChainsYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('consequence chain earlier year rejection is atomic',()=>{
 const g=chain('chains-past');
 g.state.lastConsequenceChainsProcessedYear=2076;
 delete g.state.consequenceChains;
 const before=structuredClone(g.state);
 assert.throws(()=>processConsequenceChainsYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('consequence chain marker survives save and following year advances',()=>{
 const g=chain('chains-save');processConsequenceChainsYear(g.state,safeRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processConsequenceChainsYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processConsequenceChainsYear(restored.state,safeRng);
 assert.equal(restored.state.consequenceChains[0].step,2);
 assert.equal(restored.state.lastConsequenceChainsProcessedYear,2076);
 delete restored.state.lastConsequenceChainsProcessedYear;
 processConsequenceChainsYear(restored.state,safeRng);
 assert.equal(restored.state.lastConsequenceChainsProcessedYear,2076);
});
test('deceased partner cannot initiate or continue relationship erosion',()=>{
 const g=chain('chains-dead-romance');
 g.state.householdDynamics.financialPressure=0;
 g.state.social.romance={alive:false,resentment:90,trust:50,intimacy:60,relationship:50};
 g.state.consequenceChains=[{id:'relationship-erosion-2070',type:'relationship-erosion',startedAtAge:35,step:1,resolved:false,data:{}}];
 processConsequenceChainsYear(g.state,safeRng);
 assert.equal(g.state.consequenceChains[0].resolved,true);
 assert.equal(g.state.social.romance.intimacy,60);
 assert.equal(g.state.social.romance.trust,50);
 const h=chain('chains-dead-trigger');
 h.state.householdDynamics.financialPressure=0;
 h.state.social.romance={alive:false,resentment:90,trust:50};
 processConsequenceChainsYear(h.state,safeRng);
 assert.ok(!h.state.consequenceChains.some(c=>c.type==='relationship-erosion'));
});

test('life goal progress cannot be smoothed twice in the same year',()=>{
 const g=goal('goal-once');
 processLifeGoalsYear(g.state);
 const after=structuredClone(g.state);
 assert.deepEqual(processLifeGoalsYear(g.state),[]);
 assert.deepEqual(g.state,after);
});
test('life goal rejects past year before changing progress',()=>{
 const g=goal('goal-past');g.state.lifeGoals.active.lastProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processLifeGoalsYear(g.state),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('life goal marker survives save/restore and permits later year and legacy',()=>{
 const g=goal('goal-save');processLifeGoalsYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processLifeGoalsYear(restored.state),[]);
 restored.state.year++;restored.state.player.age++;
 processLifeGoalsYear(restored.state);
 assert.equal(restored.state.lifeGoals.active.lastProcessedYear,2076);
 delete restored.state.lifeGoals.active.lastProcessedYear;
 processLifeGoalsYear(restored.state);
 assert.equal(restored.state.lifeGoals.active.lastProcessedYear,2076);
});
test('a different life goal chosen in the same year can be evaluated',()=>{
 const g=goal('goal-new');processLifeGoalsYear(g.state);
 setLifeGoal(g.state,'wellbeing');
 assert.equal(g.state.lifeGoals.active.lastProcessedYear,undefined);
 processLifeGoalsYear(g.state);
 assert.equal(g.state.lifeGoals.active.lastProcessedYear,2075);
});
test('inactive life goals remain inert',()=>{
 const g=adult('goal-inert');
 const before=structuredClone(g.state);
 assert.deepEqual(processLifeGoalsYear(g.state),[]);
 assert.deepEqual(g.state,before);
});

test('deceased friends do not inflate a social-circle life goal',()=>{
 const g=adult('goal-dead-friends');
 g.state.social.friends=[{id:'gone',alive:false,relationship:100,closeFriend:true}];
 setLifeGoal(g.state,'social-circle');
 processLifeGoalsYear(g.state);
 assert.equal(g.state.lifeGoals.active.progress,3);
});
test('deceased family members do not inflate a family-bond life goal',()=>{
 const g=adult('goal-dead-family');
 g.state.parents.mother.alive=false;g.state.parents.father.alive=false;
 g.state.social.romance={alive:false,relationship:100,trust:100};
 g.state.children=[{id:'gone',alive:false,relationship:100,development:{parentAttachment:100}}];
 setLifeGoal(g.state,'family-bond');
 processLifeGoalsYear(g.state);
 assert.equal(g.state.lifeGoals.active.progress,11);
});

test('legacy memory record without a health profile does not crash annual processing',()=>{
 const g=memory('memory-no-health');
 delete g.state.healthProfile;
 assert.doesNotThrow(()=>processMemoryConsequencesYear(g.state));
 assert.equal(g.state.lastMemoryConsequencesProcessedYear,2075);
});
test('resolved consequence chain cannot be recreated on a same-year replay',()=>{
 const g=chain('chains-resolved');
 g.state.consequenceChains=[{id:'financial-strain-2070',type:'financial-strain',startedAtAge:35,step:2,resolved:false,data:{}}];
 g.state.householdDynamics.financialPressure=0;
 processConsequenceChainsYear(g.state,safeRng);
 g.state.householdDynamics.financialPressure=90;
 const after=structuredClone(g.state);
 assert.deepEqual(processConsequenceChainsYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
