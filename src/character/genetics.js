function inheritValue(rng, a, b, mutation = 12) {
  const midpoint = (a + b) / 2;
  return Math.max(1, Math.min(100, Math.round(midpoint + rng.int(-mutation, mutation))));
}

export function inheritFromParents(rng, mother, father) {
  return {
    appearance: {
      heightPotential: inheritValue(rng, mother.appearance.heightPotential, father.appearance.heightPotential, 10),
      attractiveness: inheritValue(rng, mother.appearance.attractiveness, father.appearance.attractiveness, 14),
      build: inheritValue(rng, mother.appearance.build, father.appearance.build, 15)
    },
    health: {
      constitution: inheritValue(rng, mother.health.constitution, father.health.constitution, 12)
    }
  };
}
