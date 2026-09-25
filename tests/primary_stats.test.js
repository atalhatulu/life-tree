import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {computePrimaryStats,refreshPrimaryStats} from '../src/life/primary_stats.js';

test('primary stats expose exactly the four player-facing attributes',()=>{
 const g=new Game('primary-stats-shape');
 const stats=refreshPrimaryStats(g.state);
 assert.deepEqual(Object.keys(stats),['health','intelligence','appearance','happiness']);
 for(const value of Object.values(stats)){
  assert.ok(Number.isInteger(value));
  assert.ok(value>=0&&value<=100);
 }
});

test('health and appearance mirror canonical player state',()=>{
 const g=new Game('primary-stats-mirror');
 g.state.player.health.current=43;
 g.state.player.appearance.attractiveness=81;
 const stats=computePrimaryStats(g.state);
 assert.equal(stats.health,43);
 assert.equal(stats.appearance,81);
});

test('intelligence responds to curiosity discipline and educational performance',()=>{
 const g=new Game('primary-stats-intelligence');
 g.state.player.personality.curiosity=20;
 g.state.player.personality.discipline=25;
 g.state.education={...(g.state.education??{}),performance:30,level:0};
 const low=computePrimaryStats(g.state).intelligence;
 g.state.player.personality.curiosity=90;
 g.state.player.personality.discipline=85;
 g.state.education.performance=92;
 g.state.education.level=4;
 g.state.higherEducation={completed:true,enrolled:false};
 const high=computePrimaryStats(g.state).intelligence;
 assert.ok(high>low+35);
});

test('happiness falls with stress and rises with stronger relationships',()=>{
 const g=new Game('primary-stats-happiness');
 g.state.healthProfile={...(g.state.healthProfile??{}),stress:85};
 g.state.mentalHealth={...(g.state.mentalHealth??{}),strain:65};
 g.state.social.friends=[];
 g.state.social.romance=null;
 for(const key of Object.keys(g.state.player.relationships??{}))g.state.player.relationships[key]=30;
 const low=computePrimaryStats(g.state).happiness;

 g.state.healthProfile.stress=10;
 g.state.mentalHealth.strain=5;
 for(const key of Object.keys(g.state.player.relationships??{}))g.state.player.relationships[key]=90;
 g.state.social.friends=[{id:'f',relationship:92}];
 g.state.social.romance={relationship:94,trust:90,relationshipTension:8};
 const high=computePrimaryStats(g.state).happiness;
 assert.ok(high>low+20);
});


test('yearly progression refreshes primary stats from the resulting life state',()=>{
 const g=new Game('primary-stats-year-refresh');
 g.state.primaryStats={health:-1,intelligence:-1,appearance:-1,happiness:-1};
 g.ageOneYear();
 assert.deepEqual(g.state.primaryStats,computePrimaryStats(g.state));
});

test('save/load repairs stale primary stats without changing the canonical attributes',()=>{
 const g=new Game('primary-stats-save-refresh');
 g.state.player.health.current=42;
 g.state.player.appearance.attractiveness=78;
 const payload={
  version:2,schemaVersion:2,seedText:g.seedText,
  rng:{seed:g.rng.seed,state:g.rng.state},
  state:structuredClone(g.state)
 };
 payload.state.primaryStats={health:100,intelligence:100,appearance:100,happiness:100};
 const loaded=Game.fromSave(payload);
 assert.equal(loaded.state.player.health.current,42);
 assert.equal(loaded.state.player.appearance.attractiveness,78);
 assert.deepEqual(loaded.state.primaryStats,computePrimaryStats(loaded.state));
});

test('decision snapshots restore independently computed primary stats',()=>{
 const original=new Game('primary-stats-snapshot');
 original.state.player.health.current=38;
 original.state.player.appearance.attractiveness=73;
 const snapshot={state:structuredClone(original.state),rng:{seed:original.rng.seed,state:original.rng.state}};
 const restored=Game.fromDecisionSnapshot(original.seedText,snapshot);
 assert.deepEqual(restored.state.primaryStats,computePrimaryStats(restored.state));
 restored.state.player.health.current=91;
 refreshPrimaryStats(restored.state);
 assert.equal(original.state.player.health.current,38);
 assert.equal(restored.state.primaryStats.health,91);
});
