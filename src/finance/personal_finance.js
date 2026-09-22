import {TURKEY_2026_ECONOMY} from '../data/countries/turkey/economy.js';
import {lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';
import {economy} from '../world/world_state.js';

const STARTING_CASH_BY_CLASS={düşük:2500,orta:7500,'üst-orta':18000,yüksek:50000};
const STUDENT_SUPPORT_BY_CLASS={düşük:3500,orta:7500,'üst-orta':11000,yüksek:17000};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function ensurePersonalFinance(state){
 if(state.finance){
  state.finance.savings??=0;
  state.finance.financialDistressYears??=0;
  state.finance.financialDistressEvents??=0;
  state.finance.debtRestructured??=false;
  return state.finance;
 }
 const studentAwayFromHome=Boolean(state.higherEducation?.enrolled&&state.higherEducation?.movedForUniversity);
 state.finance={
  cash:STARTING_CASH_BY_CLASS[state.household.economicClass]??5000,
  savings:0,
  debt:0,
  monthlyIncome:0,
  monthlyExpenses:0,
  familySupportMonthly:0,
  childMonthlyCost:0,
  financialDistressYears:0,
  financialDistressEvents:0,
  debtRestructured:false,
  lifestyle:{housing:studentAwayFromHome?'shared':'family',food:'standard',clothing:'basic',transport:'public'}
 };
 return state.finance;
}

function familySupport(state){
 const isStudent=state.higherEducation?.enrolled;
 const isYoungGap=state.nextPath==='gap'&&state.player.age<=22;
 if(!isStudent&&!isYoungGap)return 0;
 const livingParents=[['mother',state.parents?.mother],['father',state.parents?.father]].filter(([,person])=>person?.alive);
 if(!livingParents.length)return 0;
 const relationship=livingParents.reduce((sum,[id])=>sum+(state.player.relationships?.[id]??60),0)/livingParents.length;
 const relationFactor=relationship>=70?1:relationship>=50?.8:.55;
 const survivingFactor=livingParents.length===2?1:.58;
 return Math.round((STUDENT_SUPPORT_BY_CLASS[state.household.economicClass]??4500)*relationFactor*survivingFactor);
}

function effectiveTaxRate(monthly,retired=false){
 if(retired)return .06;
 const mw=TURKEY_2026_ECONOMY.netMinimumWage;
 if(monthly<=mw*1.4)return .12;
 if(monthly<=mw*2.8)return .18;
 if(monthly<=mw*5)return .23;
 return .28;
}

function lateLifeCareCosts(state){
 const mode=state.lateLife?.careMode;
 if(!mode)return 0;
 if(mode==='family')return 3000;
 if(mode==='home-care')return 14000;
 if(mode==='assisted')return 26000;
 return 0;
}

function recurringOwnershipCosts(state){
 let monthly=0;
 if(state.assets?.home)monthly+=Math.round((state.assets.home.price??0)*.007/12);
 if(state.assets?.car)monthly+=Math.round((state.assets.car.price??0)*.025/12);
 monthly+=(state.healthProfile?.conditions?.length??0)*1200;
 return monthly;
}

function partnerContribution(state){
 const r=state.social?.romance;
 if(!r||!['cohabiting','married'].includes(r.status))return 0;
 return Math.round((r.monthlyIncome??0)*.55);
}

function securedDebt(state){
 return Math.max(0,state.assets?.home?.remainingDebt??0)+Math.max(0,state.assets?.car?.remainingDebt??0);
}

function unsecuredDebt(state){
 return Math.max(0,(state.finance?.debt??0)-securedDebt(state));
}

function reduceDebtBalances(state,payment){
 const f=state.finance;
 let remaining=Math.min(Math.max(0,Math.round(payment)),Math.max(0,f.debt??0));
 if(remaining<=0)return 0;
 const paid=remaining;
 f.debt=Math.max(0,f.debt-remaining);

 const homeDebt=Math.max(0,state.assets?.home?.remainingDebt??0);
 const carDebt=Math.max(0,state.assets?.car?.remainingDebt??0);
 const secured=homeDebt+carDebt;
 if(secured>0){
  const securedPayment=Math.min(remaining,secured);
  if(state.assets?.home?.remainingDebt){
   const share=homeDebt/secured;
   state.assets.home.remainingDebt=Math.max(0,Math.round(homeDebt-securedPayment*share));
  }
  if(state.assets?.car?.remainingDebt){
   const share=carDebt/secured;
   state.assets.car.remainingDebt=Math.max(0,Math.round(carDebt-securedPayment*share));
  }
 }
 return paid;
}

function sweepExcessLiquidityToUnsecuredDebt(state,reserveTarget){
 const f=state.finance;
 const unsecured=unsecuredDebt(state);
 if(unsecured<=0)return 0;
 const liquid=(f.cash??0)+(f.savings??0);
 const excess=Math.max(0,liquid-reserveTarget);
 if(excess<=0)return 0;

 const payment=Math.min(unsecured,excess);
 let remaining=payment;
 const savingsUsed=Math.min(f.savings??0,remaining);
 f.savings-=savingsUsed;
 remaining-=savingsUsed;
 if(remaining>0){
  const cashFloor=Math.min(f.cash??0,reserveTarget);
  const cashAvailable=Math.max(0,(f.cash??0)-cashFloor);
  const cashUsed=Math.min(cashAvailable,remaining);
  f.cash-=cashUsed;
  remaining-=cashUsed;
 }
 const actual=payment-remaining;
 if(actual>0)reduceDebtBalances(state,actual);
 return actual;
}

function serviceDebt(state,available){
 const f=state.finance;
 if(f.debt<=0||available<=0)return available;
 const payment=Math.min(f.debt,Math.round(available*.70));
 if(payment<=0)return available;
 reduceDebtBalances(state,payment);
 return available-payment;
}

function drawReserves(f,amount){
 let remaining=Math.max(0,amount);
 const cashUsed=Math.min(f.cash,remaining);
 f.cash-=cashUsed;
 remaining-=cashUsed;
 const savingsUsed=Math.min(f.savings??0,remaining);
 f.savings-=savingsUsed;
 remaining-=savingsUsed;
 return remaining;
}

function discretionaryRate(state){
 const l=state.finance.lifestyle;
 let rate=.18;
 if(l.food==='premium')rate+=.08;
 else if(l.food==='healthy')rate+=.03;
 else if(l.food==='frugal')rate-=.05;
 if(l.clothing==='premium')rate+=.05;
 if(l.transport==='car')rate+=.03;
 if(l.housing==='apartment')rate+=.03;
 if(state.retirement?.retired)rate-=.04;
 return clamp(rate,.10,.42);
}

function cashReserveTarget(f){
 const mw=TURKEY_2026_ECONOMY.netMinimumWage;
 return Math.round(clamp((f.monthlyExpenses+f.ownershipCostsMonthly)*6,mw*3.3,mw*50));
}

function downgradeLifestyle(state){
 const l=state.finance.lifestyle;
 let changed=false;
 if(l.clothing==='premium'){l.clothing='standard';changed=true;}
 else if(l.clothing==='standard'){l.clothing='basic';changed=true;}
 if(l.food==='premium'){l.food='healthy';changed=true;}
 if(!state.assets?.car&&l.transport==='car'){l.transport='public';changed=true;}
 if(['apartment','studio'].includes(l.housing)){l.housing='shared';changed=true;}
 return changed;
}

function liquidateCar(state){
 const car=state.assets?.car;
 if(!car)return 0;
 const proceeds=Math.round((car.price??0)*.45);
 state.finance.debt=Math.max(0,state.finance.debt-proceeds);
 state.assets.car=null;
 state.finance.lifestyle.transport='public';
 return proceeds;
}

function liquidateHome(state){
 const home=state.assets?.home;
 if(!home)return 0;
 const proceeds=Math.round((home.price??0)*.88);
 state.finance.debt=Math.max(0,state.finance.debt-proceeds);
 state.assets.home=null;
 state.finance.lifestyle.housing='shared';
 return proceeds;
}

function manageFinancialDistress(state,annualIncome,reserveTarget){
 const f=state.finance;
 const secured=securedDebt(state);
 const debtCapacity=secured+Math.max(TURKEY_2026_ECONOMY.netMinimumWage*25,annualIncome*2.5);
 const liquid=(f.cash??0)+(f.savings??0);
 const distressed=f.debt>debtCapacity&&liquid<reserveTarget*.5;
 const actions=[];
 if(distressed){
  f.financialDistressYears=(f.financialDistressYears??0)+1;
  f.financialDistressEvents=(f.financialDistressEvents??0)+1;
 }else{
  f.financialDistressYears=Math.max(0,(f.financialDistressYears??0)-1);
  return actions;
 }
 if(downgradeLifestyle(state))actions.push('yaşam giderleri düşürüldü');
 if(f.financialDistressYears>=2&&state.assets?.car){
  const proceeds=liquidateCar(state);
  actions.push('araç satıldı (₺'+proceeds.toLocaleString('tr-TR')+')');
 }
 if(f.financialDistressYears>=3&&state.assets?.home&&f.debt>annualIncome*4+(state.assets.home.remainingDebt??0)){
  const proceeds=liquidateHome(state);
  actions.push('ev satıldı (₺'+proceeds.toLocaleString('tr-TR')+')');
 }
 if(
  f.financialDistressYears>=4&&!state.assets?.home&&!state.assets?.car&&
  f.debt>Math.max(TURKEY_2026_ECONOMY.netMinimumWage*50,annualIncome*6)&&
  (f.lastRestructureAge==null||state.player.age-f.lastRestructureAge>=5)
 ){
  const before=f.debt;
  const affordableDebt=Math.max(TURKEY_2026_ECONOMY.netMinimumWage*8.3,annualIncome*3.5);
  const settlementTarget=Math.max(affordableDebt,Math.round(f.debt*.70));
  f.debt=Math.min(f.debt,Math.round(settlementTarget));
  f.debtRestructured=true;
  f.lastRestructureAge=state.player.age;
  actions.push('borç yeniden yapılandırıldı (₺'+Math.round(before-f.debt).toLocaleString('tr-TR')+' uzlaşma indirimi)');
 }

 if(
  f.financialDistressYears>=8&&!state.assets?.home&&!state.assets?.car&&
  f.debt>Math.max(TURKEY_2026_ECONOMY.netMinimumWage*16.7,annualIncome*4)&&
  (f.cash??0)+(f.savings??0)<reserveTarget*.25
 ){
  const before=f.debt;
  const sustainable=Math.max(TURKEY_2026_ECONOMY.netMinimumWage*5,annualIncome*2.5);
  f.debt=Math.min(f.debt,Math.round(sustainable));
  f.debtRestructured=true;
  f.insolvencyResolved=true;
  actions.push('uzun süreli ödeme güçlüğü sonrası borç ödeme kapasitesine göre uzlaştırıldı (₺'+Math.round(before-f.debt).toLocaleString('tr-TR')+' indirildi)');
 }
 return actions;
}

export function processPersonalFinanceYear(state){
 const f=ensurePersonalFinance(state);
 f.monthlyIncome=state.career?.employed?state.career.monthlyIncome:(state.retirement?.retired?state.retirement.pensionMonthly:0);
 f.familySupportMonthly=familySupport(state);
 f.partnerContributionMonthly=partnerContribution(state);
 f.adultChildSupportMonthly=state.lateLife?.familySupportMonthly??0;
 const macro=economy(state);
 f.monthlyExpenses=Math.round((lifestyleMonthlyCost(state)+(f.childMonthlyCost??0)+lateLifeCareCosts(state))*macro.costOfLiving);
 const taxRate=effectiveTaxRate(f.monthlyIncome,Boolean(state.retirement?.retired));
 f.monthlyTax=Math.round(f.monthlyIncome*taxRate);
 f.ownershipCostsMonthly=recurringOwnershipCosts(state);
 const annualIncome=(f.monthlyIncome-f.monthlyTax+f.familySupportMonthly+f.partnerContributionMonthly+f.adultChildSupportMonthly)*12;
 const annualExpense=(f.monthlyExpenses+f.ownershipCostsMonthly)*12;
 const annualNet=annualIncome-annualExpense;
 f.discretionaryAnnual=0;

 if(annualNet>=0){
  f.discretionaryAnnual=Math.round(annualNet*discretionaryRate(state));
  let available=Math.max(0,annualNet-f.discretionaryAnnual);
  available=serviceDebt(state,available);
  const reserveTarget=cashReserveTarget(f);
  const reserveNeed=Math.max(0,reserveTarget-f.cash);
  const toCash=Math.min(reserveNeed,available);
  f.cash+=toCash;
  available-=toCash;
  f.savings=(f.savings??0)+available;
 }else{
  const unresolved=drawReserves(f,Math.abs(annualNet));
  if(unresolved>0)f.debt+=unresolved;
 }

 const interestRate=f.insolvencyResolved ? .02 : f.debtRestructured ? .035 : .055;
 f.debt+=Math.round(f.debt*interestRate);
 const reserveTarget=cashReserveTarget(f);
 const reserveDebtPayment=sweepExcessLiquidityToUnsecuredDebt(state,reserveTarget);
 const distressActions=manageFinancialDistress(state,Math.max(0,annualIncome),reserveTarget);
 if(reserveDebtPayment>0)distressActions.unshift('fazla likit rezervden ₺'+Math.round(reserveDebtPayment).toLocaleString('tr-TR')+' teminatsız borç kapatıldı');

 return [{
  age:state.player.age,
  kind:'finance',
  text:'Yıllık bütçe: gelir ₺'+Math.round(annualIncome).toLocaleString('tr-TR')+
   ' • temel gider ₺'+Math.round(annualExpense).toLocaleString('tr-TR')+
   ' • isteğe bağlı harcama ₺'+Math.round(f.discretionaryAnnual).toLocaleString('tr-TR')+
   ' • nakit ₺'+Math.round(f.cash).toLocaleString('tr-TR')+
   ' • uzun vadeli birikim ₺'+Math.round(f.savings??0).toLocaleString('tr-TR')+
   (f.debt>0?' • borç ₺'+Math.round(f.debt).toLocaleString('tr-TR'):'')+
   (distressActions.length?' • finansal önlem: '+distressActions.join(', '):'')
 }];
}
