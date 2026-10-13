import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processAdultYear} from '../src/life/adult_simulation.js';
import {processFamilyYear} from '../src/family/family_simulation.js';
import {attemptChild,parenthoodReadiness} from '../src/family/parenting_system.js';

const noRng={chance:()=>false,int:()=>0,fork(){return this;}};
const forbidRng={chance(){throw Error('RNG consumed');},int(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};

function adultState(seed){
 const state=new Game(seed).state;
 state.player.age=28;
 state.year=2054;
 return state;
}

test('adult year replay never recharges finance or modifies annual state',()=>{
 const state=adultState('adult-year-once');
 processAdultYear(state,new RNG('adult-year-first'));
 assert.equal(state.lastAdultProcessedYear,2054);
 const after=structuredClone(state);
 assert.deepEqual(processAdultYear(state,forbidRng),[]);
 assert.deepEqual(state,after);
});

test('adult year refuses backward calendar time without side effects',()=>{
 const state=adultState('adult-year-order');
 processAdultYear(state,new RNG('adult-year-first'));
 state.year--;
 const before=structuredClone(state);
 assert.throws(()=>processAdultYear(state,forbidRng),/earlier year/);
 assert.deepEqual(state,before);
});

test('adult annual marker survives save/restore and new year is processable',()=>{
 const game=new Game('adult-save');
 game.state.player.age=30;game.state.year=2056;
 processAdultYear(game.state,new RNG('adult-save-first'));
 const restored=Game.fromSave(serializeGame(game));
 const before=structuredClone(restored.state);
 assert.deepEqual(processAdultYear(restored.state,forbidRng),[]);
 assert.deepEqual(restored.state,before);
 restored.state.year++;
 restored.state.player.age++;
 processAdultYear(restored.state,new RNG('adult-save-next'));
 assert.equal(restored.state.lastAdultProcessedYear,2057);
});

test('family year cannot repeat sibling health, births, or mortality RNG',()=>{
 const state=new Game('family-once').state;
 state.year=2060;
 const sibling=state.siblings[0]??structuredClone(state.player);
 sibling.id='sibling-guard';sibling.alive=true;sibling.age=50;
 sibling.health={current:80};
 state.siblings=[sibling];
 processFamilyYear(state,new RNG('family-first'));
 assert.equal(state.lastFamilyProcessedYear,2060);
 const after=structuredClone(state);
 assert.deepEqual(processFamilyYear(state,forbidRng),[]);
 assert.deepEqual(state,after);
 state.year--;
 const backward=structuredClone(state);
 assert.throws(()=>processFamilyYear(state,forbidRng),/earlier year/);
 assert.deepEqual(state,backward);
});

test('family marker survives save and legacy state processes next year',()=>{
 const game=new Game('family-save');
 game.state.year=2030;
 processFamilyYear(game.state,new RNG('family-save-first'));
 const restored=Game.fromSave(serializeGame(game));
 assert.deepEqual(processFamilyYear(restored.state,forbidRng),[]);
 restored.state.year++;
 processFamilyYear(restored.state,new RNG('family-save-next'));
 assert.equal(restored.state.lastFamilyProcessedYear,2031);
 const legacy=new Game('family-legacy').state;
 delete legacy.lastFamilyProcessedYear;
 processFamilyYear(legacy,new RNG('family-legacy'));
 assert.equal(legacy.lastFamilyProcessedYear,legacy.year);
});

function parentState(seed){
 const state=adultState(seed);
 state.player.age=30;
 state.social.romance={id:'partner',alive:true,status:'married',age:29,
  preferences:{parenthoodDesire:85},relationship:85,relationshipTension:5,yearsTogether:4,monthlyIncome:75000};
 state.preferences={parenthoodDesire:85};
 state.children=[];
 return state;
}

test('deceased children do not reduce parenting readiness',()=>{
 const a=parentState('readiness-empty');
 const b=structuredClone(a);
 b.children=[{id:'dead-1',alive:false},{id:'dead-2',alive:false},{id:'dead-3',alive:false}];
 assert.equal(parenthoodReadiness(b),parenthoodReadiness(a));
});

test('three deceased children do not block a new parenthood attempt',()=>{
 const state=parentState('parenthood-deceased');
 state.children=Array.from({length:3},(_,i)=>({id:'dead-'+i,alive:false}));
 let rolls=0;
 const rng={chance(){rolls++;return false;},fork(){return this;}};
 assert.equal(attemptChild(state,rng),null);
 assert.equal(rolls,1);
 assert.ok(state.lastParenthoodAttempt.chance>0);
 assert.equal(state.lastParenthoodAttempt.reason,undefined);
});

test('new child can be born after three deceased children without ID collision',()=>{
 const state=parentState('parenthood-after-loss');
 state.social.romance.appearance=structuredClone(state.player.appearance);
 state.social.romance.health=structuredClone(state.player.health);
 state.children=Array.from({length:3},(_,i)=>({id:'child-'+state.year+'-'+i,alive:false}));
 const rng=new RNG('parenthood-after-loss');
 rng.chance=()=>true;
 const newborn=attemptChild(state,rng);
 assert.ok(newborn);
 assert.equal(newborn.id,'child-'+state.year+'-3');
 assert.equal(state.children.length,4);
 assert.equal(state.children.filter(c=>c.alive!==false).length,1);
 assert.equal(state.lastParenthoodAttempt.success,true);
});

test('living and legacy children still count toward the three-child limit',()=>{
 const state=parentState('parenthood-limit');
 state.children=[{id:'living',alive:true},{id:'legacy'},{id:'living2',alive:true},{id:'dead',alive:false}];
 assert.equal(attemptChild(state,forbidRng),null);
 assert.equal(state.lastParenthoodAttempt.reason,'not-eligible');
});
