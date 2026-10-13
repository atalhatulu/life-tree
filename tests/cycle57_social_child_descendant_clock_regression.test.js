import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processSocialYear} from '../src/social/social_simulation.js';
import {processChildDevelopmentYear} from '../src/family/child_development_system.js';
import {processDescendantLives} from '../src/family/descendant_life_system.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const malformed=[NaN,Infinity,-Infinity,'2080',2080.5,-1,Number.MAX_SAFE_INTEGER+1];
function child(id,age=18){return {id,name:id,age,alive:true,relationship:70,health:{current:70},personality:{curiosity:60,discipline:60,sociability:60,ambition:60},parenting:{involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0}};}
function friend(id){return {id,name:id,surname:'K',age:35,alive:true,relationship:75,yearsKnown:5,health:{current:80}};}
const systems=[
 {name:'social year',run:processSocialYear,setup(s){s.social.friends=[friend('a')];},set(s,v){s.social.lastProcessedYear=v;},get(s){return s.social.lastProcessedYear;}},
 {name:'child development',run:processChildDevelopmentYear,setup(s){s.children=[child('a',16),child('b',16)];},set(s,v){s.children[1].development={confidence:50,lastProcessedYear:v};},get(s){return s.children[0].development?.lastProcessedYear;}},
 {name:'adult descendants',run:processDescendantLives,setup(s){s.children=[child('a',24),child('b',24)];},set(s,v){s.children[1].adultLife={initialized:true,partnered:false,children:0,lastProcessedYear:v};},get(s){return s.children[0].adultLife?.lastProcessedYear;}}
];
function state(system){const s=new Game('cycle57-'+system.name).state;s.year=2080;s.player.age=45;system.setup(s);return s;}
function rejectsUnchanged(s,run){const before=structuredClone(s);assert.throws(()=>run(s,noRng),RangeError);assert.deepEqual(s,before);}
for(const system of systems){
 test(system.name+' rejects malformed calendar years before any state or RNG changes',()=>{
  for(const value of malformed){const s=state(system);s.year=value;rejectsUnchanged(s,system.run);}
 });
 test(system.name+' rejects malformed persisted markers atomically',()=>{
  for(const value of malformed){const s=state(system);system.set(s,value);rejectsUnchanged(s,system.run);}
 });
 test(system.name+' rejects a future marker without partial updates',()=>{
  const s=state(system);system.set(s,2081);rejectsUnchanged(s,system.run);
 });
 test(system.name+' preserves same-year replay and next-year advancement',()=>{
  const s=state(system);system.run(s,new RNG('first'));assert.equal(system.get(s),2080);
  const before=structuredClone(s);assert.deepEqual(system.run(s,noRng),[]);assert.deepEqual(s,before);
  s.year=2081;system.run(s,new RNG('next'));assert.equal(system.get(s),2081);
 });
 test(system.name+' permits standalone calls without a calendar year',()=>{
  const s=state(system);delete s.year;system.run(s,new RNG('legacy'));
  if(system.name!=='social year')assert.equal(system.get(s),undefined);
 });
}
test('dead descendants with invalid markers are ignored while living siblings advance',()=>{
 for(const system of systems.slice(1)){
  const s=state(system);s.children[1].alive=false;system.set(s,Infinity);
  system.run(s,new RNG('survivor'));assert.equal(system.get(s),2080);
 }
});
