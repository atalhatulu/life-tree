import {changeTrait,growTrait} from '../character/personality_dynamics.js';
const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));

export function processChildhoodYear(state, rng) {
  const entries = [];
  const player = state.player;
  if (player.age > 18) return entries;

  const homeSupport = (state.household.educationSupport + state.household.hobbySupport) / 2;
  const familyBond = ((player.relationships.mother ?? 60) + (player.relationships.father ?? 60)) / 2;

  if (player.age <= 5) {
    player.personality.curiosity = changeTrait(player.personality.curiosity,rng.int(-1,3));
    player.health.current = clamp(player.health.current + rng.int(-2, 2) + (player.health.constitution > 65 ? 1 : 0));

    if (rng.chance(0.24)) {
      const delta = homeSupport >= 60 ? 2 : 1;
      player.personality.sociability = growTrait(player.personality.sociability,delta);
      entries.push({ age: player.age, kind: 'development', text: 'Ailenle geçirdiğin zaman sosyal gelişimini etkiledi.' });
    }
  }

  if (state.education?.enrolled) {
    const e=state.education;
    const target=clamp(
      (e.aptitude ?? 50)*.26+
      player.personality.discipline*.16+
      state.household.educationSupport*.16+
      e.quality*.12+
      e.motivation*.12+
      player.health.current*.08+
      (e.studyEffort ?? 0)*.10
    );
    const convergence=(target-e.performance)*.34;
    e.performance=clamp(e.performance+convergence+rng.int(-3,3));
    e.motivation=clamp(e.motivation+rng.int(-4,4)+(familyBond>70?1:0));
    e.studyEffort=0;
  }

  return entries;
}
