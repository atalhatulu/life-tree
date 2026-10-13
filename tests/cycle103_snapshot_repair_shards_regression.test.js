import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync,readdirSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {snapshotObjectGraph} from '../src/core/transaction_snapshot.js';
import {repairSaveFile} from '../src/cli/repair_save.js';
import {discoverTestFiles,shardTestFiles} from '../src/cli/test_shard.js';
import {benchmarkSnapshot} from '../src/cli/benchmark_snapshot.js';

test('unchanged graph rollback does not redefine any descriptors',()=>{
 let writes=0;
 const original={count:1,child:{value:2}};
 const proxy=new Proxy(original,{defineProperty(target,key,desc){writes++;return Reflect.defineProperty(target,key,desc);}});
 const restore=snapshotObjectGraph([proxy]);
 restore();
 assert.equal(writes,0);
 assert.deepEqual(original,{count:1,child:{value:2}});
});

test('mutated graph restores descriptors and nested identity',()=>{
 const child={value:1};const root={child};
 Object.defineProperty(root,'hidden',{value:7,configurable:true,enumerable:false});
 const restore=snapshotObjectGraph([root]);
 root.child={value:100};child.value=9;root.extra=true;
 Object.defineProperty(root,'hidden',{value:20,configurable:true,enumerable:true});
 restore();
 assert.equal(root.child,child);
 assert.equal(child.value,1);
 assert.equal(root.hidden,7);
 assert.equal(Object.getOwnPropertyDescriptor(root,'hidden').enumerable,false);
 assert.equal(Object.hasOwn(root,'extra'),false);
});

test('unchanged accessor is not invoked during rollback',()=>{
 let reads=0;
 const root={};
 Object.defineProperty(root,'accessor',{configurable:true,get(){reads++;throw new Error('getter called');}});
 const restore=snapshotObjectGraph([root]);
 restore();
 assert.equal(reads,0);
});

test('sparse array rollback restores length, holes and aliases',()=>{
 const child={n:1};const array=[];array[4]=child;
 const restore=snapshotObjectGraph([array]);
 array.length=1;array[0]=child;child.n=2;
 restore();
 assert.equal(array.length,5);
 assert.equal(0 in array,false);
 assert.equal(array[4],child);
 assert.equal(child.n,1);
});

test('atomic repair writes valid output and leaves no temporary directories',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-tree-cycle103-repair-'));
 try{
  const input=join(dir,'in.json'),output=join(dir,'out.json');
  const raw=createSavePayload(new Game('cycle103-atomic'));
  raw.state.world.shockHistory='corrupt';
  writeFileSync(input,JSON.stringify(raw));
  const result=await repairSaveFile(input,output);
  assert.deepEqual(result.repairs,['world.shockHistory']);
  assert.deepEqual(parseSave(readFileSync(output,'utf8')).state.world.shockHistory,[]);
  assert.equal(JSON.parse(readFileSync(input,'utf8')).state.world.shockHistory,'corrupt');
  assert.deepEqual(readdirSync(dir).sort(),['in.json','out.json']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('atomic repair refuses existing destination without leaving partial output',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-tree-cycle103-exists-'));
 try{
  const input=join(dir,'in.json'),output=join(dir,'out.json');
  writeFileSync(input,JSON.stringify(createSavePayload(new Game('cycle103-exists'))));
  writeFileSync(output,'KEEP');
  await assert.rejects(repairSaveFile(input,output),{code:'EEXIST'});
  assert.equal(readFileSync(output,'utf8'),'KEEP');
  assert.deepEqual(readdirSync(dir).sort(),['in.json','out.json']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('atomic repair never follows an existing output symlink',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-tree-cycle103-symlink-'));
 try{
  const input=join(dir,'in.json'),output=join(dir,'out.json'),target=join(dir,'target.json');
  writeFileSync(input,JSON.stringify(createSavePayload(new Game('cycle103-symlink'))));
  writeFileSync(target,'KEEP');symlinkSync(target,output);
  await assert.rejects(repairSaveFile(input,output),{code:'EEXIST'});
  assert.equal(readFileSync(target,'utf8'),'KEEP');
  assert.deepEqual(readdirSync(dir).sort(),['in.json','out.json','target.json']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('dry-run does not publish or create temporary files',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-tree-cycle103-dry-'));
 try{
  const input=join(dir,'in.json'),output=join(dir,'out.json');
  writeFileSync(input,JSON.stringify(createSavePayload(new Game('cycle103-dry'))));
  await repairSaveFile(input,output,{dryRun:true});
  assert.equal(existsSync(output),false);
  assert.deepEqual(readdirSync(dir),['in.json']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('test shard discovery includes nested tests but not symlink loops',()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-tree-cycle103-shards-'));
 try{
  mkdirSync(join(dir,'nested'));
  writeFileSync(join(dir,'a.test.js'),'');
  writeFileSync(join(dir,'nested','b.test.js'),'');
  writeFileSync(join(dir,'nested','ignore.js'),'');
  symlinkSync(dir,join(dir,'nested','loop'),'dir');
  const files=discoverTestFiles(dir);
  assert.equal(files.length,2);
  assert.ok(files.some(name=>name.endsWith('/a.test.js')));
  assert.ok(files.some(name=>name.endsWith('/nested/b.test.js')));
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('four shards cover each discovered test file exactly once',()=>{
 const files=discoverTestFiles('tests');
 const shards=Array.from({length:4},(_,i)=>shardTestFiles(files,i+1,4));
 assert.equal(new Set(shards.flat()).size,files.length);
 assert.deepEqual(shards.flat().sort(),files);
 assert.ok(shards.every(shard=>shard.length>0));
 assert.ok(files.includes('tests/cycle103_snapshot_repair_shards_regression.test.js'));
});

test('snapshot profile reports both unchanged and changed graph costs',()=>{
 const result=benchmarkSnapshot(2);
 assert.equal(result.iterations,2);
 assert.ok(Number.isFinite(result.unchangedMs));
 assert.ok(Number.isFinite(result.changedMs));
});
