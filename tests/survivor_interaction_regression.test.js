import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';
import {processLongTermConsequences} from '../src/life/long_term_consequence_system.js';
import {isLivingPerson,hasLivingPartner,hasLivingChildren,canInteractWithPerson,livingCompanionsFromState} from '../src/ui/survivor_interactions.js';

function activityState(){
 const s=new Game('survivor-activity').state;
 s.player.age=30;
 s.actions={remaining:3,max:3};
 s.social.romance={id:'p',name:'Partner',alive:false,relationship:45};
 s.social.friends=[{id:'dead',name:'Dead',alive:false,relationship:50},{id:'living',name:'Living',alive:true,relationship:60}];
 return s;
}

test('dead partner is not offered a date and a stale date action does not spend a turn',()=>{
 const s=activityState();
 assert.ok(!availableActivities(s).some(a=>a.id==='date'));
 const before=structuredClone({actions:s.actions,romance:s.social.romance,activityMemory:s.activityMemory});
 assert.throws(()=>performActivity(s,'date',{}),/kullanılamıyor/);
 assert.deepEqual({actions:s.actions,romance:s.social.romance,activityMemory:s.activityMemory},before);
});

test('living and legacy partners can still date',()=>{
 for(const alive of [true,undefined]){
  const s=activityState();s.social.romance.alive=alive;
  assert.ok(availableActivities(s).some(a=>a.id==='date'));
  const result=performActivity(s,'date',{int:()=>3});
  assert.match(result,/kaliteli zaman/);
  assert.equal(s.social.romance.relationship,48);
  assert.equal(s.actions.remaining,2);
 }
});

test('social activity picks only living friends and leaves deceased friends untouched',()=>{
 const s=activityState();
 const picked=[];
 performActivity(s,'socialize',{pick:items=>{picked.push(items.map(x=>x.id));return items[0];}});
 assert.deepEqual(picked,[['living']]);
 assert.equal(s.social.friends[0].relationship,50);
 assert.equal(s.social.friends[0].lastContactAge,undefined);
 assert.equal(s.social.friends[1].relationship,67);
});

test('social activity with only deceased friends does not interact with them',()=>{
 const s=activityState();s.social.friends=[s.social.friends[0]];
 const result=performActivity(s,'socialize',{pick:()=>{throw Error('must not pick deceased friends');}});
 assert.match(result,/İnsanlarla vakit/);
 assert.equal(s.social.friends[0].relationship,50);
 assert.equal(s.actions.remaining,2);
});

test('social activity tolerates old saves without a friend list',()=>{
 const s=activityState();s.social.friends=undefined;
 const result=performActivity(s,'socialize',{pick:()=>{throw Error('no friends to pick');}});
 assert.match(result,/İnsanlarla vakit/);
 assert.equal(s.actions.remaining,2);
});

test('legacy friends remain eligible for social activities',()=>{
 const s=activityState();s.social.friends=[{id:'legacy',name:'Legacy',relationship:60}];
 performActivity(s,'socialize',{pick:items=>items[0]});
 assert.equal(s.social.friends[0].relationship,67);
});

test('a deceased player cannot see or perform activities',()=>{
 const s=activityState();s.player.alive=false;
 assert.deepEqual(availableActivities(s),[]);
 assert.throws(()=>performActivity(s,'socialize',{}),/Hayat sona erdi/);
 assert.equal(s.actions.remaining,3);
});

function milestoneState(){
 return {player:{age:45},social:{romance:{alive:false,trust:40,sharedGoals:45,intimacy:50}},children:[
  {id:'dead',alive:false,relationship:40},{id:'living',alive:true,relationship:50},{id:'legacy',relationship:60}
 ],lifeTree:{nodes:[{age:40,pacingCategory:'relationship',label:'İlişki'}, {age:40,pacingCategory:'family',label:'Aile'}]}};
}

test('long-term milestones never improve deceased partners or descendants',()=>{
 const s=milestoneState();
 const entries=processLongTermConsequences(s);
 assert.equal(entries.length,1);
 assert.equal(s.social.romance.trust,40);
 assert.deepEqual(s.children.map(c=>c.relationship),[40,51,61]);
 assert.deepEqual(s.lifeTree.nodes.map(n=>n.longTermMilestones),[[5],[5]]);
 assert.equal(processLongTermConsequences(s).length,0);
});

test('long-term family milestone with no living children does not produce a misleading event',()=>{
 const s=milestoneState();s.children=[s.children[0]];
 assert.deepEqual(processLongTermConsequences(s),[]);
 assert.equal(s.children[0].relationship,40);
 assert.deepEqual(s.lifeTree.nodes[1].longTermMilestones,[5]);
});

test('living and legacy partners still receive relationship milestones at 5, 10 and 20 years',()=>{
 for(const alive of [true,undefined]){
  const s=milestoneState();s.social.romance.alive=alive;
  for(const [age,field,gain] of [[45,'trust',2],[50,'sharedGoals',4],[60,'intimacy',3]]){
   s.player.age=age;
   assert.ok(processLongTermConsequences(s).some(e=>e.text.includes('ilişki karar')));
   assert.equal(s.social.romance[field],{trust:42,sharedGoals:49,intimacy:53}[field]);
  }
 }
});

test('web companion selector excludes deceased people but retains legacy and original child indices',()=>{
 const s=activityState();
 s.children=[{id:'c0',name:'Lost',alive:false},{id:'c1',name:'Alive',alive:true},{id:'c2',name:'Legacy'}];
 s.social.friends.push({id:'legacy',name:'Legacy'});
 assert.deepEqual(livingCompanionsFromState(s).map(x=>x.id),['alone','friend:living','friend:legacy','child:1','child:2']);
 assert.equal(hasLivingPartner(s),false);
 assert.equal(hasLivingChildren(s),true);
 assert.equal(isLivingPerson(s.children[0]),false);
 assert.equal(isLivingPerson(s.children[2]),true);
});

test('web person actions require living actor, living target and available action budget',()=>{
 const s=activityState();
 assert.equal(canInteractWithPerson(s,s.social.friends[0]),false);
 assert.equal(canInteractWithPerson(s,s.social.friends[1]),true);
 s.actions.remaining=0;
 assert.equal(canInteractWithPerson(s,s.social.friends[1]),false);
 s.actions.remaining=3;s.player.alive=false;
 assert.equal(canInteractWithPerson(s,s.social.friends[1]),false);
});

test('web selectors preserve legacy living-person compatibility',()=>{
 const s=activityState();s.social.romance.alive=undefined;s.children=[{name:'Legacy'}];
 assert.equal(hasLivingPartner(s),true);
 assert.equal(hasLivingChildren(s),true);
 assert.ok(livingCompanionsFromState(s).some(x=>x.id==='partner'));
});
