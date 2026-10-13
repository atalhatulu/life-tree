import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processChildrenYear} from '../src/family/parenting_system.js';
import {processDescendantLives} from '../src/family/descendant_life_system.js';
import {processLateLifeYear} from '../src/life/late_age_system.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
function stateFor(seed,age=65){
 const state=new Game(seed).state;
 state.player.age=age;
 state.year=2080;
 state.children=[];
 state.social.romance=null;
 state.social.friends=[];
 state.healthProfile={fitness:60,stress:30,conditions:[]};
 return state;
}
function child(id,age=20){
 return {id,name:id,age,alive:true,relationship:80,health:{current:80},personality:{curiosity:70,discipline:70,sociability:70,ambition:70},parenting:{involvement:60,stability:70,emotionalSecurity:75,conflict:5,accumulatedSupport:2}};
}

test('child annual processing never ages the same child or changes expenses twice',()=>{
 const s=stateFor('annual-child-once',40);
 s.children=[child('child-1',17)];
 s.finance={childMonthlyCost:0};
 const entries=processChildrenYear(s,new RNG('child-first'));
 assert.equal(s.children[0].age,18);
 assert.ok(entries.some(e=>e.text.includes('yetişkinliğe')));
 assert.equal(s.lastChildrenProcessedYear,2080);
 const after=structuredClone(s);
 assert.deepEqual(processChildrenYear(s,noRng),[]);
 assert.deepEqual(s,after);
});

test('child annual processing refuses backward year without mutations',()=>{
 const s=stateFor('annual-child-back',40);
 s.children=[child('child-1',8)];
 processChildrenYear(s,new RNG('child-first'));
 s.year=2079;
 const before=structuredClone(s);
 assert.throws(()=>processChildrenYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});

test('child annual marker persists across save, legacy records and next year work',()=>{
 const g=new Game('annual-child-save');
 g.state.year=2080;
 g.state.children=[child('child-1',7)];
 processChildrenYear(g.state,new RNG('child-first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processChildrenYear(restored.state,noRng),[]);
 restored.state.year++;
 processChildrenYear(restored.state,new RNG('child-next'));
 assert.equal(restored.state.children[0].age,9);
 assert.equal(restored.state.lastChildrenProcessedYear,2081);
 delete restored.state.lastChildrenProcessedYear;
 processChildrenYear(restored.state,new RNG('child-legacy'));
 assert.equal(restored.state.lastChildrenProcessedYear,2081);
});

test('descendant annual processing cannot create grandchildren twice',()=>{
 const s=stateFor('annual-descendant-once');
 const c=child('adult-child',30);
 c.adultLife={initialized:true,partnered:true,children:0};
 s.children=[c];
 const always={fork(){return this;},chance(){return true;},int(){return 0;}};
 const entries=processDescendantLives(s,always);
 assert.equal(s.grandchildren,1);
 assert.equal(c.adultLife.children,1);
 assert.equal(entries.filter(e=>e.text.includes('çocuk sahibi oldu')).length,1);
 assert.equal(c.adultLife.lastProcessedYear,2080);
 const after=structuredClone(s);
 assert.deepEqual(processDescendantLives(s,noRng),[]);
 assert.deepEqual(s,after);
});

test('descendant annual processing rejects backward time and processes new years',()=>{
 const s=stateFor('annual-descendant-back');
 const c=child('adult-child',30);
 c.adultLife={initialized:true,partnered:true,children:0};
 s.children=[c];
 const always={fork(){return this;},chance(){return true;},int(){return 0;}};
 processDescendantLives(s,always);
 s.year--;
 const before=structuredClone(s);
 assert.throws(()=>processDescendantLives(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
 s.year+=2;
 processDescendantLives(s,always);
 assert.equal(s.grandchildren,2);
 assert.equal(c.adultLife.lastProcessedYear,2081);
});

test('descendant annual marker persists through save and legacy states remain processable',()=>{
 const g=new Game('annual-descendant-save');
 g.state.year=2080;
 g.state.children=[child('adult-child',23)];
 processDescendantLives(g.state,new RNG('desc-first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processDescendantLives(restored.state,noRng),[]);
 restored.state.year++;
 processDescendantLives(restored.state,new RNG('desc-next'));
 assert.equal(restored.state.children[0].adultLife.lastProcessedYear,2081);
 delete restored.state.children[0].adultLife.lastProcessedYear;
 processDescendantLives(restored.state,new RNG('desc-legacy'));
 assert.equal(restored.state.children[0].adultLife.lastProcessedYear,2081);
});

test('new adult descendant can join the same year without replaying an existing child',()=>{
 const s=stateFor('annual-descendant-added');
 const first=child('first',30);
 first.adultLife={initialized:true,partnered:true,children:0};
 s.children=[first];
 const always={fork(){return this;},chance(){return true;},int(){return 0;}};
 processDescendantLives(s,always);
 const before=structuredClone(first);
 const added=child('added',30);
 added.adultLife={initialized:true,partnered:true,children:0};
 s.children.push(added);
 const entries=processDescendantLives(s,always);
 assert.deepEqual(first,before);
 assert.equal(added.adultLife.children,1);
 assert.equal(s.grandchildren,2);
 assert.equal(entries.length,1);
});

test('descendant backward guard validates every child before changing any',()=>{
 const s=stateFor('annual-descendant-mixed-backward');
 const first=child('first',30);
 first.adultLife={initialized:true,partnered:true,children:0};
 const second=child('second',30);
 second.adultLife={initialized:true,partnered:true,children:0,lastProcessedYear:2081};
 s.children=[first,second];
 const before=structuredClone(s);
 assert.throws(()=>processDescendantLives(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});

test('late-life annual processing cannot wear mobility or change stress twice',()=>{
 const s=stateFor('annual-late-once',82);
 s.lateLife={mobility:60,isolation:45,careNeed:false,careMode:null};
 s.retirement={retired:true};
 const entries=processLateLifeYear(s,{int:()=>-2,chance:()=>false});
 assert.deepEqual(entries,[]);
 assert.equal(s.lateLife.lastProcessedYear,2080);
 const after=structuredClone(s);
 assert.deepEqual(processLateLifeYear(s,noRng),[]);
 assert.deepEqual(s,after);
});

test('late-life annual processing refuses earlier years without effects',()=>{
 const s=stateFor('annual-late-back',78);
 processLateLifeYear(s,{int:()=>0,chance:()=>false});
 s.year--;
 const before=structuredClone(s);
 assert.throws(()=>processLateLifeYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});

test('late-life annual marker survives save, permits new year and legacy record',()=>{
 const g=new Game('annual-late-save');
 g.state.player.age=77;
 g.state.year=2080;
 processLateLifeYear(g.state,{int:()=>0,chance:()=>false});
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processLateLifeYear(restored.state,noRng),[]);
 restored.state.year++;
 restored.state.player.age++;
 processLateLifeYear(restored.state,{int:()=>0,chance:()=>false});
 assert.equal(restored.state.lateLife.lastProcessedYear,2081);
 delete restored.state.lateLife.lastProcessedYear;
 processLateLifeYear(restored.state,{int:()=>0,chance:()=>false});
 assert.equal(restored.state.lateLife.lastProcessedYear,2081);
});

test('under-60 late-life call is inert and does not poison future processing',()=>{
 const s=stateFor('annual-late-young',59);
 assert.deepEqual(processLateLifeYear(s,noRng),[]);
 assert.equal(s.lateLife,undefined);
 s.player.age=60;
 assert.deepEqual(processLateLifeYear(s,{int:()=>0,chance:()=>false}),[]);
 assert.equal(s.lateLife.lastProcessedYear,2080);
});
