import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';

function adult(label){
 const state=new Game('cycle81-'+label).state;
 state.player.age=35;
 state.actions={remaining:3,max:3};
 state.healthProfile={conditions:[],stress:30,fitness:50,lastCheckupAge:null};
 state.mentalHealth={strain:30,status:'stable',resilience:50,therapyYears:0,episodes:[]};
 return state;
}
function rejectsAtomically(label,activity,setup){
 test(label+' is rejected without changing state or RNG',()=>{
  const state=adult(label);
  setup(state);
  const rng=new RNG('cycle81-rng-'+label);
  const before=structuredClone(state),randomBefore=rng.state;
  assert.throws(()=>performActivity(state,activity,rng),/Geçersiz|kullanılamıyor/);
  assert.deepEqual(state,before);
  assert.equal(rng.state,randomBefore);
 });
}
// Candidate 1: social activity must not spend a turn or increase sociability
// before discovering an invalid living friend record.
for(const [label,setup] of [
 ['social friends list is a string',s=>{s.social.friends='invalid';}],
 ['social friends list is an object',s=>{s.social.friends={};}],
 ['social friend is null',s=>{s.social.friends=[null];}],
 ['social friend is an array',s=>{s.social.friends=[[]];}],
 ['social friend relationship is NaN',s=>{s.social.friends=[{name:'Ada',relationship:NaN}];}],
 ['social friend relationship is a string',s=>{s.social.friends=[{name:'Ada',relationship:'60'}];}],
 ['social friend relationship is above 100',s=>{s.social.friends=[{name:'Ada',relationship:101}];}],
 ['social friend relationship is negative',s=>{s.social.friends=[{name:'Ada',relationship:-1}];}],
 ['social second living friend is invalid',s=>{s.social.friends=[{name:'A',relationship:40},{name:'B',relationship:Infinity}];}]
])rejectsAtomically(label,'socialize',setup);

// Candidate 2: date action must validate both relationship metrics before
// writing either, even when the legacy tension field is optional.
for(const [label,setup] of [
 ['date relationship is missing',s=>{s.social.romance={name:'Partner',alive:true};}],
 ['date relationship is NaN',s=>{s.social.romance={name:'Partner',alive:true,relationship:NaN};}],
 ['date relationship is a string',s=>{s.social.romance={name:'Partner',alive:true,relationship:'50'};}],
 ['date tension is infinity',s=>{s.social.romance={name:'Partner',alive:true,relationship:60,relationshipTension:Infinity};}],
 ['date tension is negative',s=>{s.social.romance={name:'Partner',alive:true,relationship:60,relationshipTension:-1};}],
 ['date tension is an array',s=>{s.social.romance={name:'Partner',alive:true,relationship:60,relationshipTension:[]};}]
])rejectsAtomically(label,'date',setup);

// Candidate 3: malformed checkup provenance or stress must not be silently
// clamped into NaN or corrupt the medical cooldown.
for(const [label,setup] of [
 ['checkup last age is string',s=>{s.healthProfile.lastCheckupAge='20';}],
 ['checkup last age is negative',s=>{s.healthProfile.lastCheckupAge=-1;}],
 ['checkup last age is fractional',s=>{s.healthProfile.lastCheckupAge=20.5;}],
 ['checkup last age is NaN',s=>{s.healthProfile.lastCheckupAge=NaN;}],
 ['checkup stress is NaN',s=>{s.healthProfile.stress=NaN;}],
 ['checkup stress is a string',s=>{s.healthProfile.stress='40';}],
 ['checkup profile is an array',s=>{s.healthProfile=[];}],
 ['therapy stress is infinity',s=>{s.mentalHealth.strain=65;s.healthProfile.stress=Infinity;}],
 ['budget stress is invalid',s=>{s.healthProfile.stress='30';s.finance={cash:0,debt:0};}]
])rejectsAtomically(label,label.startsWith('therapy')?'therapy':label.startsWith('budget')?'budget':'checkup',setup);

test('invalid checkup age is not advertised as available',()=>{
 const state=adult('checkup-menu');state.healthProfile.lastCheckupAge='19';
 assert.equal(availableActivities(state).some(a=>a.id==='checkup'),false);
});
test('valid social, dating and health activities retain their effects',()=>{
 const social=adult('social-valid');
 social.social.friends=[{id:'f',name:'Friend',relationship:60,yearsKnown:5}];
 assert.match(performActivity(social,'socialize',new RNG('social-valid')),/Friend/);
 assert.equal(social.social.friends[0].relationship,67);
 const date=adult('date-valid');
 date.social.romance={name:'Partner',alive:true,relationship:60};
 assert.match(performActivity(date,'date',new RNG('date-valid')),/kaliteli zaman/);
 assert.ok(date.social.romance.relationship>60);
 const checkup=adult('checkup-valid');
 checkup.healthProfile.stress=45;
 assert.match(performActivity(checkup,'checkup',new RNG('checkup-valid')),/Sağlık kontrolünden/);
 assert.equal(checkup.healthProfile.stress,41);
 assert.equal(checkup.healthProfile.lastCheckupAge,35);
 const therapy=adult('therapy-valid');therapy.mentalHealth.strain=65;
 assert.match(performActivity(therapy,'therapy',new RNG('therapy-valid')),/psikolojik/);
});

test('menus omit invalid social, dating and therapy activity records',()=>{
 const social=adult('social-menu');social.social.friends=[{name:'Friend',relationship:NaN}];
 assert.equal(availableActivities(social).some(a=>a.id==='socialize'),false);
 const date=adult('date-menu');date.social.romance={alive:true,relationship:'60'};
 assert.equal(availableActivities(date).some(a=>a.id==='date'),false);
 const therapy=adult('therapy-menu');therapy.mentalHealth.strain=65;therapy.healthProfile.stress=Infinity;
 assert.equal(availableActivities(therapy).some(a=>a.id==='therapy'),false);
 const budget=adult('budget-menu');budget.finance={cash:0,debt:0};budget.healthProfile.stress='30';
 assert.equal(availableActivities(budget).some(a=>a.id==='budget'),false);
});
test('legacy absent medical stress uses safe default rather than NaN',()=>{
 const state=adult('legacy-stress');delete state.healthProfile.stress;
 performActivity(state,'checkup',new RNG('legacy-stress'));
 assert.equal(state.healthProfile.stress,16);
});

test('legacy null friends and health profile retain default behavior',()=>{
 const social=adult('legacy-null-friends');social.social.friends=null;
 assert.equal(availableActivities(social).some(a=>a.id==='socialize'),true);
 assert.match(performActivity(social,'socialize',new RNG('null-friends')), /İnsanlarla vakit/);
 const checkup=adult('legacy-null-profile');checkup.healthProfile=null;
 assert.equal(availableActivities(checkup).some(a=>a.id==='checkup'),true);
 performActivity(checkup,'checkup',new RNG('null-profile'));
 assert.equal(checkup.healthProfile.stress,16);
});
