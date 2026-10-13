import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {processChildDevelopmentYear} from '../src/family/child_development_system.js';
import {processWorldYear,createWorldState} from '../src/world/world_state.js';
import {processRelationshipDepthYear,ensureRelationshipDepth} from '../src/social/relationship_depth.js';

const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},next(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const child=(id,age=16)=>({id,name:id,age,alive:true,relationship:75,personality:{discipline:70,sociability:65,ambition:75},parenting:{involvement:75,stability:75,emotionalSecurity:80,conflict:5,accumulatedSupport:15}});
const friend=(id,alive=true)=>({id,name:id,alive,age:40,relationship:75,closeFriend:true,yearsKnown:5,lastContactAge:39});
const partner=(id,alive=true)=>({id,name:id,alive,relationship:70,relationshipTension:15,preferences:{parenthoodDesire:55,hometownAttachment:45,riskTolerance:50}});
function state(seed){const s=new Game(seed).state;s.year=2080;s.player.age=40;s.children=[];s.social.romance=null;s.social.friends=[];s.healthProfile={stress:75,fitness:50,conditions:[]};return s;}

// Child development is independently callable after child aging.
test('child development cannot change goals, metrics or events twice in one year',()=>{
 const s=state('child-development-once');s.children=[child('c1',16)];
 const first=processChildDevelopmentYear(s,new RNG('first'));
 assert.ok(first.length>0);
 const before=structuredClone(s);
 assert.deepEqual(processChildDevelopmentYear(s,noRng),[]);
 assert.deepEqual(s,before);
});
test('child development rejects backward years atomically for multiple children',()=>{
 const s=state('child-development-back');s.children=[child('first'),child('second')];
 s.children[1].development={confidence:50,lastProcessedYear:2081};
 const before=structuredClone(s);
 assert.throws(()=>processChildDevelopmentYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('new child can develop in a previously processed year without replaying siblings',()=>{
 const s=state('child-development-new');s.children=[child('first',14)];
 processChildDevelopmentYear(s,new RNG('first'));
 const before=structuredClone(s.children[0]);
 s.children.push(child('new',18));
 const entries=processChildDevelopmentYear(s,new RNG('second'));
 assert.deepEqual(s.children[0],before);
 assert.equal(s.children[1].development.lastProcessedYear,2080);
 assert.equal(s.children[1].educationPlan!==undefined,true);
 assert.ok(entries.length>0);
});
test('child development marker survives save, advances a year, and supports legacy children',()=>{
 const g=new Game('child-development-save');g.state.year=2080;g.state.player.age=40;g.state.children=[child('first',16)];
 processChildDevelopmentYear(g.state,new RNG('initial'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processChildDevelopmentYear(restored.state,noRng),[]);
 restored.state.year++;
 processChildDevelopmentYear(restored.state,new RNG('next'));
 assert.equal(restored.state.children[0].development.lastProcessedYear,2081);
 delete restored.state.children[0].development.lastProcessedYear;
 processChildDevelopmentYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.children[0].development.lastProcessedYear,2081);
});

test('world economy does not compound indices or consume RNG on replay',()=>{
 const s=state('world-once');s.world=createWorldState(2026);
 processWorldYear(s,new RNG('macro-first'));
 const before=structuredClone(s);
 assert.deepEqual(processWorldYear(s,noRng),[]);
 assert.deepEqual(s,before);
});
test('world economy refuses backward year before any mutation',()=>{
 const s=state('world-back');s.world=createWorldState(2026);
 processWorldYear(s,new RNG('macro-first'));
 s.year--;
 const before=structuredClone(s);
 assert.throws(()=>processWorldYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('world year survives save, advances a year, and accepts legacy world data',()=>{
 const g=new Game('world-save');g.state.year=2080;
 processWorldYear(g.state,new RNG('macro-first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processWorldYear(restored.state,noRng),[]);
 restored.state.year++;
 processWorldYear(restored.state,new RNG('macro-next'));
 assert.equal(restored.state.world.lastProcessedYear,2081);
 delete restored.state.world.lastProcessedYear;
 processWorldYear(restored.state,new RNG('macro-legacy'));
 assert.equal(restored.state.world.lastProcessedYear,2081);
});

test('relationship depth skips deceased partner and friends including initialization',()=>{
 const s=state('relationship-dead');s.social.romance=partner('dead-partner',false);s.social.friends=[friend('dead-friend',false)];
 const before=structuredClone(s);
 assert.deepEqual(processRelationshipDepthYear(s,noRng),[]);
 assert.deepEqual(s,before);
 ensureRelationshipDepth(s);
 assert.deepEqual(s,before);
});
test('relationship depth processes living friends without changing deceased contacts',()=>{
 const s=state('relationship-mixed');s.social.friends=[friend('dead',false),friend('living')];
 const deadBefore=structuredClone(s.social.friends[0]);
 processRelationshipDepthYear(s,new RNG('mixed'));
 assert.deepEqual(s.social.friends[0],deadBefore);
 assert.equal(s.social.friends[1].lastDepthProcessedYear,2080);
});
test('relationship depth cannot replay a partner or friend in the same year',()=>{
 const s=state('relationship-once');s.social.romance=partner('living');s.social.friends=[friend('living')];
 processRelationshipDepthYear(s,new RNG('first'));
 const before=structuredClone(s);
 assert.deepEqual(processRelationshipDepthYear(s,noRng),[]);
 assert.deepEqual(s,before);
});
test('new friends and partners may join a processed year without replaying existing friends',()=>{
 const s=state('relationship-new');s.social.friends=[friend('first')];
 processRelationshipDepthYear(s,new RNG('first'));
 const before=structuredClone(s.social.friends[0]);
 s.social.friends.push(friend('second'));s.social.romance=partner('new-partner');
 processRelationshipDepthYear(s,new RNG('second'));
 assert.deepEqual(s.social.friends[0],before);
 assert.equal(s.social.friends[1].lastDepthProcessedYear,2080);
 assert.equal(s.social.romance.lastDepthProcessedYear,2080);
});
test('relationship depth rejects backward years before initializing any participant',()=>{
 const s=state('relationship-back');s.social.romance=partner('new-partner');s.social.friends=[friend('first'),friend('second')];
 s.social.friends[1].lastDepthProcessedYear=2081;
 const before=structuredClone(s);
 assert.throws(()=>processRelationshipDepthYear(s,noRng),/earlier year/);
 assert.deepEqual(s,before);
});
test('relationship depth marker survives save and supports older records',()=>{
 const g=new Game('relationship-save');g.state.year=2080;g.state.player.age=40;
 g.state.social.friends=[friend('first')];g.state.social.romance=partner('partner');
 processRelationshipDepthYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(processRelationshipDepthYear(restored.state,noRng),[]);
 restored.state.year++;
 processRelationshipDepthYear(restored.state,new RNG('next'));
 assert.equal(restored.state.social.friends[0].lastDepthProcessedYear,2081);
 delete restored.state.social.friends[0].lastDepthProcessedYear;
 processRelationshipDepthYear(restored.state,new RNG('legacy'));
 assert.equal(restored.state.social.friends[0].lastDepthProcessedYear,2081);
});

test('deceased minors do not create relationship parenting pressure',()=>{
 const a=state('relationship-parent-pressure');a.social.romance=partner('partner');
 const b=structuredClone(a);a.children=[{id:'lost-child',age:9,alive:false}];
 const first=processRelationshipDepthYear(a,new RNG('same-pressure'));
 const second=processRelationshipDepthYear(b,new RNG('same-pressure'));
 assert.deepEqual(first,second);
 assert.deepEqual(a.social.romance,b.social.romance);
});
test('legacy friends without an alive flag continue annual relationship processing',()=>{
 const s=state('relationship-legacy');s.social.friends=[friend('legacy')];
 delete s.social.friends[0].alive;
 processRelationshipDepthYear(s,new RNG('legacy'));
 assert.equal(s.social.friends[0].lastDepthProcessedYear,2080);
 assert.ok(Number.isFinite(s.social.friends[0].trust));
});
