import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/core/rng.js';
import {Game} from '../src/core/game.js';
import {createSavePayload} from '../src/core/save_system.js';
import {createDecisionSnapshot,restoreDecisionSnapshot} from '../src/timeline/snapshot.js';

const STEP=0x6d2b79f5;
const MAX=Number.MAX_SAFE_INTEGER;

function checkpoint(seed='cycle68-snapshot'){
 const game=new Game(seed);
 return {game,snapshot:createDecisionSnapshot(game.state,{id:'example',title:'Example'},[],
  {seed:game.rng.seed,state:game.rng.state})};
}

function highSchool(){
 const game=new Game('cycle68-branch-counter');
 while(game.state.player.alive&&game.state.player.age<14){
  const event=game.ageOneYear();
  if(event){
   const choice=event.id==='high-school-path'
    ?game.eventChoices(event).find(c=>c.id==='academic')
    :game.eventChoices(event)[0];
   game.makeChoice(event,choice.id);
  }
 }
 const index=game.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 assert.ok(index>=0);
 return {game,index};
}

// Candidate 1: protect deterministic RNG draws at the safe-integer boundary.
test('RNG still increments exactly at the final safe counter',()=>{
 const rng=new RNG('cycle68-boundary');
 rng.state=MAX-STEP;
 rng.next();
 assert.equal(rng.state,MAX);
});
test('RNG rolls over without losing low-32-bit sequence on overflow',()=>{
 const rng=new RNG('cycle68-rollover');
 const low=new RNG('cycle68-rollover');
 rng.state=MAX-STEP+1;
 low.state=rng.state>>>0;
 assert.equal(rng.next(),low.next());
 assert.equal(rng.state,low.state>>>0);
 assert.ok(Number.isSafeInteger(rng.state));
});
test('RNG rollover preserves the next 12 draws and safe counters',()=>{
 const high=new RNG('cycle68-stream');
 const low=new RNG('cycle68-stream');
 high.state=MAX-2;
 low.state=high.state>>>0;
 for(let i=0;i<12;i++){
  assert.equal(high.next(),low.next());
  assert.ok(Number.isSafeInteger(high.state));
 }
});
test('RNG rejects invalid mutable counters before consuming randomness',()=>{
 const rng=new RNG('cycle68-corruption');
 for(const invalid of [-1,1.5,NaN,Infinity,MAX+1]){
  rng.state=invalid;
  assert.throws(()=>rng.next(),/Invalid RNG counter/);
  assert.ok(Object.is(rng.state,invalid));
 }
});
test('saved and snapshotted near-overflow RNGs continue identically',()=>{
 const game=new Game('cycle68-resume-overflow');
 game.rng.state=MAX-1;
 const saved=Game.fromSave(createSavePayload(game));
 const snap=createDecisionSnapshot(game.state,{id:'example',title:'Example'},[],
  {seed:game.rng.seed,state:game.rng.state});
 const branched=Game.fromDecisionSnapshot(game.seedText,snap);
 for(let i=0;i<8;i++){
  const draw=game.rng.next();
  assert.equal(saved.rng.next(),draw);
  assert.equal(branched.rng.next(),draw);
 }
 assert.equal(saved.rng.state,game.rng.state);
 assert.equal(branched.rng.state,game.rng.state);
});

// Candidate 2: malformed checkpoint metadata must not be silently repaired.
test('snapshot restore rejects missing or invalid player and calendar',()=>{
 for(const edit of [
  snap=>{delete snap.state.player;},
  snap=>{snap.state.player.age=-1;},
  snap=>{snap.state.year=NaN;},
  snap=>{snap.state.year='2026';}
 ]){
  const {snapshot}=checkpoint();
  edit(snapshot);
  assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
 }
});
test('snapshot restore rejects inconsistent checkpoint age and year',()=>{
 for(const field of ['age','year']){
  const {snapshot}=checkpoint();
  snapshot[field]++;
  assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
  snapshot[field]=null;
  assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
 }
});
test('snapshot restore rejects malformed prior nodes before cloning',()=>{
 for(const priorNodes of [null,{},[null],[5],[{id:'ok'},'bad']]){
  const {snapshot}=checkpoint();
  snapshot.priorNodes=priorNodes;
  assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
 }
});
test('snapshot restore rejects malformed embedded life tree and history',()=>{
 for(const edit of [
  snap=>{snap.state.lifeTree.nodes={};},
  snap=>{snap.state.lifeTree.nodes=null;},
  snap=>{snap.state.lifeTree.branches='broken';},
  snap=>{snap.state.lifeTree=[];},
  snap=>{snap.state.lifeTree=null;},
  snap=>{snap.state.history={};},
  snap=>{snap.state.history=null;}
 ]){
  const {snapshot}=checkpoint();
  edit(snapshot);
  assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
 }
});
test('valid checkpoint and legacy optional metadata still restore',()=>{
 const {game,snapshot}=checkpoint();
 const restored=Game.fromDecisionSnapshot(game.seedText,snapshot);
 assert.equal(restored.state.year,game.state.year);
 assert.equal(restored.state.player.age,game.state.player.age);
 const old=structuredClone(snapshot);
 delete old.age;
 delete old.year;
 delete old.priorNodes;
 assert.equal(Game.fromDecisionSnapshot(game.seedText,old).state.player.age,game.state.player.age);
});

// Candidate 3: branch ID allocation must be bounded and collision-free.
test('invalid branch counters do not change lived state',()=>{
 const {game,index}=highSchool();
 for(const counter of [-1,0,1.5,NaN,Infinity,'2',MAX]){
  game.state.lifeTree.nextBranchId=counter;
  const before=structuredClone(game.state);
  assert.throws(()=>game.branchFromNode(index,'vocational'),/Invalid Life Tree branch counter/);
  assert.deepEqual(game.state,before);
 }
});
test('branch allocation rejects a pre-existing branch ID collision',()=>{
 const {game,index}=highSchool();
 game.state.lifeTree.branches.push({id:'branch-1'});
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'vocational'),/branch ID collision/);
 assert.deepEqual(game.state,before);
});
test('branch allocation rejects malformed branch history',()=>{
 const {game,index}=highSchool();
 game.state.lifeTree.branches={};
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'vocational'),/Invalid Life Tree branches/);
 assert.deepEqual(game.state,before);
});
test('largest incrementable branch ID is committed once',()=>{
 const {game,index}=highSchool();
 game.state.lifeTree.nextBranchId=MAX-1;
 const branch=game.branchFromNode(index,'vocational');
 assert.equal(branch.state.lifeTree.currentBranchId,'branch-'+(MAX-1));
 assert.equal(game.state.lifeTree.nextBranchId,MAX);
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'vocational'),/Invalid Life Tree branch counter/);
 assert.deepEqual(game.state,before);
});
