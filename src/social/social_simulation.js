import {createFriend} from './friend_generator.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

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
 state.social??={friends:[]};
 state.social.friends??=[];
 if(state.player.age<7)return entries;

 const survivors=[];
 for(const friend of state.social.friends){
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
   if(state.healthProfile)state.healthProfile.stress=clamp(state.healthProfile.stress+4);
   if(state.lateLife)state.lateLife.isolation=clamp(state.lateLife.isolation+5);
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
 return entries;
}
