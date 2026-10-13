import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processRomanceYear} from '../src/social/romance_system.js';
import {processPartnershipYear} from '../src/social/partnership_system.js';

const noChance={int:()=>0,chance:()=>false,fork(){return this;}};
const forbidRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
function setup(seed='annual-partner',age=35){
 const game=new Game(seed);
 game.state.player.age=age;game.state.year=2026+age;
 game.state.social.romance={id:'p1',name:'Ada',surname:'K',age:age-1,alive:true,
  status:'dating',relationship:75,relationshipTension:12,yearsTogether:1,
  personality:{sociability:60,ambition:50},health:{current:85}};
 return game;
}

test('romance annual age transition runs once and never consumes replay RNG',()=>{
 const g=setup('romance-once',17),s=g.state;
 processRomanceYear(s,noChance);
 const after=structuredClone(s.social.romance);
 assert.deepEqual(processRomanceYear(s,forbidRng),[]);
 assert.deepEqual(s.social.romance,after);
 assert.equal(after.lastRomanceProcessedYear,s.year);
 s.year++;s.player.age++;
 processRomanceYear(s,noChance);
 assert.equal(s.social.romance.age,after.age+1);
});

test('romance annual transition rejects earlier year without changes',()=>{
 const s=setup('romance-order',17).state;
 processRomanceYear(s,noChance);
 const before=structuredClone(s.social.romance);
 s.year-=1;
 assert.throws(()=>processRomanceYear(s,noChance),/earlier year/);
 assert.deepEqual(s.social.romance,before);
});

test('partnership year runs once without repeating relationship and health changes',()=>{
 const s=setup('partnership-once').state;
 processPartnershipYear(s,noChance);
 const after=structuredClone(s.social.romance);
 assert.deepEqual(processPartnershipYear(s,forbidRng),[]);
 assert.deepEqual(s.social.romance,after);
 assert.equal(after.lastPartnershipProcessedYear,s.year);
 s.year++;s.player.age++;
 processPartnershipYear(s,noChance);
 assert.equal(s.social.romance.yearsTogether,after.yearsTogether+1);
});

test('partnership year rejects out-of-order year without mutation',()=>{
 const s=setup('partnership-order').state;
 processPartnershipYear(s,noChance);
 const before=structuredClone(s.social.romance);
 s.year--;
 assert.throws(()=>processPartnershipYear(s,noChance),/earlier year/);
 assert.deepEqual(s.social.romance,before);
});

test('annual partner markers survive save and load',()=>{
 const g=setup('annual-save');
 processRomanceYear(g.state,noChance);
 processPartnershipYear(g.state,noChance);
 const restored=Game.fromSave(serializeGame(g));
 const before=structuredClone(restored.state.social.romance);
 assert.deepEqual(processRomanceYear(restored.state,forbidRng),[]);
 assert.deepEqual(processPartnershipYear(restored.state,forbidRng),[]);
 assert.deepEqual(restored.state.social.romance,before);
});

test('legacy partners without markers still run first annual transition',()=>{
 const s=setup('annual-legacy').state;
 assert.equal(s.social.romance.lastPartnershipProcessedYear,undefined);
 assert.equal(s.social.romance.lastRomanceProcessedYear,undefined);
 processRomanceYear(s,noChance);
 processPartnershipYear(s,noChance);
 assert.equal(s.social.romance.lastPartnershipProcessedYear,s.year);
 assert.equal(s.social.romance.lastRomanceProcessedYear,s.year);
});

test('deceased children do not increase annual relationship stress',()=>{
 const a=setup('dead-child-stress').state;
 const b=structuredClone(a);
 a.children=[];
 b.children=[{id:'c1',age:6,alive:false,relationship:90}];
 processPartnershipYear(a,new RNG('identical-stress'));
 processPartnershipYear(b,new RNG('identical-stress'));
 assert.deepEqual(b.social.romance,a.social.romance);
});

test('living minor children continue to contribute to annual relationship stress',()=>{
 const a=setup('living-child-stress').state;
 const b=structuredClone(a);
 a.children=[];
 b.children=[{id:'c1',age:6,alive:true}];
 // The deterministic RNG yields the same random values, so any tension difference
 // comes from the extra living-child household load.
 processPartnershipYear(a,noChance);
 processPartnershipYear(b,noChance);
 assert.ok(b.social.romance.relationshipTension>a.social.romance.relationshipTension);
});
