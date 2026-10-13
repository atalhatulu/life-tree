import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processChildhoodYear} from '../src/life/childhood_simulation.js';
import {processAdolescenceYear} from '../src/life/adolescence_simulation.js';
import {processAdultYear} from '../src/life/adult_simulation.js';
import {processHealthYear} from '../src/health/health_system.js';

const MAX=Number.MAX_SAFE_INTEGER;
const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
function unchanged(state,action){const before=structuredClone(state);assert.throws(action,RangeError);assert.deepEqual(state,before);}
function state(age){const s=new Game('cycle54-'+age).state;s.player.age=age;s.year=2075;return s;}

// 1: The top-level game must reject an unsafe clock/age before changing any member.
test('ageOneYear rejects unsafe or malformed calendar before mutating state',()=>{
 for(const year of [NaN,Infinity,'2075',2075.5,-1,MAX]){
  const g=new Game('cycle54-game-year-'+year);g.state.year=year;
  unchanged(g.state,()=>g.ageOneYear());
 }
});
test('ageOneYear rejects invalid player or living relative ages atomically',()=>{
 for(const age of [NaN,Infinity,'40',40.5,-1,MAX]){
  const g=new Game('cycle54-game-player-'+age);g.state.player.age=age;
  unchanged(g.state,()=>g.ageOneYear());
  const relative=new Game('cycle54-game-relative-'+age);
  relative.state.parents.mother.alive=true;relative.state.parents.mother.age=age;
  unchanged(relative.state,()=>relative.ageOneYear());
 }
});
test('ageOneYear preflights siblings and grandparents before aging parents',()=>{
 const g=new Game('cycle54-late-relative');
 const sibling=structuredClone(g.state.player);sibling.alive=true;sibling.age=Number.MAX_SAFE_INTEGER;
 g.state.siblings.push(sibling);
 unchanged(g.state,()=>g.ageOneYear());
 g.state.siblings=[];
 g.state.grandparents.paternal.grandfather.alive=true;
 g.state.grandparents.paternal.grandfather.age=Infinity;
 unchanged(g.state,()=>g.ageOneYear());
});
test('ageOneYear does not reject dead relatives with legacy ages',()=>{
 const g=new Game('cycle54-dead-relative');
 g.state.parents.mother.alive=false;g.state.parents.mother.age=NaN;
 g.ageOneYear();
 assert.equal(g.state.year,2027);
 assert.equal(g.state.player.age,1);
});

// 2: Childhood/adolescence annual markers must not permit replays through corrupt values.
for(const [label,age,fn,marker] of [
 ['childhood',8,processChildhoodYear,'lastChildhoodProcessedYear'],
 ['adolescence',15,processAdolescenceYear,'lastAdolescenceProcessedYear']
]){
 test(label+' rejects invalid current year without consuming RNG',()=>{
  for(const value of [NaN,Infinity,'2075',2075.5,-1,MAX+1]){
   const s=state(age);s.year=value;unchanged(s,()=>fn(s,noRng));
  }
 });
 test(label+' rejects corrupt prior marker before mutating state',()=>{
  for(const value of [NaN,Infinity,'2074',2074.5,-1,MAX+1]){
   const s=state(age);s[marker]=value;unchanged(s,()=>fn(s,noRng));
  }
 });
}

// 3: Adult orchestration and health must validate markers before all side effects.
for(const [label,age,fn,marker] of [
 ['adult',29,processAdultYear,'lastAdultProcessedYear'],
 ['health',45,processHealthYear,'healthProfile.lastHealthProcessedYear']
]){
 test(label+' rejects invalid current year before mutation',()=>{
  for(const value of [NaN,Infinity,'2075',2075.5,-1,MAX+1]){
   const s=state(age);s.year=value;unchanged(s,()=>fn(s,noRng));
  }
 });
 test(label+' rejects corrupt prior year marker before mutation',()=>{
  for(const value of [NaN,Infinity,'2074',2074.5,-1,MAX+1]){
   const s=state(age);
   if(label==='health')s.healthProfile={conditions:[],stress:25,fitness:60,lastHealthProcessedYear:value};
   else s[marker]=value;
   unchanged(s,()=>fn(s,noRng));
  }
 });
}
