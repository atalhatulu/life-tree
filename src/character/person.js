export function createPersonBase({ id, name, surname, sex, age, rng }) {
  return {
    id,
    name,
    surname,
    sex,
    age,
    alive: true,
    appearance: {
      heightPotential: rng.int(1, 100),
      attractiveness: rng.int(20, 90),
      build: rng.int(20, 90)
    },
    health: {
      constitution: rng.int(35, 95),
      current: rng.int(60, 100)
    },
    personality: {
      discipline: rng.int(15, 95),
      sociability: rng.int(15, 95),
      ambition: rng.int(15, 95),
      curiosity: rng.int(15, 95)
    },
    interests: {},
    job: null,
    monthlyIncome: 0
  };
}
