import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processRomanceYear} from '../src/social/romance_system.js';
import {processPartnershipYear} from '../src/social/partnership_system.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';

const malformed=[NaN,Infinity,-Infinity,'2080',2080.5,-1,Number.MAX_SAFE_INTEGER+1];
const forbiddenRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
function setup(age=35){
 const s=new Game('cycle59-relationship-year').state;
 s.year=2080;s.player.age=age;
 s.social.romance={id:'p59',name:'Ada',surname:'K',age:age-1,alive:true,
  status:'dating',relationship:80,relationshipTension:10,yearsTogether:1,
  personality:{sociability:60,ambition:50},health:{current:85},
  monthlyIncome:50000,job:'Mühendis',jobId:'engineer'};
 return s;
}
const systems=[
 {name:'romance',age:17,run:processRomanceYear,marker:p=>p.lastRomanceProcessedYear,set:(p,v)=>{p.lastRomanceProcessedYear=v;}},
 {name:'partnership',age:35,run:processPartnershipYear,marker:p=>p.lastPartnershipProcessedYear,set:(p,v)=>{p.lastPartnershipProcessedYear=v;}},
 {name:'partner life',age:35,run:processPartnerLifeYear,marker:p=>p.life?.lastProcessedYear,set:(p,v)=>{p.life??={};p.life.lastProcessedYear=v;}}
];
function rejectsUnchanged(s,run){const before=structuredClone(s);assert.throws(()=>run(s,forbiddenRng),RangeError);assert.deepEqual(s,before);}
for(const system of systems){
 test(system.name+' rejects malformed calendar years before mutation or RNG',()=>{
  for(const value of malformed){const s=setup(system.age);s.year=value;rejectsUnchanged(s,system.run);}
 });
 test(system.name+' rejects malformed stored annual markers before mutation or RNG',()=>{
  for(const value of malformed){const s=setup(system.age);system.set(s.social.romance,value);rejectsUnchanged(s,system.run);}
 });
 test(system.name+' rejects future markers before mutation or RNG',()=>{
  const s=setup(system.age);system.set(s.social.romance,2081);rejectsUnchanged(s,system.run);
 });
 test(system.name+' rejects malformed markers with no calendar year',()=>{
  const s=setup(system.age);delete s.year;system.set(s.social.romance,'2080');rejectsUnchanged(s,system.run);
 });
 test(system.name+' advances once, ignores replay and advances next year',()=>{
  const s=setup(system.age);system.run(s,new RNG('cycle59-first'));
  assert.equal(system.marker(s.social.romance),2080);
  const before=structuredClone(s);assert.deepEqual(system.run(s,forbiddenRng),[]);assert.deepEqual(s,before);
  s.year=2081;s.player.age++;
  system.run(s,new RNG('cycle59-next'));assert.equal(system.marker(s.social.romance),2081);
 });
 test(system.name+' supports legacy calls without calendar year',()=>{
  const s=setup(system.age);delete s.year;
  system.run(s,new RNG('cycle59-legacy'));
  assert.equal(system.marker(s.social.romance),2000+system.age);
 });
}
for(const system of systems.slice(0,2)){
 test(system.name+' validates malformed year before reconciling deceased partner',()=>{
  const s=setup(system.age);s.social.romance.alive=false;s.year=NaN;
  rejectsUnchanged(s,system.run);
 });
}
test('inactive partner life remains a no-op even with invalid calendar year',()=>{
 const s=setup();s.social.romance=null;s.year=NaN;
 const before=structuredClone(s);assert.deepEqual(processPartnerLifeYear(s,forbiddenRng),[]);assert.deepEqual(s,before);
});
