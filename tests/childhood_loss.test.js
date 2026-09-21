import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processElderFamilyYear} from '../src/family/elder_system.js';
import {releaseTrustFund} from '../src/finance/trust_fund.js';

function forceOldParents(g){
 g.state.player.age=10;
 g.state.year=2036;
 for(const parent of [g.state.parents.mother,g.state.parents.father]){
  parent.age=100;
  parent.health.current=0;
 }
}

test('parent death reduces household income and size',()=>{
 const g=new Game('single-parent-loss');
 g.state.player.age=12;
 g.state.year=2038;
 const mother=g.state.parents.mother;
 mother.age=100;
 mother.health.current=0;
 const income=g.state.household.monthlyIncome;
 const people=g.state.household.people;

 for(let i=0;i<80&&mother.alive;i++){
  processElderFamilyYear(g.state,new RNG('single-parent-loss-'+i));
 }
 assert.equal(mother.alive,false);
 assert.ok(g.state.household.monthlyIncome<=income);
 assert.equal(g.state.household.people,people-1);
});

test('orphaned minor receives a guardian',()=>{
 const g=new Game('orphan-guardian');
 forceOldParents(g);
 for(let i=0;i<120&&(g.state.parents.mother.alive||g.state.parents.father.alive);i++){
  processElderFamilyYear(g.state,new RNG('orphan-guardian-'+i));
 }
 assert.equal(g.state.parents.mother.alive,false);
 assert.equal(g.state.parents.father.alive,false);
 assert.ok(g.state.guardianship);
 assert.ok(['family','state-care'].includes(g.state.guardianship.type));
});

test('minor inheritance stays locked until adulthood',()=>{
 const g=new Game('minor-trust');
 forceOldParents(g);
 for(let i=0;i<120&&(g.state.parents.mother.alive||g.state.parents.father.alive);i++){
  processElderFamilyYear(g.state,new RNG('minor-trust-'+i));
 }
 assert.ok(g.state.trustFund);
 assert.equal(g.state.trustFund.released,false);
 const balance=g.state.trustFund.balance;
 assert.ok(balance>=0);

 g.state.player.age=17;
 assert.equal(releaseTrustFund(g.state).length,0);
 g.state.player.age=18;
 const entries=releaseTrustFund(g.state);
 assert.equal(g.state.trustFund.released,true);
 assert.equal(entries.length,1);
 assert.ok((g.state.finance?.cash??0)>=balance);
});
