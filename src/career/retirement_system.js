export function retirementEligibility(state){
 const age=state.player.age;
 const years=state.career?.totalYears??state.career?.years??0;
 return age>=58&&Boolean(state.career?.employed)&&years>=5;
}

export function retire(state){
 if(!retirementEligibility(state))throw new Error('Henüz emekliliğe uygun değilsin.');
 const c=state.career;
 const pension=Math.max(18000,Math.round(c.monthlyIncome*.42));
 state.retirement={
  retired:true,
  retiredAtAge:state.player.age,
  previousTitle:c.title,
  pensionMonthly:pension
 };
 c.employed=false;
 state.player.job='Emekli';
 state.player.monthlyIncome=pension;
 state.nextPath='retired';
 return state.retirement;
}

export function processRetirementYear(state){
 if(!state.retirement?.retired)return [];
 state.retirement.years=(state.retirement.years??0)+1;
 return [];
}
