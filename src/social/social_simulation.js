import {annualYearStatus} from '../core/annual_clock.js';
import {captureRngCheckpoint,restoreRngOrThrow} from '../core/transaction_snapshot.js';
import {createFriend} from './friend_generator.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validScore=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
const validCounter=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;

// The annual pass mutates several friends before reaching the last one. Check
// the entire cohort and the side-effect ledgers first so a bad legacy record
// cannot leave an earlier friend aged or an archive half-written.
function assertSocialYearInputs(state){
 const social=state.social;
 if(social!=null&&!isRecord(social))throw new TypeError('Invalid social ledger');
 if(social&&Object.hasOwn(social,'friends')&&social.friends!==undefined&&
    !Array.isArray(social.friends))throw new TypeError('Invalid friends collection');
 for(const key of ['deceasedFriends','formerFriends']){
  const items=social?.[key];
  if(items!=null&&(!Array.isArray(items)||items.some(item=>!isRecord(item))))
   throw new TypeError('Invalid social archive: '+key);
 }
 if(!Number.isSafeInteger(state.player?.age)||state.player.age<0)
  throw new RangeError('Invalid player age for social year');
 if(!validScore(state.player?.personality?.sociability))
  throw new TypeError('Invalid player sociability for social year');
 if(social?.friendsCreated!=null&&!validCounter(social.friendsCreated))
  throw new RangeError('Invalid or overflowing friendsCreated');
 for(const [key,score] of [['healthProfile','stress'],['lateLife','isolation']]){
  const ledger=state[key];
  if(ledger!=null&&(!isRecord(ledger)||
     (ledger[score]!=null&&!validScore(ledger[score]))))
   throw new TypeError('Invalid '+key+' '+score);
 }
 const ids=new Set();
 for(const friend of social?.friends??[]){
  if(!isRecord(friend)||typeof friend.id!=='string'||!friend.id||ids.has(friend.id))
   throw new TypeError('Invalid or duplicate friend ID');
  ids.add(friend.id);
  if(friend.alive===false)continue; // Dead legacy friends are only archived.
  if(!validCounter(friend.age)||
     (friend.yearsKnown!=null&&!validCounter(friend.yearsKnown))||
     !validScore(friend.relationship)||
     (friend.lastContactAge!=null&&(!Number.isSafeInteger(friend.lastContactAge)||
       friend.lastContactAge<0||friend.lastContactAge>state.player.age)))
   throw new RangeError('Invalid or overflowing living friend fields');
  if(friend.health!==undefined&&(!isRecord(friend.health)||!validScore(friend.health.current)))
   throw new TypeError('Invalid friend health');
 }
 // A counter can be valid while pointing at an existing legacy friend ID.
 // Check before any RNG draw rather than inserting a duplicate on a lucky roll.
 const nextId='friend-'+state.year+'-'+((social?.friendsCreated??0)+1);
 if(ids.has(nextId))throw new TypeError('Invalid duplicate generated friend ID');
}

// Snapshot the annual social write set, including public friend/array identities.
// An RNG callback may throw after earlier friends have aged or been archived.
function snapshotSocialYear(state){
 const social=state.social;
 const snapshotRecord=value=>isRecord(value)?structuredClone(value):value;
 const arrays=Object.fromEntries(['friends','deceasedFriends','formerFriends']
  .filter(key=>Array.isArray(social?.[key]))
  .map(key=>[key,{ref:social[key],members:[...social[key]]}]));
 const friends=(Array.isArray(social?.friends)?social.friends:[]).map(ref=>({ref,copy:structuredClone(ref),
  healthRef:isRecord(ref.health)?ref.health:null}));
 return {hasSocial:Object.hasOwn(state,'social'),socialRef:social,socialCopy:snapshotRecord(social),
  arrays,friends,healthRef:state.healthProfile,healthCopy:snapshotRecord(state.healthProfile),
  lateRef:state.lateLife,lateCopy:snapshotRecord(state.lateLife),
  hasHealth:Object.hasOwn(state,'healthProfile'),hasLate:Object.hasOwn(state,'lateLife')};
}
function restoreRecord(target,copy){
 for(const key of Object.keys(target))delete target[key];
 Object.assign(target,copy);
}
function restoreSocialYear(state,before){
 for(const {ref,copy,healthRef} of before.friends){
  restoreRecord(ref,copy);
  if(healthRef){restoreRecord(healthRef,copy.health);ref.health=healthRef;}
 }
 if(isRecord(before.socialRef)){
  restoreRecord(before.socialRef,before.socialCopy);
  for(const [key,{ref,members}] of Object.entries(before.arrays)){
   ref.splice(0,ref.length,...members);
   before.socialRef[key]=ref;
  }
 }
 if(before.hasSocial)state.social=before.socialRef;
 else delete state.social;
 for(const [key,ref,copy] of [
  ['healthProfile',before.healthRef,before.healthCopy],
  ['lateLife',before.lateRef,before.lateCopy]]){
  if(isRecord(ref))restoreRecord(ref,copy);
  if((key==='healthProfile'&&before.hasHealth)||(key==='lateLife'&&before.hasLate))state[key]=ref;
  else delete state[key];
 }
}

function mortalityChance(person){
 const age=person.age??20;
 const health=person.health?.current??75;
 if(age<45)return .00025;
 if(age<60)return .001+(age-45)*.0007;
 if(age<75)return .012+(age-60)*.0022+(100-health)*.00018;
 return Math.min(.24,.045+(age-75)*.006+(100-health)*.00025);
}

export function processSocialYear(state,rng){
 const entries=[];
 // Validate before initializing a missing social record or touching any friend.
 const {calendarYear,replayed}=annualYearStatus(state.year,state.social?.lastProcessedYear,'social life');
 if(replayed)return entries;
 if(state.player?.age>=7)assertSocialYearInputs(state);
 const before=snapshotSocialYear(state);
 // Opt-in custom generators can also restore their draw position on failure.
 const restoreRng=captureRngCheckpoint(rng);
 try {
 state.social??={friends:[]};
 state.social.friends??=[];
 if(state.player.age<7)return entries;

 const survivors=[];
 for(const friend of state.social.friends){
  // Older saves may still contain a deceased friend in the active list.
  // Reconcile without aging them or rolling a second death.
  if(friend.alive===false){
   state.social.deceasedFriends??=[];
   if(!state.social.deceasedFriends.some(p=>p===friend||(friend.id!=null&&p.id===friend.id)))
    state.social.deceasedFriends.push({...friend});
   continue;
  }
  friend.age+=1;
  friend.yearsKnown=(friend.yearsKnown??0)+1;
  friend.lastContactAge??=state.player.age-1;
  if(friend.health){
   const agePenalty=friend.age>=70?2:friend.age>=55?1:0;
   friend.health.current=clamp(friend.health.current+rng.fork('health-'+friend.id).int(-2,1)-agePenalty);
  }

  if(rng.fork('death-'+friend.id).chance(mortalityChance(friend))){
   friend.alive=false;
   friend.deathAge=friend.age;
   friend.deathYear=state.year;
   state.social.deceasedFriends??=[];
   state.social.deceasedFriends.push({...friend});
   entries.push({age:state.player.age,kind:'social',text:'Arkadaşın '+friend.name+' '+friend.surname+' hayatını kaybetti.'});
   if(state.healthProfile)state.healthProfile.stress=clamp((state.healthProfile.stress??30)+4);
   if(state.lateLife)state.lateLife.isolation=clamp((state.lateLife.isolation??0)+5);
   continue;
  }

  const yearsSinceContact=Math.max(0,state.player.age-(friend.lastContactAge??state.player.age));
  const movedAway=friend.cityId&&(state.location?.cityId??state.origin?.cityId)!==friend.cityId;
  const longBond=(friend.yearsKnown??0)>=8?1:0;
  let drift=rng.fork('rel-'+friend.id).int(-2,1)+longBond;
  if(yearsSinceContact>=3)drift-=1;
  if(yearsSinceContact>=6)drift-=1;
  if(movedAway&&yearsSinceContact>=2)drift-=1;
  friend.relationship=clamp(friend.relationship+drift);
  friend.closeFriend=Boolean((friend.closeFriend&&friend.relationship>=55)||(friend.relationship>=78&&(friend.yearsKnown??0)>=4));

  if(friend.relationship<12&&!friend.closeFriend){
   state.social.formerFriends??=[];
   state.social.formerFriends.push({...friend,endedAtAge:state.player.age});
   entries.push({age:state.player.age,kind:'social',text:friend.name+' ile zaman içinde uzaklaştınız.'});
   continue;
  }
  survivors.push(friend);
 }
 state.social.friends=survivors;

 const age=state.player.age;
 const adultPenalty=age>=60?.28:age>=19?.58:1;
 const cap=3+Math.floor(state.player.personality.sociability/22)+(age>=19?1:0);
 const chance=(0.11+state.player.personality.sociability/320)*adultPenalty;

 if(state.social.friends.length<cap&&rng.chance(chance)){
  const id='friend-'+state.year+'-'+((state.social.friendsCreated??0)+1);
  const friend=createFriend(state,rng.fork(id),id);
  state.social.friends.push(friend);
  state.social.friendsCreated=(state.social.friendsCreated??0)+1;
  entries.push({age,kind:'social',text:friend.name+' '+friend.surname+' ile arkadaş oldun.'});
 }
 if(calendarYear!==null)state.social.lastProcessedYear=calendarYear;
 return entries;
 }catch(error){
  restoreSocialYear(state,before);
  restoreRngOrThrow(restoreRng,error);
 }
}
