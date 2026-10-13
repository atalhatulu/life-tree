import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave,validateSavePayload} from '../src/core/save_system.js';

function fixture(){return createSavePayload(new Game('cycle66-save-integrity'));}
function invalid(mutate,match=/Invalid save/){
 const payload=fixture();
 mutate(payload);
 const original=structuredClone(payload);
 assert.throws(()=>parseSave(payload),match);
 assert.deepEqual(payload,original,'failed parse must not mutate input');
 assert.throws(()=>parseSave(JSON.stringify(payload)),match);
}

// Candidate 1: RNG integrity (never coerce broken snapshots with >>>0).
for(const [name,value] of [['negative',-1],['fraction',1.5],['string','12'],['unsafe',Number.MAX_SAFE_INTEGER+1],['non-finite',Infinity],['null',null]]){
 test(`reject malformed RNG state: ${name}`,()=>invalid(p=>{p.rng.state=value;}));
}
test('reject out-of-range RNG seed and array RNG snapshot',()=>{
 invalid(p=>{p.rng.seed=0x100000000;});
 invalid(p=>{p.rng=[];});
});
test('accept legitimate unsigned RNG and advanced positive integer RNG state',()=>{
 const p=fixture();p.rng.seed=0xffffffff;p.rng.state=0x100000000+42;
 const restored=Game.fromSave(p);
 assert.equal(restored.rng.seed,0xffffffff);
 assert.equal(restored.rng.state,0x100000000+42);
});

// Candidate 2: calendar/age integrity, including optional metadata in v1/v2.
for(const [name,value] of [['negative',-1],['fraction',2026.5],['string','2026'],['unsafe',Number.MAX_SAFE_INTEGER+1],['non-finite',Infinity]]){
 test(`reject invalid state calendar year: ${name}`,()=>invalid(p=>{p.state.year=value;}));
}
test('reject malformed player ages before restoring',()=>{
 for(const age of [-1,2.5,'22',NaN,Number.MAX_SAFE_INTEGER+1])invalid(p=>{p.state.player.age=age;});
});
test('reject inconsistent saved-at year/age and malformed metadata',()=>{
 invalid(p=>{p.savedAtYear+=1;});
 invalid(p=>{p.savedAtAge+=1;});
 invalid(p=>{p.savedAtYear='2026';});
 invalid(p=>{p.savedAtAge=-1;});
});
test('allow missing optional saved-at metadata in older saves',()=>{
 const p=fixture();p.version=1;delete p.savedAtYear;delete p.savedAtAge;
 const parsed=parseSave(p);
 assert.equal(parsed.version,2);
 assert.equal(parsed.state.year,2026);
});

// Candidate 3: reject malformed nested collections and event IDs before migration.
for(const [label,mutate] of [
 ['history',p=>{p.state.history={};}],
 ['life tree nodes',p=>{p.state.lifeTree.nodes='broken';}],
 ['life tree branches',p=>{p.state.lifeTree.branches={};}],
 ['completed events',p=>{p.state.flags.completedEvents='broken';}],
 ['friends',p=>{p.state.social.friends={};}],
 ['children',p=>{p.state.children={};}],
 ['life goals',p=>{p.state.lifeGoals.completed={};}],
 ['NPC initiatives',p=>{p.state.npcInitiatives.pending='broken';}],
 ['player object',p=>{p.state.player=[];}],
 ['state object',p=>{p.state=[];}],
 ['active event ID',p=>{p.activeEventId=42;}],
 ['empty active event ID',p=>{p.activeEventId='';}]
]){
 test(`reject malformed save structure: ${label}`,()=>invalid(mutate));
}
test('validateSavePayload reports invalid RNG, calendar, and structure directly',()=>{
 const p=fixture();p.rng.state=-5;p.state.year=-1;p.state.lifeTree.nodes={};
 const errors=validateSavePayload(p);
 assert.ok(errors.some(e=>e.includes('rng')));
 assert.ok(errors.some(e=>e.includes('year')));
 assert.ok(errors.some(e=>e.includes('life tree')));
});
test('valid pending decision survives save/load and v1 migration',()=>{
 const game=new Game('cycle66-pending');
 let event;
 while(game.state.player.age<8&&!event)event=game.ageOneYear();
 assert.ok(event);
 const p=createSavePayload(game);
 const restored=Game.fromSave(p);
 assert.equal(restored.pendingEvent()?.id,event.id);
 p.version=1;delete p.state.lifeTree.branches;
 assert.equal(Game.fromSave(p).pendingEvent()?.id,event.id);
});
