import {lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';
import {economy} from '../world/world_state.js';

const STARTING_CASH_BY_CLASS={düşük:2500,orta:7500,'üst-orta':18000,yüksek:50000};
const STUDENT_SUPPORT_BY_CLASS={düşük:3500,orta:7500,'üst-orta':11000,yüksek:17000};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const DEBT_RATES={consumer:.085,medical:.03,housing:.035,car:.06,emergency:.055};

function ensureDebtBuckets(finance){
 finance.debts??={consumer:0,medical:0,housing:0,car:0,emergency:0};
 for(const key of Object.keys(DEBT_RATES))finance.debts[key]=Math.max(0,Number(finance.debts[key]??0));
 let bucketTotal=Object.values(finance.debts).reduce((s,v)=>s+v,0);
 const aggregate=Math.max(0,Number(finance.debt??0));
 if(bucketTotal===0&&aggregate>0){
  finance.debts.consumer=aggregate;
  bucketTotal=aggregate;
 }else if(aggregate>bucketTotal){
  finance.debts.emergency+=aggregate-bucketTotal;
  bucketTotal=aggregate;
 }else if(aggregate<bucketTotal){
  let reduction=bucketTotal-aggregate;
  for(const key of ['consumer','emergency','medical','car','housing']){
   if(reduction<=0)break;
   const take=Math.min(finance.debts[key],reduction);
   finance.debts[key]-=take;
   reduction-=take;
  }
 }
 finance.debt=Math.round(Object.values(finance.debts).reduce((s,v)=>s+v,0));
 return finance.debts;
}

export function addDebt(state,type,amount){
 const f=ensurePersonalFinance(state);
 const debts=ensureDebtBuckets(f);
 const key=DEBT_RATES[type]!=null?type:'emergency';
 debts[key]+=Math.max(0,Math.round(amount));
 f.debt=Math.round(Object.values(debts).reduce((s,v)=>s+v,0));
 return f.debt;
}

function syncDebt(f){
 f.debts??={consumer:0,medical:0,housing:0,car:0,emergency:0};
 f.debt=Math.max(0,Math.round(Object.values(f.debts).reduce((s,v)=>s+(Number(v)||0),0)));
 return f.debt;
}

export function payDownDebt(state,amount){
 const f=ensurePersonalFinance(state);
 ensureDebtBuckets(f);
 let budget=Math.max(0,Math.round(amount));
 const order=['consumer','emergency','medical','car','housing'];
 for(const key of order){
  if(budget<=0)break;
  const paid=Math.min(f.debts[key],budget);
  f.debts[key]-=paid;
  budget-=paid;
  if(key==='housing'&&state.assets?.home)state.assets.home.remainingDebt=Math.max(0,(state.assets.home.remainingDebt??0)-paid);
  if(key==='car'&&state.assets?.car)state.assets.car.remainingDebt=Math.max(0,(state.assets.car.remainingDebt??0)-paid);
 }
 return syncDebt(f);
}

export function ensurePersonalFinance(state){
 if(state.finance){
  state.finance.savings??=0;
  state.finance.financialDistressYears??=0;
  state.finance.financialDistressEvents??=0;
  state.finance.debtRestructured??=false;
  state.finance.activitySpendingAnnual??=0;
  ensureDebtBuckets(state.finance);
  return state.finance;
 }
 const studentAwayFromHome=Boolean(state.higherEducation?.enrolled&&state.higherEducation?.movedForUniversity);
 state.finance={
  cash:STARTING_CASH_BY_CLASS[state.household.economicClass]??5000,
  savings:0,
  debt:0,
  debts:{consumer:0,medical:0,housing:0,car:0,emergency:0},
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
 if(monthly<=40000)return .12;
 if(monthly<=80000)return .18;
 if(monthly<=140000)return .23;
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

function serviceDebt(state,available){
 const f=state.finance;
 ensureDebtBuckets(f);
 if(f.debt<=0||available<=0)return available;
 let budget=Math.min(f.debt,Math.round(available*.55));
 const original=budget;
 const order=['consumer','emergency','medical','car','housing'];
 for(const key of order){
  if(budget<=0)break;
  const payment=Math.min(f.debts[key],budget);
  f.debts[key]-=payment;
  budget-=payment;
  if(key==='housing'&&state.assets?.home)state.assets.home.remainingDebt=Math.max(0,(state.assets.home.remainingDebt??0)-payment);
  if(key==='car'&&state.assets?.car)state.assets.car.remainingDebt=Math.max(0,(state.assets.car.remainingDebt??0)-payment);
 }
 syncDebt(f);
 return available-(original-budget);
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
 const monthlyGross=state.career?.monthlyIncome??state.retirement?.pensionMonthly??0;
 let rate=.22;
 if(monthlyGross>60000)rate+=.04;
 if(monthlyGross>100000)rate+=.05;
 if(monthlyGross>160000)rate+=.06;
 if(state.player.age>=30)rate+=.02;
 if((state.children?.length??0)>0)rate+=.04;
 if(l.food==='premium')rate+=.08;
 else if(l.food==='healthy')rate+=.03;
 else if(l.food==='frugal')rate-=.05;
 if(l.clothing==='premium')rate+=.05;
 if(l.transport==='car')rate+=.03;
 if(l.housing==='apartment')rate+=.03;
 if(state.retirement?.retired)rate-=.04;
 return clamp(rate,.14,.58);
}

function cashReserveTarget(f){
 return Math.round(clamp((f.monthlyExpenses+f.ownershipCostsMonthly)*5,80000,900000));
}

function longTermSavingsCap(state,annualIncome){
 const age=state.player.age;
 const years=Math.max(1,age-18);
 const targetMultiple=age<30?.7:age<40?1.5:age<50?2.5:age<60?3.5:4.5;
 return Math.max(150000,Math.round((annualIncome||1)*targetMultiple+years*18000));
}

function lifestyleCreep(state,annualIncome){
 const f=state.finance;
 if(!f?.lifestyle||annualIncome<=0)return;
 const monthly=annualIncome/12;
 if(monthly>=90000&&f.lifestyle.food==='standard')f.lifestyle.food='healthy';
 if(monthly>=130000&&f.lifestyle.clothing==='basic')f.lifestyle.clothing='standard';
 if(state.player.age>=30&&monthly>=80000&&f.lifestyle.housing==='family')f.lifestyle.housing='shared';
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
 ensureDebtBuckets(state.finance);
 const paid=Math.min(state.finance.debts.car??0,proceeds);
 state.finance.debts.car=Math.max(0,(state.finance.debts.car??0)-paid);
 if(proceeds>paid){
  const extra=Math.min(state.finance.debts.consumer??0,proceeds-paid);
  state.finance.debts.consumer=Math.max(0,(state.finance.debts.consumer??0)-extra);
 }
 syncDebt(state.finance);
 state.assets.car=null;
 state.finance.lifestyle.transport='public';
 return proceeds;
}

function liquidateHome(state){
 const home=state.assets?.home;
 if(!home)return 0;
 const proceeds=Math.round((home.price??0)*.88);
 ensureDebtBuckets(state.finance);
 const paid=Math.min(state.finance.debts.housing??0,proceeds);
 state.finance.debts.housing=Math.max(0,(state.finance.debts.housing??0)-paid);
 if(proceeds>paid){
  const extra=Math.min(state.finance.debts.consumer??0,proceeds-paid);
  state.finance.debts.consumer=Math.max(0,(state.finance.debts.consumer??0)-extra);
 }
 syncDebt(state.finance);
 state.assets.home=null;
 state.finance.lifestyle.housing='shared';
 return proceeds;
}

function manageFinancialDistress(state,annualIncome,reserveTarget){
 const f=state.finance;
 const secured=securedDebt(state);
 const debtCapacity=secured+Math.max(750000,annualIncome*2.5);
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
  f.debt>Math.max(1500000,annualIncome*6)&&
  (f.lastRestructureAge==null||state.player.age-f.lastRestructureAge>=5)
 ){
  ensureDebtBuckets(f);
  const before=f.debt;
  f.debts.consumer=Math.round(f.debts.consumer*.75);
  f.debts.emergency=Math.round(f.debts.emergency*.82);
  syncDebt(f);
  f.debtRestructured=true;
  f.lastRestructureAge=state.player.age;
  actions.push('borç yeniden yapılandırıldı (₺'+Math.round(before-f.debt).toLocaleString('tr-TR')+' uzlaşma indirimi)');
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
 f.parentCareMonthlyCost=state.parentCare?.active?(state.parentCare.monthlyCost??0):0;
 f.monthlyExpenses=Math.round((lifestyleMonthlyCost(state)+(f.childMonthlyCost??0)+(f.parentCareMonthlyCost??0)+lateLifeCareCosts(state))*macro.costOfLiving);
 const taxRate=effectiveTaxRate(f.monthlyIncome,Boolean(state.retirement?.retired));
 f.monthlyTax=Math.round(f.monthlyIncome*taxRate);
 f.ownershipCostsMonthly=recurringOwnershipCosts(state);
 const annualIncome=(f.monthlyIncome-f.monthlyTax+f.familySupportMonthly+f.partnerContributionMonthly+f.adultChildSupportMonthly)*12;
 const annualExpense=(f.monthlyExpenses+f.ownershipCostsMonthly)*12;
 const annualNet=annualIncome-annualExpense;
 f.discretionaryAnnual=0;

 if(annualNet>=0){
  lifestyleCreep(state,annualIncome);
  f.discretionaryAnnual=Math.round(annualNet*discretionaryRate(state));
  let available=Math.max(0,annualNet-f.discretionaryAnnual);
  available=serviceDebt(state,available);
  const reserveTarget=cashReserveTarget(f);
  const reserveNeed=Math.max(0,reserveTarget-f.cash);
  const toCash=Math.min(reserveNeed,available);
  f.cash+=toCash;
  available-=toCash;
  const savingsCap=longTermSavingsCap(state,annualIncome);
  const savingsRoom=Math.max(0,savingsCap-(f.savings??0));
  const toSavings=Math.min(savingsRoom,available);
  f.savings=(f.savings??0)+toSavings;
  available-=toSavings;
  // Surplus above a realistic long-term savings target is consumed through
  // travel, household replacement, gifts and other non-asset life spending.
  f.activitySpendingAnnual=Math.round((f.activitySpendingAnnual??0)*.25+available);
 }else{
  const unresolved=drawReserves(f,Math.abs(annualNet));
  if(unresolved>0)addDebt(state,'emergency',unresolved);
 }

 ensureDebtBuckets(f);
 const macroCredit=economy(state).creditConditions??1;
 for(const [key,rate] of Object.entries(DEBT_RATES)){
  const effective=f.debtRestructured&&['consumer','emergency'].includes(key)?Math.min(rate,.045):rate;
  f.debts[key]+=Math.round(f.debts[key]*effective*macroCredit);
 }
 syncDebt(f);
 const reserveTarget=cashReserveTarget(f);
 const distressActions=manageFinancialDistress(state,Math.max(0,annualIncome),reserveTarget);

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
