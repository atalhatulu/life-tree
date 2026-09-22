import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';
import {createSavePayload} from '../src/core/save_system.js';

function runTelemetry(){
 const out=execFileSync(process.execPath,[
  'src/cli/fast_simulate.js',
  '--lives','24','--to-age','70','--policy','human-like','--seed-prefix','telemetry-quality'
 ],{encoding:'utf8',maxBuffer:20*1024*1024});
 const marker='FAST SIMULATION FULL TELEMETRY';
 const idx=out.indexOf(marker);
 assert.ok(idx>=0,'telemetry marker missing');
 return JSON.parse(out.slice(idx+marker.length).trim());
}

test('fast telemetry exposes new Group 3-5 systems',()=>{
 const report=runTelemetry();
 assert.equal(report.validity.invalid,0);
 assert.ok(report.relationships.firstRelationshipAges);
 assert.ok(report.health.mentalStrain);
 assert.ok(report.finance.debtTypes);
 assert.ok(report.career.sectors);
 assert.ok(report.career.levels);
 assert.ok(report.education.yksScores);
 assert.ok(report.military);
 assert.ok(report.care);
 assert.ok(report.events.contentDensityByAgeBand);
});

test('world boom telemetry matches current world event wording',()=>{
 const report=runTelemetry();
 assert.equal(typeof report.world.boomsPerLife,'number');
 assert.equal(typeof report.world.housingSurgesPerLife,'number');
});

test('first relationship telemetry is not limited to adult dating choices',()=>{
 const report=runTelemetry();
 const first=report.relationships.firstRelationshipAges;
 assert.ok(first.n>=0);
 if(first.n>0){
  assert.ok(first.min>=14);
  assert.ok(first.max<=70);
 }
});

test('cross-policy integration sample remains invariant-valid',()=>{
 const policies=['random','human-like','balanced','vocational','social','academic'];
 for(let i=0;i<24;i++){
  const policy=policies[i%policies.length];
  const g=new Game('final-integration-'+policy+'-'+i);
  autoplay(g,{toAge:65,policy});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],g.seedText+' -> '+errors.join('; '));
 }
});

test('save restore preserves final integrated state schema and deterministic continuation',()=>{
 const source=new Game('final-save-chain');
 autoplay(source,{toAge:38,policy:'human-like'});
 const payload=createSavePayload(source);
 const a=Game.fromSave(payload),b=Game.fromSave(payload);
 autoplay(a,{toAge:55,policy:'human-like'});
 autoplay(b,{toAge:55,policy:'human-like'});
 assert.deepEqual(a.state,b.state);
 assert.equal(a.state.schemaVersion,2);
 assert.deepEqual(validateState(a.state),[]);
});

test('major systems leave observable state in a mixed adult life',()=>{
 let observed={
  finance:false,mental:false,career:false,education:false,world:false,middleAge:false
 };
 for(let i=0;i<12;i++){
  const g=new Game('observable-systems-'+i);
  autoplay(g,{toAge:52,policy:'human-like'});
  const s=g.state;
  observed.finance||=Boolean(s.finance);
  observed.mental||=Boolean(s.mentalHealth);
  observed.career||=Boolean(s.careerProfile);
  observed.education||=Boolean(s.education);
  observed.world||=Boolean(s.world?.economy);
  observed.middleAge||=Boolean(s.middleAge);
 }
 for(const [key,value] of Object.entries(observed))assert.equal(value,true,key+' never became observable');
});
