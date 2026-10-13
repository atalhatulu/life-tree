import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';

function unchanged(game,invoke,pattern){
 const original=game.state;
 const player=original.player;
 const history=original.history;
 const mother=original.parents.mother;
 const before=structuredClone(original);
 const eventId=game.activeEventId;
 const rngState=game.rng.state;
 assert.throws(invoke,pattern);
 assert.equal(game.state,original,'original root reference');
 assert.equal(game.state.player,player,'original player reference');
 assert.equal(game.state.history,history,'original history reference');
 assert.equal(game.state.parents.mother,mother,'original parent reference');
 assert.deepEqual(game.state,before,'all state changes rolled back');
 assert.equal(game.activeEventId,eventId,'pending event restored');
 assert.equal(game.rng.state,rngState,'main RNG state restored');
}

function actionGame(seed){
 const game=new Game(seed);
 game.state.player.age=25;
 game.state.actions={remaining:3,max:3};
 return game;
}

// Candidate 1: the entire age transition is one transaction, not only each subsystem.
test('annual event selection failure rolls back all completed annual systems',()=>{
 const game=new Game('cycle97-year-event');
 game.activeEventId='pending-previous';
 game.events.choose=(state)=>{
  state.history.push({kind:'uncommitted'});
  state.player.health.current=1;
  game.rng.state+=9;
  throw new Error('event selection failed');
 };
 unchanged(game,()=>game.ageOneYear(),/event selection failed/);
});

test('annual RNG fork failure does not leave ages, year or action budget advanced',()=>{
 const game=new Game('cycle97-year-fork');
 const fork=game.rng.fork;
 game.rng.fork=function(){this.state+=3;throw new Error('fork unavailable');};
 unchanged(game,()=>game.ageOneYear(),/fork unavailable/);
 game.rng.fork=fork;
});

test('annual transaction restores custom checkpoint RNG after late failure',()=>{
 const game=new Game('cycle97-custom-rng');
 const rng={position:5,snapshotState(){return this.position;},restoreState(value){this.position=value;},fork(label){this.position+=1;return new RNG(label);}};
 game.rng=rng;
 const before=structuredClone(game.state);
 game.events.choose=()=>{throw new Error('late failure');};
 assert.throws(()=>game.ageOneYear(),/late failure/);
 assert.equal(rng.position,5);
 assert.deepEqual(game.state,before);
});

test('failed custom RNG restoration is reported, never claimed as successful rollback',()=>{
 const game=new Game('cycle97-broken-checkpoint');
 game.rng={snapshotState(){return 1;},restoreState(){throw new Error('checkpoint broken');},fork(){throw new Error('fork broken');}};
 assert.throws(()=>game.ageOneYear(),error=>error instanceof AggregateError&&
  error.errors.some(e=>e.message==='fork broken')&&
  error.errors.some(e=>e.message==='checkpoint broken'));
});

// Candidate 2: a decision's resolution, derived stats and history commit are atomic.
test('choice resolver mutating the original state cannot leave partial changes',()=>{
 const game=new Game('cycle97-choice-mutation');
 game.activeEventId='pending-choice';
 game.events.resolve=(state)=>{
  state.player.health.current=1;
  state.lifeTree.nodes.push({id:'partial'});
  throw new Error('resolution failed');
 };
 const event={id:'synthetic',choices:[{id:'choose',label:'Choose'}]};
 unchanged(game,()=>game.makeChoice(event,'choose'),/resolution failed/);
});

test('choice history failure after new state assignment restores original state and pending event',()=>{
 const game=new Game('cycle97-choice-commit');
 game.activeEventId='pending-choice';
 game.events.resolve=(state)=>{
  const next=structuredClone(state);
  next.history=null;
  return {state:next,result:'ok',decision:null};
 };
 const event={id:'synthetic',choices:[{id:'choose',label:'Choose'}]};
 unchanged(game,()=>game.makeChoice(event,'choose'),/push/);
});

test('invalid choice remains a no-op',()=>{
 const game=new Game('cycle97-choice-invalid');
 const event={id:'synthetic',choices:[{id:'choose',label:'Choose'}]};
 unchanged(game,()=>game.makeChoice(event,'wrong'),/Unknown or unavailable choice/);
});

test('successful choice still commits its new state and clears pending event',()=>{
 const game=new Game('cycle97-choice-success');
 game.activeEventId='pending-choice';
 const old=game.state;
 const event={id:'synthetic',choices:[{id:'choose',label:'Choose'}],once:true};
 assert.equal(game.makeChoice(event,'choose'),undefined);
 assert.notEqual(game.state,old);
 assert.equal(game.activeEventId,null);
 assert.equal(game.state.history.at(-1).choiceId,'choose');
});

// Candidate 3: gameplay actions and goals cannot be half committed by late failures.
test('late activity RNG error rolls back prior health and action changes',()=>{
 const game=actionGame('cycle97-activity-rng');
 game.rng.fork=()=>({int:(()=>{let count=0;return ()=>{if(++count===2)throw new Error('second draw failed');return 2;};})()});
 unchanged(game,()=>game.performActivity('exercise'),/second draw failed/);
});

test('activity history failure rolls back a completed action and memory',()=>{
 const game=actionGame('cycle97-activity-history');
 game.state.history=null;
 unchanged(game,()=>game.performActivity('hobby'),/push/);
});

test('life goal history failure restores selected goal and primary stats',()=>{
 const game=actionGame('cycle97-goal-history');
 game.state.history=null;
 unchanged(game,()=>game.setLifeGoal('wellbeing'),/push/);
});

test('life action history failure restores goal progress and action credit',()=>{
 const game=actionGame('cycle97-life-action-history');
 game.setLifeGoal('wellbeing');
 game.state.history=null;
 unchanged(game,()=>game.performLifeAction('focus-goal'),/push/);
});

test('successful action and goal still commit their normal effects',()=>{
 const game=actionGame('cycle97-action-success');
 const oldHealth=game.state.player.health.current;
 game.setLifeGoal('wellbeing');
 game.performLifeAction('focus-goal');
 game.performActivity('exercise');
 assert.equal(game.state.actions.remaining,1);
 assert.equal(game.state.lifeGoals.active.focusYears,1);
 assert.ok(game.state.player.health.current>=oldHealth);
 assert.equal(game.state.history.at(-1).kind,'activity');
});
