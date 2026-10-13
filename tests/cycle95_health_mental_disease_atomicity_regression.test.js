import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processHealthYear} from '../src/health/health_system.js';
import {processDiseaseProgressionYear} from '../src/health/disease_progression.js';
import {processMentalHealthYear} from '../src/health/mental_health_system.js';

function state(seed){
 const s=new Game('cycle95-'+seed).state;
 s.year=2078;s.player.age=60;s.player.alive=true;
 s.player.health.current=80;s.player.health.constitution=65;
 s.healthProfile={conditions:[],stress:45,fitness:65};
 s.social.friends=[];
 return s;
}
function condition(id='metabolic'){
 return {id,label:id,severity:2,diagnosedAtAge:50};
}
function checkpoint(failDraw=Infinity,{chance=true}={}){
 return {position:0,failDraw,
  snapshotState(){return this.position;},restoreState(token){this.position=token;},
  draw(){this.position++;if(this.position===this.failDraw)throw Error('injected RNG failure');},
  int(){this.draw();return 0;},chance(){this.draw();return chance;},fork(){return this;}};
}
function unchangedAfterFailure(run,s,rng,matcher=/injected RNG failure/){
 const before=structuredClone(s);
 assert.throws(()=>run(s,rng),matcher);
 assert.deepEqual(s,before);
 assert.equal(rng.position,0);
}

test('health restores reserves, exposure, condition progression and RNG on later draw failure',()=>{
 const s=state('health-late');s.healthProfile.conditions=[condition()];
 const refs=[s.player.health,s.healthProfile,s.healthProfile.conditions,s.healthProfile.conditions[0]];
 unchangedAfterFailure(processHealthYear,s,checkpoint(4));
 assert.strictEqual(s.player.health,refs[0]);assert.strictEqual(s.healthProfile,refs[1]);
 assert.strictEqual(s.healthProfile.conditions,refs[2]);assert.strictEqual(s.healthProfile.conditions[0],refs[3]);
});
test('health restores death, diagnosis and player alive if cause RNG fork fails',()=>{
 const s=state('health-death');s.player.age=95;s.healthProfile.riskExposure={hypertension:99};
 const before=structuredClone(s);
 const rng=checkpoint();rng.fork=(label)=>{if(label==='cause')throw Error('cause fork failed');return rng;};
 assert.throws(()=>processHealthYear(s,rng),/cause fork failed/);
 assert.deepEqual(s,before);assert.equal(rng.position,0);
});
test('health removes newly created profile when first RNG call fails',()=>{
 const s=state('health-absent');delete s.healthProfile;
 unchangedAfterFailure(processHealthYear,s,checkpoint(1));
 assert.equal(Object.hasOwn(s,'healthProfile'),false);
});
test('health rejects corrupt later condition and exposure before any RNG draw',()=>{
 for(const mutate of [
  s=>s.healthProfile.conditions.push(null),
  s=>s.healthProfile.conditions.push({...condition('cardiac'),severity:NaN}),
  s=>s.healthProfile.riskExposure={hypertension:Infinity},
  s=>s.healthProfile.conditions='broken',
  s=>s.healthProfile.fitness='65'
 ]){
  const s=state('health-preflight');s.healthProfile.conditions=[condition()];mutate(s);
  const before=structuredClone(s),rng=checkpoint();
  assert.throws(()=>processHealthYear(s,rng),/health|condition|exposure|fitness/i);
  assert.deepEqual(s,before);assert.equal(rng.position,0);
 }
});
test('health commits and replay is inert without taking another RNG snapshot',()=>{
 const s=state('health-success'),rng=checkpoint(Infinity,{chance:false});
 processHealthYear(s,rng);const after=structuredClone(s),position=rng.position;
 rng.snapshotState=()=>{throw Error('checkpoint on replay');};
 assert.deepEqual(processHealthYear(s,rng),[]);assert.deepEqual(s,after);assert.equal(rng.position,position);
});

test('disease progression restores earlier complication, nested references and RNG',()=>{
 const s=state('disease-late');s.healthProfile.conditions=[condition('metabolic'),condition('cardiac')];
 const refs=[s.healthProfile,s.healthProfile.conditions,s.healthProfile.conditions[0],s.player.health];
 unchangedAfterFailure(processDiseaseProgressionYear,s,checkpoint(3));
 assert.strictEqual(s.healthProfile,refs[0]);assert.strictEqual(s.healthProfile.conditions,refs[1]);
 assert.strictEqual(s.healthProfile.conditions[0],refs[2]);assert.strictEqual(s.player.health,refs[3]);
});
test('disease progression rejects corrupt later progression before changing earlier condition',()=>{
 for(const mutate of [
  c=>c.progression={score:NaN,stage:'mild',status:'active',stableYears:0,complicationCount:0},
  c=>c.progression={score:50,stage:'unknown',status:'active',stableYears:0,complicationCount:0},
  c=>c.progression={score:50,stage:'moderate',status:'active',stableYears:0,complicationCount:Number.MAX_SAFE_INTEGER},
  c=>c.severity='3',
  c=>c.lastProgressionProcessedYear=2079
 ]){
  const s=state('disease-preflight');s.healthProfile.conditions=[condition(),condition('cardiac')];
  mutate(s.healthProfile.conditions[1]);const before=structuredClone(s),rng=checkpoint();
  assert.throws(()=>processDiseaseProgressionYear(s,rng),/progression|condition|severity|earlier year|counter/i);
  assert.deepEqual(s,before);assert.equal(rng.position,0);
 }
});
test('disease progression accepts partial legacy progression and idempotent replay',()=>{
 const s=state('disease-legacy');s.healthProfile.conditions=[condition()];
 s.healthProfile.conditions[0].progression={score:40};
 const rng=checkpoint(Infinity,{chance:false});
 processDiseaseProgressionYear(s,rng);
 assert.ok(Number.isFinite(s.healthProfile.conditions[0].progression.score));
 const after=structuredClone(s);rng.snapshotState=()=>{throw Error('replay checkpoint');};
 assert.deepEqual(processDiseaseProgressionYear(s,rng),[]);assert.deepEqual(s,after);
});
test('disease progression rejects incomplete custom RNG checkpoint without mutation',()=>{
 const s=state('disease-checkpoint');s.healthProfile.conditions=[condition()];
 const before=structuredClone(s);
 assert.throws(()=>processDiseaseProgressionYear(s,{snapshotState(){return 0;},int(){return 0;}}),/checkpoint/i);
 assert.deepEqual(s,before);
});

test('mental health restores newly initialized ledger when RNG fails',()=>{
 const s=state('mental-new');delete s.mentalHealth;
 unchangedAfterFailure(processMentalHealthYear,s,checkpoint(1));
 assert.equal(Object.hasOwn(s,'mentalHealth'),false);
});
test('mental health restores existing episode list and strain after grief episode push fails',()=>{
 const s=state('mental-grief');s.mentalHealth={resilience:65,strain:40,status:'strained',episodes:[],therapyYears:0,recoveryYears:0};
 s.parents.mother.deathYear=s.year;
 const episodes=s.mentalHealth.episodes,m=s.mentalHealth,profile=s.healthProfile;
 Object.defineProperty(episodes,'push',{value(){throw Error('episode append failed');},configurable:true});
 const before=JSON.stringify(s),rng=checkpoint();
 assert.throws(()=>processMentalHealthYear(s,rng),/episode append failed/);
 assert.equal(JSON.stringify(s),before);assert.equal(rng.position,0);
 assert.strictEqual(s.mentalHealth,m);assert.strictEqual(s.mentalHealth.episodes,episodes);assert.strictEqual(s.healthProfile,profile);
});
test('mental health rejects corrupt loss list, episode list, or recovery counter before RNG',()=>{
 for(const mutate of [
  s=>s.social.deceasedFriends='invalid',
  s=>s.siblings=null,
  s=>s.mentalHealth={episodes:'broken',strain:20,resilience:50},
  s=>s.mentalHealth={episodes:[],strain:20,resilience:50,recoveryYears:Number.MAX_SAFE_INTEGER},
  s=>s.healthProfile.stress=NaN
 ]){
  const s=state('mental-preflight');mutate(s);const before=structuredClone(s),rng=checkpoint();
  assert.throws(()=>processMentalHealthYear(s,rng),/mental|episode|loss|siblings|stress|counter|array/i);
  assert.deepEqual(s,before);assert.equal(rng.position,0);
 }
});
test('mental health fills safe legacy fields and skips replay checkpoint',()=>{
 const s=state('mental-legacy');s.mentalHealth={strain:28};const rng=checkpoint();
 processMentalHealthYear(s,rng);
 assert.ok(Array.isArray(s.mentalHealth.episodes));assert.ok(Number.isFinite(s.mentalHealth.resilience));
 const after=structuredClone(s),position=rng.position;
 rng.snapshotState=()=>{throw Error('replay checkpoint');};
 assert.deepEqual(processMentalHealthYear(s,rng),[]);assert.deepEqual(s,after);assert.equal(rng.position,position);
});
test('mental health rejects half checkpoint and snapshot exceptions without creating a ledger',()=>{
 for(const rng of [
  {snapshotState(){return 0;},int(){return 0;}},
  {snapshotState(){throw Error('snapshot error');},restoreState(){},int(){return 0;}}
 ]){
  const s=state('mental-checkpoint');delete s.mentalHealth;const before=structuredClone(s);
  assert.throws(()=>processMentalHealthYear(s,rng),/checkpoint|snapshot error/i);
  assert.deepEqual(s,before);
 }
});

test('disease progression safely completes a partial legacy genetic course',()=>{
 const s=state('disease-course');s.healthProfile.conditions=[{...condition(),geneticCourse:{onsetAgeOffset:0}}];
 const course=s.healthProfile.conditions[0].geneticCourse;
 processDiseaseProgressionYear(s,checkpoint(Infinity,{chance:false}));
 assert.strictEqual(s.healthProfile.conditions[0].geneticCourse,course);
 assert.ok(Number.isFinite(course.complicationMultiplier));
});
test('disease progression rejects null condition before consuming RNG',()=>{
 const s=state('disease-null');s.healthProfile.conditions=[condition(),null];
 const before=structuredClone(s),rng=checkpoint();
 assert.throws(()=>processDiseaseProgressionYear(s,rng),/disease condition/i);
 assert.deepEqual(s,before);assert.equal(rng.position,0);
});
test('health rollback reports both original error and RNG restore failure',()=>{
 const s=state('health-restore-error'),before=structuredClone(s),rng=checkpoint(2);
 rng.restoreState=()=>{throw Error('restore failed');};
 assert.throws(()=>processHealthYear(s,rng),error=>{
  assert.ok(error instanceof AggregateError);
  assert.match(error.errors[0].message,/injected RNG failure/);
  assert.match(error.errors[1].message,/restore failed/);
  return true;
 });
 assert.deepEqual(s,before);
});
