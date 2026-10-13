import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';

function fixture(label){
 const state=new Game('cycle85-'+label).state;
 state.player.age=35;
 state.actions={remaining:3,max:3};
 state.mentalHealth={strain:20,status:'stable',resilience:50,therapyYears:0};
 state.social.friends=[{id:'f',name:'Arkadaş',alive:true,relationship:70,yearsKnown:4,closeFriend:true}];
 state.social.romance={name:'Partner',alive:true,relationship:70,relationshipTension:10};
 return state;
}
function atomicReject(label,id,change,{menu=true}={}){
 test(label+' rejects without side effects',()=>{
  const state=fixture(label),rng=new RNG('rng-'+label);
  change(state);
  const before=structuredClone(state),seed=rng.state;
  assert.throws(()=>performActivity(state,id,rng),/Geçersiz|kullanılamıyor/);
  assert.deepEqual(state,before);
  assert.equal(rng.state,seed);
  if(menu){
   assert.equal(availableActivities(state).some(a=>a.id===id),false);
   assert.deepEqual(state,before);
  }
 });
}
// Candidate 1: Counters that are valid now but would overflow on recordUse.
for(const [label,entry] of [
 ['uses near safe limit',{uses:Number.MAX_SAFE_INTEGER-1,streak:1,lastAge:33}],
 ['streak near safe limit',{uses:2,streak:Number.MAX_SAFE_INTEGER-1,lastAge:34}],
 ['uses near limit same-year streak',{uses:Number.MAX_SAFE_INTEGER-1,streak:0,lastAge:null}]
])atomicReject(label,'checkup',s=>s.activityMemory={checkup:entry});

test('large previous streak safely resets when not consecutive',()=>{
 const state=fixture('streak-reset');
 state.activityMemory={checkup:{uses:1,streak:Number.MAX_SAFE_INTEGER-1,lastAge:30}};
 performActivity(state,'checkup',new RNG('streak-reset'));
 assert.equal(state.activityMemory.checkup.streak,1);
 assert.equal(state.activityMemory.checkup.uses,2);
});
// Candidate 2: Menu and direct API must agree for invalid activity ledgers.
for(const [label,entry] of [
 ['malformed uses',{uses:'3',streak:0,lastAge:null}],
 ['malformed streak',{uses:0,streak:-1,lastAge:null}],
 ['future activity age',{uses:1,streak:1,lastAge:36}],
 ['invalid entry array',[]],
 ['invalid entry null',null]
])atomicReject(label,'hobby',s=>s.activityMemory={hobby:entry});
for(const [label,ledger] of [
 ['malformed root ledger',[]],
 ['string root ledger','bad']
])atomicReject(label,'hobby',s=>s.activityMemory=ledger);

test('unrelated corrupted ledger does not hide healthy activities',()=>{
 const state=fixture('menu-independent');
 state.activityMemory={hobby:{uses:'bad'}};
 assert.equal(availableActivities(state).some(a=>a.id==='hobby'),false);
 assert.equal(availableActivities(state).some(a=>a.id==='exercise'),true);
});
// Candidate 3: Corrupt social contact timestamps must not be silently overwritten.
for(const [label,value] of [
 ['friend future contact',36],['friend negative contact',-1],
 ['friend string contact','30'],['friend fractional contact',34.5],
 ['friend unsafe contact',Number.MAX_SAFE_INTEGER+1],['friend NaN contact',NaN]
])atomicReject(label,'socialize',s=>s.social.friends[0].lastContactAge=value);
for(const [label,value] of [
 ['partner future quality time',36],['partner negative quality time',-1],
 ['partner string quality time','30'],['partner fractional quality time',34.5],
 ['partner unsafe quality time',Number.MAX_SAFE_INTEGER+1],['partner NaN quality time',NaN]
])atomicReject(label,'date',s=>s.social.romance.lastQualityTimeAge=value);

test('legacy absent timestamps and valid past timestamps are accepted',()=>{
 const social=fixture('valid-social');
 social.social.friends[0].lastContactAge=34;
 performActivity(social,'socialize',new RNG('valid-social'));
 assert.equal(social.social.friends[0].lastContactAge,35);
 const date=fixture('valid-date');
 performActivity(date,'date',new RNG('valid-date'));
 assert.equal(date.social.romance.lastQualityTimeAge,35);
});

test('dead friends with corrupt timestamps do not block living-friend activity',()=>{
 const state=fixture('dead-friend');
 state.social.friends.push({id:'dead',alive:false,lastContactAge:'broken'});
 assert.match(performActivity(state,'socialize',new RNG('dead-friend')),/Arkadaş/);
});
