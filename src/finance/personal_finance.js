import {lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';

const STARTING_CASH_BY_CLASS={düşük:2500,orta:7500,'üst-orta':18000,yüksek:50000};
const STUDENT_SUPPORT_BY_CLASS={düşük:3500,orta:7500,'üst-orta':11000,yüksek:17000};

export function ensurePersonalFinance(state){
 if(state.finance) return state.finance;
 state.finance={
  cash:STARTING_CASH_BY_CLASS[state.household.economicClass]??5000,
  debt:0,
  monthlyIncome:0,
  monthlyExpenses:0,
  familySupportMonthly:0,
  childMonthlyCost:0,
  lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}
 };
 return state.finance;
}

function familySupport(state){
 const isStudent=state.higherEducation?.enrolled;
 const isYoungGap=state.nextPath==='gap'&&state.player.age<=22;
 if(!isStudent&&!isYoungGap) return 0;
 const relationship=((state.player.relationships.mother??60)+(state.player.relationships.father??60))/2;
 const relationFactor=relationship>=70?1:relationship>=50?.8:.55;
 return Math.round((STUDENT_SUPPORT_BY_CLASS[state.household.economicClass]??4500)*relationFactor);
}

function partnerContribution(state){
 const r=state.social?.romance;
 if(!r||!['cohabiting','married'].includes(r.status)) return 0;
 return Math.round((r.monthlyIncome??0)*.55);
}

function serviceDebt(state,available){
 const f=state.finance;
 if(f.debt<=0||available<=0) return available;
 const payment=Math.min(f.debt,Math.round(available*.55));
 f.debt-=payment;
 if(state.assets?.car?.remainingDebt) state.assets.car.remainingDebt=Math.max(0,state.assets.car.remainingDebt-payment*.18);
 if(state.assets?.home?.remainingDebt) state.assets.home.remainingDebt=Math.max(0,state.assets.home.remainingDebt-payment*.82);
 return available-payment;
}

export function processPersonalFinanceYear(state){
 const f=ensurePersonalFinance(state);
 f.monthlyIncome=state.career?.employed?state.career.monthlyIncome:0;
 f.familySupportMonthly=familySupport(state);
 f.partnerContributionMonthly=partnerContribution(state);
 f.monthlyExpenses=lifestyleMonthlyCost(state)+(f.childMonthlyCost??0);
 const annualIncome=(f.monthlyIncome+f.familySupportMonthly+f.partnerContributionMonthly)*12;
 const annualExpense=f.monthlyExpenses*12;
 let annualNet=annualIncome-annualExpense;

 if(annualNet>=0){
  annualNet=serviceDebt(state,annualNet);
  f.cash+=annualNet;
 }else{
  const deficit=Math.abs(annualNet);
  const used=Math.min(f.cash,deficit);
  f.cash-=used;
  f.debt+=deficit-used;
 }

 const interest=Math.round(f.debt*.055);
 f.debt+=interest;

 return [{
  age:state.player.age,
  kind:'finance',
  text:'Yıllık bütçe: gelir ₺'+Math.round(annualIncome).toLocaleString('tr-TR')+
   ' • gider ₺'+Math.round(annualExpense).toLocaleString('tr-TR')+
   ' • birikim ₺'+Math.round(f.cash).toLocaleString('tr-TR')+
   (f.debt>0?' • borç ₺'+Math.round(f.debt).toLocaleString('tr-TR'):'')
 }];
}
