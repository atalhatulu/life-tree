import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {captureRngCheckpoint} from '../src/core/transaction_snapshot.js';
import {createSavePayload,parseSave} from '../src/core/save_system.js';

class StatefulRNG extends RNG{
 constructor(seed){super(seed);this.extraDraws=0;}
 next(){this.extraDraws++;return super.next();}
 snapshotState(){return {seed:this.seed,state:this.state,extraDraws:this.extraDraws};}
 restoreState(token){Object.assign(this,token);}
}

test('RNG subclass checkpoint honors explicit snapshot/restore protocol',()=>{
 const rng=new StatefulRNG('cycle100-custom');
 const old={seed:rng.seed,state:rng.state,extraDraws:rng.extraDraws};
 const restore=captureRngCheckpoint(rng);
 rng.next();rng.seed=1234;
 restore();
 assert.deepEqual({seed:rng.seed,state:rng.state,extraDraws:rng.extraDraws},old);
});

test('game rollback restores protocol state of injected RNG subclass',()=>{
 const game=new Game('cycle100-game-custom');
 game.rng=new StatefulRNG('cycle100-injected');
 const old={seed:game.rng.seed,state:game.rng.state,extraDraws:game.rng.extraDraws};
 game.events.choose=()=>{game.rng.next();throw new Error('injected late failure');};
 assert.throws(()=>game.ageOneYear(),/injected late failure/);
 assert.deepEqual({seed:game.rng.seed,state:game.rng.state,extraDraws:game.rng.extraDraws},old);
});

test('incomplete custom protocol on RNG subclass fails before mutation',()=>{
 class IncompleteRNG extends RNG{snapshotState(){return {};}}
 const rng=new IncompleteRNG('cycle100-incomplete');
 assert.throws(()=>captureRngCheckpoint(rng),/snapshotState and restoreState/);
});

for(const [name,mutate] of [
 ['finance debt ledger',state=>{state.finance={debts:'corrupt'};}],
 ['finance object',state=>{state.finance='corrupt';}],
 ['actions array',state=>{state.actions=[];}],
 ['child money array',state=>{state.childMoney=[];}],
 ['health risk array',state=>{state.healthProfile={riskExposure:[]};}],
 ['primary stats array',state=>{state.primaryStats=[];}]
])test('malformed optional save '+name+' is rejected as Invalid save',()=>{
 const payload=createSavePayload(new Game('cycle100-save-'+name));
 mutate(payload.state);
 assert.throws(()=>parseSave(payload),/Invalid save:/);
 assert.throws(()=>Game.fromSave(JSON.stringify(payload)),/Invalid save:/);
});

test('missing legacy optional save containers still migrate safely',()=>{
 const payload=createSavePayload(new Game('cycle100-legacy'));
 for(const key of ['actions','childMoney','primaryStats','healthProfile','finance'])delete payload.state[key];
 const restored=parseSave(payload);
 assert.equal(restored.state.actions.max,3);
 assert.equal(restored.state.childMoney.wallet,0);
 assert.equal(typeof restored.state.primaryStats,'object');
});
