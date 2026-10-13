import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processGeneticHealthYear} from '../src/health/genetic_system.js';
import {processDiseaseProgressionYear} from '../src/health/disease_progression.js';
import {processElderFamilyYear} from '../src/family/elder_system.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const malformed=[NaN,Infinity,-Infinity,'2075',2075.5,-1,Number.MAX_SAFE_INTEGER+1];
const systems=[
 {name:'genetic health',run:processGeneticHealthYear,setup(s){s.player.health.genetics={monogenic:{},polygenic:{}};},set(s,v){s.lastGeneticHealthProcessedYear=v;},get(s){return s.lastGeneticHealthProcessedYear;}},
 {name:'disease progression',run:processDiseaseProgressionYear,setup(s){s.healthProfile={conditions:[{id:'hypertension',label:'Hypertension',severity:2},{id:'metabolic',label:'Metabolic',severity:2}],fitness:60,stress:20};},set(s,v){s.healthProfile.conditions[1].lastProgressionProcessedYear=v;},get(s){return s.healthProfile.conditions[1].lastProgressionProcessedYear;}},
 {name:'elder family',run:processElderFamilyYear,setup(){},set(s,v){s.lastElderFamilyProcessedYear=v;},get(s){return s.lastElderFamilyProcessedYear;}}
];
function state(system){const s=new Game('cycle56-'+system.name).state;s.year=2075;s.player.age=35;system.setup(s);return s;}
function rejectsUnchanged(s,run){const before=structuredClone(s);assert.throws(()=>run(s,noRng),RangeError);assert.deepEqual(s,before);}
for(const system of systems){
 test(system.name+' rejects malformed current calendar years without side effects',()=>{
  for(const value of malformed){const s=state(system);s.year=value;rejectsUnchanged(s,system.run);}
 });
 test(system.name+' rejects malformed persisted markers without partial updates',()=>{
  for(const value of malformed){const s=state(system);system.set(s,value);rejectsUnchanged(s,system.run);}
 });
 test(system.name+' rejects backdated years without partial updates',()=>{
  const s=state(system);system.set(s,2076);rejectsUnchanged(s,system.run);
 });
 test(system.name+' preserves same-year replay and next-year advancement',()=>{
  const s=state(system);system.run(s,new RNG('first'));assert.equal(system.get(s),2075);
  const before=structuredClone(s);assert.deepEqual(system.run(s,noRng),[]);assert.deepEqual(s,before);
  s.year=2076;system.run(s,new RNG('next'));assert.equal(system.get(s),2076);
 });
 test(system.name+' retains legacy standalone calls with absent year',()=>{
  const s=state(system);delete s.year;system.run(s,new RNG('legacy'));assert.equal(system.get(s),undefined);
 });
}
