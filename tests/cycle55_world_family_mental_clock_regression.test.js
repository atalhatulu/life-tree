import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processWorldYear} from '../src/world/world_state.js';
import {processFamilyYear} from '../src/family/family_simulation.js';
import {processMentalHealthYear} from '../src/health/mental_health_system.js';

const forbiddenRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},next(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const invalid=[NaN,Infinity,-Infinity,'2075',2075.5,-1,Number.MAX_SAFE_INTEGER+1];
const systems=[
 {name:'world',run:processWorldYear,read:s=>s.world?.lastProcessedYear,write:(s,v)=>{s.world.lastProcessedYear=v;}},
 {name:'family',run:processFamilyYear,read:s=>s.lastFamilyProcessedYear,write:(s,v)=>{s.lastFamilyProcessedYear=v;}},
 {name:'mental health',run:processMentalHealthYear,read:s=>s.lastMentalHealthProcessedYear,write:(s,v)=>{s.lastMentalHealthProcessedYear=v;}}
];
function makeState(name){const g=new Game('cycle55-'+name);g.state.year=2075;g.state.player.age=30;g.state.healthProfile={stress:20,fitness:60,conditions:[]};return g.state;}
function rejectsWithoutMutation(s,run){const before=structuredClone(s);assert.throws(()=>run(s,forbiddenRng),RangeError);assert.deepEqual(s,before);}
for(const system of systems){
 test(system.name+' rejects malformed current calendar years without mutation or RNG',()=>{
  for(const value of invalid){const s=makeState(system.name+'-year');s.year=value;rejectsWithoutMutation(s,system.run);}
 });
 test(system.name+' rejects malformed persisted annual markers before any side effects',()=>{
  for(const value of invalid){const s=makeState(system.name+'-marker');system.write(s,value);rejectsWithoutMutation(s,system.run);}
 });
 test(system.name+' rejects backdated years before any side effects',()=>{
  const s=makeState(system.name+'-backdated');system.write(s,2076);rejectsWithoutMutation(s,system.run);
 });
 test(system.name+' preserves same-year replay idempotence and advances next year',()=>{
  const s=makeState(system.name+'-replay');system.run(s,new RNG('first'));
  assert.equal(system.read(s),2075);
  const before=structuredClone(s);assert.deepEqual(system.run(s,forbiddenRng),[]);assert.deepEqual(s,before);
  s.year=2076;system.run(s,new RNG('second'));assert.equal(system.read(s),2076);
 });
 test(system.name+' supports standalone calls without a calendar year',()=>{
  const s=makeState(system.name+'-legacy');delete s.year;
  system.run(s,new RNG('legacy'));
  assert.equal(system.read(s),undefined);
 });
}
