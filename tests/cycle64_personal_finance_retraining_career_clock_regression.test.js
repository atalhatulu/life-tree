import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processPersonalFinanceYear} from '../src/finance/personal_finance.js';
import {beginRetraining,processRetrainingYear} from '../src/career/career_system.js';
import {progressCareerYear} from '../src/career/job_market.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');}};
const steadyRng={int(){return 0;},chance(){return false;}};
function base(seed){
 const s=new Game('cycle64-'+seed).state;
 s.year=2075;s.player.age=35;
 return s;
}
function finance(seed){
 const s=base(seed);
 s.finance={cash:20000,savings:10000,debt:0};
 return s;
}
function retraining(seed){
 const s=base(seed);
 s.career={employed:true,jobId:'accountant',title:'Muhasebeci'};
 beginRetraining(s,'designer');
 return s;
}
function career(seed){
 const s=base(seed);
 s.career={employed:true,jobId:'developer',title:'Yazılımcı',monthlyIncome:80000,years:2,totalYears:2,performance:70,degreeRelated:true};
 s.player.monthlyIncome=80000;
 return s;
}
function rejectsAtomically(process,s,pattern=/Invalid|earlier year/){
 const before=structuredClone(s);
 assert.throws(()=>process(s),pattern);
 assert.deepEqual(s,before);
}
const systems=[
 {name:'personal finance',make:finance,process:s=>processPersonalFinanceYear(s),marker:s=>s.finance,field:'lastProcessedYear'},
 {name:'retraining',make:retraining,process:s=>processRetrainingYear(s),marker:s=>s.retraining,field:'lastProcessedYear'},
 {name:'career progression',make:career,process:s=>progressCareerYear(s,noRng),run:s=>progressCareerYear(s,steadyRng),marker:s=>s,field:'lastCareerProgressProcessedYear'}
];
const invalidYears=[['NaN',NaN],['negative',-1],['fractional',2075.5],['text','2075'],['unsafe',Number.MAX_SAFE_INTEGER+1]];
const invalidMarkers=[['negative',-1],['text','2074'],['infinite',Infinity]];
for(const sys of systems){
 for(const [label,value] of invalidYears){
  test(sys.name+' rejects '+label+' calendar year before any mutation',()=>{
   const s=sys.make('year-'+sys.name+'-'+label);s.year=value;
   rejectsAtomically(sys.process,s);
  });
 }
 for(const [label,value] of invalidMarkers){
  test(sys.name+' rejects '+label+' prior year marker without mutation',()=>{
   const s=sys.make('marker-'+sys.name+'-'+label);sys.marker(s)[sys.field]=value;
   rejectsAtomically(sys.process,s);
  });
 }
 test(sys.name+' rejects future year marker before mutation',()=>{
  const s=sys.make('future-'+sys.name);sys.marker(s)[sys.field]=2076;
  rejectsAtomically(sys.process,s,/earlier year/);
 });
 test(sys.name+' preserves replay, next year and standalone legacy calls',()=>{
  const s=sys.make('legacy-'+sys.name);
  const run=sys.run??sys.process;
  run(s);
  const after=structuredClone(s);
  assert.deepEqual(sys.process(s),[]);
  assert.deepEqual(s,after);
  s.year=2076;
  run(s);
  assert.equal(sys.marker(s)[sys.field],2076);
  delete s.year;
  delete sys.marker(s)[sys.field];
  run(s);
  assert.equal(sys.marker(s)[sys.field],undefined);
 });
}

test('inactive career and completed retraining remain side-effect free',()=>{
 const c=career('inactive');c.career.employed=false;c.year=NaN;
 const r=retraining('complete');r.retraining.completed=true;r.year=NaN;
 const beforeC=structuredClone(c),beforeR=structuredClone(r);
 assert.deepEqual(progressCareerYear(c,noRng),[]);
 assert.deepEqual(processRetrainingYear(r),[]);
 assert.deepEqual(c,beforeC);assert.deepEqual(r,beforeR);
});
