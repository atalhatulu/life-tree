import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processMemoryConsequencesYear} from '../src/life/memory_system.js';
import {processNarrativeEchoesYear} from '../src/life/narrative_echo_system.js';
import {processLateLifeYear} from '../src/life/late_age_system.js';

const invalid=[NaN,Infinity,-Infinity,'2080',2080.5,-1,Number.MAX_SAFE_INTEGER+1];
const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');},weighted(){throw Error('RNG consumed');}};
const alwaysYes={chance(){return true;},weighted(items){return items[0].value;}};
function base(seed,age=45){const s=new Game(seed).state;s.year=2080;s.player.age=age;return s;}
function memory(){const s=base('cycle62-memory');s.finance={financialDistressYears:2};s.healthProfile={stress:30};return s;}
function echo(){const s=base('cycle62-echo');s.lifeMemory={memories:[{id:'a',label:'Old',age:35,valence:1,intensity:5,echoCount:0}],resilience:50,scarLoad:0};s.lifeTree={nodes:[{id:'b',label:'Choice',age:35,echoCount:0}]};s.narrativeEcho={lastAge:20,total:0};return s;}
function late(){const s=base('cycle62-late',68);s.lateLife={mobility:65,isolation:20,careNeed:false};return s;}
function unchanged(s,fn){const before=structuredClone(s);assert.throws(()=>fn(s),RangeError);assert.deepEqual(s,before);}

test('memory rejects malformed explicit calendar year without creating ledger',()=>{
 for(const v of invalid){const s=memory();delete s.lifeMemory;s.year=v;unchanged(s,processMemoryConsequencesYear);}
});
test('memory rejects malformed annual marker before adding memories',()=>{
 for(const v of invalid){const s=memory();s.lastMemoryConsequencesProcessedYear=v;unchanged(s,processMemoryConsequencesYear);}
});
test('memory rejects future annual marker before any write',()=>{
 const s=memory();s.lastMemoryConsequencesProcessedYear=2081;unchanged(s,processMemoryConsequencesYear);
});
test('memory same-year replay, next year and yearless legacy calls',()=>{
 const s=memory();processMemoryConsequencesYear(s);const after=structuredClone(s);
 assert.deepEqual(processMemoryConsequencesYear(s),[]);assert.deepEqual(s,after);
 s.year++;s.player.age++;processMemoryConsequencesYear(s);assert.equal(s.lastMemoryConsequencesProcessedYear,2081);
 const old=memory();delete old.year;processMemoryConsequencesYear(old);assert.equal(old.lastMemoryConsequencesProcessedYear,undefined);
});

test('narrative rejects malformed explicit year before RNG or state changes',()=>{
 for(const v of invalid){const s=echo();s.year=v;unchanged(s,x=>processNarrativeEchoesYear(x,noRng));}
});
test('narrative rejects malformed annual marker before RNG',()=>{
 for(const v of invalid){const s=echo();s.lastNarrativeEchoProcessedYear=v;unchanged(s,x=>processNarrativeEchoesYear(x,noRng));}
});
test('narrative rejects future marker before RNG',()=>{
 const s=echo();s.lastNarrativeEchoProcessedYear=2081;unchanged(s,x=>processNarrativeEchoesYear(x,noRng));
});
test('narrative rejects malformed second eligible memory counter before first echo',()=>{
 for(const v of [NaN,'1',-1,1.5,Infinity,Number.MAX_SAFE_INTEGER]){
  const s=echo();s.lifeMemory.memories.push({id:'second',label:'Second',age:34,valence:-1,intensity:4,echoCount:v});
  unchanged(s,x=>processNarrativeEchoesYear(x,alwaysYes));
 }
});
test('narrative rejects malformed eligible decision counter before memory echo',()=>{
 for(const v of ['1',NaN,-1,Number.MAX_SAFE_INTEGER]){const s=echo();s.lifeTree.nodes[0].echoCount=v;unchanged(s,x=>processNarrativeEchoesYear(x,alwaysYes));}
});
test('narrative rejects corrupt echo age and total before RNG',()=>{
 for(const v of [NaN,'20',-1,46,Infinity]){const s=echo();s.narrativeEcho.lastAge=v;unchanged(s,x=>processNarrativeEchoesYear(x,alwaysYes));}
 for(const v of [NaN,'1',-1,Number.MAX_SAFE_INTEGER]){const s=echo();s.narrativeEcho.total=v;unchanged(s,x=>processNarrativeEchoesYear(x,alwaysYes));}
});
test('narrative rejects corrupt future echo marker on eligible memory',()=>{
 const s=echo();s.lifeMemory.memories[0].lastEchoAge=46;unchanged(s,x=>processNarrativeEchoesYear(x,alwaysYes));
});
test('narrative replay, next year and yearless calls remain supported',()=>{
 const s=echo();assert.equal(processNarrativeEchoesYear(s,alwaysYes).length,1);
 const after=structuredClone(s);assert.deepEqual(processNarrativeEchoesYear(s,noRng),[]);assert.deepEqual(s,after);
 s.year++;s.player.age++;processNarrativeEchoesYear(s,{chance(){return false;}});assert.equal(s.lastNarrativeEchoProcessedYear,2081);
 const old=echo();delete old.year;processNarrativeEchoesYear(old,alwaysYes);assert.equal(old.lastNarrativeEchoProcessedYear,undefined);
});
test('narrative skips ineligible legacy memories with corrupt echo counters',()=>{
 const s=echo();s.lifeMemory.memories.push({id:'ancient',age:1,echoCount:'old'});
 assert.equal(processNarrativeEchoesYear(s,alwaysYes).length,1);
});

test('late life rejects malformed explicit year before initialization or RNG',()=>{
 for(const v of invalid){const s=late();delete s.lateLife;s.year=v;unchanged(s,x=>processLateLifeYear(x,noRng));}
});
test('late life rejects malformed annual marker before updating mobility',()=>{
 for(const v of invalid){const s=late();s.lateLife.lastProcessedYear=v;unchanged(s,x=>processLateLifeYear(x,noRng));}
});
test('late life rejects future annual marker before initialization',()=>{
 const s=late();s.lateLife.lastProcessedYear=2081;unchanged(s,x=>processLateLifeYear(x,noRng));
});
test('late life replay, next year and yearless legacy calls',()=>{
 const s=late();processLateLifeYear(s,new RNG('cycle62-late-first'));const after=structuredClone(s);
 assert.deepEqual(processLateLifeYear(s,noRng),[]);assert.deepEqual(s,after);
 s.year++;s.player.age++;processLateLifeYear(s,new RNG('cycle62-late-next'));assert.equal(s.lateLife.lastProcessedYear,2081);
 const old=late();delete old.year;processLateLifeYear(old,new RNG('cycle62-late-legacy'));assert.equal(old.lateLife.lastProcessedYear,undefined);
});
test('late life under 60 remains inert even with malformed calendar year',()=>{
 const s=base('cycle62-young',45);s.year=NaN;delete s.lateLife;const before=structuredClone(s);
 assert.deepEqual(processLateLifeYear(s,noRng),[]);assert.deepEqual(s,before);
});
