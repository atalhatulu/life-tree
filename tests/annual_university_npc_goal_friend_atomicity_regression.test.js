import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {serializeGame} from '../src/core/save_system.js';
import {progressUniversityYear} from '../src/education/university_system.js';
import {applyPartnerGoalAlignment} from '../src/life/npc_goal_system.js';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';

const noRng={int(){throw Error('RNG consumed on replay');},fork(){throw Error('RNG consumed on replay');}};
function university(seed='university-year'){
 const g=new Game(seed);const s=g.state;
 s.year=2075;s.player.age=21;s.player.alive=true;
 s.higherEducation={enrolled:true,completed:false,year:2,duration:4,performance:60,universityName:'Test Üniversitesi',programTitle:'Test',cityName:'Ankara'};
 return g;
}
function partner(seed='goal-alignment-year'){
 const g=new Game(seed);const s=g.state;
 s.year=2075;s.player.age=30;s.lifeGoals={active:{id:'career-mastery',progress:45},completed:[],history:[]};
 s.social.romance={id:'p1',name:'Ece',age:30,alive:true,personality:{ambition:90,sociability:35,patience:35},trust:60,sharedGoals:60,resentment:20};
 return g;
}
function friend(id,year=null){
 return {id,name:id,age:30,alive:true,relationship:60,personality:{ambition:50,sociability:50,patience:50},life:year===null?undefined:{lastProcessedYear:year,workStability:50,personalStress:25}};
}

test('university progression changes performance and year only once per calendar year',()=>{
 const g=university();const u=g.state.higherEducation;
 progressUniversityYear(g.state,new RNG('first'));assert.equal(u.year,3);
 assert.equal(u.lastProgressProcessedYear,2075);
 const snapshot=structuredClone(g.state);
 assert.deepEqual(progressUniversityYear(g.state,noRng),[]);
 assert.deepEqual(g.state,snapshot);
});
test('university earlier-year call is rejected without any mutation',()=>{
 const g=university();g.state.higherEducation.lastProgressProcessedYear=2076;
 const snapshot=structuredClone(g.state);
 assert.throws(()=>progressUniversityYear(g.state,noRng),RangeError);
 assert.deepEqual(g.state,snapshot);
});
test('university save/restore and later year advance exactly once',()=>{
 const g=university();progressUniversityYear(g.state,new RNG('first'));
 const restored=Game.fromSave(serializeGame(g));
 assert.deepEqual(progressUniversityYear(restored.state,noRng),[]);
 restored.state.year++;restored.state.player.age++;
 progressUniversityYear(restored.state,new RNG('second'));
 assert.equal(restored.state.higherEducation.year,4);
 assert.equal(restored.state.higherEducation.lastProgressProcessedYear,2076);
});
test('university graduation does not repeat and legacy saves can progress',()=>{
 const g=university();g.state.higherEducation.year=4;
 assert.equal(progressUniversityYear(g.state,new RNG('graduate')).length,1);
 assert.equal(g.state.higherEducation.completed,true);
 assert.deepEqual(progressUniversityYear(g.state,noRng),[]);
 const legacy=university('legacy-university');delete legacy.state.higherEducation.lastProgressProcessedYear;
 progressUniversityYear(legacy.state,new RNG('legacy'));
 assert.equal(legacy.state.higherEducation.lastProgressProcessedYear,2075);
});
test('partner goal alignment cannot increase trust twice in one calendar year',()=>{
 const g=partner();const p=g.state.social.romance;
 const first=applyPartnerGoalAlignment(g.state);assert.equal(first.alignment,1);
 const snapshot=structuredClone(g.state);
 assert.equal(applyPartnerGoalAlignment(g.state).alignment,1);
 assert.deepEqual(g.state,snapshot);
});
test('partner goal alignment earlier-year rejection is atomic, even for missing goals',()=>{
 const g=partner();g.state.social.romance.lastGoalAlignmentProcessedYear=2076;
 const snapshot=structuredClone(g.state);
 assert.throws(()=>applyPartnerGoalAlignment(g.state),RangeError);
 assert.deepEqual(g.state,snapshot);
});
test('partner goal alignment persists through save and processes a later year',()=>{
 const g=partner();applyPartnerGoalAlignment(g.state);
 const restored=Game.fromSave(serializeGame(g));
 const p=restored.state.social.romance;const before=p.trust;
 applyPartnerGoalAlignment(restored.state);assert.equal(p.trust,before);
 restored.state.year++;restored.state.player.age++;
 applyPartnerGoalAlignment(restored.state);assert.equal(p.trust,before+1);
});
test('deceased partner does not receive goal alignment changes',()=>{
 const g=partner();g.state.social.romance.alive=false;
 const before=structuredClone(g.state);
 assert.equal(applyPartnerGoalAlignment(g.state),null);
 assert.deepEqual(g.state,before);
});
test('friend lives reject a future-year marker before mutating any earlier friend',()=>{
 const g=new Game('friend-atomic');g.state.year=2075;g.state.player.age=30;
 g.state.social.friends=[friend('first'),friend('second',2076)];
 const snapshot=structuredClone(g.state);
 assert.throws(()=>processFriendLivesYear(g.state,new RNG('friend-atomic')),RangeError);
 assert.deepEqual(g.state,snapshot);
});
test('friend lives preflight ignores deceased friends and permits living friends',()=>{
 const g=new Game('friend-dead');g.state.year=2075;g.state.player.age=30;
 const dead=friend('dead',2076);dead.alive=false;
 g.state.social.friends=[friend('living'),dead];
 processFriendLivesYear(g.state,new RNG('friend-dead'));
 assert.equal(g.state.social.friends[0].life.lastProcessedYear,2075);
 assert.equal(g.state.social.friends[1].life.lastProcessedYear,2076);
});
test('friend lives still skip replay without consuming RNG',()=>{
 const g=new Game('friend-replay');g.state.year=2075;g.state.player.age=30;
 g.state.social.friends=[friend('living')];
 processFriendLivesYear(g.state,new RNG('friend-replay'));
 const snapshot=structuredClone(g.state);
 assert.deepEqual(processFriendLivesYear(g.state,noRng),[]);
 assert.deepEqual(g.state,snapshot);
});
