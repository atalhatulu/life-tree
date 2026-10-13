import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {progressCareerYear} from '../src/career/job_market.js';
import {recordCareerYear} from '../src/career/career_profile.js';
import {processCareerDynamics} from '../src/career/career_system.js';

const noRng={int(){throw Error('replay consumed RNG');},chance(){throw Error('replay consumed RNG');},fork(){throw Error('replay consumed RNG');}};
const safeRng={int(){return 0;},chance(){return false;},fork(){return safeRng;}};
function employed(seed='career-annual'){
 const g=new Game(seed),s=g.state;
 s.year=2075;s.player.age=35;s.player.alive=true;
 s.career={employed:true,jobId:'developer',title:'Yazılımcı',monthlyIncome:80000,years:2,totalYears:2,performance:70,degreeRelated:true,level:1,levelTitle:'junior',satisfaction:60,stability:65,network:60,companyFit:60,sector:'private'};
 s.player.job=s.career.title;s.player.jobId=s.career.jobId;s.player.monthlyIncome=s.career.monthlyIncome;
 return g;
}
function nextYear(state){state.year++;state.player.age++;}

test('career progression does not add tenure or roll raises twice in one year',()=>{
 const g=employed();progressCareerYear(g.state,safeRng);
 const before=structuredClone(g.state);
 assert.deepEqual(progressCareerYear(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});
test('career progression rejects past year without mutation',()=>{
 const g=employed();g.state.lastCareerProgressProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>progressCareerYear(g.state,noRng),RangeError);
 assert.deepEqual(g.state,before);
});
test('career progression marker survives save and later year advances',()=>{
 const g=employed();progressCareerYear(g.state,safeRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(progressCareerYear(restored.state,noRng),[]);
 nextYear(restored.state);progressCareerYear(restored.state,safeRng);
 assert.equal(restored.state.career.years,4);
});
test('career progression remains one-per-year after job replacement and unemployed call is inert',()=>{
 const g=employed();g.state.career.employed=false;
 assert.deepEqual(progressCareerYear(g.state,noRng),[]);
 assert.equal(g.state.lastCareerProgressProcessedYear,undefined);
 g.state.career.employed=true;progressCareerYear(g.state,safeRng);
 g.state.career={...g.state.career,years:0};
 assert.deepEqual(progressCareerYear(g.state,noRng),[]);
 assert.equal(g.state.career.years,0);
});

test('career profile credits exactly one experience year on replay',()=>{
 const g=employed();recordCareerYear(g.state);
 const before=structuredClone(g.state);
 recordCareerYear(g.state);
 assert.deepEqual(g.state,before);
 assert.equal(g.state.careerProfile.totalExperience,1);
});
test('career profile rejects past year before creating a missing profile',()=>{
 const g=employed();g.state.careerProfile={lastRecordedYear:2076,experienceByJob:{},experienceByFamily:{},recentJobs:[],totalExperience:0};
 const before=structuredClone(g.state);
 assert.throws(()=>recordCareerYear(g.state),RangeError);
 assert.deepEqual(g.state,before);
});
test('career profile preserves year marker in saves and permits next year',()=>{
 const g=employed();recordCareerYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 recordCareerYear(restored.state);
 assert.equal(restored.state.careerProfile.totalExperience,1);
 nextYear(restored.state);recordCareerYear(restored.state);
 assert.equal(restored.state.careerProfile.totalExperience,2);
});
test('career profile does not credit two jobs in one year, and unemployment is inert',()=>{
 const g=employed();g.state.career.employed=false;
 recordCareerYear(g.state);
 assert.equal(g.state.careerProfile?.lastRecordedYear,undefined);
 g.state.career.employed=true;recordCareerYear(g.state);
 g.state.career={...g.state.career,jobId:'designer'};
 recordCareerYear(g.state);
 assert.equal(g.state.careerProfile.totalExperience,1);
 assert.equal(g.state.careerProfile.experienceByJob.designer,undefined);
});

test('career dynamics does not reapply promotion, stress, or firing roll in one year',()=>{
 const g=employed();processCareerDynamics(g.state,safeRng);
 const before=structuredClone(g.state);
 assert.deepEqual(processCareerDynamics(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});
test('career dynamics rejects past year before initializing missing fields',()=>{
 const g=employed();delete g.state.career.companyFit;
 g.state.lastCareerDynamicsProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processCareerDynamics(g.state,noRng),RangeError);
 assert.deepEqual(g.state,before);
});
test('career dynamics persists through save and advances in next year',()=>{
 const g=employed();processCareerDynamics(g.state,safeRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processCareerDynamics(restored.state,noRng),[]);
 nextYear(restored.state);processCareerDynamics(restored.state,safeRng);
 assert.equal(restored.state.lastCareerDynamicsProcessedYear,2076);
});
test('career dynamics does not re-roll after a job change in the same year',()=>{
 const g=employed();processCareerDynamics(g.state,safeRng);
 g.state.career={...g.state.career,jobId:'designer',companyFit:60};
 const before=structuredClone(g.state);
 assert.deepEqual(processCareerDynamics(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});
test('career dynamics marks even a firing year and legacy records still process',()=>{
 const g=employed();
 const fireRng={int(){return 0;},chance(){return true;},fork(){return safeRng;}};
 const entries=processCareerDynamics(g.state,fireRng);
 assert.ok(entries.some(e=>e.text.includes('işinden çıkarıldın')));
 assert.equal(g.state.lastCareerDynamicsProcessedYear,2075);
 g.state.career.employed=true;
 assert.deepEqual(processCareerDynamics(g.state,noRng),[]);
 const legacy=employed('legacy-career');
 processCareerDynamics(legacy.state,safeRng);
 assert.equal(legacy.state.lastCareerDynamicsProcessedYear,2075);
});

test('career raise year is marked and cannot issue a second raise',()=>{
 const g=employed('raise-year');g.state.career.performance=100;
 const raiseRng={int(min,max){return max;},chance(){return true;}};
 const entries=progressCareerYear(g.state,raiseRng);
 assert.ok(entries.some(e=>e.text.includes('zam aldın')));
 assert.equal(g.state.lastCareerProgressProcessedYear,2075);
 const income=g.state.career.monthlyIncome;
 assert.deepEqual(progressCareerYear(g.state,noRng),[]);
 assert.equal(g.state.career.monthlyIncome,income);
});
