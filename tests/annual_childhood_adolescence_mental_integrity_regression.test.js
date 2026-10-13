import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processChildhoodYear} from '../src/life/childhood_simulation.js';
import {processAdolescenceYear} from '../src/life/adolescence_simulation.js';
import {processMentalHealthYear,ensureMentalHealth} from '../src/health/mental_health_system.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
function state(seed,age){const s=new Game(seed).state;s.year=2075;s.player.age=age;return s;}

// Childhood changes personality, health and school outcomes independently of allowance processing.
test('childhood annual effects are replay-safe without RNG consumption',()=>{
 const s=state('childhood-replay',5);
 processChildhoodYear(s,new RNG('first'));
 const after=structuredClone(s);
 assert.deepEqual(processChildhoodYear(s,noRng),[]);
 assert.deepEqual(s,after);
});
test('childhood rejects a past year without mutation',()=>{
 const s=state('childhood-past',8);processChildhoodYear(s,new RNG('first'));s.year--;
 const before=structuredClone(s);
 assert.throws(()=>processChildhoodYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('childhood year marker survives save, advances, and legacy records still process',()=>{
 const g=new Game('childhood-save');g.state.year=2075;g.state.player.age=8;
 processChildhoodYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processChildhoodYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processChildhoodYear(restored.state,new RNG('next'));
 assert.equal(restored.state.lastChildhoodProcessedYear,2076);
 delete restored.state.lastChildhoodProcessedYear;
 processChildhoodYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.lastChildhoodProcessedYear,2076);
});
test('childhood processing remains inactive after age 18',()=>{
 const s=state('childhood-adult',20),before=structuredClone(s);
 assert.deepEqual(processChildhoodYear(s,noRng),[]);
 assert.deepEqual(s,before);
});

test('adolescence annual changes cannot repeat in one year',()=>{
 const s=state('adolescence-replay',15);
 processAdolescenceYear(s,new RNG('first'));
 const after=structuredClone(s);
 assert.deepEqual(processAdolescenceYear(s,noRng),[]);
 assert.deepEqual(s,after);
});
test('adolescence rejects past year atomically',()=>{
 const s=state('adolescence-past',15);processAdolescenceYear(s,new RNG('first'));s.year--;
 const before=structuredClone(s);
 assert.throws(()=>processAdolescenceYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('adolescence save, next year, and old saves without markers',()=>{
 const g=new Game('adolescence-save');g.state.year=2075;g.state.player.age=14;
 processAdolescenceYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processAdolescenceYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processAdolescenceYear(restored.state,new RNG('next'));
 assert.equal(restored.state.lastAdolescenceProcessedYear,2076);
 delete restored.state.lastAdolescenceProcessedYear;
 processAdolescenceYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.lastAdolescenceProcessedYear,2076);
});
test('adolescence processing remains inactive outside age range',()=>{
 for(const age of [8,19]){
  const s=state('adolescence-outside-'+age,age),before=structuredClone(s);
  assert.deepEqual(processAdolescenceYear(s,noRng),[]);
  assert.deepEqual(s,before);
 }
});

test('mental health cannot accumulate duplicate grief, strain or recovery in same year',()=>{
 const s=state('mental-replay',42);
 s.healthProfile={stress:70,fitness:40,conditions:[]};
 s.parents.mother.deathYear=s.year;
 const first=processMentalHealthYear(s,new RNG('first'));
 assert.ok(first.some(e=>e.kind==='mental-health'));
 const after=structuredClone(s);
 assert.deepEqual(processMentalHealthYear(s,noRng),[]);
 assert.deepEqual(s,after);
});
test('mental health rejects past years without initializing a missing profile',()=>{
 const s=state('mental-past',40);
 s.lastMentalHealthProcessedYear=2076;
 delete s.mentalHealth;
 const before=structuredClone(s);
 assert.throws(()=>processMentalHealthYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('mental health marker survives save and legacy records remain processable',()=>{
 const g=new Game('mental-save');g.state.year=2075;g.state.player.age=40;
 g.state.healthProfile={stress:40,fitness:55,conditions:[]};
 processMentalHealthYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processMentalHealthYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processMentalHealthYear(restored.state,new RNG('next'));
 assert.equal(restored.state.lastMentalHealthProcessedYear,2076);
 delete restored.state.lastMentalHealthProcessedYear;
 processMentalHealthYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.lastMentalHealthProcessedYear,2076);
});
test('deceased friends and partners do not provide mental health support or conflict',()=>{
 const base=state('mental-survivors',40);
 base.healthProfile={stress:65,fitness:50,conditions:[]};
 base.social={friends:[],romance:null};
 const dead=structuredClone(base);
 dead.social.friends=[{id:'lost',alive:false,relationship:90}];
 dead.social.romance={alive:false,relationshipState:'conflict'};
 const a=processMentalHealthYear(base,new RNG('same'));
 const b=processMentalHealthYear(dead,new RNG('same'));
 assert.deepEqual(a,b);
 assert.deepEqual(ensureMentalHealth(base),ensureMentalHealth(dead));
 assert.equal(base.healthProfile.stress,dead.healthProfile.stress);
});

test('deceased friends cannot influence adolescent peer pressure',()=>{
 const a=state('adolescent-dead-friend',15);
 a.social.friends=[];
 const b=structuredClone(a);
 b.social.friends=[{id:'deceased',alive:false,relationship:100}];
 processAdolescenceYear(a,new RNG('same-peers'));
 processAdolescenceYear(b,new RNG('same-peers'));
 assert.deepEqual(a.player.personality,b.player.personality);
 assert.deepEqual(a.education,b.education);
});
