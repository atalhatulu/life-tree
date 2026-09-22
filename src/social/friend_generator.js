import {FIRST_NAMES,SURNAMES} from '../data/catalog.js';
import {createPersonBase} from '../character/person.js';

function friendshipType(state){
 const age=state.player.age;
 if(age<=12)return 'childhood';
 if(age<=18)return 'school';
 if(state.higherEducation?.enrolled)return 'university';
 if(state.career?.employed)return 'coworker';
 return 'adult';
}

export function createFriend(state,rng,id){
 const sex=rng.chance(.5)?'female':'male';
 const age=Math.max(6,state.player.age+rng.int(-1,1));
 const friend=createPersonBase({id,name:rng.pick(FIRST_NAMES[sex]),surname:rng.pick(SURNAMES),sex,age,rng});
 friend.relationship=rng.int(48,70);
 friend.role='friend';
 friend.friendshipType=friendshipType(state);
 friend.yearsKnown=0;
 friend.lastContactAge=state.player.age;
 friend.cityId=state.location?.cityId??state.origin?.cityId;
 friend.cityName=state.location?.cityName??state.origin?.cityName;
 friend.closeFriend=false;
 return friend;
}
