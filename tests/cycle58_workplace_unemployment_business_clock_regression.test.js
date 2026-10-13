import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processWorkplaceYear} from '../src/career/workplace_system.js';
import {processUnemploymentYear} from '../src/career/unemployment_system.js';
import {processBusinessYear} from '../src/career/entrepreneurship_system.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const safeRng={int(){return 0;},chance(){return false;},fork(){return safeRng;}};
const malformed=[NaN,Infinity,-Infinity,'2080',2080.5,-1,Number.MAX_SAFE_INTEGER+1];
function base(seed){const s=new Game(seed).state;s.year=2080;s.player.age=45;return s;}
function workplace(){const s=base('cycle58-workplace');s.career={employed:true,monthlyIncome:60000,performance:65,satisfaction:55};return s;}
function unemployment(){const s=base('cycle58-unemployment');s.career={employed:false};s.nextPath='work';s.unemployedSinceAge=43;s.finance={cash:5000,debt:0,unemploymentYears:0};s.healthProfile={stress:25,fitness:50,conditions:[]};s.mentalHealth={strain:20};return s;}
function business(){const s=base('cycle58-business');s.business={active:true,mode:'side',years:0,health:65,capital:400000,monthlyProfit:0,employees:0};s.finance={cash:500000,debt:0};s.healthProfile={stress:25,fitness:50,conditions:[]};return s;}
const cases=[
 {label:'workplace',make:workplace,run:(s,r)=>processWorkplaceYear(s,r),set:(s,v)=>s.career.lastWorkplaceProcessedYear=v,get:s=>s.career.lastWorkplaceProcessedYear},
 {label:'unemployment',make:unemployment,run:s=>processUnemploymentYear(s),set:(s,v)=>{s.unemployment={startedAtAge:43,durationYears:1,lastProcessedYear:v};},get:s=>s.unemployment.lastProcessedYear},
 {label:'business',make:business,run:(s,r)=>processBusinessYear(s,r),set:(s,v)=>s.business.lastProcessedYear=v,get:s=>s.business.lastProcessedYear}
];
function rejectsUnchanged(s,run){const before=structuredClone(s);assert.throws(()=>run(s,noRng),RangeError);assert.deepEqual(s,before);}
for(const c of cases){
 test(c.label+' rejects malformed current years without mutation or RNG',()=>{
  for(const value of malformed){const s=c.make();s.year=value;rejectsUnchanged(s,c.run);}
 });
 test(c.label+' rejects malformed saved annual markers before mutation',()=>{
  for(const value of malformed){const s=c.make();c.set(s,value);rejectsUnchanged(s,c.run);}
 });
 test(c.label+' rejects future annual markers atomically',()=>{
  const s=c.make();c.set(s,2081);rejectsUnchanged(s,c.run);
 });
 test(c.label+' preserves replay and subsequent-year advancement',()=>{
  const s=c.make();c.run(s,safeRng);assert.equal(c.get(s),2080);
  const after=structuredClone(s);assert.deepEqual(c.run(s,noRng),[]);assert.deepEqual(s,after);
  s.year=2081;c.run(s,safeRng);assert.equal(c.get(s),2081);
 });
 test(c.label+' supports standalone processing with absent calendar year',()=>{
  const s=c.make();delete s.year;c.run(s,safeRng);assert.equal(c.get(s),undefined);
 });
}
test('unemployment rejects invalid year before creating a new unemployment spell',()=>{
 const s=unemployment();s.year=NaN;delete s.unemployment;rejectsUnchanged(s,processUnemploymentYear);
});
test('unemployment rejects malformed marker even when calendar year is missing',()=>{
 const s=unemployment();delete s.year;s.unemployment={startedAtAge:43,durationYears:1,lastProcessedYear:'2080'};
 rejectsUnchanged(s,processUnemploymentYear);
});
test('inactive workplace and business remain no-ops',()=>{
 const w=workplace();w.career.employed=false;w.year=NaN;const wb=structuredClone(w);
 assert.deepEqual(processWorkplaceYear(w,noRng),[]);assert.deepEqual(w,wb);
 const b=business();b.business.active=false;b.year=NaN;const bb=structuredClone(b);
 assert.deepEqual(processBusinessYear(b,noRng),[]);assert.deepEqual(b,bb);
});
