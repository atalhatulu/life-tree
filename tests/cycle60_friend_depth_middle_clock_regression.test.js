import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
import {processRelationshipDepthYear} from '../src/social/relationship_depth.js';
import {processMiddleAgeYear} from '../src/life/middle_age_system.js';

const malformed=[NaN,Infinity,-Infinity,'2080',2080.5,-1,Number.MAX_SAFE_INTEGER+1];
const noRng={int(){throw Error('RNG consumed');},chance(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
const friend=(id,alive=true)=>({id,name:id,age:40,alive,relationship:75,yearsKnown:6,closeFriend:false,personality:{sociability:65},life:{personalStress:20,workStability:55}});
function setup(){
 const s=new Game('cycle60-clock').state;
 s.year=2080;s.player.age=40;s.social.friends=[friend('first')];s.social.romance=null;
 return s;
}
function rejectedUnchanged(s,run){const before=structuredClone(s);assert.throws(()=>run(s,noRng),RangeError);assert.deepEqual(s,before);}

// 1. Friend NPC life: validate the whole living cohort before touching any NPC.
test('friend lives rejects every malformed calendar year without changes or RNG',()=>{
 for(const value of malformed){const s=setup();s.year=value;rejectedUnchanged(s,processFriendLivesYear);}
});
test('friend lives rejects every malformed stored marker without changes or RNG',()=>{
 for(const value of malformed){const s=setup();s.social.friends[0].life.lastProcessedYear=value;rejectedUnchanged(s,processFriendLivesYear);}
});
test('friend lives rejects future and malformed later friend marker atomically',()=>{
 for(const value of [2081,NaN,'2080']){
  const s=setup();s.social.friends.push(friend('second'));s.social.friends[1].life.lastProcessedYear=value;
  rejectedUnchanged(s,processFriendLivesYear);
 }
});
test('friend lives rejects invalid stored marker even without explicit calendar year',()=>{
 const s=setup();delete s.year;s.social.friends[0].life.lastProcessedYear='2080';rejectedUnchanged(s,processFriendLivesYear);
});
test('friend lives replays once, advances next year, and retains legacy age-year fallback',()=>{
 const s=setup();processFriendLivesYear(s,new RNG('friend-first'));assert.equal(s.social.friends[0].life.lastProcessedYear,2080);
 const before=structuredClone(s);assert.deepEqual(processFriendLivesYear(s,noRng),[]);assert.deepEqual(s,before);
 s.year=2081;s.player.age++;processFriendLivesYear(s,new RNG('friend-next'));assert.equal(s.social.friends[0].life.lastProcessedYear,2081);
 const legacy=setup();delete legacy.year;processFriendLivesYear(legacy,new RNG('friend-legacy'));
 assert.equal(legacy.social.friends[0].life.lastProcessedYear,2040);
});
test('friend lives ignores dead NPC markers and does not initialize dead NPCs',()=>{
 const s=setup();const dead=friend('dead',false);dead.life.lastProcessedYear='broken';s.social.friends.push(dead);
 const snapshot=structuredClone(dead);processFriendLivesYear(s,new RNG('friend-dead'));
 assert.deepEqual(dead,snapshot);
});

// 2. Relationship depth: validate partner and all living friends before initialization.
test('relationship depth rejects every malformed calendar year without changes or RNG',()=>{
 for(const value of malformed){const s=setup();s.year=value;rejectedUnchanged(s,processRelationshipDepthYear);}
});
test('relationship depth rejects every malformed partner marker without changes or RNG',()=>{
 for(const value of malformed){const s=setup();s.social.romance={name:'Ada',alive:true,relationship:70,lastDepthProcessedYear:value};rejectedUnchanged(s,processRelationshipDepthYear);}
});
test('relationship depth rejects malformed later friend markers before touching partner or first friend',()=>{
 for(const value of [2081,NaN,'2080']){
  const s=setup();s.social.romance={name:'Ada',alive:true,relationship:70};
  const second=friend('second');second.lastDepthProcessedYear=value;s.social.friends.push(second);
  rejectedUnchanged(s,processRelationshipDepthYear);
 }
});
test('relationship depth rejects malformed markers with no explicit year',()=>{
 const s=setup();delete s.year;s.social.friends[0].lastDepthProcessedYear='2080';rejectedUnchanged(s,processRelationshipDepthYear);
});
test('relationship depth replays once, advances next year, and accepts legacy yearless calls',()=>{
 const s=setup();processRelationshipDepthYear(s,new RNG('depth-first'));assert.equal(s.social.friends[0].lastDepthProcessedYear,2080);
 const before=structuredClone(s);assert.deepEqual(processRelationshipDepthYear(s,noRng),[]);assert.deepEqual(s,before);
 s.year=2081;s.player.age++;processRelationshipDepthYear(s,new RNG('depth-next'));assert.equal(s.social.friends[0].lastDepthProcessedYear,2081);
 const legacy=setup();delete legacy.year;processRelationshipDepthYear(legacy,new RNG('depth-legacy'));
 assert.equal(legacy.social.friends[0].lastDepthProcessedYear,undefined);
});
test('relationship depth ignores deceased markers',()=>{
 const s=setup();const dead=friend('dead',false);dead.lastDepthProcessedYear='broken';s.social.friends.push(dead);
 const snapshot=structuredClone(dead);processRelationshipDepthYear(s,new RNG('depth-dead'));assert.deepEqual(dead,snapshot);
});

// 3. Middle-age life: validate before creating a new middle-age record.
test('middle age rejects every malformed calendar year without initializing a record',()=>{
 for(const value of malformed){const s=setup();delete s.middleAge;s.year=value;rejectedUnchanged(s,processMiddleAgeYear);}
});
test('middle age rejects every malformed stored marker without changes or RNG',()=>{
 for(const value of malformed){const s=setup();s.middleAge={lastProcessedYear:value};rejectedUnchanged(s,processMiddleAgeYear);}
});
test('middle age rejects future marker and malformed marker without explicit year',()=>{
 const s=setup();s.middleAge={lastProcessedYear:2081};rejectedUnchanged(s,processMiddleAgeYear);
 const legacy=setup();delete legacy.year;legacy.middleAge={lastProcessedYear:'2080'};rejectedUnchanged(legacy,processMiddleAgeYear);
});
test('middle age replays once, advances next year, and accepts legacy yearless calls',()=>{
 const s=setup();processMiddleAgeYear(s,{chance:()=>false});assert.equal(s.middleAge.lastProcessedYear,2080);
 const before=structuredClone(s);assert.deepEqual(processMiddleAgeYear(s,noRng),[]);assert.deepEqual(s,before);
 s.year=2081;s.player.age++;processMiddleAgeYear(s,{chance:()=>false});assert.equal(s.middleAge.lastProcessedYear,2081);
 const legacy=setup();delete legacy.year;processMiddleAgeYear(legacy,{chance:()=>false});assert.equal(legacy.middleAge.lastProcessedYear,undefined);
});
test('middle age remains inert outside eligible ages even with invalid calendar year',()=>{
 const s=setup();s.player.age=34;s.year=NaN;const before=structuredClone(s);
 assert.deepEqual(processMiddleAgeYear(s,noRng),[]);assert.deepEqual(s,before);
});
