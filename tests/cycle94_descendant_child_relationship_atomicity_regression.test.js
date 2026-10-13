import test from 'node:test';
import assert from 'node:assert/strict';
import {processDescendantLives} from '../src/family/descendant_life_system.js';
import {processChildDevelopmentYear} from '../src/family/child_development_system.js';
import {processRelationshipDepthYear} from '../src/social/relationship_depth.js';

function child(id,age=30){return {id,name:id,age,alive:true,relationship:75,
 health:{current:80},personality:{curiosity:65,discipline:65,sociability:65,ambition:65},
 parenting:{involvement:70,emotionalSecurity:70,stability:70,conflict:5,accumulatedSupport:10}};}
function descendantState(){const first=child('first'),second=child('second');
 for(const c of [first,second])c.adultLife={initialized:true,partnered:true,children:0};
 return {year:2080,player:{age:60},children:[first,second],grandchildren:2};}
function developmentState(){return {year:2080,player:{age:42},children:[child('first',16),child('second',16)]};}
function relationshipState(){return {year:2080,player:{age:40},healthProfile:{stress:80},
 social:{romance:{id:'partner',name:'Partner',alive:true,relationship:75,relationshipTension:20},
 friends:[{id:'first',name:'First',alive:true,relationship:80,yearsKnown:5,closeFriend:true,lastContactAge:40},
 {id:'second',name:'Second',alive:true,relationship:70,yearsKnown:4,lastContactAge:40}]}};}
function checkpointRng(failAt=Infinity){return {position:0,failAt,
 snapshotState(){return this.position;},restoreState(token){this.position=token;},
 draw(){this.position++;if(this.position===this.failAt)throw Error('injected draw failure');},
 int(){this.draw();return 0;},chance(){this.draw();return true;},fork(){return this;}};}
function assertGraphIdentity(state,refs){for(const [read,ref] of refs)assert.strictEqual(read(),ref);}

test('descendant year rolls back first grandchild and both child graphs when later RNG throws',()=>{
 const s=descendantState(),before=structuredClone(s),rng=checkpointRng(3);
 const refs=[[()=>s.children,s.children],[()=>s.children[0],s.children[0]],
 [()=>s.children[0].adultLife,s.children[0].adultLife],[()=>s.children[1].adultLife,s.children[1].adultLife]];
 assert.throws(()=>processDescendantLives(s,rng),/injected draw/);
 assert.deepEqual(s,before);assert.equal(rng.position,0);assertGraphIdentity(s,refs);
});
test('descendant year refuses unsafe grandchild counter before RNG or mutations',()=>{
 const s=descendantState();s.grandchildren=Number.MAX_SAFE_INTEGER;
 const before=structuredClone(s),rng={fork(){throw Error('RNG should not be consumed');}};
 assert.throws(()=>processDescendantLives(s,rng),/grandchildren|counter|overflow/i);
 assert.deepEqual(s,before);
});
test('descendant year commits successfully and replay skips checkpoint and draws',()=>{
 const s=descendantState(),rng=checkpointRng();
 processDescendantLives(s,rng);assert.equal(s.grandchildren,4);
 const before=structuredClone(s),position=rng.position;
 rng.snapshotState=()=>{throw Error('checkpoint on replay');};
 assert.deepEqual(processDescendantLives(s,rng),[]);assert.deepEqual(s,before);assert.equal(rng.position,position);
});

test('child development rolls back first sibling goals and milestones when second RNG throws',()=>{
 const s=developmentState(),before=structuredClone(s),rng=checkpointRng(5);
 const refs=[[()=>s.children,s.children],[()=>s.children[0],s.children[0]],
 [()=>s.children[1],s.children[1]]];
 assert.throws(()=>processChildDevelopmentYear(s,rng),/injected draw/);
 assert.deepEqual(s,before);assert.equal(rng.position,0);assertGraphIdentity(s,refs);
});
test('child development rejects malformed later milestones before any RNG draw',()=>{
 const s=developmentState();s.children[1].development={milestones:'corrupt',lastStage:'early'};
 const before=structuredClone(s);
 assert.throws(()=>processChildDevelopmentYear(s,{fork(){throw Error('RNG consumed');}}),/milestone|development/i);
 assert.deepEqual(s,before);
});
test('child development supports partially populated legacy milestones and replay',()=>{
 const s=developmentState();s.children=[child('legacy',16)];
 s.children[0].development={confidence:55};const rng=checkpointRng();
 assert.doesNotThrow(()=>processChildDevelopmentYear(s,rng));
 assert.ok(Array.isArray(s.children[0].development.milestones));
 const before=structuredClone(s);rng.snapshotState=()=>{throw Error('checkpoint on replay');};
 assert.deepEqual(processChildDevelopmentYear(s,rng),[]);assert.deepEqual(s,before);
});

test('relationship depth restores partner, earlier friend, stress and RNG on later failure',()=>{
 const s=relationshipState(),before=structuredClone(s),rng=checkpointRng(9);
 const refs=[[()=>s.social,s.social],[()=>s.social.romance,s.social.romance],
 [()=>s.social.friends,s.social.friends],[()=>s.social.friends[0],s.social.friends[0]],
 [()=>s.healthProfile,s.healthProfile]];
 assert.throws(()=>processRelationshipDepthYear(s,rng),/injected draw/);
 assert.deepEqual(s,before);assert.equal(rng.position,0);assertGraphIdentity(s,refs);
});
test('relationship depth rejects overflowing later friend history before partner draw',()=>{
 const s=relationshipState();s.social.friends[1].sharedHistory=Number.MAX_SAFE_INTEGER;
 const before=structuredClone(s);
 assert.throws(()=>processRelationshipDepthYear(s,{int(){throw Error('RNG consumed');}}),/sharedHistory|overflow|counter/i);
 assert.deepEqual(s,before);
});
test('relationship depth commits year and skips RNG checkpoint on replay',()=>{
 const s=relationshipState(),rng=checkpointRng();processRelationshipDepthYear(s,rng);
 assert.equal(s.social.romance.lastDepthProcessedYear,2080);
 const before=structuredClone(s),position=rng.position;
 rng.snapshotState=()=>{throw Error('checkpoint on replay');};
 assert.deepEqual(processRelationshipDepthYear(s,rng),[]);assert.deepEqual(s,before);assert.equal(rng.position,position);
});


test('descendant rollback removes newly created grandchildren field after failure',()=>{
 const s=descendantState();delete s.grandchildren;
 const before=structuredClone(s),rng=checkpointRng(3);
 assert.throws(()=>processDescendantLives(s,rng),/injected draw/);
 assert.deepEqual(s,before);assert.equal(Object.hasOwn(s,'grandchildren'),false);
});
test('relationship depth rejects overflowing legacy yearsKnown fallback',()=>{
 const s=relationshipState();s.social.friends[1].yearsKnown=Number.MAX_SAFE_INTEGER;
 const before=structuredClone(s);
 assert.throws(()=>processRelationshipDepthYear(s,{int(){throw Error('RNG consumed');}}),/sharedHistory/i);
 assert.deepEqual(s,before);
});
test('new annual checkpoints reject incomplete custom RNG protocol without mutation',()=>{
 for(const [run,state] of [[processDescendantLives,descendantState()],
  [processChildDevelopmentYear,developmentState()],[processRelationshipDepthYear,relationshipState()]]){
  const before=structuredClone(state),rng={snapshotState(){return 0;},int(){throw Error('draw');},fork(){throw Error('fork');}};
  assert.throws(()=>run(state,rng),/checkpoint/i);assert.deepEqual(state,before);
 }
});
test('new annual processors never mutate state if RNG snapshot itself fails',()=>{
 for(const [run,state] of [[processDescendantLives,descendantState()],
  [processChildDevelopmentYear,developmentState()],[processRelationshipDepthYear,relationshipState()]]){
  const before=structuredClone(state),rng={snapshotState(){throw Error('snapshot failed');},restoreState(){}};
  assert.throws(()=>run(state,rng),/snapshot failed/);assert.deepEqual(state,before);
 }
});

test('descendant rollback preserves legacy null and own undefined grandchild fields',()=>{
 for(const original of [null,undefined]){
  const s=descendantState();s.grandchildren=original;
  const before=structuredClone(s),rng=checkpointRng(3);
  assert.throws(()=>processDescendantLives(s,rng),/injected draw/);
  assert.deepEqual(s,before);assert.equal(Object.hasOwn(s,'grandchildren'),true);
 }
});
