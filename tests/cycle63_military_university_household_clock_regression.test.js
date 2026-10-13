import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processMilitaryYear} from '../src/life/military_service.js';
import {progressUniversityYear} from '../src/education/university_system.js';
import {processHouseholdDepthYear} from '../src/finance/household_depth.js';

const noRng={int(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const steadyRng={int(){return 0;},fork(){return {chance(){return false;}};}};
function base(seed){
 const s=new Game(seed).state;
 s.year=2075;s.player.age=25;
 return s;
}
function military(seed){
 const s=base(seed);s.player.sex='male';
 s.militaryService={eligible:true,status:'pending',deferredUntilAge:null};
 s.career={employed:true,monthlyIncome:50000,stability:60,serviceLeave:{startedAtAge:24,months:6,mode:'standard'}};
 s.player.monthlyIncome=0;
 return s;
}
function university(seed){
 const s=base(seed);
 s.higherEducation={enrolled:true,completed:false,year:2,duration:4,performance:55,
  universityName:'Üniversite',programTitle:'Bölüm',cityName:'Ankara'};
 return s;
}
function household(seed){
 const s=base(seed);
 s.finance={cash:50000,savings:30000,monthlyExpenses:10000,ownershipCostsMonthly:0,
  monthlyIncome:20000,debt:0};
 s.assets={car:null,home:null};
 return s;
}
function rejectsWithoutMutation(fn,s,rng,regex=/Invalid|earlier year/){
 const before=structuredClone(s);
 assert.throws(()=>fn(s,rng),regex);
 assert.deepEqual(s,before);
}

for(const [name,value] of [['NaN',NaN],['negative',-1],['fractional',2075.5],['text','2075'],['unsafe',Number.MAX_SAFE_INTEGER+1]]){
 test('military rejects '+name+' calendar year before restoring career leave',()=>{
  const s=military('m-'+name);s.year=value;
  rejectsWithoutMutation(processMilitaryYear,s);
 });
}
test('military rejects malformed prior marker without restoring leave',()=>{
 const s=military('m-marker');s.militaryService.lastProcessedYear='2074';
 rejectsWithoutMutation(processMilitaryYear,s);
});
test('military rejects future marker before mutation',()=>{
 const s=military('m-future');s.militaryService.lastProcessedYear=2076;
 rejectsWithoutMutation(processMilitaryYear,s,/earlier year/);
});
test('military retains replay and missing-year standalone compatibility',()=>{
 const s=military('m-legacy');processMilitaryYear(s);
 const after=structuredClone(s);assert.deepEqual(processMilitaryYear(s),[]);assert.deepEqual(s,after);
 delete s.year;delete s.militaryService.lastProcessedYear;
 assert.deepEqual(processMilitaryYear(s),[]);
});

for(const [name,value] of [['NaN',NaN],['negative',-1],['fractional',2075.5],['text','2075'],['unsafe',Number.MAX_SAFE_INTEGER+1]]){
 test('university rejects '+name+' calendar year before RNG or grade changes',()=>{
  const s=university('u-'+name);s.year=value;
  rejectsWithoutMutation(progressUniversityYear,s,noRng);
 });
}
test('university rejects malformed prior marker before RNG',()=>{
 const s=university('u-marker');s.higherEducation.lastProgressProcessedYear=Infinity;
 rejectsWithoutMutation(progressUniversityYear,s,noRng);
});
test('university rejects future marker before RNG',()=>{
 const s=university('u-future');s.higherEducation.lastProgressProcessedYear=2076;
 rejectsWithoutMutation(progressUniversityYear,s,noRng,/earlier year/);
});
test('university retains replay, next year and missing-year compatibility',()=>{
 const s=university('u-legacy');progressUniversityYear(s,steadyRng);
 const after=structuredClone(s);assert.deepEqual(progressUniversityYear(s,noRng),[]);assert.deepEqual(s,after);
 s.year=2076;progressUniversityYear(s,steadyRng);assert.equal(s.higherEducation.lastProgressProcessedYear,2076);
 delete s.year;delete s.higherEducation.lastProgressProcessedYear;
 progressUniversityYear(s,steadyRng);
});

for(const [name,value] of [['NaN',NaN],['negative',-1],['fractional',2075.5],['text','2075'],['unsafe',Number.MAX_SAFE_INTEGER+1]]){
 test('household rejects '+name+' calendar year before finance changes',()=>{
  const s=household('h-'+name);s.year=value;
  rejectsWithoutMutation(processHouseholdDepthYear,s,noRng);
 });
}
test('household rejects malformed prior marker before finance changes',()=>{
 const s=household('h-marker');s.householdDynamics={lastProcessedYear:-1};
 rejectsWithoutMutation(processHouseholdDepthYear,s,noRng);
});
test('household rejects future marker before finance changes',()=>{
 const s=household('h-future');s.householdDynamics={lastProcessedYear:2076};
 rejectsWithoutMutation(processHouseholdDepthYear,s,noRng,/earlier year/);
});
test('household retains replay, next year and missing-year compatibility',()=>{
 const s=household('h-legacy');processHouseholdDepthYear(s,steadyRng);
 const after=structuredClone(s);assert.deepEqual(processHouseholdDepthYear(s,noRng),[]);assert.deepEqual(s,after);
 s.year=2076;processHouseholdDepthYear(s,steadyRng);assert.equal(s.householdDynamics.lastProcessedYear,2076);
 delete s.year;delete s.householdDynamics.lastProcessedYear;
 processHouseholdDepthYear(s,steadyRng);
});
