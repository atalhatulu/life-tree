import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {createSavePayload,serializeGame} from '../src/core/save_system.js';
import {createDecisionSnapshot,snapshotRng} from '../src/timeline/snapshot.js';

const HIGH=0x100000000+98765;

function schoolDecision(){
 const game=new Game('cycle67-branch-preflight');
 while(game.state.player.age<14&&game.state.player.alive){
  const event=game.ageOneYear();
  if(!event)continue;
  const choices=game.eventChoices(event);
  const chosen=event.id==='high-school-path'
   ?choices.find(c=>c.id==='academic')
   :(choices.find(c=>c.id==='embrace')??choices[0]);
  game.makeChoice(event,chosen.id);
 }
 const index=game.state.lifeTree.nodes.findIndex(n=>n.eventId==='high-school-path');
 assert.ok(index>=0);
 assert.ok(game.state.lifeTree.nodes[index].snapshot);
 return {game,index};
}

// Candidate 1: lossless save/restore of a valid counter above 2^32.
test('save payload restores the complete RNG counter above 32 bits',()=>{
 const game=new Game('cycle67-save-high');
 game.rng.state=HIGH;
 const restored=Game.fromSave(createSavePayload(game));
 assert.equal(restored.rng.state,HIGH);
 assert.equal(restored.rng.seed,game.rng.seed);
});
test('JSON save restores high RNG counter and subsequent draws exactly',()=>{
 const game=new Game('cycle67-save-json');
 game.rng.state=HIGH;
 const restored=Game.fromSave(serializeGame(game));
 assert.equal(restored.rng.state,HIGH);
 for(let i=0;i<10;i++)assert.equal(restored.rng.next(),game.rng.next());
 assert.equal(restored.rng.state,game.rng.state);
});
test('32-bit RNG save counters remain backward compatible',()=>{
 const game=new Game('cycle67-save-legacy');
 game.rng.state=12345;
 assert.equal(Game.fromSave(createSavePayload(game)).rng.state,12345);
});

// Candidate 2: a branch checkpoint must not silently truncate the RNG counter.
test('decision snapshot records and returns high RNG counters without truncation',()=>{
 const game=new Game('cycle67-snapshot-high');
 const snap=createDecisionSnapshot(game.state,{id:'test',title:'Test'},[{id:'yes',label:'Yes'}],
  {seed:game.rng.seed,state:HIGH});
 assert.equal(snap.rng.state,HIGH);
 assert.equal(snapshotRng(snap).state,HIGH);
});
test('decision snapshot restore retains high RNG counter and draw stream',()=>{
 const game=new Game('cycle67-snapshot-restore');
 const snap=createDecisionSnapshot(game.state,{id:'test',title:'Test'},[],
  {seed:game.rng.seed,state:HIGH});
 const restored=Game.fromDecisionSnapshot(game.seedText,structuredClone(snap));
 assert.equal(restored.rng.state,HIGH);
 const expected=new RNG('cycle67-snapshot-restore');
 expected.state=HIGH;
 for(let i=0;i<10;i++)assert.equal(restored.rng.next(),expected.next());
 assert.equal(restored.rng.state,expected.state);
});
test('malformed snapshot RNG counters are rejected rather than coerced',()=>{
 const game=new Game('cycle67-snapshot-invalid');
 for(const value of [-1,1.25,'123',NaN,Number.MAX_SAFE_INTEGER+1]){
  const snap=createDecisionSnapshot(game.state,{id:'test',title:'Test'},[],null);
  snap.rng={seed:game.rng.seed,state:value};
  assert.throws(()=>Game.fromDecisionSnapshot(game.seedText,snap),/Invalid decision RNG snapshot/);
 }
});
test('snapshot creation rejects invalid RNG seed before persisting',()=>{
 const game=new Game('cycle67-snapshot-bad-seed');
 assert.throws(()=>createDecisionSnapshot(game.state,{id:'test',title:'Test'},[],
  {seed:0x100000000,state:HIGH}),/Invalid decision RNG snapshot/);
});
test('legacy low-32-bit snapshot RNG remains supported',()=>{
 const game=new Game('cycle67-snapshot-legacy');
 const snap=createDecisionSnapshot(game.state,{id:'test',title:'Test'},[],
  {seed:game.rng.seed,state:31415});
 assert.equal(Game.fromDecisionSnapshot(game.seedText,snap).rng.state,31415);
});

// Candidate 3: invalid branch requests cannot alter the lived tree.
test('unknown alternate does not consume branch ID or mutate lived state',()=>{
 const {game,index}=schoolDecision();
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'nonexistent-choice'),/Unknown or unavailable choice/);
 assert.deepEqual(game.state,before);
});
test('lived choice cannot consume branch ID',()=>{
 const {game,index}=schoolDecision();
 const before=structuredClone(game.state);
 assert.throws(()=>game.branchFromNode(index,'academic'),/must differ/);
 assert.deepEqual(game.state,before);
});
test('successful alternate consumes exactly one branch ID and leaves lived choice intact',()=>{
 const {game,index}=schoolDecision();
 const original=structuredClone(game.state);
 const next=game.state.lifeTree.nextBranchId??1;
 const branch=game.branchFromNode(index,'vocational');
 assert.equal(game.state.lifeTree.nextBranchId,next+1);
 assert.equal(branch.state.lifeTree.currentBranchId,'branch-'+next);
 assert.equal(branch.state.education.path,'vocational');
 assert.equal(game.state.lifeTree.nodes[index].choiceId,'academic');
 const expected={...original,lifeTree:{...original.lifeTree,nextBranchId:next+1}};
 assert.deepEqual(game.state,expected);
});
