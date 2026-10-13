import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';

function stateFor(label){
 const s=new Game('cycle84-'+label).state;
 s.player.age=35;
 s.actions={remaining:3,max:3};
 s.mentalHealth={strain:25,status:'stable',resilience:50,therapyYears:0};
 s.social.friends=[{id:'friend',name:'Arkadaş',alive:true,relationship:60,yearsKnown:5,closeFriend:false}];
 s.social.romance={name:'Partner',alive:true,relationship:60,relationshipTension:20};
 s.career={employed:true,performance:60,satisfaction:60};
 return s;
}
function rejects(label,id,mutate,{menu=true}={}){
 test(label+' rejects atomically without consuming RNG',()=>{
  const s=stateFor(label),rng=new RNG('cycle84-rng-'+label);
  mutate(s,rng);
  const before=structuredClone(s),randomBefore=rng.state;
  assert.throws(()=>performActivity(s,id,rng),/Geçersiz|Invalid/);
  assert.deepEqual(s,before);
  assert.equal(rng.state,randomBefore);
  if(menu){
   assert.equal(availableActivities(s).some(a=>a.id===id),false);
   assert.deepEqual(s,before);
  }
 });
}
// 1. Socializing writes sociability before picking a friend. Reject invalid
// traits even with no living friends (the legacy no-friend path).
for(const [label,change] of [
 ['social sociability NaN',s=>s.player.personality.sociability=NaN],
 ['social sociability string',s=>s.player.personality.sociability='60'],
 ['social sociability infinity',s=>s.player.personality.sociability=Infinity],
 ['social sociability negative',s=>s.player.personality.sociability=-1],
 ['social sociability over 100',s=>s.player.personality.sociability=101],
 ['social sociability personality array',s=>s.player.personality=[]],
 ['social sociability no friends',s=>{s.social.friends=[];s.player.personality.sociability=NaN;}]
])rejects(label,'socialize',change);

// 2. Years known and close-friend markers influence the promotion decision.
// Never coerce strings or accept malformed counters on a living friend.
for(const [label,change] of [
 ['friend years known NaN',f=>f.yearsKnown=NaN],
 ['friend years known string',f=>f.yearsKnown='4'],
 ['friend years known negative',f=>f.yearsKnown=-1],
 ['friend years known fractional',f=>f.yearsKnown=1.5],
 ['friend years known infinity',f=>f.yearsKnown=Infinity],
 ['friend years known unsafe',f=>f.yearsKnown=Number.MAX_SAFE_INTEGER+1],
 ['friend close marker string',f=>f.closeFriend='yes'],
 ['friend close marker number',f=>f.closeFriend=1],
 ['friend close marker array',f=>f.closeFriend=[]]
])rejects(label,'socialize',s=>change(s.social.friends[0]));

// 3. A corrupt RNG state or absent required RNG method must not leave a
// partial activity, including budget repayment or social trait changes.
for(const [label,id,change] of [
 ['rng NaN before date','date',r=>r.state=NaN],
 ['rng negative before course','course',r=>r.state=-1],
 ['rng string before study','study',r=>r.state='10'],
 ['rng unsafe before budget','budget',r=>r.state=Number.MAX_SAFE_INTEGER+1],
 ['rng fractional before social','socialize',r=>r.state=0.5]
])rejects(label,id,(s,r)=>{
 if(id==='study'){s.higherEducation={enrolled:true,performance:60};}
 if(id==='budget'){s.finance={cash:0,debt:0};}
 change(r);
},{menu:false});
for(const [label,id,rng] of [
 ['missing date random int','date',{}],
 ['missing social random pick','socialize',{}],
 ['missing course random int','course',{}],
 ['missing exercise random int','exercise',{}]
])test(label+' rejects before any state mutation',()=>{
 const s=stateFor(label),before=structuredClone(s);
 assert.throws(()=>performActivity(s,id,rng),/Geçersiz|Invalid/);
 assert.deepEqual(s,before);
});

test('valid social friendship promotion retains the old relationship rule',()=>{
 const s=stateFor('social-valid');
 s.social.friends[0].relationship=75;
 s.social.friends[0].yearsKnown=4;
 assert.match(performActivity(s,'socialize',new RNG('social-valid')),/Arkadaş/);
 assert.equal(s.social.friends[0].relationship,82);
 assert.equal(s.social.friends[0].closeFriend,true);
 assert.equal(s.actions.remaining,2);
});
test('legacy friends without yearsKnown or closeFriend remain supported',()=>{
 const s=stateFor('social-legacy');
 delete s.social.friends[0].yearsKnown;
 delete s.social.friends[0].closeFriend;
 assert.match(performActivity(s,'socialize',new RNG('social-legacy')),/Arkadaş/);
 assert.equal(s.social.friends[0].closeFriend,false);
});
test('valid legacy RNG stubs remain supported for dating and socializing',()=>{
 const date=stateFor('rng-stub-date');
 assert.match(performActivity(date,'date',{int:()=>3}),/kaliteli/);
 const social=stateFor('rng-stub-social');
 assert.match(performActivity(social,'socialize',{pick:items=>items[0]}),/Arkadaş/);
});
