import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processHealthYear} from '../src/health/health_system.js';
import {processDiseaseProgressionYear} from '../src/health/disease_progression.js';
import {processBusinessYear} from '../src/career/entrepreneurship_system.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const safeRng={int(){return 0;},chance(){return false;},fork(){return safeRng;}};
function adult(seed){const g=new Game(seed);g.state.year=2075;g.state.player.age=45;return g;}
function ill(seed){
 const g=adult(seed);
 g.state.healthProfile={conditions:[{id:'metabolic',label:'Metabolik sorun',severity:2,diagnosedAtAge:39}],stress:35,fitness:60};
 return g;
}
function business(seed){
 const g=adult(seed);
 g.state.finance={cash:500000,debt:0};
 g.state.healthProfile={conditions:[],stress:25,fitness:60};
 g.state.business={active:true,mode:'side',years:0,health:65,capital:400000,monthlyProfit:0,employees:0};
 return g;
}

test('health year replay does not age reserves, accumulate exposure or consume RNG',()=>{
 const g=adult('health-replay');
 processHealthYear(g.state,safeRng);
 const after=structuredClone(g.state);
 assert.deepEqual(processHealthYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('health rejects earlier year without creating a profile or consuming RNG',()=>{
 const g=adult('health-past');
 g.state.healthProfile={conditions:[],stress:25,fitness:50,lastHealthProcessedYear:2076};
 const before=structuredClone(g.state);
 assert.throws(()=>processHealthYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('health year survives save/restore and permits next year and old saves',()=>{
 const g=adult('health-save');
 processHealthYear(g.state,safeRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processHealthYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processHealthYear(restored.state,safeRng);
 assert.equal(restored.state.healthProfile.lastHealthProcessedYear,2076);
 delete restored.state.healthProfile.lastHealthProcessedYear;
 processHealthYear(restored.state,safeRng);
 assert.equal(restored.state.healthProfile.lastHealthProcessedYear,2076);
});
test('dead players are not exposed to another annual health roll',()=>{
 const g=adult('health-dead');g.state.player.alive=false;
 const before=structuredClone(g.state);
 assert.deepEqual(processHealthYear(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});

test('disease progression replay is inert, including complications',()=>{
 const g=ill('disease-replay');
 const dangerous={int(){return 4;},chance(){return true;}};
 processDiseaseProgressionYear(g.state,dangerous);
 const after=structuredClone(g.state);
 assert.deepEqual(processDiseaseProgressionYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('disease progression rejects an earlier year before mutating any condition',()=>{
 const g=ill('disease-past');
 g.state.healthProfile.conditions.push({id:'cardiac',label:'Kalp-damar',severity:3,diagnosedAtAge:40,lastProgressionProcessedYear:2076});
 const before=structuredClone(g.state);
 assert.throws(()=>processDiseaseProgressionYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('disease progression can process a newly diagnosed condition in the same year',()=>{
 const g=ill('disease-new');
 processDiseaseProgressionYear(g.state,safeRng);
 const first=g.state.healthProfile.conditions[0];
 g.state.healthProfile.conditions.push({id:'cardiac',label:'Kalp-damar',severity:3,diagnosedAtAge:45});
 const entries=processDiseaseProgressionYear(g.state,safeRng);
 assert.deepEqual(entries,[]);
 assert.equal(first.lastProgressionProcessedYear,2075);
 assert.equal(g.state.healthProfile.conditions[1].lastProgressionProcessedYear,2075);
 assert.deepEqual(processDiseaseProgressionYear(g.state,noRng),[]);
});
test('disease progression marker persists across save/restore, advances next year and accepts legacy',()=>{
 const g=ill('disease-save');
 processDiseaseProgressionYear(g.state,safeRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processDiseaseProgressionYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processDiseaseProgressionYear(restored.state,safeRng);
 const condition=restored.state.healthProfile.conditions[0];
 assert.equal(condition.lastProgressionProcessedYear,2076);
 delete condition.lastProgressionProcessedYear;
 processDiseaseProgressionYear(restored.state,safeRng);
 assert.equal(condition.lastProgressionProcessedYear,2076);
});

test('business replay cannot duplicate revenue, debt, years or RNG consumption',()=>{
 const g=business('business-replay');
 processBusinessYear(g.state,safeRng);
 const after=structuredClone(g.state);
 assert.deepEqual(processBusinessYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('business rejects earlier year without changing finances',()=>{
 const g=business('business-past');g.state.business.lastProcessedYear=2076;
 const before=structuredClone(g.state);
 assert.throws(()=>processBusinessYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('business saves annual marker and processes next year and legacy records',()=>{
 const g=business('business-save');
 processBusinessYear(g.state,safeRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processBusinessYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processBusinessYear(restored.state,safeRng);
 assert.equal(restored.state.business.years,2);
 assert.equal(restored.state.business.lastProcessedYear,2076);
 delete restored.state.business.lastProcessedYear;
 processBusinessYear(restored.state,safeRng);
 assert.equal(restored.state.business.lastProcessedYear,2076);
});
test('business closure cannot be replayed after company becomes inactive',()=>{
 const g=business('business-closure');
 g.state.business.health=5;
 const closeRng={int(){return 0;},chance(){return true;}};
 const events=processBusinessYear(g.state,closeRng);
 assert.equal(events.length,1);
 assert.equal(g.state.business.active,false);
 const after=structuredClone(g.state);
 assert.deepEqual(processBusinessYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('inactive business is not marked as processed',()=>{
 const g=business('business-inactive');g.state.business.active=false;
 const before=structuredClone(g.state);
 assert.deepEqual(processBusinessYear(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});
