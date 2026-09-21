function careerRetirementEligibility(state){
 const age=state.player.age;
 const years=state.career?.totalYears??state.career?.years??0;
 return age>=58&&Boolean(state.career?.employed)&&years>=5;
}

function businessRetirementEligibility(state){
 const b=state.business;
 return state.player.age>=60&&Boolean(b?.active)&&b.mode==='full-time'&&(b.years??0)>=5;
}

export function retirementEligibility(state){
 return careerRetirementEligibility(state)||businessRetirementEligibility(state);
}

function retireFromCareer(state){
 const c=state.career;
 const pension=Math.max(18000,Math.round(c.monthlyIncome*.42));
 state.retirement={
  retired:true,
  source:'career',
  retiredAtAge:state.player.age,
  previousTitle:c.title,
  pensionMonthly:pension,
  years:0
 };
 c.employed=false;
 state.player.job='Emekli';
 state.player.monthlyIncome=pension;
 state.nextPath='retired';
 return state.retirement;
}

function retireFromBusiness(state){
 const b=state.business;
 const healthFactor=Math.max(.30,Math.min(1.35,(b.health??50)/65));
 const saleValue=Math.max(0,Math.round((b.capital??0)*healthFactor));
 state.finance??={cash:0,debt:0};
 state.finance.cash=(state.finance.cash??0)+saleValue;

 const profitBase=Math.max(0,b.monthlyProfit??0);
 const pension=Math.max(18000,Math.round(16000+Math.min(32000,profitBase*.22)));

 b.active=false;
 b.retiredAtAge=state.player.age;
 b.exitType='retirement-sale';
 b.saleValue=saleValue;

 state.retirement={
  retired:true,
  source:'business',
  retiredAtAge:state.player.age,
  previousTitle:'Girişimci',
  pensionMonthly:pension,
  businessSaleValue:saleValue,
  years:0
 };
 state.player.job='Emekli girişimci';
 state.player.jobId=null;
 state.player.monthlyIncome=pension;
 state.nextPath='retired';
 return state.retirement;
}

export function retire(state){
 if(!retirementEligibility(state))throw new Error('Henüz emekliliğe uygun değilsin.');
 if(businessRetirementEligibility(state)&&!state.career?.employed){
  return retireFromBusiness(state);
 }
 return retireFromCareer(state);
}

export function processRetirementYear(state){
 if(!state.retirement?.retired)return [];
 state.retirement.years=(state.retirement.years??0)+1;
 return [];
}
