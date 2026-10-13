import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processChildrenYear} from '../src/family/parenting_system.js';
import {processConsequenceChainsYear} from '../src/life/consequence_chain_system.js';
import {processLifeGoalsYear,setLifeGoal} from '../src/life/life_goal_system.js';

const malformed=[NaN,Infinity,-Infinity,'2080',2080.5,-1,Number.MAX_SAFE_INTEGER+1];
const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const safeRng={fork(){return {chance(){return false;}};},chance(){return false;}};
const child=(id,age=10,alive=true)=>({id,name:id,age,alive,relationship:75,health:{current:80},personality:{curiosity:65,discipline:65},parenting:{involvement:60,stability:65,emotionalSecurity:65,conflict:10,accumulatedSupport:0}});
function base(seed){const s=new Game(seed).state;s.year=2080;s.player.age=40;return s;}
function parenting(){const s=base('cycle61-parent');s.children=[child('first'),child('second')];return s;}
function chains(){const s=base('cycle61-chains');s.householdDynamics={financialPressure:85};s.healthProfile={stress:25};return s;}
function goal(){const s=base('cycle61-goal');s.career={employed:true,performance:65,satisfaction:60,level:2};setLifeGoal(s,'career-mastery');return s;}
function unchanged(s,run){const before=structuredClone(s);assert.throws(()=>run(s),RangeError);assert.deepEqual(s,before);}

test('parenting rejects malformed calendar years before aging or consuming RNG',()=>{
 for(const value of malformed){const s=parenting();s.year=value;unchanged(s,x=>processChildrenYear(x,noRng));}
});
test('parenting rejects malformed persisted annual markers before child updates',()=>{
 for(const value of malformed){const s=parenting();s.lastChildrenProcessedYear=value;unchanged(s,x=>processChildrenYear(x,noRng));}
});
test('parenting rejects future marker before child updates',()=>{
 const s=parenting();s.lastChildrenProcessedYear=2081;unchanged(s,x=>processChildrenYear(x,noRng));
});
test('parenting rejects malformed second child age before modifying first child',()=>{
 for(const value of [...malformed,Number.MAX_SAFE_INTEGER]){const s=parenting();s.children[1].age=value;unchanged(s,x=>processChildrenYear(x,noRng));}
});
test('parenting skips deceased child with legacy malformed age',()=>{
 const s=parenting();s.children.push(child('dead','bad',false));const before=structuredClone(s.children[2]);
 processChildrenYear(s,new RNG('cycle61-parent-ok'));assert.deepEqual(s.children[2],before);assert.equal(s.children[0].age,11);
});
test('parenting advances once, then next year, and retains yearless legacy calls',()=>{
 const s=parenting();processChildrenYear(s,new RNG('cycle61-parent-first'));
 const before=structuredClone(s);assert.deepEqual(processChildrenYear(s,noRng),[]);assert.deepEqual(s,before);
 s.year++;processChildrenYear(s,new RNG('cycle61-parent-next'));assert.equal(s.children[0].age,12);
 const legacy=parenting();delete legacy.year;processChildrenYear(legacy,new RNG('cycle61-parent-legacy'));
 assert.equal(legacy.lastChildrenProcessedYear,undefined);assert.equal(legacy.children[0].age,11);
});

test('consequence chains reject malformed calendar years before initializing chains',()=>{
 for(const value of malformed){const s=chains();delete s.consequenceChains;s.year=value;unchanged(s,x=>processConsequenceChainsYear(x,noRng));}
});
test('consequence chains reject malformed annual markers before mutation',()=>{
 for(const value of malformed){const s=chains();s.lastConsequenceChainsProcessedYear=value;unchanged(s,x=>processConsequenceChainsYear(x,noRng));}
});
test('consequence chains reject future marker before mutation',()=>{
 const s=chains();s.lastConsequenceChainsProcessedYear=2081;unchanged(s,x=>processConsequenceChainsYear(x,noRng));
});
test('consequence chains reject corrupt second active chain step atomically',()=>{
 for(const value of [NaN,'2',-1,1.5,Number.MAX_SAFE_INTEGER,Infinity]){
  const s=chains();s.consequenceChains=[
   {id:'financial-strain-2079',type:'financial-strain',startedAtAge:39,step:1,resolved:false,data:{}},
   {id:'burnout-spiral-2079',type:'burnout-spiral',startedAtAge:39,step:value,resolved:false,data:{}}
  ];unchanged(s,x=>processConsequenceChainsYear(x,noRng));
 }
});
test('consequence chains ignore resolved legacy corrupt steps',()=>{
 const s=chains();s.consequenceChains=[{id:'old',type:'financial-strain',startedAtAge:30,step:'bad',resolved:true,data:{}}];
 processConsequenceChainsYear(s,safeRng);assert.equal(s.lastConsequenceChainsProcessedYear,2080);
});
test('consequence chains replay once and accept yearless legacy calls',()=>{
 const s=chains();processConsequenceChainsYear(s,safeRng);const before=structuredClone(s);
 assert.deepEqual(processConsequenceChainsYear(s,noRng),[]);assert.deepEqual(s,before);
 s.year++;processConsequenceChainsYear(s,safeRng);assert.equal(s.lastConsequenceChainsProcessedYear,2081);
 const legacy=chains();delete legacy.year;processConsequenceChainsYear(legacy,safeRng);assert.equal(legacy.lastConsequenceChainsProcessedYear,undefined);
});

test('life goals reject malformed calendar years before changing progress',()=>{
 for(const value of malformed){const s=goal();s.year=value;unchanged(s,processLifeGoalsYear);}
});
test('life goals reject malformed active-goal markers before changing progress',()=>{
 for(const value of malformed){const s=goal();s.lifeGoals.active.lastProcessedYear=value;unchanged(s,processLifeGoalsYear);}
});
test('life goals reject future active-goal marker before changing progress',()=>{
 const s=goal();s.lifeGoals.active.lastProcessedYear=2081;unchanged(s,processLifeGoalsYear);
});
test('life goals replay once, advance, and allow yearless legacy calls',()=>{
 const s=goal();processLifeGoalsYear(s);const before=structuredClone(s);
 assert.deepEqual(processLifeGoalsYear(s),[]);assert.deepEqual(s,before);
 s.year++;processLifeGoalsYear(s);assert.equal(s.lifeGoals.active.lastProcessedYear,2081);
 const legacy=goal();delete legacy.year;processLifeGoalsYear(legacy);assert.equal(legacy.lifeGoals.active.lastProcessedYear,undefined);
});
test('inactive life goals stay inert even with malformed calendar year',()=>{
 const s=base('cycle61-inactive');s.year=NaN;delete s.lifeGoals;
 const before=structuredClone(s);assert.deepEqual(processLifeGoalsYear(s),[]);assert.deepEqual(s,before);
});
