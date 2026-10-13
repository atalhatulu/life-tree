import test from 'node:test';
import assert from 'node:assert/strict';
import {systemicStorylets} from '../src/events/systemic_storylets.js';
import {EventEngine} from '../src/events/event_engine.js';

const storylet=id=>systemicStorylets.find(event=>event.id===id);
const choices=(id,state)=>new EventEngine().choicesFor(state,storylet(id));

function state(friends){
 return {
  player:{age:38},
  social:{friends},
  healthProfile:{stress:70},
  lifeMemory:{scarLoad:40,resilience:50},
  storyletCooldowns:{},storyletCounts:{}
 };
}
function friend(id,alive=true){
 return {id,name:id,alive,closeFriend:true,trust:75,relationship:65,reciprocity:50};
}

test('dead friends cannot trigger a crisis or be chosen over a living friend',()=>{
 const onlyDead=state([friend('deceased',false)]);
 assert.equal(storylet('storylet-close-friend-crisis').condition(onlyDead),false);
 assert.deepEqual(choices('storylet-close-friend-crisis',onlyDead),[]);
 const mixed=state([friend('deceased',false),friend('living')]);
 assert.equal(storylet('storylet-close-friend-crisis').condition(mixed),true);
 assert.match(choices('storylet-close-friend-crisis',mixed)[0].label,/living/);
 choices('storylet-close-friend-crisis',mixed)[0].effect(mixed);
 assert.equal(mixed.social.friends[0].relationship,65);
 assert.equal(mixed.social.friends[1].relationship,72);
});

test('all friend-crisis responses safely ignore a removed or newly deceased friend',()=>{
 for(const optionId of ['show-up','send-message','too-busy']){
  for(const removed of [false,true]){
   const s=state([friend('target')]);
   const response=choices('storylet-close-friend-crisis',s).find(c=>c.id===optionId);
   assert.ok(response);
   if(removed)s.social.friends=[];
   else s.social.friends[0].alive=false;
   assert.doesNotThrow(()=>response.effect(s));
   assert.equal(s.healthProfile.stress,70);
   assert.equal(s.storyletCounts['friend-crisis']??0,0);
   if(!removed)assert.equal(s.social.friends[0].relationship,65);
  }
 }
});

test('legacy friend records without alive flag remain eligible',()=>{
 const legacy=friend('legacy');delete legacy.alive;
 const s=state([legacy]);
 assert.equal(storylet('storylet-close-friend-crisis').condition(s),true);
 choices('storylet-close-friend-crisis',s)[1].effect(s);
 assert.equal(s.social.friends[0].relationship,68);
 assert.equal(s.storyletCounts['friend-crisis'],1);
});

test('scar support cannot rely solely on deceased friends or a deceased partner',()=>{
 const s=state([friend('deceased',false)]);
 s.social.romance={alive:false};
 assert.equal(choices('storylet-old-scar-trigger',s).some(c=>c.id==='lean-on-someone'),false);
 s.social.friends.push(friend('living'));
 assert.equal(choices('storylet-old-scar-trigger',s).some(c=>c.id==='lean-on-someone'),true);
 s.social.friends[1].alive=false;
 s.social.romance={alive:true};
 assert.equal(choices('storylet-old-scar-trigger',s).some(c=>c.id==='lean-on-someone'),true);
});


test('scar support choice does not grant benefits after the last supporter dies',()=>{
 const s=state([friend('supporter')]);
 const response=choices('storylet-old-scar-trigger',s).find(c=>c.id==='lean-on-someone');
 assert.ok(response);
 s.social.friends[0].alive=false;
 response.effect(s);
 assert.equal(s.healthProfile.stress,70);
 assert.equal(s.lifeMemory.resilience,50);
 assert.equal(s.storyletCounts['scar-trigger']??0,0);
});
