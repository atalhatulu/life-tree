import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotObjectGraph} from '../src/core/transaction_snapshot.js';

test('ArrayBuffer bytes restore after direct Uint8Array mutation',()=>{
 const buffer=new ArrayBuffer(4),view=new Uint8Array(buffer);
 view.set([1,2,3,4]);
 const restore=snapshotObjectGraph([buffer]);
 view.fill(9);restore();
 assert.deepEqual([...view],[1,2,3,4]);
});

test('ArrayBuffer rollback restores byte-for-byte after DataView writes',()=>{
 const buffer=new ArrayBuffer(8),view=new DataView(buffer);
 view.setFloat64(0,Math.PI);
 const original=[...new Uint8Array(buffer)];
 const restore=snapshotObjectGraph([buffer]);
 view.setBigUint64(0,0n);restore();
 assert.deepEqual([...new Uint8Array(buffer)],original);
});

test('nested typed-array view checkpoints its otherwise unreachable buffer',()=>{
 const view=new Uint16Array([10,20,30]);
 const root={nested:{view}};
 const restore=snapshotObjectGraph([root]);
 view[1]=99;root.nested.view=new Uint16Array([1]);
 restore();
 assert.equal(root.nested.view,view);
 assert.deepEqual([...view],[10,20,30]);
});

test('nested DataView checkpoints its otherwise unreachable buffer',()=>{
 const view=new DataView(new ArrayBuffer(4));view.setInt32(0,42);
 const restore=snapshotObjectGraph([{view}]);
 view.setInt32(0,99);restore();
 assert.equal(view.getInt32(0),42);
});

test('aliased views share the same restored backing buffer',()=>{
 const buffer=new ArrayBuffer(6),a=new Uint8Array(buffer),b=new DataView(buffer,2);
 a.set([1,2,3,4,5,6]);
 const restore=snapshotObjectGraph([{a,b}]);
 b.setUint16(0,65535);a[5]=0;
 restore();
 assert.deepEqual([...a],[1,2,3,4,5,6]);
 assert.equal(b.buffer,a.buffer);
});

test('typed-array subclass overriding buffer getter cannot conceal backing store',()=>{
 class Custom extends Uint8Array{get buffer(){throw new Error('overridden buffer');}}
 const view=new Custom([1,2,3]);
 const restore=snapshotObjectGraph([view]);
 view[0]=9;restore();
 assert.deepEqual([...view],[1,2,3]);
});

test('DataView subclass overriding buffer getter cannot conceal backing store',()=>{
 class Custom extends DataView{get buffer(){throw new Error('overridden buffer');}}
 const view=new Custom(new ArrayBuffer(2));view.setUint8(0,7);
 const restore=snapshotObjectGraph([view]);
 view.setUint8(0,9);restore();
 assert.equal(view.getUint8(0),7);
});

test('unchanged ArrayBuffer rollback retains bytes',()=>{
 const buffer=new ArrayBuffer(3);new Uint8Array(buffer).set([1,2,3]);
 const restore=snapshotObjectGraph([buffer]);restore();
 assert.deepEqual([...new Uint8Array(buffer)],[1,2,3]);
});

test('resizable ArrayBuffer restores original length and bytes after shrink',()=>{
 const buffer=new ArrayBuffer(6,{maxByteLength:12}),view=new Uint8Array(buffer);
 view.set([1,2,3,4,5,6]);
 const restore=snapshotObjectGraph([{view}]);
 buffer.resize(2);new Uint8Array(buffer).fill(9);
 restore();
 assert.equal(buffer.byteLength,6);
 assert.deepEqual([...view],[1,2,3,4,5,6]);
});

test('resizable ArrayBuffer restores original length after expansion',()=>{
 const buffer=new ArrayBuffer(2,{maxByteLength:8});new Uint8Array(buffer).set([3,4]);
 const restore=snapshotObjectGraph([buffer]);
 buffer.resize(8);new Uint8Array(buffer).fill(8);
 restore();
 assert.equal(buffer.byteLength,2);
 assert.deepEqual([...new Uint8Array(buffer)],[3,4]);
});

test('detached buffer rollback reports failure but restores independent objects',()=>{
 const buffer=new ArrayBuffer(3),other={value:1};
 new Uint8Array(buffer).set([1,2,3]);
 const restore=snapshotObjectGraph([buffer,other]);
 structuredClone(buffer,{transfer:[buffer]});other.value=99;
 assert.throws(restore);
 assert.equal(other.value,1);
});

test('proxied ArrayBuffer descriptor rollback avoids invalid native receiver',()=>{
 const buffer=new ArrayBuffer(2);buffer.label='before';
 const proxy=new Proxy(buffer,{});
 const restore=snapshotObjectGraph([proxy]);
 proxy.label='after';restore();
 assert.equal(proxy.label,'before');
});

test('zero-length ArrayBuffer snapshot restores after resize',()=>{
 const buffer=new ArrayBuffer(0,{maxByteLength:4});
 const restore=snapshotObjectGraph([buffer]);
 buffer.resize(4);new Uint8Array(buffer).fill(7);
 restore();
 assert.equal(buffer.byteLength,0);
});

test('resizable ArrayBuffer subclass override cannot intercept rollback',()=>{
 class Custom extends ArrayBuffer{resize(){throw new Error('override resize');}}
 const buffer=new Custom(4,{maxByteLength:8});new Uint8Array(buffer).set([1,2,3,4]);
 const restore=snapshotObjectGraph([buffer]);
 ArrayBuffer.prototype.resize.call(buffer,2);
 restore();
 assert.deepEqual([...new Uint8Array(buffer)],[1,2,3,4]);
});

test('Map entry typed-array backing bytes are restored',()=>{
 const view=new Uint8Array([1,2]),map=new Map([['view',view]]);
 const restore=snapshotObjectGraph([map]);
 view[1]=9;restore();
 assert.equal(map.get('view'),view);
 assert.deepEqual([...view],[1,2]);
});
