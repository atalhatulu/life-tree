import { generateNewbornSibling } from './family_generator.js';

const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));

function ageHealth(person, rng) {
  if (!person.alive) return;
  const agePenalty = person.age >= 65 ? 2 : person.age >= 45 ? 1 : 0;
  person.health.current = clamp(person.health.current + rng.int(-2, 2) - agePenalty);
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

  for (const person of familyMembers) ageHealth(person, rng.fork(`health-${person.id}`));

  if (canHaveNewSibling(state)) {
    const motherAge = state.parents.mother.age;
    const familySizePenalty = state.siblings.length * 0.025;
    const agePenalty = Math.max(0, motherAge - 34) * 0.012;
    const chance = Math.max(0.015, 0.10 - familySizePenalty - agePenalty);
    if (rng.chance(chance)) {
      const id = `sibling-born-${state.year}-${state.siblings.length}`;
      const newborn = generateNewbornSibling(rng.fork(id), state, id);
      state.siblings.push(newborn);
      state.household.people += 1;
      state.player.relationships[id] = rng.int(55, 82);
      entries.push({
        age: state.player.age,
        kind: 'family',
        text: `${newborn.name} adında bir ${newborn.sex === 'female' ? 'kız' : 'erkek'} kardeşin dünyaya geldi.`
      });
    }
  }

  return entries;
}
