import {FIRST_NAMES,SURNAMES} from '../data/catalog.js';
import {createPersonBase} from '../character/person.js';

export function createFriend(state,rng,id){
 const sex=rng.chance(.5)?'female':'male';
 const age=Math.max(6,state.player.age+rng.int(-1,1));
 const friend=createPersonBase({id,name:rng.pick(FIRST_NAMES[sex]),surname:rng.pick(SURNAMES),sex,age,rng});
 friend.relationship=rng.int(48,72);
 friend.role='friend';
 return friend;
}
