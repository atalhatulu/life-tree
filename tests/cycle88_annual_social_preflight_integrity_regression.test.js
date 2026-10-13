import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processSocialYear} from '../src/social/social_simulation.js';

const noRng={int:()=>0,chance:()=>false,fork(){return this;}};
const trapRng={int(){throw Error('RNG was consumed');},chance(){throw Error('RNG was consumed');},fork(){throw Error('RNG was consumed');}};
function friend(id='friend-a'){
 return {id,name:id,surname:'Y',alive:true,age:30,yearsKnown:5,lastContactAge:34,relationship:75,health:{current:80}};
}
function state(seed='social-88'){
 const s=new Game(seed).state;s.year=2061;s.player.age=35;s.player.personality.sociability=60;
 s.social.friends=[friend('a'),friend('b')];return s;
}
function unchanged(s,expected=/Invalid|Geçersiz|overflow|duplicate/i){
 const before=structuredClone(s);
 assert.throws(()=>processSocialYear(s,trapRng),expected);
 assert.deepEqual(s,before);
}

test('annual social preflight rejects malformed late friend fields before aging the first friend',()=>{
 for(const [field,value] of [
  ['age',Number.MAX_SAFE_INTEGER],['age',NaN],['age','30'],['yearsKnown',Number.MAX_SAFE_INTEGER],
  ['yearsKnown',-1],['lastContactAge',36],['lastContactAge','34'],
  ['relationship',Infinity],['relationship',101],['relationship',undefined]
 ]){
  const s=state('friend-'+field+String(value));s.social.friends[1][field]=value;unchanged(s);
 }
});
test('annual social preflight validates every living friend health record atomically',()=>{
 for(const health of [null,'unhealthy',[],{current:NaN},{current:101},{current:'75'}]){
  const s=state('health-'+String(health));s.social.friends[1].health=health;unchanged(s);
 }
});
test('annual social preflight rejects malformed friend containers and entries',()=>{
 for(const friends of [null,{},'friends',[friend('a'),null],[friend('a'),friend('a')]]){
  const s=state('collection');s.social.friends=friends;unchanged(s);
 }
});
test('annual social preflight rejects malformed archive arrays and entries',()=>{
 for(const field of ['deceasedFriends','formerFriends']){
  for(const value of [false,{},[null],[{id:'ok'},'invalid']]){
   const s=state('archive-'+field);s.social[field]=value;unchanged(s);
  }
 }
});
test('annual social preflight rejects invalid death side-effect ledgers before friend updates',()=>{
 for(const [field,value] of [
  ['healthProfile',{stress:NaN}],['healthProfile',{stress:'30'}],['healthProfile','invalid'],
  ['lateLife',{isolation:Infinity}],['lateLife',{isolation:-2}],['lateLife',[]]
 ]){
  const s=state('side-'+field);s[field]=value;unchanged(s);
 }
});
test('annual social preflight rejects invalid sociability and friend creation counters',()=>{
 for(const value of [NaN,'50',-1,101]){
  const s=state('social-sociability');s.player.personality.sociability=value;unchanged(s);
 }
 for(const value of [-1,1.2,NaN,Number.MAX_SAFE_INTEGER,'3']){
  const s=state('social-counter');s.social.friendsCreated=value;unchanged(s);
 }
});
test('annual social preflight rejects a generated ID collision without RNG or state changes',()=>{
 const s=state('social-duplicate-id');s.social.friends[1].id='friend-2061-1';
 unchanged(s,/duplicate|Invalid/i);
});
test('annual social preflight rejects duplicate existing IDs before mutation',()=>{
 const s=state('social-existing-id');s.social.friends[1].id='a';unchanged(s);
});
test('annual social preflight rejects a malformed social ledger before initialization',()=>{
 const s=state('social-ledger');s.social='broken';unchanged(s);
});
test('valid legacy optional social fields remain supported',()=>{
 const s=state('social-legacy');delete s.social.friends[0].yearsKnown;
 delete s.social.friends[0].health;delete s.social.friends[0].lastContactAge;
 delete s.social.friendsCreated;s.social.deceasedFriends=[{id:'dead',alive:false}];
 processSocialYear(s,noRng);
 assert.equal(s.social.friends[0].yearsKnown,1);
 assert.equal(s.social.friends[0].lastContactAge,34);
 assert.equal(s.social.lastProcessedYear,2061);
});
test('annual social replay is a read-only no-op even if current ledgers are malformed',()=>{
 const s=state('social-replay');s.social.lastProcessedYear=2061;
 s.social.friends=[null];s.player.personality.sociability=NaN;
 const before=structuredClone(s);
 assert.deepEqual(processSocialYear(s,trapRng),[]);
 assert.deepEqual(s,before);
});
test('valid annual social updates preserve normal behavior and marker',()=>{
 const s=state('social-normal');processSocialYear(s,noRng);
 assert.equal(s.social.friends[0].age,31);
 assert.equal(s.social.friends[0].yearsKnown,6);
 assert.equal(s.social.lastProcessedYear,2061);
});
test('a friend death uses finite legacy defaults for missing stress and isolation',()=>{
 const s=state('social-death-defaults');
 s.healthProfile={};s.lateLife={};
 const rng={int:()=>0,chance:()=>false,fork(label){return {int:()=>0,chance:()=>label.startsWith('death-')};}};
 processSocialYear(s,rng);
 assert.equal(s.healthProfile.stress,38);
 assert.equal(s.lateLife.isolation,10);
 assert.equal(s.social.deceasedFriends.length,2);
 assert.equal(s.social.friends.length,0);
});
