import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';
import {createDecisionSnapshot,restoreDecisionSnapshot} from '../src/timeline/snapshot.js';

function save(){return createSavePayload(new Game('cycle70-save'));}
function invalidSave(edit){
 const payload=save();edit(payload);
 const original=structuredClone(payload);
 assert.throws(()=>parseSave(payload),/Invalid save/);
 assert.deepEqual(payload,original);
 assert.throws(()=>parseSave(JSON.stringify(payload)),/Invalid save/);
}

// Candidate 1: an active event must resolve to a real registered event after load.
for(const eventId of ['removed-event-id','not-a-real-event','__proto__']){
 test('unknown pending event rejected without changing save: '+eventId,()=>{
  const payload=save();payload.activeEventId=eventId;
  const before=structuredClone(payload);
  assert.throws(()=>Game.fromSave(payload),/Invalid save: unknown active event ID/);
  assert.deepEqual(payload,before);
  assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save: unknown active event ID/);
 });
}
test('null pending event and valid registered pending event survive save/load',()=>{
 const idle=save();assert.equal(Game.fromSave(idle).pendingEvent(),null);
 const game=new Game('cycle70-valid-pending');
 let event=null;
 while(game.state.player.age<8&&!event)event=game.ageOneYear();
 assert.ok(event);
 assert.equal(Game.fromSave(createSavePayload(game)).pendingEvent()?.id,event.id);
});

// Candidate 2: a valid array cannot contain unusable entries.
for(const [name,edit] of [
 ['history null',p=>p.state.history.push(null)],
 ['history string',p=>p.state.history.push('broken')],
 ['history array',p=>p.state.history.push([])],
 ['tree node null',p=>p.state.lifeTree.nodes.push(null)],
 ['tree node number',p=>p.state.lifeTree.nodes.push(5)],
 ['tree node array',p=>p.state.lifeTree.nodes.push([])],
 ['tree branch null',p=>p.state.lifeTree.branches.push(null)],
 ['tree branch string',p=>p.state.lifeTree.branches.push('branch')],
 ['completed event object',p=>p.state.flags.completedEvents.push({id:'bad'})],
 ['completed event empty',p=>p.state.flags.completedEvents.push('')]
])test('save rejects malformed collection entry: '+name,()=>invalidSave(edit));
test('legitimate event history, nodes, completed IDs and old missing collections still load',()=>{
 const game=new Game('cycle70-legitimate');
 for(let i=0;i<15;i++){
  const event=game.ageOneYear();
  if(event)game.makeChoice(event,game.eventChoices(event)[0].id);
 }
 const payload=createSavePayload(game);
 assert.deepEqual(Game.fromSave(payload).state,game.state);
 payload.version=1;
 delete payload.state.lifeTree.branches;
 assert.ok(Array.isArray(Game.fromSave(payload).state.lifeTree.branches));
});

// Candidate 3: snapshot metadata must be well-formed before any restore.
function checkpoint(){
 const game=new Game('cycle70-checkpoint');
 return createDecisionSnapshot(game.state,{id:'sample-event',title:'Sample'},
  [{id:'yes',label:'Yes'},{id:'no',label:'No'}],{seed:game.rng.seed,state:game.rng.state});
}
for(const [name,edit] of [
 ['negative history length',s=>{s.historyLength=-1;}],
 ['fractional history length',s=>{s.historyLength=1.5;}],
 ['unsafe history length',s=>{s.historyLength=Number.MAX_SAFE_INTEGER+1;}],
 ['invalid event ID',s=>{s.eventId='';}],
 ['numeric event ID',s=>{s.eventId=5;}],
 ['unsupported version',s=>{s.version=999;}],
 ['invalid choices object',s=>{s.availableChoices={};}],
 ['null choice',s=>{s.availableChoices=[null];}],
 ['choice without ID',s=>{s.availableChoices=[{label:'X'}];}],
 ['empty choice ID',s=>{s.availableChoices=[{id:'',label:'X'}];}],
 ['invalid choice label',s=>{s.availableChoices=[{id:'x',label:5}];}],
 ['duplicate choice ID',s=>{s.availableChoices.push({id:'yes',label:'Again'});}]
])test('snapshot rejects invalid metadata: '+name,()=>{
 const snapshot=checkpoint();edit(snapshot);
 const before=structuredClone(snapshot);
 assert.throws(()=>restoreDecisionSnapshot(snapshot),/Invalid decision snapshot/);
 assert.deepEqual(snapshot,before);
});
test('snapshot metadata remains compatible with omitted optional legacy fields',()=>{
 const snapshot=checkpoint();
 assert.equal(restoreDecisionSnapshot(snapshot).year,snapshot.state.year);
 delete snapshot.version;delete snapshot.historyLength;delete snapshot.eventId;
 delete snapshot.availableChoices;
 assert.equal(restoreDecisionSnapshot(snapshot).player.age,snapshot.state.player.age);
});
