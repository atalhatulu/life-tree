import {createFriend} from './friend_generator.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function processSocialYear(state,rng){
 const entries=[];
 state.social??={friends:[]};
 if(state.player.age<7||state.player.age>18)return entries;
 for(const friend of state.social.friends){
  friend.age+=1;
  friend.relationship=clamp(friend.relationship+rng.fork(`rel-${friend.id}`).int(-4,4));
 }
 const cap=2+Math.floor(state.player.personality.sociability/25);
 const chance=0.16+state.player.personality.sociability/250;
 if(state.social.friends.length<cap&&rng.chance(chance)){
  const id=`friend-${state.year}-${state.social.friends.length}`;
  const friend=createFriend(state,rng.fork(id),id);
  state.social.friends.push(friend);
  entries.push({age:state.player.age,kind:'social',text:`${friend.name} ${friend.surname} ile arkadaş oldun.`});
 }
 return entries;
}
