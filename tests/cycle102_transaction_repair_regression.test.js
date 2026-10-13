import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave,repairSavePayload} from '../src/core/save_system.js';
import {snapshotObjectGraph,snapshotOwnFields} from '../src/core/transaction_snapshot.js';

// Candidate 1: graph rollback must restore all reachable objects even when
// one injected, non-configurable property cannot be deleted.
test('graph rollback continues after an un-restorable new property',()=>{
 const left={count:1},right={count:2},root={left,right};
 const restore=snapshotObjectGraph([root]);
 left.count=10;right.count=20;root.added=true;
 Object.defineProperty(left,'permanent',{value:7,configurable:false});
 assert.throws(restore,/Cannot restore non-configurable/);
 assert.equal(left.count,1);
 assert.equal(right.count,2);
 assert.equal(Object.hasOwn(root,'added'),false);
});

test('graph rollback aggregates independent failures without skipping other references',()=>{
 const first={n:1},second={n:2},third={n:3};
 const restore=snapshotObjectGraph([first,second,third]);
 for(const obj of [first,second]){
  obj.n=99;
  Object.defineProperty(obj,'locked',{value:true,configurable:false});
 }
 third.n=99;
 assert.throws(restore,error=>error instanceof AggregateError&&error.errors.length===2);
 assert.deepEqual([first.n,second.n,third.n],[1,2,3]);
});

// Candidate 2: top-level fields must use descriptor-safe capture and restore.
test('own-field checkpoint does not invoke getters or setters',()=>{
 let getterCalls=0,setterCalls=0;
 const obj={};
 const getter=()=>{getterCalls++;throw new Error('unexpected getter');};
 const setter=()=>{setterCalls++;throw new Error('unexpected setter');};
 Object.defineProperty(obj,'value',{configurable:true,enumerable:false,get:getter,set:setter});
 const restore=snapshotOwnFields(obj,['value','missing']);
 Object.defineProperty(obj,'value',{configurable:true,value:42});
 obj.missing='new';
 restore();
 assert.equal(getterCalls,0);assert.equal(setterCalls,0);
 const descriptor=Object.getOwnPropertyDescriptor(obj,'value');
 assert.equal(descriptor.get,getter);assert.equal(descriptor.set,setter);
 assert.equal(descriptor.enumerable,false);
 assert.equal(Object.hasOwn(obj,'missing'),false);
});

test('own-field rollback preserves symbols and original writable flags',()=>{
 const key=Symbol('field');const obj={};
 Object.defineProperty(obj,key,{value:{id:1},writable:false,configurable:true,enumerable:false});
 const old=obj[key];const restore=snapshotOwnFields(obj,[key]);
 Object.defineProperty(obj,key,{value:3,writable:true,configurable:true,enumerable:true});
 restore();
 const desc=Object.getOwnPropertyDescriptor(obj,key);
 assert.equal(obj[key],old);
 assert.equal(desc.writable,false);assert.equal(desc.enumerable,false);
});

test('own-field rollback continues restoring other fields after a locked addition',()=>{
 const obj={count:1};const restore=snapshotOwnFields(obj,['missing','count']);
 Object.defineProperty(obj,'missing',{value:2,configurable:false});
 obj.count=42;
 assert.throws(restore,/Cannot restore non-configurable transaction field/);
 assert.equal(obj.count,1);
});

// Candidate 3: explicit, audited and non-destructive optional save repair.
test('strict loading rejects corruption while opt-in repair fixes known optional containers',()=>{
 const raw=createSavePayload(new Game('cycle102-repair'));
 raw.state.world.shockHistory={bad:1};
 raw.state.healthProfile={conditions:'bad',riskExposure:[]};
 raw.state.mentalHealth={episodes:{bad:true}};
 raw.state.finance??={};raw.state.finance.debts='bad';
 const original=JSON.stringify(raw);
 assert.throws(()=>parseSave(raw),/Invalid save/);
 const {payload,repairs}=repairSavePayload(raw);
 assert.deepEqual(repairs,[
  'world.shockHistory','healthProfile.conditions','healthProfile.riskExposure',
  'mentalHealth.episodes','finance.debts'
 ]);
 assert.equal(JSON.stringify(raw),original,'input must not be mutated');
 assert.equal(payload.state.world.shockHistory.length,0);
 assert.deepEqual(payload.state.healthProfile.conditions,[]);
 assert.deepEqual(payload.state.healthProfile.riskExposure,{});
 assert.deepEqual(payload.state.mentalHealth.episodes,[]);
 assert.equal(typeof payload.state.finance.debts,'object');
 assert.equal(Game.fromSave(payload).state.player.id,raw.state.player.id);
});

test('repair refuses unsafe core corruption instead of fabricating a save',()=>{
 const raw=createSavePayload(new Game('cycle102-unsafe'));
 raw.state.world.shockHistory='bad';
 raw.state.parents.mother.id=raw.state.parents.father.id;
 assert.throws(()=>repairSavePayload(raw),/Invalid save: invalid or duplicate family member ID/);
});

test('repair on valid save makes no replacements and accepts JSON input',()=>{
 const raw=createSavePayload(new Game('cycle102-valid'));
 const {payload,repairs}=repairSavePayload(JSON.stringify(raw));
 assert.deepEqual(repairs,[]);
 assert.equal(payload.state.player.id,raw.state.player.id);
});

test('repair can migrate version 1 save without modifying input',()=>{
 const raw=createSavePayload(new Game('cycle102-v1'));
 raw.version=1;raw.state.world.shockHistory=null;
 const {payload,repairs}=repairSavePayload(raw);
 assert.equal(raw.version,1);
 assert.equal(payload.version,2);
 assert.deepEqual(repairs,['world.shockHistory']);
});

test('repair CLI supports dry run, safe output and refuses overwrites',()=>{
 const dir=mkdtempSync(join(tmpdir(),'life-tree-repair-'));
 try{
  const input=join(dir,'broken.json'),output=join(dir,'repaired.json');
  const raw=createSavePayload(new Game('cycle102-cli'));
  raw.state.healthProfile={conditions:{bad:true}};
  writeFileSync(input,JSON.stringify(raw));
  const run=(...args)=>spawnSync(process.execPath,['src/cli/repair_save.js',...args],{cwd:process.cwd(),encoding:'utf8'});
  const dry=run(input,'--dry-run');
  assert.equal(dry.status,0,dry.stderr);
  assert.deepEqual(JSON.parse(dry.stdout).repairs,['healthProfile.conditions']);
  assert.equal(existsSync(output),false);
  const first=run(input,output);
  assert.equal(first.status,0,first.stderr);
  assert.equal(parseSave(readFileSync(output,'utf8')).state.player.id,raw.state.player.id);
  const second=run(input,output);
  assert.notEqual(second.status,0);
  assert.equal(run(input,input).status,1);
  assert.deepEqual(JSON.parse(readFileSync(input,'utf8')).state.healthProfile.conditions,{bad:true});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
