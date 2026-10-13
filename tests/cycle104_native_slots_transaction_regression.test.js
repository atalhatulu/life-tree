import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotObjectGraph} from '../src/core/transaction_snapshot.js';

test('Map restores deleted and added entries in insertion order',()=>{
 const map=new Map([['a',1],['b',2]]);
 const restore=snapshotObjectGraph([map]);
 map.delete('a');map.set('c',3);map.set('b',5);
 restore();
 assert.deepEqual([...map],[['a',1],['b',2]]);
});

test('Map recursively restores object keys and values without replacing identities',()=>{
 const key={id:1},value={score:5},map=new Map([[key,value]]);
 const restore=snapshotObjectGraph([{map}]);
 key.id=9;value.score=0;map.clear();
 restore();
 assert.equal([...map][0][0],key);
 assert.equal(map.get(key),value);
 assert.deepEqual(key,{id:1});assert.deepEqual(value,{score:5});
});

test('Map self references and aliased object values restore',()=>{
 const shared={count:1},map=new Map();
 map.set(map,shared);map.set('alias',shared);
 const restore=snapshotObjectGraph([map]);
 shared.count=10;map.clear();
 restore();
 assert.equal(map.get(map),shared);
 assert.equal(map.get('alias'),shared);
 assert.equal(shared.count,1);
});

test('Map rollback bypasses subclass overrides and does not call getters',()=>{
 class TrackedMap extends Map{
  clear(){throw new Error('override clear');}
  set(){throw new Error('override set');}
 }
 const map=new TrackedMap();Map.prototype.set.call(map,'a',1);
 Object.defineProperty(map,'danger',{get(){throw new Error('getter');},configurable:true});
 const restore=snapshotObjectGraph([map]);
 Map.prototype.set.call(map,'b',2);
 restore();
 assert.deepEqual([...map],[['a',1]]);
});

test('unchanged Map rollback skips destructive native writes',()=>{
 const map=new Map([['a',1]]);
 const restore=snapshotObjectGraph([map]);
 restore();
 assert.deepEqual([...map],[['a',1]]);
});

test('Set restores deleted and added values and insertion order',()=>{
 const set=new Set(['a','b']);
 const restore=snapshotObjectGraph([set]);
 set.delete('a');set.add('c');
 restore();
 assert.deepEqual([...set],['a','b']);
});

test('Set nested object and cycle restore with stable identity',()=>{
 const obj={n:1},set=new Set([obj]);set.add(set);
 const restore=snapshotObjectGraph([set]);
 obj.n=10;set.clear();set.add('wrong');
 restore();
 assert.deepEqual([...set],[obj,set]);
 assert.equal(obj.n,1);
});

test('Set rollback bypasses subclass mutators',()=>{
 class TrackedSet extends Set{
  clear(){throw new Error('override clear');}
  add(){throw new Error('override add');}
 }
 const set=new TrackedSet();Set.prototype.add.call(set,1);
 const restore=snapshotObjectGraph([set]);
 Set.prototype.add.call(set,2);
 restore();
 assert.deepEqual([...set],[1]);
});

test('Date timestamp is restored through a nested graph',()=>{
 const date=new Date('2000-01-01T00:00:00.000Z');
 const root={date};
 const restore=snapshotObjectGraph([root]);
 date.setFullYear(2025);root.date=new Date(1999);
 restore();
 assert.equal(root.date,date);
 assert.equal(date.toISOString(),'2000-01-01T00:00:00.000Z');
});

test('invalid Date is restored after mutation',()=>{
 const date=new Date(NaN);
 const restore=snapshotObjectGraph([date]);
 date.setTime(0);
 restore();
 assert.ok(Number.isNaN(date.getTime()));
});

test('Date rollback bypasses overridden setTime method',()=>{
 class TrackedDate extends Date{setTime(){throw new Error('override');}}
 const date=new TrackedDate(10);
 const restore=snapshotObjectGraph([date]);
 Date.prototype.setTime.call(date,100);
 restore();
 assert.equal(date.getTime(),10);
});

test('native slot rollback continues when an unrelated descriptor cannot be removed',()=>{
 const map=new Map([['a',1]]),set=new Set([1]),date=new Date(10);
 const blocker={};
 const restore=snapshotObjectGraph([blocker,map,set,date]);
 Object.defineProperty(blocker,'locked',{value:1,configurable:false});
 map.clear();set.clear();date.setTime(20);
 assert.throws(restore,/Cannot restore non-configurable transaction property/);
 assert.deepEqual([...map],[['a',1]]);
 assert.deepEqual([...set],[1]);
 assert.equal(date.getTime(),10);
});

test('proxied Map and Set preserve descriptor rollback without invalid native slot calls',()=>{
 for(const target of [new Map([['a',1]]),new Set([1])]){
  target.marker=1;
  const proxy=new Proxy(target,{});
  const restore=snapshotObjectGraph([proxy]);
  proxy.marker=2;
  restore();
  assert.equal(proxy.marker,1);
 }
});

test('proxied Date preserves descriptor rollback without native timestamp access',()=>{
 const target=new Date(10);target.marker=1;
 const proxy=new Proxy(target,{});
 const restore=snapshotObjectGraph([proxy]);
 proxy.marker=2;
 restore();
 assert.equal(proxy.marker,1);
});
