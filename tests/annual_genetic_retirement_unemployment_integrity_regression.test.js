import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {serializeGame} from '../src/core/save_system.js';
import {processGeneticHealthYear} from '../src/health/genetic_system.js';
import {processRetirementYear} from '../src/career/retirement_system.js';
import {processUnemploymentYear} from '../src/career/unemployment_system.js';

const forbiddenRng={chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');},int(){throw Error('RNG consumed');}};
const manifestRng={chance(){return true;},fork(){return manifestRng;},int(){return 0;}};
function game(seed){const g=new Game(seed);g.state.year=2075;g.state.player.age=42;return g;}
function genetic(seed){
 const g=game(seed);
 g.state.player.health.genetics.monogenic.fmf={alleles:['V','V'],status:'affected'};
 g.state.healthProfile={conditions:[],stress:25,fitness:60};
 return g;
}
function retired(seed){
 const g=game(seed);
 g.state.retirement={retired:true,source:'career',retiredAtAge:60,years:2,pensionMonthly:20000};
 return g;
}
function unemployed(seed){
 const g=game(seed);
 g.state.nextPath='work';
 g.state.career={employed:false};
 g.state.unemployedSinceAge=39;
 g.state.healthProfile={conditions:[],stress:30,fitness:50};
 g.state.mentalHealth={strain:20};
 g.state.finance={cash:5000,debt:0,unemploymentYears:0};
 return g;
}

test('genetic manifestation does not re-roll in the same calendar year',()=>{
 const g=genetic('genetic-once');
 const events=processGeneticHealthYear(g.state,manifestRng);
 assert.equal(events.length,1);
 const after=structuredClone(g.state);
 assert.deepEqual(processGeneticHealthYear(g.state,forbiddenRng),[]);
 assert.deepEqual(g.state,after);
});
test('genetic processing rejects past year without creating a profile or rolling',()=>{
 const g=genetic('genetic-past');
 delete g.state.healthProfile;
 g.state.lastGeneticHealthProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processGeneticHealthYear(g.state,forbiddenRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('genetic annual marker survives saves and allows later years and legacy saves',()=>{
 const g=genetic('genetic-save');
 processGeneticHealthYear(g.state,manifestRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processGeneticHealthYear(restored.state,forbiddenRng),[]);
 restored.state.year++;restored.state.player.age++;
 processGeneticHealthYear(restored.state,manifestRng);
 assert.equal(restored.state.lastGeneticHealthProcessedYear,2076);
 delete restored.state.lastGeneticHealthProcessedYear;
 processGeneticHealthYear(restored.state,manifestRng);
 assert.equal(restored.state.lastGeneticHealthProcessedYear,2076);
});
test('genetic processing leaves deceased players and genomes without genetics untouched',()=>{
 const dead=genetic('genetic-dead');dead.state.player.alive=false;
 const deadBefore=structuredClone(dead.state);
 assert.deepEqual(processGeneticHealthYear(dead.state,forbiddenRng),[]);
 assert.deepEqual(dead.state,deadBefore);
 const missing=game('genetic-missing');delete missing.state.player.health.genetics;
 const before=structuredClone(missing.state);
 assert.deepEqual(processGeneticHealthYear(missing.state,forbiddenRng),[]);
 assert.deepEqual(missing.state,before);
});

test('retirement years only advance once per calendar year',()=>{
 const g=retired('retire-once');
 processRetirementYear(g.state);
 assert.equal(g.state.retirement.years,3);
 const after=structuredClone(g.state);
 assert.deepEqual(processRetirementYear(g.state),[]);
 assert.deepEqual(g.state,after);
});
test('retirement rejects past year without mutation',()=>{
 const g=retired('retire-past');g.state.retirement.lastProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processRetirementYear(g.state),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('retirement marker survives save and permits later year and legacy state',()=>{
 const g=retired('retire-save');processRetirementYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processRetirementYear(restored.state),[]);
 restored.state.year++;restored.state.player.age++;
 processRetirementYear(restored.state);
 assert.equal(restored.state.retirement.years,4);
 delete restored.state.retirement.lastProcessedYear;
 processRetirementYear(restored.state);
 assert.equal(restored.state.retirement.years,5);
});
test('non-retired player does not receive a retirement marker',()=>{
 const g=game('retire-noop');
 const before=structuredClone(g.state);
 assert.deepEqual(processRetirementYear(g.state),[]);
 assert.deepEqual(g.state,before);
});

test('unemployment replay does not duplicate stress, strain, finance or events',()=>{
 const g=unemployed('unemployed-once');
 processUnemploymentYear(g.state);
 assert.equal(g.state.finance.unemploymentYears,1);
 const after=structuredClone(g.state);
 assert.deepEqual(processUnemploymentYear(g.state),[]);
 assert.deepEqual(g.state,after);
});
test('unemployment past-year check is atomic even before normalization',()=>{
 const g=unemployed('unemployed-past');
 g.state.unemployment={startedAtAge:39,durationYears:2,lastProcessedYear:2076};
 const before=structuredClone(g.state);
 assert.throws(()=>processUnemploymentYear(g.state),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('unemployment save/restore, next year and legacy spell work',()=>{
 const g=unemployed('unemployed-save');processUnemploymentYear(g.state);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processUnemploymentYear(restored.state),[]);
 restored.state.year++;restored.state.player.age++;
 processUnemploymentYear(restored.state);
 assert.equal(restored.state.finance.unemploymentYears,2);
 delete restored.state.unemployment.lastProcessedYear;
 processUnemploymentYear(restored.state);
 assert.equal(restored.state.finance.unemploymentYears,3);
});
test('employment resets unemployment and a new spell can be processed in the same year',()=>{
 const g=unemployed('unemployed-new-spell');
 processUnemploymentYear(g.state);
 g.state.career.employed=true;
 processUnemploymentYear(g.state);
 assert.equal(g.state.unemployment,null);
 g.state.career.employed=false;
 processUnemploymentYear(g.state);
 assert.equal(g.state.finance.unemploymentYears,2);
});
test('unemployment path without a spell is inert',()=>{
 const g=game('unemployed-inert');
 g.state.nextPath='university';g.state.career={employed:false};g.state.unemployment=null;
 const before=structuredClone(g.state);
 assert.deepEqual(processUnemploymentYear(g.state),[]);
 assert.deepEqual(g.state,before);
});
