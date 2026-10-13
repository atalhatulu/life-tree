import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processElderFamilyYear} from '../src/family/elder_system.js';

// Force one NPC death and a deterministic estate valuation without depending
// on the unrelated random health and mortality rolls.
function deathRng(personId){
 return {
  fork(label){
   return {
    int(){return label==='inheritance-'+personId?10:0;},
    chance(){return label==='death-'+personId;}
   };
  }
 };
}

function setup(seed){
 const state=new Game(seed).state;
 state.player.age=40;
 state.year=2066;
 state.siblings=[
  {id:'living-sibling',age:35,alive:true},
  {id:'deceased-sibling',age:38,alive:false}
 ];
 state.pendingInheritance=[];
 return state;
}

test('deceased siblings do not dilute inheritance from a deceased parent',()=>{
 const state=setup('parent-inheritance-surviving-siblings');
 state.parents.mother.monthlyIncome=1000;
 state.parents.mother.age=80;
 state.parents.father.alive=true;
 processElderFamilyYear(state,deathRng('mother'));
 assert.equal(state.parents.mother.alive,false);
 // Gross 10,000; surviving spouse gets 40%; 6,000 / (player + 1 living sibling).
 assert.equal(state.pendingInheritance.length,1);
 assert.equal(state.pendingInheritance[0].amount,3000);
});

test('deceased siblings do not dilute inheritance from a deceased grandparent',()=>{
 const state=setup('grandparent-inheritance-surviving-siblings');
 state.parents.mother.alive=false;
 state.grandparents.maternal.grandmother.monthlyIncome=1000;
 state.grandparents.maternal.grandmother.age=85;
 processElderFamilyYear(state,deathRng('maternal-grandmother'));
 assert.equal(state.grandparents.maternal.grandmother.alive,false);
 // Gross 10,000; the grandchild branch receives 45%, split between living siblings + player.
 assert.equal(state.pendingInheritance.length,1);
 assert.equal(state.pendingInheritance[0].amount,2250);
});

test('only the player inherits when every sibling is deceased',()=>{
 const state=setup('parent-inheritance-no-surviving-siblings');
 state.siblings.forEach(sibling=>{sibling.alive=false;});
 state.parents.mother.monthlyIncome=1000;
 state.parents.father.alive=false;
 processElderFamilyYear(state,deathRng('mother'));
 assert.equal(state.pendingInheritance.length,1);
 assert.equal(state.pendingInheritance[0].amount,10000);
});

test('legacy sibling records without an alive flag still count as heirs',()=>{
 const state=setup('parent-inheritance-legacy-sibling');
 state.siblings=[{id:'legacy-sibling',age:35}];
 state.parents.mother.monthlyIncome=1000;
 state.parents.father.alive=false;
 processElderFamilyYear(state,deathRng('mother'));
 assert.equal(state.pendingInheritance.length,1);
 assert.equal(state.pendingInheritance[0].amount,5000);
});
