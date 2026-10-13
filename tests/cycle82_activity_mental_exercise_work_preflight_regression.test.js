import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';

function adult(label,age=35){
 const state=new Game('cycle82-'+label).state;
 state.player.age=age;
 state.actions={remaining:3,max:3};
 state.healthProfile={conditions:[],stress:30,fitness:50,lastCheckupAge:null};
 state.mentalHealth={strain:45,status:'strained',resilience:50,therapyYears:0,episodes:[]};
 state.career={employed:true,performance:60,satisfaction:60};
 return state;
}
function rejectsAtomically(label,activity,setup){
 test(label+' rejects without state or RNG changes',()=>{
  const state=adult(label,activity==='exercise-late'||activity==='work-late'?65:35);
  setup(state);
  const rng=new RNG('cycle82-rng-'+label);
  const before=structuredClone(state),randomBefore=rng.state;
  const id=activity==='exercise-late'?'exercise':activity==='work-late'?'work-hard':activity;
  assert.throws(()=>performActivity(state,id,rng),/Geçersiz/);
  assert.deepEqual(state,before);
  assert.equal(rng.state,randomBefore);
  assert.equal(availableActivities(state).some(a=>a.id===id),false);
  assert.deepEqual(state,before);
 });
}

// 1. Mental-health postprocessing must never corrupt an otherwise successful
// action after it has already spent RNG and mutated physical/social state.
for(const [label,activity,setup] of [
 ['mental strain NaN','exercise',s=>{s.mentalHealth.strain=NaN;}],
 ['mental strain string','socialize',s=>{s.mentalHealth.strain='45';}],
 ['mental strain negative','hobby',s=>{s.mentalHealth.strain=-1;}],
 ['mental strain above 100','date',s=>{s.mentalHealth.strain=101;s.social.romance={name:'Partner',alive:true,relationship:60};}],
 ['mental ledger is array','checkup',s=>{s.mentalHealth=[];}],
 ['mental ledger is string','exercise',s=>{s.mentalHealth='invalid';}],
 ['derived mental resilience has NaN constitution','hobby',s=>{delete s.mentalHealth;s.player.health.constitution=NaN;}],
 ['derived mental resilience has string patience','socialize',s=>{delete s.mentalHealth;s.player.personality.patience='50';}],
 ['therapy years NaN','therapy',s=>{s.mentalHealth.therapyYears=NaN;}],
 ['therapy years negative','therapy',s=>{s.mentalHealth.therapyYears=-1;}],
 ['therapy years fractional','therapy',s=>{s.mentalHealth.therapyYears=1.5;}],
 ['therapy years overflow','therapy',s=>{s.mentalHealth.therapyYears=Number.MAX_SAFE_INTEGER;}]
])rejectsAtomically(label,activity,setup);

// 2. Exercise must not clamp malformed physical/appearance metrics to NaN.
for(const [label,activity,setup] of [
 ['exercise health NaN','exercise',s=>{s.player.health.current=NaN;}],
 ['exercise health string','exercise',s=>{s.player.health.current='60';}],
 ['exercise health above max','exercise',s=>{s.player.health.current=101;}],
 ['exercise appearance NaN','exercise',s=>{s.player.appearance.build=NaN;}],
 ['exercise appearance negative','exercise',s=>{s.player.appearance.build=-1;}],
 ['exercise appearance string','exercise',s=>{s.player.appearance.build='50';}],
 ['exercise fitness NaN','exercise',s=>{s.healthProfile.fitness=NaN;}],
 ['exercise fitness string','exercise',s=>{s.healthProfile.fitness='50';}],
 ['exercise fitness above max','exercise',s=>{s.healthProfile.fitness=110;}],
 ['exercise profile array','exercise',s=>{s.healthProfile=[];}],
 ['exercise late-life mobility NaN','exercise-late',s=>{s.lateLife={mobility:NaN};}]
])rejectsAtomically(label,activity,setup);

// 3. Work focus must validate career scores and any stress/fitness fields
// before modifying performance, satisfaction or mental-health strain.
for(const [label,activity,setup] of [
 ['work performance NaN','work-hard',s=>{s.career.performance=NaN;}],
 ['work performance string','work-hard',s=>{s.career.performance='60';}],
 ['work performance negative','work-hard',s=>{s.career.performance=-1;}],
 ['work satisfaction NaN','work-hard',s=>{s.career.satisfaction=NaN;}],
 ['work satisfaction string','work-hard',s=>{s.career.satisfaction='60';}],
 ['work satisfaction above max','work-hard',s=>{s.career.satisfaction=101;}],
 ['work stress NaN','work-hard',s=>{s.healthProfile.stress=NaN;}],
 ['work stress string','work-hard',s=>{s.healthProfile.stress='40';}],
 ['work stress negative','work-hard',s=>{s.healthProfile.stress=-1;}],
 ['work fitness NaN','work-hard',s=>{s.healthProfile.fitness=NaN;}],
 ['work profile array','work-hard',s=>{s.healthProfile=[];}],
 ['work late-life mobility string','work-late',s=>{s.lateLife={mobility:'40'};}]
])rejectsAtomically(label,activity,setup);

test('legacy missing mental ledger and fitness use safe defaults on valid exercise',()=>{
 const s=adult('legacy-exercise');delete s.mentalHealth;delete s.healthProfile.fitness;
 assert.ok(availableActivities(s).some(a=>a.id==='exercise'));
 const result=performActivity(s,'exercise',new RNG('cycle82-legacy-exercise'));
 assert.match(result,/Egzersiz|antrenmanı|zorlanma/);
 assert.ok(Number.isFinite(s.healthProfile.fitness)&&s.healthProfile.fitness>=50);
 assert.ok(Number.isFinite(s.mentalHealth.strain));
 assert.equal(s.actions.remaining,2);
});
test('legacy absent work satisfaction and stress use established defaults',()=>{
 const s=adult('legacy-work');delete s.career.satisfaction;delete s.healthProfile.stress;
 assert.ok(availableActivities(s).some(a=>a.id==='work-hard'));
 assert.match(performActivity(s,'work-hard',new RNG('cycle82-legacy-work')),/İşine|Fiziksel/);
 assert.ok(Number.isFinite(s.career.satisfaction));
 assert.equal(s.actions.remaining,2);
});
test('valid therapy retains strain reduction and increments therapy years',()=>{
 const s=adult('valid-therapy');s.mentalHealth.strain=65;s.mentalHealth.therapyYears=2;
 assert.match(performActivity(s,'therapy',new RNG('cycle82-therapy')),/psikolojik/);
 assert.equal(s.mentalHealth.strain,54);
 assert.equal(s.mentalHealth.therapyYears,3);
});

test('repeated work with missing legacy stress uses the default in both stress paths',()=>{
 const s=adult('legacy-work-streak');
 s.player.health.current=35;
 s.healthProfile.fitness=20;
 delete s.healthProfile.stress;
 s.activityMemory={'work-hard':{uses:4,streak:4,lastAge:s.player.age-1}};
 assert.match(performActivity(s,'work-hard',new RNG('cycle82-streak')),/Fiziksel/);
 assert.equal(s.healthProfile.stress,28);
 assert.ok(Number.isFinite(s.career.satisfaction));
 assert.equal(s.actions.remaining,2);
});
