import test from 'node:test';
import assert from 'node:assert/strict';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
const rng={fork(){return {int(){return 3},chance(){return true}}}};
const setup=(age,year=2030)=>{
 const friend={id:'f',name:'Ece',age,alive:true,relationship:45,personality:{sociability:70},life:{personalStress:20,workStability:55}};
 return {friend,state:{year,player:{age},social:{friends:[friend]}}};
};
test('repeated year does not reroll relationship, work or stress',()=>{
 const {friend,state}=setup(25);
 processFriendLivesYear(state,rng);
 const snapshot=JSON.stringify(friend);
 assert.deepEqual(processFriendLivesYear(state,rng),[]);
 assert.equal(JSON.stringify(friend),snapshot);
});
test('out of order NPC years rejected',()=>{
 const {state}=setup(25);
 processFriendLivesYear(state,rng);
 state.year=2029;
 assert.throws(()=>processFriendLivesYear(state,rng),/earlier year/);
});
test('school milestone is once only and depends on NPC study',()=>{
 const {friend,state}=setup(17);
 const events=processFriendLivesYear(state,rng);
 assert.equal(friend.life.schoolCompletionYear,2030);
 assert.ok(['developing','progressing','advanced'].includes(friend.life.schoolOutcome));
 assert.equal(events.filter(e=>e.text.includes('okul dönemini tamamladı')).length,1);
 assert.equal(processFriendLivesYear(state,rng).length,0);
});
test('adult NPC does not receive a school milestone',()=>{
 const {friend,state}=setup(26);
 processFriendLivesYear(state,rng);
 assert.equal(friend.life.schoolCompletionYear,undefined);
});

test('schoolchildren and unemployed NPCs cannot lose a job they do not hold',()=>{
 for(const [age,jobId] of [[16,'student'],[25,'unemployed'],[70,'retired'],[25,undefined]]){
  const {friend,state}=setup(age);friend.jobId=jobId;friend.life.workStability=0;
  processFriendLivesYear(state,rng);
  assert.notEqual(friend.life.workStability,20);
  if(jobId==='student'||jobId==='retired')assert.equal(friend.jobId,jobId);
 }
});
test('education outcome changes reemployment chance at the same random draw',()=>{
 const make=(outcome)=>{const {friend,state}=setup(23);friend.jobId='unemployed';friend.life.schoolOutcome=outcome;return {friend,state}};
 const thresholdRng={fork(){return {int(){return 0},chance(p){return p>=.27}}}};
 const basic=make('developing');const advanced=make('advanced');
 processFriendLivesYear(basic.state,thresholdRng);processFriendLivesYear(advanced.state,thresholdRng);
 assert.equal(basic.friend.jobId,'unemployed');
 assert.equal(advanced.friend.jobId,'cleaner');
 assert.equal(advanced.friend.life.lastReemploymentYear,2030);
});
