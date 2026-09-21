import { FIRST_NAMES, SURNAMES, JOBS, HOBBIES } from '../data/catalog.js';
import { createPersonBase } from '../character/person.js';
import { inheritFromParents } from '../character/genetics.js';

function assignAdultLife(person, rng) {
  const job = rng.weighted(JOBS.map((value) => ({ value, weight: value.title === 'İşsiz' ? 0.08 : 1 })));
  person.job = job.title;
  person.monthlyIncome = rng.int(job.income[0], job.income[1]);

  const hobbyCount = rng.int(1, 3);
  const pool = [...new Set([...job.interests, ...HOBBIES])];
  while (Object.keys(person.interests).length < hobbyCount) {
    person.interests[rng.pick(pool)] = rng.int(45, 95);
  }
  return person;
}

function makeAdult(rng, sex, surname, id, ageRange = [22, 48]) {
  const person = createPersonBase({
    id,
    name: rng.pick(FIRST_NAMES[sex]),
    surname,
    sex,
    age: rng.int(...ageRange),
    rng
  });
  return assignAdultLife(person, rng);
}

function generateGrandparents(rng, parent, side) {
  const surname = side === 'father' ? parent.surname : rng.pick(SURNAMES);
  return {
    grandmother: makeAdult(rng.fork(`${side}-gm`), 'female', surname, `${side}-grandmother`, [45, 78]),
    grandfather: makeAdult(rng.fork(`${side}-gf`), 'male', surname, `${side}-grandfather`, [47, 82])
  };
}

function deriveChildInterests(rng, mother, father) {
  const interests = {};
  const sources = new Set([...Object.keys(mother.interests), ...Object.keys(father.interests)]);
  for (const interest of sources) {
    const exposure = ((mother.interests[interest] || 0) + (father.interests[interest] || 0)) / 2;
    if (exposure > 20 || rng.chance(0.35)) interests[interest] = Math.round(exposure * 0.35 + rng.int(0, 25));
  }
  return interests;
}

export function generateFamily(seed) {
  const root = seed.fork('family');
  const surname = root.pick(SURNAMES);
  const father = makeAdult(root.fork('father'), 'male', surname, 'father');
  const mother = makeAdult(root.fork('mother'), 'female', surname, 'mother');

  const inherited = inheritFromParents(root.fork('genetics'), mother, father);
  const child = createPersonBase({
    id: 'player',
    name: root.pick([...FIRST_NAMES.female, ...FIRST_NAMES.male]),
    surname,
    sex: root.chance(0.5) ? 'female' : 'male',
    age: 0,
    rng: root.fork('child')
  });
  child.appearance = inherited.appearance;
  child.health.constitution = inherited.health.constitution;
  child.interests = deriveChildInterests(root.fork('interests'), mother, father);

  const siblingCount = root.weighted([
    { value: 0, weight: 2 }, { value: 1, weight: 4 }, { value: 2, weight: 2 }, { value: 3, weight: 1 }
  ]);
  const siblings = Array.from({ length: siblingCount }, (_, index) => {
    const srng = root.fork(`sibling-${index}`);
    const sibling = createPersonBase({
      id: `sibling-${index}`,
      name: srng.pick([...FIRST_NAMES.female, ...FIRST_NAMES.male]),
      surname,
      sex: srng.chance(0.5) ? 'female' : 'male',
      age: srng.int(0, 12),
      rng: srng
    });
    sibling.appearance = inheritFromParents(srng.fork('genetics'), mother, father).appearance;
    return sibling;
  });

  const householdIncome = mother.monthlyIncome + father.monthlyIncome;
  return {
    player: child,
    parents: { mother, father },
    grandparents: {
      maternal: generateGrandparents(root, mother, 'mother'),
      paternal: generateGrandparents(root, father, 'father')
    },
    siblings,
    household: {
      monthlyIncome: householdIncome,
      economicClass: householdIncome < 45000 ? 'düşük' : householdIncome < 100000 ? 'orta' : 'yüksek'
    }
  };
}
