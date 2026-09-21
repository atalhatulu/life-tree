import { generateNewbornSibling } from './family_generator.js';

const clamp = (v, min=0, max=100) => Math.max(min,Math.min(max,v));

function ageHealth(person, rng) {
  if (!person.alive) return;
  const agePenalty = person.age >= 65 ? 2 : person.age >= 45 ? 1 : 0;
  person.health.current = clamp(person.health.current + rng.int(-2, 2) - agePenalty);
}

function siblingMortalityChance(person){
  if(!person.alive)return 0;
  const age=person.age;
  const health=person.health?.current??70;
  if(age<45)return .0003;
  if(age<60)return .001+(age-45)*.0008;
  if(age<75)return .014+(age-60)*.0024+(100-health)*.00018;
  return Math.min(.26,.05+(age-75)*.006+(100-health)*.00025);
}

function processSiblingLosses(state,rng,entries){
  for(const sibling of state.siblings){
    if(!sibling.alive)continue;
    if(!rng.fork('sibling-death-'+sibling.id).chance(siblingMortalityChance(sibling)))continue;
    sibling.alive=false;
    sibling.deathAge=sibling.age;
    sibling.deathYear=state.year;
    state.deceasedSiblings??=[];
    state.deceasedSiblings.push(sibling.id);
    entries.push({
      age:state.player.age,
      kind:'family',
      text:'Kardeşin '+sibling.name+' '+sibling.surname+' '+sibling.age+' yaşında hayatını kaybetti.'
    });
    if(state.healthProfile)state.healthProfile.stress=clamp(state.healthProfile.stress+5);
    if(state.lateLife)state.lateLife.isolation=clamp(state.lateLife.isolation+4);
  }
}

function canHaveNewSibling(state) {
  const mother = state.parents.mother;
  if (!mother.alive || mother.age < 22 || mother.age > 41) return false;
  if (state.siblings.length >= 5) return false;
  return state.player.age >= 1 && state.player.age <= 10;
}

export function processFamilyYear(state, rng) {
  const entries = [];
  const familyMembers = [
    state.parents.mother,
    state.parents.father,
    ...state.siblings,
    state.grandparents.maternal.grandmother,
    state.grandparents.maternal.grandfather,
    state.grandparents.paternal.grandmother,
    state.grandparents.paternal.grandfather
  ];

  for (const person of familyMembers) ageHealth(person, rng.fork('health-'+person.id));
  processSiblingLosses(state,rng,entries);

  if (canHaveNewSibling(state)) {
    const motherAge = state.parents.mother.age;
    const familySizePenalty = state.siblings.length * 0.025;
    const agePenalty = Math.max(0, motherAge - 34) * 0.012;
    const chance = Math.max(0.015, 0.10 - familySizePenalty - agePenalty);
    if (rng.chance(chance)) {
      const id = 'sibling-born-'+state.year+'-'+state.siblings.length;
      const newborn = generateNewbornSibling(rng.fork(id), state, id);
      state.siblings.push(newborn);
      state.household.people += 1;
      state.player.relationships[id] = rng.int(55, 82);
      entries.push({
        age: state.player.age,
        kind: 'family',
        text: newborn.name+' adında bir '+(newborn.sex === 'female' ? 'kız' : 'erkek')+' kardeşin dünyaya geldi.'
      });
    }
  }

  return entries;
}
