import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processCareerDynamics} from '../src/career/career_system.js';
import {recordCareerYear} from '../src/career/career_profile.js';
import {processRetirementYear} from '../src/career/retirement_system.js';

const noRng={int(){throw Error('RNG consumed before calendar validation');},chance(){throw Error('RNG consumed before calendar validation');},fork(){throw Error('RNG consumed before calendar validation');}};
const steadyRng={int(){return 0;},chance(){return false;},fork(){return steadyRng;}};
function base(seed){
 const s=new Game('cycle65-'+seed).state;
 s.year=2075;s.player.age=35;
 s.career={employed:true,jobId:'developer',title:'Yazılımcı',monthlyIncome:80000,years:2,totalYears:2,performance:70,degreeRelated:true,level:1,levelTitle:'junior',satisfaction:60,stability:65,network:60,companyFit:60,sector:'private'};
 s.player.job=s.career.title;s.player.jobId=s.career.jobId;s.player.monthlyIncome=s.career.monthlyIncome;
 return s;
}
function retired(seed){
 const s=base(seed);s.retirement={retired:true,years:2,pensionMonthly:20000};return s;
}
function unchangedOnFailure(sys,s,pattern=/Invalid|earlier year/){
 const before=structuredClone(s);
 assert.throws(()=>sys.run(s),pattern);
 assert.deepEqual(s,before);
}
const systems=[
 {name:'career dynamics',make:base,run:s=>processCareerDynamics(s,noRng),advance:s=>processCareerDynamics(s,steadyRng),marker:s=>s,field:'lastCareerDynamicsProcessedYear'},
 {name:'career profile',make:base,run:s=>recordCareerYear(s),advance:s=>recordCareerYear(s),marker:s=>s.careerProfile,field:'lastRecordedYear',init:s=>{s.careerProfile={experienceByJob:{},experienceByFamily:{},recentJobs:[],coreFamily:null,totalExperience:0};}},
 {name:'retirement',make:retired,run:s=>processRetirementYear(s),advance:s=>processRetirementYear(s),marker:s=>s.retirement,field:'lastProcessedYear'}
];
for(const sys of systems){
 for(const [label,value] of [['NaN',NaN],['negative',-1],['fractional',2075.5],['string','2075'],['unsafe',Number.MAX_SAFE_INTEGER+1]]){
  test(sys.name+' rejects '+label+' current year atomically',()=>{
   const s=sys.make(sys.name+'-year-'+label);sys.init?.(s);s.year=value;
   unchangedOnFailure(sys,s);
  });
 }
 for(const [label,value] of [['negative',-1],['string','2074'],['infinite',Infinity],['fractional',2074.5]]){
  test(sys.name+' rejects '+label+' persisted marker atomically',()=>{
   const s=sys.make(sys.name+'-marker-'+label);sys.init?.(s);sys.marker(s)[sys.field]=value;
   unchangedOnFailure(sys,s);
  });
 }
 test(sys.name+' rejects a future marker atomically',()=>{
  const s=sys.make(sys.name+'-future');sys.init?.(s);sys.marker(s)[sys.field]=2076;
  unchangedOnFailure(sys,s,/earlier year/);
 });
 test(sys.name+' supports idempotent replay, subsequent year and missing-year legacy call',()=>{
  const s=sys.make(sys.name+'-replay');sys.init?.(s);
  sys.advance(s);
  const after=structuredClone(s);
  assert.deepEqual(sys.run(s),sys.name==='career profile'?undefined:[]);
  assert.deepEqual(s,after);
  s.year=2076;sys.advance(s);
  assert.equal(sys.marker(s)[sys.field],2076);
  delete s.year;delete sys.marker(s)[sys.field];
  sys.advance(s);
  assert.equal(sys.marker(s)[sys.field],undefined);
 });
}
test('inactive career dynamics and profile and non-retired state remain inert',()=>{
 const d=base('inactive-dynamics');d.career.employed=false;d.year=NaN;
 const p=base('inactive-profile');p.career.employed=false;p.year=NaN;
 const r=base('inactive-retirement');r.year=NaN;
 for(const [s,run,expected] of [[d,()=>processCareerDynamics(d,noRng),[]],[p,()=>recordCareerYear(p),undefined],[r,()=>processRetirementYear(r),[]]]){
  const before=structuredClone(s);
  assert.deepEqual(run(),expected);
  assert.deepEqual(s,before);
 }
});
test('career profile rejects corrupt year before lazily creating a profile',()=>{
 const s=base('profile-before-ensure');delete s.careerProfile;s.year=NaN;
 const before=structuredClone(s);
 assert.throws(()=>recordCareerYear(s),RangeError);
 assert.deepEqual(s,before);
});
test('career dynamics rejects corrupt marker before lazily initializing career fields',()=>{
 const s=base('dynamics-before-deepen');delete s.career.companyFit;s.lastCareerDynamicsProcessedYear='2074';
 const before=structuredClone(s);
 assert.throws(()=>processCareerDynamics(s,noRng),RangeError);
 assert.deepEqual(s,before);
});
