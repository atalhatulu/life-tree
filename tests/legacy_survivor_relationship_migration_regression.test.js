import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {processSocialYear} from '../src/social/social_simulation.js';
import {processRomanceYear} from '../src/social/romance_system.js';
import {ensurePartnershipState,processPartnershipYear,marryPartner,moveInTogether} from '../src/social/partnership_system.js';
import {adultEvents} from '../src/events/adult_events.js';
import {EventEngine} from '../src/events/event_engine.js';
import {relocationHouseholdSize,generatePartnerMoveOpportunity,resolvePartnerMove,moveToCity} from '../src/world/migration_system.js';

const neverRng={chance:()=>false,int:()=>0,fork(){return this;}};
function state(seed='legacy-survivor'){
 const s=new Game(seed).state;
 s.player.age=35;s.year=2061;
 return s;
}
function deadPartner(){return {id:'old-partner',name:'Ece',surname:'A',age:37,alive:false,status:'married',relationship:75,yearsTogether:7,marriageYears:4,trust:60,health:{current:30}};}
function opportunity(){return {cityId:'ankara',cityName:'Ankara',oldIncome:30000,newIncome:50000};}

test('legacy deceased friends are archived once, not aged or killed again',()=>{
 const s=state('dead-friend-cleanup');
 const dead={id:'dead',name:'Ali',surname:'Y',age:50,alive:false,relationship:60,yearsKnown:8};
 const living={id:'living',name:'Can',surname:'Z',age:30,alive:true,relationship:70,yearsKnown:3};
 s.social.friends=[dead,living];s.social.deceasedFriends=[{...dead,deathYear:2060}];
 const entries=processSocialYear(s,neverRng);
 assert.deepEqual(entries,[]);
 assert.equal(dead.age,50);assert.equal(dead.yearsKnown,8);
 assert.deepEqual(s.social.friends.map(f=>f.id),['living']);
 assert.equal(living.age,31);
 assert.equal(s.social.deceasedFriends.length,1);
 processSocialYear(s,neverRng);
 assert.equal(s.social.deceasedFriends.length,1);
});

test('unarchived deceased friends are preserved without creating a second death event',()=>{
 const s=state('unarchived-dead-friend');
 s.social.friends=[{id:'dead',name:'Ali',age:81,alive:false,relationship:70}];
 assert.deepEqual(processSocialYear(s,neverRng),[]);
 assert.equal(s.social.friends.length,0);
 assert.equal(s.social.deceasedFriends.length,1);
 assert.equal(s.social.deceasedFriends[0].age,81);
});

test('romance-year cleanup reconciles deceased married partner before aging',()=>{
 const s=state('romance-cleanup');const partner=deadPartner();
 s.social.romance=partner;s.pendingPartnerMove=opportunity();
 assert.deepEqual(processRomanceYear(s,neverRng),[]);
 assert.equal(partner.age,37);
 assert.equal(s.social.romance,null);
 assert.equal(s.social.deceasedPartners.length,1);
 assert.equal(s.widowedAtAge,35);
 assert.equal(s.pendingPartnerMove,null);
 assert.deepEqual(processRomanceYear(s,neverRng),[]);
 assert.equal(s.social.deceasedPartners.length,1);
});

test('partnership-year cleanup is idempotent when deceased partner is already archived',()=>{
 const s=state('partnership-cleanup');const partner=deadPartner();
 s.social.romance=partner;s.social.deceasedPartners=[{...partner}];
 assert.deepEqual(processPartnershipYear(s,neverRng),[]);
 assert.equal(s.social.romance,null);
 assert.equal(s.social.deceasedPartners.length,1);
 assert.equal(partner.yearsTogether,7);
});

test('deceased partners cannot be married or cohabited with via direct calls',()=>{
 for(const action of [marryPartner,moveInTogether]){
  const s=state('dead-commitment');s.social.romance=deadPartner();
  const before=structuredClone(s);
  assert.throws(()=>action(s),/hayatta değil/);
  assert.deepEqual(s,before);
 }
});

test('relationship commitment and marriage events do not offer deceased partner decisions',()=>{
 const s=state('dead-commitment-events');s.social.romance=deadPartner();
 for(const id of ['relationship-commitment','marriage-after-cohabiting']){
  const event=adultEvents.find(e=>e.id===id);
  assert.equal(event.condition(s),false,id);
 }
 const legacy=state('legacy-commitment-events');legacy.social.romance={...deadPartner(),alive:undefined,status:'dating',yearsTogether:2};
 assert.equal(adultEvents.find(e=>e.id==='relationship-commitment').condition(legacy),true);
});

test('partnership schema normalization leaves deceased partner untouched',()=>{
 const s=state('dead-ensure');s.social.romance=deadPartner();
 const before=structuredClone(s.social.romance);
 ensurePartnershipState(s);
 assert.deepEqual(s.social.romance,before);
});

test('deceased partners and children are not counted as relocation household members',()=>{
 const s=state('dead-move-household');s.social.romance=deadPartner();
 s.children=[{age:8,alive:false},{age:10,alive:true},{age:12}];
 assert.equal(relocationHouseholdSize(s),3);
 s.social.romance.alive=undefined;
 assert.equal(relocationHouseholdSize(s),4);
});

test('partner move generation and event selection reject deceased partner',()=>{
 const s=state('dead-move-opportunity');s.social.romance=deadPartner();s.pendingPartnerMove=opportunity();
 assert.equal(generatePartnerMoveOpportunity(s,neverRng),null);
 assert.equal(adultEvents.find(e=>e.id==='partner-job-relocation').condition(s),false);
});

test('stale partner relocation cannot charge cash, move or modify deceased partner',()=>{
 const s=state('dead-move-resolution');s.social.romance=deadPartner();s.pendingPartnerMove=opportunity();
 const before=structuredClone(s);
 for(const accept of [true,false]){
  assert.throws(()=>resolvePartnerMove(s,accept),/Aktif eş taşınma fırsatı yok/);
  assert.deepEqual(s,before);
 }
});

test('ordinary relocation does not move a deceased partner record',()=>{
 const s=state('dead-move-city');s.social.romance=deadPartner();
 const partnerCity=s.social.romance.cityId='izmir';
 const target=s.location.cityId==='ankara'?'istanbul':'ankara';
 moveToCity(s,target,'personal');
 assert.equal(s.social.romance.cityId,partnerCity);
});


test('stale relationship event resolution is rejected before any mutation',()=>{
 const s=state('stale-relationship-event');s.social.romance=deadPartner();
 const event=adultEvents.find(e=>e.id==='marriage-after-cohabiting');
 const before=structuredClone(s);
 assert.throws(()=>new EventEngine([event]).resolve(s,event,'continue',neverRng),/no longer available/);
 assert.deepEqual(s,before);
});

test('living and legacy partners can still commit and relocate',()=>{
 for(const alive of [true,undefined]){
  const s=state('living-commit-'+alive);
  s.social.romance={...deadPartner(),alive,status:'dating'};
  moveInTogether(s);
  assert.equal(s.social.romance.status,'cohabiting');
  marryPartner(s);
  assert.equal(s.social.romance.status,'married');
  s.pendingPartnerMove=opportunity();
  const result=resolvePartnerMove(s,false);
  assert.equal(result.moved,false);
  assert.equal(s.pendingPartnerMove,null);
  assert.equal(s.social.romance.relationship,79);
 }
});


test('natural partner death invalidates pending relocation for future relationships',()=>{
 const s=state('natural-partner-loss');s.social.romance={...deadPartner(),alive:true};
 s.pendingPartnerMove=opportunity();
 const entries=processPartnershipYear(s,{int:()=>0,fork:()=>({chance:()=>true})});
 assert.equal(entries.length,1);
 assert.equal(s.social.romance,null);
 assert.equal(s.pendingPartnerMove,null);
 assert.equal(s.social.deceasedPartners.length,1);
});

test('divorce invalidates pending relocation rather than transferring it to a new partner',()=>{
 const s=state('divorce-partner-move');
 s.social.romance={...deadPartner(),alive:true,relationship:8,relationshipTension:99,compatibility:30,conflictYears:4};
 s.pendingPartnerMove=opportunity();
 const entries=processPartnershipYear(s,neverRng);
 assert.ok(entries.some(e=>e.text.includes('boşanmayla')));
 assert.equal(s.social.romance,null);
 assert.equal(s.pendingPartnerMove,null);
});


test('a pending move tied to a previous partner cannot transfer to a new partner',()=>{
 const s=state('partner-move-owner');
 s.social.romance={...deadPartner(),alive:true,id:'new-partner'};
 s.pendingPartnerMove={...opportunity(),partnerId:'old-partner'};
 const before=structuredClone(s);
 assert.equal(adultEvents.find(e=>e.id==='partner-job-relocation').condition(s),false);
 assert.throws(()=>resolvePartnerMove(s,true),/Aktif eş taşınma fırsatı yok/);
 assert.deepEqual(s,before);
 assert.equal(generatePartnerMoveOpportunity(s,neverRng),null);
 assert.equal(s.pendingPartnerMove,null);
});


test('historical partner death does not restart the mourning delay years later',()=>{
 const s=state('historical-widow');s.social.romance={...deadPartner(),deathYear:2055};
 processRomanceYear(s,neverRng);
 assert.equal(s.widowedAtAge,29);
 assert.equal(s.nextDatingAge,31);
});
