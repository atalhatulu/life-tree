import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {serializeGame} from '../src/core/save_system.js';
import {processElderFamilyYear,evaluateParentCareNeed,setParentCareMode} from '../src/family/elder_system.js';
import {processNarrativeEchoesYear} from '../src/life/narrative_echo_system.js';
import {generateNpcInitiatives,resolveNpcInitiative} from '../src/life/npc_initiative_system.js';

const noRng={fork(){throw Error('RNG consumed on replay');},chance(){throw Error('RNG consumed on replay');},weighted(){throw Error('RNG consumed on replay');}};
const elderRng={fork(){return {int(){return -2;},chance(){return false;}};}};
const alwaysYes={fork(){return this;},chance(){return true;},weighted(items){return items[0].value;}};
const alwaysNo={fork(){return this;},chance(){return false;},weighted(items){return items[0].value;}};
function adult(seed){const g=new Game(seed);g.state.year=2075;g.state.player.age=45;return g;}
function echo(seed){
 const g=adult(seed);g.state.lifeMemory={memories:[{id:'old',label:'Önemli anı',age:30,valence:1,intensity:8}],resilience:50,scarLoad:0};
 g.state.lifeTree.nodes=[];g.state.healthProfile={stress:40};g.state.narrativeEcho={lastAge:20,total:0};return g;
}
function npc(seed){
 const g=adult(seed);g.state.social.romance=null;g.state.children=[];
 g.state.social.friends=[{id:'friend-1',name:'Deniz',age:45,alive:true,closeFriend:true,needsSupport:true,
  personality:{ambition:35,sociability:75,patience:50},life:{personalStress:85,workStability:25},relationship:65,trust:60,reciprocity:50}];
 return g;
}

test('elder health and mortality rolls occur at most once per calendar year',()=>{
 const g=adult('elder-once');const mother=g.state.parents.mother;mother.age=75;mother.health.current=80;
 processElderFamilyYear(g.state,elderRng);
 assert.equal(g.state.lastElderFamilyProcessedYear,2075);
 const after=structuredClone(g.state);
 assert.deepEqual(processElderFamilyYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('elder parent care stress cannot be applied twice in a year',()=>{
 const g=adult('elder-care-once');g.state.healthProfile={stress:20};g.state.parents.mother.age=80;g.state.parents.mother.health.current=30;
 evaluateParentCareNeed(g.state);setParentCareMode(g.state,'family');
 const before=g.state.healthProfile.stress;
 processElderFamilyYear(g.state,elderRng);
 assert.equal(g.state.healthProfile.stress,before+2);
 assert.deepEqual(processElderFamilyYear(g.state,noRng),[]);
 assert.equal(g.state.healthProfile.stress,before+2);
});
test('elder earlier-year rejection is atomic even without parent-care state',()=>{
 const g=adult('elder-past');g.state.lastElderFamilyProcessedYear=2076;delete g.state.parentCare;
 const before=structuredClone(g.state);
 assert.throws(()=>processElderFamilyYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('elder save/restore, next year, and legacy marker compatibility',()=>{
 const g=adult('elder-save');processElderFamilyYear(g.state,elderRng);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processElderFamilyYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 processElderFamilyYear(restored.state,elderRng);
 assert.equal(restored.state.lastElderFamilyProcessedYear,2076);
 delete restored.state.lastElderFamilyProcessedYear;
 processElderFamilyYear(restored.state,elderRng);
 assert.equal(restored.state.lastElderFamilyProcessedYear,2076);
});
test('elder death and inheritance cannot be re-rolled in same year',()=>{
 const g=adult('elder-death-once');g.state.parents.mother.monthlyIncome=1000;
 const rng={fork(label){return {int(){return 10;},chance(){return label==='death-mother';}};}};
 processElderFamilyYear(g.state,rng);
 assert.equal(g.state.parents.mother.alive,false);
 const inheritance=structuredClone(g.state.pendingInheritance);
 assert.deepEqual(processElderFamilyYear(g.state,noRng),[]);
 assert.deepEqual(g.state.pendingInheritance,inheritance);
});

test('narrative failed roll is not retried in the same calendar year',()=>{
 const g=echo('echo-failed');assert.deepEqual(processNarrativeEchoesYear(g.state,alwaysNo),[]);
 assert.equal(g.state.lastNarrativeEchoProcessedYear,2075);
 const after=structuredClone(g.state);
 assert.deepEqual(processNarrativeEchoesYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('narrative echo does not duplicate stress, resilience, or counters',()=>{
 const g=echo('echo-once');assert.equal(processNarrativeEchoesYear(g.state,alwaysYes).length,1);
 assert.equal(g.state.lifeMemory.resilience,51);
 const after=structuredClone(g.state);
 assert.deepEqual(processNarrativeEchoesYear(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('narrative save/restore, later year and legacy saves work',()=>{
 const g=echo('echo-save');processNarrativeEchoesYear(g.state,alwaysYes);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processNarrativeEchoesYear(restored.state,noRng),[]);
 restored.state.year+=2;restored.state.player.age+=2;
 assert.equal(processNarrativeEchoesYear(restored.state,alwaysYes).length,1);
 assert.equal(restored.state.narrativeEcho.total,2);
 delete restored.state.lastNarrativeEchoProcessedYear;
 restored.state.year++;restored.state.player.age++;
 assert.deepEqual(processNarrativeEchoesYear(restored.state,alwaysNo),[]);
 assert.equal(restored.state.lastNarrativeEchoProcessedYear,2078);
});
test('narrative earlier year is rejected before state changes or RNG',()=>{
 const g=echo('echo-past');g.state.lastNarrativeEchoProcessedYear=2076;delete g.state.narrativeEcho;
 const before=structuredClone(g.state);
 assert.throws(()=>processNarrativeEchoesYear(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('narrative echoes cannot affect a deceased player',()=>{
 const g=echo('echo-dead');g.state.player.alive=false;
 const before=structuredClone(g.state);
 assert.deepEqual(processNarrativeEchoesYear(g.state,noRng),[]);
 assert.deepEqual(g.state,before);
});

test('NPC initiative failed generation roll cannot be retried same year',()=>{
 const g=npc('npc-failed');assert.deepEqual(generateNpcInitiatives(g.state,alwaysNo),[]);
 assert.equal(g.state.npcInitiatives.lastGeneratedYear,2075);
 const after=structuredClone(g.state);
 assert.deepEqual(generateNpcInitiatives(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('resolving a generated NPC request cannot create another in the same year',()=>{
 const g=npc('npc-resolve');assert.equal(generateNpcInitiatives(g.state,alwaysYes).length,1);
 assert.equal(g.state.npcInitiatives.pending[0].type,'friend-support-request');
 resolveNpcInitiative(g.state,'friend-support-request','reject');
 const after=structuredClone(g.state);
 assert.deepEqual(generateNpcInitiatives(g.state,noRng),[]);
 assert.deepEqual(g.state,after);
});
test('NPC initiative past year rejects before initializing store or actor goals',()=>{
 const g=npc('npc-past');g.state.npcInitiatives={lastGeneratedYear:2076};
 const before=structuredClone(g.state);
 assert.throws(()=>generateNpcInitiatives(g.state,noRng),/earlier year/);
 assert.deepEqual(g.state,before);
});
test('NPC initiative marker survives save, next year rerolls, legacy saves work',()=>{
 const g=npc('npc-save');generateNpcInitiatives(g.state,alwaysNo);
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(generateNpcInitiatives(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 assert.equal(generateNpcInitiatives(restored.state,alwaysYes).length,1);
 assert.equal(restored.state.npcInitiatives.lastGeneratedYear,2076);
 const old=npc('npc-legacy');old.state.npcInitiatives={pending:[],history:[],nextId:1};
 assert.equal(generateNpcInitiatives(old.state,alwaysYes).length,1);
 assert.equal(old.state.npcInitiatives.lastGeneratedYear,2075);
});
test('pending NPC requests block new annual generation but still mark that year',()=>{
 const g=npc('npc-pending');g.state.npcInitiatives={pending:[{id:'npc-1',type:'friend-support-request',actorId:'friend-1',actorName:'Deniz',status:'pending',expiresAtAge:46}],history:[],nextId:2};
 assert.deepEqual(generateNpcInitiatives(g.state,noRng),[]);
 assert.equal(g.state.npcInitiatives.lastGeneratedYear,2075);
 assert.equal(g.state.npcInitiatives.pending.length,1);
 assert.deepEqual(generateNpcInitiatives(g.state,noRng),[]);
});
