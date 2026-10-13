import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {serializeGame} from '../src/core/save_system.js';
import {beginRetraining,processRetrainingYear} from '../src/career/career_system.js';
import {ensureMilitaryState,processMilitaryYear} from '../src/life/military_service.js';
import {ensureMiddleAgeState,processMiddleAgeYear} from '../src/life/middle_age_system.js';

function game(seed){const g=new Game(seed);g.state.year=2075;g.state.player.age=42;return g;}
function retraining(seed){
 const g=game(seed);
 g.state.career={employed:true,jobId:'accountant',title:'Muhasebeci'};
 beginRetraining(g.state,'designer');
 return g;
}
function middle(seed){
 const g=game(seed);
 g.state.career={employed:true,satisfaction:20};
 g.state.healthProfile={stress:90};
 g.state.activityMemory={'work-hard':{streak:5}};
 return g;
}
const noRng={chance(){throw Error('RNG consumed');}};
const yesRng={chance(){return true;}};
function military(seed){
 const g=game(seed);
 g.state.player.sex='male';
 g.state.militaryService={eligible:true,status:'pending',deferredUntilAge:null};
 return g;
}

test('retraining advances only once in a calendar year',()=>{
 const g=retraining('retraining-once');
 processRetrainingYear(g.state);
 assert.equal(g.state.retraining.yearsCompleted,1);
 const after=structuredClone(g.state);
 assert.deepEqual(processRetrainingYear(g.state),[]);
 assert.deepEqual(g.state,after);
});
test('retraining rejects past years without mutation',()=>{
 const g=retraining('retraining-past');g.state.retraining.lastProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processRetrainingYear(g.state),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('retraining save/restore, next year, and legacy markerless state',()=>{
 const g=retraining('retraining-save');processRetrainingYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processRetrainingYear(restored.state),[]);
 restored.state.year++;restored.state.player.age++;
 const entries=processRetrainingYear(restored.state);
 assert.equal(restored.state.retraining.yearsCompleted,2);
 assert.equal(restored.state.retraining.completed,true);
 assert.equal(entries.length,1);
 const legacy=retraining('retraining-legacy');
 assert.equal(legacy.state.retraining.lastProcessedYear,undefined);
 processRetrainingYear(legacy.state);
 assert.equal(legacy.state.retraining.lastProcessedYear,2075);
});
test('a newly started retraining spell can advance in the same year',()=>{
 const g=retraining('retraining-new-spell');processRetrainingYear(g.state);
 beginRetraining(g.state,'designer');
 processRetrainingYear(g.state);
 assert.equal(g.state.retraining.yearsCompleted,1);
 assert.equal(g.state.retraining.lastProcessedYear,2075);
});

test('military yearly eligibility does not change twice in one year',()=>{
 const g=military('military-once');
 processMilitaryYear(g.state);
 const after=structuredClone(g.state);
 g.state.higherEducation={enrolled:true};
 const before=structuredClone(g.state);
 assert.deepEqual(processMilitaryYear(g.state),[]);
 assert.deepEqual(g.state,before);
 assert.equal(g.state.militaryService.status,after.militaryService.status);
});
test('military processing rejects past year before eligibility mutation',()=>{
 const g=military('military-past');
 g.state.militaryService.lastProcessedYear=2076;
 g.state.higherEducation={enrolled:true};
 const before=structuredClone(g.state);
 assert.throws(()=>processMilitaryYear(g.state),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('military yearly marker survives save, next year, and legacy state',()=>{
 const g=military('military-save');processMilitaryYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processMilitaryYear(restored.state),[]);
 restored.state.year++;restored.state.player.age++;
 processMilitaryYear(restored.state);
 assert.equal(restored.state.militaryService.lastProcessedYear,2076);
 delete restored.state.militaryService.lastProcessedYear;
 processMilitaryYear(restored.state);
 assert.equal(restored.state.militaryService.lastProcessedYear,2076);
});
test('military career leave is restored once, not replayed',()=>{
 const g=military('military-leave');
 g.state.career={employed:true,monthlyIncome:95000,stability:60,serviceLeave:{startedAtAge:40,months:6,mode:'standard'}};
 g.state.player.monthlyIncome=0;
 const events=processMilitaryYear(g.state);
 assert.equal(events.length,1);
 assert.equal(g.state.player.monthlyIncome,95000);
 const after=structuredClone(g.state);
 assert.deepEqual(processMilitaryYear(g.state),[]);
 assert.deepEqual(g.state,after);
});

test('middle-age pressure, stress, and events only apply once per year',()=>{
 const g=middle('middle-once');
 ensureMiddleAgeState(g.state).burnoutPressure=69;
 const events=processMiddleAgeYear(g.state,yesRng);
 assert.ok(events.length>0);
 const after=structuredClone(g.state);
 assert.deepEqual(processMiddleAgeYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('middle-age past year is rejected before initialization or mutation',()=>{
 const g=middle('middle-past');
 g.state.middleAge={burnoutPressure:10,stagnationYears:0,carePressure:0,financialPressure:0,lastReflectionAge:null,transitions:[],lastProcessedYear:2076};
 const before=structuredClone(g.state);
 assert.throws(()=>processMiddleAgeYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('middle-age marker survives save and allows later years and legacy states',()=>{
 const g=middle('middle-save');processMiddleAgeYear(g.state,{chance:()=>false});
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processMiddleAgeYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processMiddleAgeYear(restored.state,{chance:()=>false});
 assert.equal(restored.state.middleAge.lastProcessedYear,2076);
 delete restored.state.middleAge.lastProcessedYear;
 processMiddleAgeYear(restored.state,{chance:()=>false});
 assert.equal(restored.state.middleAge.lastProcessedYear,2076);
});
test('middle-age processing is inert outside the age range',()=>{
 const g=middle('middle-inert');g.state.player.age=34;
 const before=structuredClone(g.state);
 assert.deepEqual(processMiddleAgeYear(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});
