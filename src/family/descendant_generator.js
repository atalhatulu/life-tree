import {FIRST_NAMES} from '../data/catalog.js';
import {createPersonBase} from '../character/person.js';
import {inheritFromParents} from '../character/genetics.js';

export function createChild(state,rng,id){
 const partner=state.social?.romance;
 if(!partner) throw new Error('Çocuk için aktif bir eş/partner gerekli.');
 const sex=rng.chance(.5)?'female':'male';
 const surname=state.player.surname;
 const child=createPersonBase({id,name:rng.pick(FIRST_NAMES[sex]),surname,sex,age:0,rng});
 const inherited=inheritFromParents(rng.fork('genetics'),state.player,partner,sex);
 child.appearance=inherited.appearance;
 child.health.constitution=inherited.health.constitution;
 child.role='child';
 child.relationship=70;
 return child;
}
