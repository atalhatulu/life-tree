import {changeTrait,growTrait} from '../character/personality_dynamics.js';
const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));

export function processChildhoodYear(state, rng) {
  const entries = [];
  const player = state.player;
  if (player.age > 18) return entries;

  const homeSupport = (state.household.educationSupport + state.household.hobbySupport) / 2;
  state.childMoney??={wallet:0,saved:0,totalAllowance:0,totalSpent:0,lastAllowanceAge:null};
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

  if (player.age >= 7 && player.age <= 17 && state.childMoney.lastAllowanceAge !== player.age) {
    const classBase={düşük:350,orta:700,'üst-orta':1200,yüksek:2200}[state.household.economicClass]??600;
    const ageFactor=player.age<10?.65:player.age<14?1:1.35;
    const relationship=((player.relationships.mother??60)+(player.relationships.father??60))/2;
    const relationFactor=relationship>=70?1.12:relationship<45?.72:1;
    const allowance=Math.max(100,Math.round(classBase*ageFactor*relationFactor));
    state.childMoney.wallet+=allowance;
    state.childMoney.totalAllowance+=allowance;
    state.childMoney.lastAllowanceAge=player.age;
    entries.push({age:player.age,kind:'child-money',text:'Bu yıl harçlık olarak ₺'+allowance.toLocaleString('tr-TR')+' aldın.'});
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
