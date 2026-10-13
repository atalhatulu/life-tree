import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {snapshotObjectGraph,captureRngCheckpoint} from '../src/core/transaction_snapshot.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {createSavePayload} from '../src/core/save_system.js';
import {validateState} from '../src/simulation/invariants.js';

test('built-in RNG checkpoint restores both seed and draw position',()=>{
 const rng=new RNG('cycle99-rng');
 const original={seed:rng.seed,state:rng.state};
 const restore=captureRngCheckpoint(rng);
 rng.seed=42;rng.state=123;
 restore();
 assert.deepEqual({seed:rng.seed,state:rng.state},original);
});

test('failed game year restores mutated built-in RNG seed as well as state',()=>{
 const game=new Game('cycle99-game-rng');
 const seed=game.rng.seed,state=game.rng.state;
 const original=structuredClone(game.state);
 game.events.choose=()=>{
  game.rng.seed=123456;
  game.rng.state=789;
  throw new Error('injected event failure');
 };
 assert.throws(()=>game.ageOneYear(),/injected event failure/);
 assert.equal(game.rng.seed,seed);
 assert.equal(game.rng.state,state);
 assert.deepEqual(game.state,original);
});

test('graph restore retains own __proto__ data keys without changing prototypes',()=>{
 const nested=JSON.parse('{"__proto__":{"note":"original"},"name":"keep"}');
 const root={nested};
 const oldPrototype=Object.getPrototypeOf(nested);
 const oldValue=Object.getOwnPropertyDescriptor(nested,'__proto__').value;
 const restore=snapshotObjectGraph([root]);
 delete nested.__proto__;
 oldValue.note='changed';
 nested.name='changed';
 restore();
 assert.equal(Object.getPrototypeOf(nested),oldPrototype);
 assert.equal(Object.hasOwn(nested,'__proto__'),true);
 assert.equal(Object.getOwnPropertyDescriptor(nested,'__proto__').value,oldValue);
 assert.equal(oldValue.note,'original');
 assert.equal(nested.name,'keep');
});

test('graph snapshot handles large alias fanout, cycles and sparse arrays',()=>{
 const leaf={counter:1};
 const refs=Array(40000).fill(leaf);
 refs.length=40002;
 refs[40001]='end';
 const root={refs,leaf};leaf.parent=root;
 const restore=snapshotObjectGraph([root]);
 leaf.counter=3;delete leaf.parent;
 refs[40000]='filled';refs.push('new');delete refs[40001];
 restore();
 assert.equal(leaf.counter,1);
 assert.equal(leaf.parent,root);
 assert.equal(root.refs,refs);
 assert.equal(refs.length,40002);
 assert.equal(40000 in refs,false);
 assert.equal(refs[40001],'end');
 assert.equal(refs[0],leaf);
});

test('save and resume produce identical outcomes through middle age',()=>{
 for(const seed of ['cycle99-replay-0','cycle99-replay-1']){
  const uninterrupted=new Game(seed);
  autoplay(uninterrupted,{toAge:25,policy:'random'});
  const resumed=Game.fromSave(createSavePayload(uninterrupted));
  autoplay(uninterrupted,{toAge:40,policy:'random'});
  autoplay(resumed,{toAge:40,policy:'random'});
  assert.deepEqual(validateState(uninterrupted.state),[]);
  assert.deepEqual(validateState(resumed.state),[]);
  assert.deepEqual(resumed.state,uninterrupted.state);
  assert.equal(resumed.rng.seed,uninterrupted.rng.seed);
  assert.equal(resumed.rng.state,uninterrupted.rng.state);
  assert.equal(resumed.activeEventId,uninterrupted.activeEventId);
 }
});
