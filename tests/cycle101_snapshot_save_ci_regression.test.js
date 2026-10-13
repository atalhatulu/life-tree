import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {snapshotObjectGraph} from '../src/core/transaction_snapshot.js';
import {discoverTestFiles,shardTestFiles} from '../src/cli/test_shard.js';

test('snapshot capture does not invoke accessors and restores descriptors',()=>{
 let calls=0;
 const child={value:1};
 const root={child};
 Object.defineProperty(root,'lazy',{enumerable:true,configurable:true,get(){calls++;throw new Error('getter ran');}});
 Object.defineProperty(root,'hidden',{enumerable:false,configurable:true,writable:true,value:42});
 const symbol=Symbol('record');root[symbol]=child;
 const originalGetter=Object.getOwnPropertyDescriptor(root,'lazy').get;
 const restore=snapshotObjectGraph([root]);
 assert.equal(calls,0);
 root.hidden=10;root[symbol]={};child.value=99;
 Object.defineProperty(root,'lazy',{configurable:true,value:'replaced'});
 root.extra=1;root[Symbol('extra')]=2;
 restore();
 assert.equal(calls,0);
 assert.equal(root.hidden,42);
 assert.equal(Object.getOwnPropertyDescriptor(root,'hidden').enumerable,false);
 assert.equal(Object.getOwnPropertyDescriptor(root,'lazy').get,originalGetter);
 assert.equal(root[symbol],child);
 assert.equal(child.value,1);
 assert.equal(Object.hasOwn(root,'extra'),false);
 assert.equal(Reflect.ownKeys(root).filter(k=>typeof k==='symbol').length,1);
});

test('snapshot restores sparse array length, symbols and nonenumerable index',()=>{
 const arr=new Array(5);arr[3]='original';
 Object.defineProperty(arr,'1',{value:'hidden',writable:true,configurable:true,enumerable:false});
 const symbol=Symbol('array');arr[symbol]={value:4};
 const restore=snapshotObjectGraph([arr]);
 arr.length=2;arr[0]='added';arr[symbol].value=999;
 restore();
 assert.equal(arr.length,5);
 assert.equal(0 in arr,false);
 assert.equal(arr[3],'original');
 assert.equal(Object.getOwnPropertyDescriptor(arr,'1').enumerable,false);
 assert.equal(arr[symbol].value,4);
});

test('unrestorable non-configurable new property fails loudly',()=>{
 const object={};const restore=snapshotObjectGraph([object]);
 Object.defineProperty(object,'permanent',{value:1,configurable:false});
 assert.throws(restore,/Cannot restore non-configurable/);
});

for(const [name,change] of [
 ['world economy',s=>{s.world.economy=[];}],
 ['world shock history',s=>{s.world.shockHistory={};}],
 ['world root',s=>{s.world=42;}],
 ['health conditions',s=>{s.healthProfile={conditions:{}};}],
 ['mental episodes',s=>{s.mentalHealth={episodes:'broken'};}],
 ['mental health root',s=>{s.mentalHealth=[];}],
 ['player health',s=>{s.player.health='broken';}]
])test('rejects malformed saved '+name+' before migration',()=>{
 const payload=createSavePayload(new Game('cycle101-'+name));
 change(payload.state);
 assert.throws(()=>parseSave(payload),/Invalid save: invalid /);
});

test('missing optional legacy health and world containers remain accepted',()=>{
 const payload=createSavePayload(new Game('cycle101-legacy'));
 delete payload.state.world;
 delete payload.state.healthProfile;
 delete payload.state.mentalHealth;
 assert.equal(parseSave(payload).version,2);
});

test('full test shards cover every test file exactly once and are stable',()=>{
 const files=discoverTestFiles('tests');
 assert.ok(files.length>100);
 const partitions=Array.from({length:4},(_,index)=>shardTestFiles(files,index+1,4));
 assert.deepEqual(partitions.flat().sort(),files);
 assert.equal(new Set(partitions.flat()).size,files.length);
 assert.deepEqual(shardTestFiles([...files].reverse(),2,4),partitions[1]);
});

test('invalid shard configuration fails before running tests',()=>{
 const files=['a.test.js'];
 for(const [shard,total] of [[0,4],[5,4],[1,0],[1,1.5],[NaN,4]])
  assert.throws(()=>shardTestFiles(files,shard,total),RangeError);
 const result=spawnSync(process.execPath,['src/cli/test_shard.js','0','4'],{encoding:'utf8'});
 assert.equal(result.status,2);
 assert.match(result.stderr,/Usage/);
});
