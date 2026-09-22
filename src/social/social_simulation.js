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
 if(state.player.age<7)return entries;

 const survivors=[];
 for(const friend of state.social.friends){
  friend.age+=1;
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

  survivors.push(friend);
 }
 state.social.friends=survivors;

 const age=state.player.age;
 const adultPenalty=age>=60?.30:age>=19?.55:1;
 const cap=2+Math.floor(state.player.personality.sociability/25)+(age>=19?1:0);
 const chance=(0.16+state.player.personality.sociability/250)*adultPenalty;

 if(state.social.friends.length<cap&&rng.chance(chance)){
  const id='friend-'+state.year+'-'+state.social.friends.length;
  const friend=createFriend(state,rng.fork(id),id);
  state.social.friends.push(friend);
  entries.push({age,kind:'social',text:friend.name+' '+friend.surname+' ile arkadaş oldun.'});
 }
 return entries;
}
