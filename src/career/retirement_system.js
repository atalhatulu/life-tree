import {safeCashAmount,previewCashCredit} from '../finance/safe_cash.js';
import {annualYearStatus} from '../core/annual_clock.js';

function careerRetirementEligibility(state){
 const age=state.player.age;
 const years=state.career?.totalYears??state.career?.years??0;
 return age>=58&&Boolean(state.career?.employed)&&years>=5;
}

function businessRetirementEligibility(state){
 const b=state.business;
 return state.player.age>=60&&Boolean(b)&&(b.active||b.closedAtAge===state.player.age)&&b.mode==='full-time'&&(b.years??0)>=5;
}

export function retirementEligibility(state){
 return careerRetirementEligibility(state)||businessRetirementEligibility(state);
}

function retireFromCareer(state){
 const c=state.career;
 const income=c.monthlyIncome;
 if(typeof income!=='number'||!Number.isSafeInteger(income)||income<0)
  throw new RangeError('Invalid career income for retirement');
 const pension=Math.max(18000,Math.round(income*.42));
 state.retirement={
  retired:true,
  source:'career',
  retiredAtAge:state.player.age,
  previousTitle:c.title,
  pensionMonthly:pension,
  years:0
 };
 c.employed=false;
 state.pendingJobOffers=null;
 state.pendingCareerOffers=null;
 state.player.job='Emekli';
 state.player.jobId=null;
 state.player.monthlyIncome=pension;
 state.nextPath='retired';
 return state.retirement;
}

function retireFromBusiness(state){
 const b=state.business;
 const health=b.health??50;
 if(typeof health!=='number'||!Number.isFinite(health)||health<0||health>100)
  throw new RangeError('Invalid business health for retirement');
 const healthFactor=Math.max(.30,Math.min(1.35,health/65));
 const capital=safeCashAmount(b.capital??0,'Business capital');
 const saleValue=b.active?safeCashAmount(capital*healthFactor,'Business sale value'):0;
 const newCash=previewCashCredit(state,saleValue);
 const monthlyProfit=b.monthlyProfit??0;
 if(typeof monthlyProfit!=='number'||!Number.isSafeInteger(monthlyProfit))
  throw new RangeError('Invalid business profit for retirement');
 const profitBase=Math.max(0,monthlyProfit);
 const pension=Math.max(18000,Math.round(16000+Math.min(32000,profitBase*.22)));
 state.finance??={cash:0,debt:0};
 state.finance.cash=newCash;

 b.active=false;
 state.pendingJobOffers=null;
 state.pendingCareerOffers=null;
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
 if(state.retirement?.retired)throw new Error('Zaten emekli oldun.');
 if(!retirementEligibility(state))throw new Error('Henüz emekliliğe uygun değilsin.');
 if(businessRetirementEligibility(state)&&!state.career?.employed){
  return retireFromBusiness(state);
 }
 return retireFromCareer(state);
}

export function processRetirementYear(state){
 const retirement=state.retirement;
 if(!retirement?.retired)return [];
 const {calendarYear,replayed}=annualYearStatus(state.year,retirement.lastProcessedYear,'retirement');
 if(replayed)return [];
 const years=retirement.years??0;
 if(!Number.isSafeInteger(years)||years<0||years===Number.MAX_SAFE_INTEGER)
  throw new RangeError('Invalid retirement year counter');
 retirement.years=years+1;
 if(calendarYear!==null)retirement.lastProcessedYear=calendarYear;
 return [];
}
