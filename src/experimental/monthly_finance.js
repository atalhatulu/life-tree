import {ensurePersonalFinance,addDebt} from '../finance/personal_finance.js';
import {lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';
import {economy} from '../world/world_state.js';

const RATES={consumer:.085,medical:.03,housing:.035,car:.06,emergency:.055};
const SUPPORT={düşük:3500,orta:7500,'üst-orta':11000,yüksek:17000};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function support(state){
 if(!state.higherEducation?.enrolled&&!(state.nextPath==='gap'&&state.player.age<=22))return 0;
 const parents=['mother','father'].filter(k=>state.parents?.[k]?.alive);
 if(!parents.length)return 0;
 const relation=parents.reduce((sum,k)=>sum+(state.player.relationships?.[k]??60),0)/parents.length;
 return Math.round((SUPPORT[state.household?.economicClass]??4500)*(relation>=70?1:relation>=50?.8:.55)*(parents.length===2?1:.58));
}
function repay(f,amount,state){
 let left=Math.min(Math.max(0,amount),f.debt??0),paid=0;
 for(const type of ['consumer','emergency','medical','car','housing']){
  const part=Math.min(f.debts[type]??0,left);
  f.debts[type]-=part;left-=part;paid+=part;
  if(type==='car'&&state.assets?.car)state.assets.car.remainingDebt=Math.max(0,(state.assets.car.remainingDebt??0)-part);
  if(type==='housing'&&state.assets?.home)state.assets.home.remainingDebt=Math.max(0,(state.assets.home.remainingDebt??0)-part);
 }
 f.debt=Math.round(Object.values(f.debts).reduce((a,b)=>a+b,0));
 return paid;
}
function interest(f,macro){
 let total=0;
 for(const [type,rate] of Object.entries(RATES)){
  const adjusted=f.debtRestructured&&['consumer','emergency'].includes(type)?Math.min(rate,.045):rate;
  const charge=Math.round((f.debts[type]??0)*adjusted*(macro.creditConditions??1)/12);
  f.debts[type]=(f.debts[type]??0)+charge;total+=charge;
 }
 f.debt=Math.round(Object.values(f.debts).reduce((a,b)=>a+b,0));
 return total;
}
function distress(state,annualIncome){
 const f=state.finance;
 const secured=(state.assets?.home?.remainingDebt??0)+(state.assets?.car?.remainingDebt??0);
 const reserve=Math.round(clamp(((f.monthlyExpenses??0)+(f.ownershipCostsMonthly??0))*5,80000,900000));
 const over=f.debt>secured+Math.max(750000,annualIncome*2.5)&&(f.cash+f.savings)<reserve*.5;
 if(!over){f.financialDistressYears=Math.max(0,(f.financialDistressYears??0)-1);return [];}
 f.financialDistressYears=(f.financialDistressYears??0)+1;
 f.financialDistressEvents=(f.financialDistressEvents??0)+1;
 const actions=[],l=f.lifestyle;
 if(l.clothing==='premium'){l.clothing='standard';actions.push('giyim gideri azaltıldı');}
 else if(l.clothing==='standard'){l.clothing='basic';actions.push('giyim gideri azaltıldı');}
 if(l.food==='premium'){l.food='healthy';actions.push('gıda gideri azaltıldı');}
 if(['apartment','studio'].includes(l.housing)){l.housing='shared';actions.push('konut gideri azaltıldı');}
 if(f.financialDistressYears>=2&&state.assets?.car){
  const value=Math.round((state.assets.car.price??0)*.45);
  repay(f,value,state);state.assets.car=null;l.transport='public';actions.push('araç satıldı');
 }
 if(f.financialDistressYears>=3&&state.assets?.home&&f.debt>annualIncome*4+(state.assets.home.remainingDebt??0)){
  const value=Math.round((state.assets.home.price??0)*.88);
  repay(f,value,state);state.assets.home=null;l.housing='shared';actions.push('ev satıldı');
 }
 if(f.financialDistressYears>=3&&!state.assets?.home&&!state.assets?.car&&f.debt>Math.max(1200000,annualIncome*4.5)&&
   (f.lastRestructureAge==null||state.player.age-f.lastRestructureAge>=5)){
  f.debts.consumer=Math.round((f.debts.consumer??0)*.68);
  f.debts.emergency=Math.round((f.debts.emergency??0)*.72);
  f.debt=Math.round(Object.values(f.debts).reduce((a,b)=>a+b,0));
  f.debtRestructured=true;f.lastRestructureAge=state.player.age;actions.push('borç yapılandırıldı');
 }
 return actions;
}
export function settleExperimentalMonth(state,month){
 if(!Number.isInteger(month)||month<1||month>12)throw new RangeError('Invalid month');
 if(state.player.age<19)return null;
 const f=ensurePersonalFinance(state);
 f.experimentalMonthlyLedger??=[];
 if(f.experimentalMonthlyLedger.some(e=>e.year===state.year&&e.month===month))throw new Error('Month already settled');
 const macro=economy(state);
 const employed=state.career?.employed&&!state.career.serviceLeave;
 const gross=employed?state.career.monthlyIncome??0:state.retirement?.retired?state.retirement.pensionMonthly??0:0;
 const tax=Math.round(gross*(state.retirement?.retired ? .06 :gross<=40000?.12:gross<=80000?.18:gross<=140000?.23:.28));
 const partner=state.social?.romance&&['cohabiting','married'].includes(state.social.romance.status)?
   Math.round((state.social.romance.monthlyIncome??0)*.55):0;
 const family=support(state);
 const income=gross-tax+partner+family+(state.lateLife?.familySupportMonthly??0);
 const care=state.lateLife?.careMode==='family'?3000:state.lateLife?.careMode==='home-care'?14000:state.lateLife?.careMode==='assisted'?26000:0;
 const costs=Math.round((lifestyleMonthlyCost(state)+(f.childMonthlyCost??0)+
   (state.parentCare?.active?state.parentCare.monthlyCost??0:0)+care)*(macro.costOfLiving??1));
 const ownership=Math.round(((state.assets?.home?.price??0)*.007+(state.assets?.car?.price??0)*.025)/12)+
   (state.healthProfile?.conditions?.length??0)*1200;
 const expense=costs+ownership,net=income-expense;
 let repayment=0,interestCharged=0;
 if(net>=0){
  const rate=clamp(.22+(gross>60000?.04:0)+(gross>100000?.05:0)+(gross>160000?.06:0)+
    (state.player.age>=30?.02:0)+((state.children?.length??0)>0?.04:0)+
    (f.lifestyle.food==='premium'?.08:f.lifestyle.food==='healthy'?.03:f.lifestyle.food==='frugal'?-.05:0)+
    (f.lifestyle.clothing==='premium'?.05:0)+(f.lifestyle.transport==='car'?.03:0)-
    (state.retirement?.retired ? .04 :0),.14,.58);
  const discretionary=Math.round(net*rate);
  f.discretionaryAnnual=(f.discretionaryAnnual??0)+discretionary;
  let available=net-discretionary;
  repayment=repay(f,Math.round(available*.55),state);available-=repayment;
  const reserve=clamp((costs+ownership)*5,80000,900000);
  const toCash=Math.min(Math.max(0,reserve-f.cash),available);
  f.cash+=toCash;available-=toCash;
  const target=Math.max(150000,Math.round(income*12*(state.player.age<30?.7:state.player.age<40?1.5:state.player.age<50?2.5:state.player.age<60?3.5:4.5)));
  const toSavings=Math.min(Math.max(0,target-f.savings),available);
  f.savings+=toSavings;available-=toSavings;
  f.activitySpendingAnnual=(f.activitySpendingAnnual??0)+available;
 }else{
  let due=-net;
  const cash=Math.min(f.cash,due);f.cash-=cash;due-=cash;
  const savings=Math.min(f.savings,due);f.savings-=savings;due-=savings;
  if(due>0)addDebt(state,'emergency',due);
 }
 f.monthlyIncome=gross;f.monthlyTax=tax;f.monthlyExpenses=costs;f.ownershipCostsMonthly=ownership;
 f.familySupportMonthly=family;f.partnerContributionMonthly=partner;
 interestCharged=interest(f,macro);
 const entry={year:state.year,month,income,expense,net,repayment,interestCharged,cash:f.cash,savings:f.savings,debt:f.debt};
 f.experimentalMonthlyLedger.push(entry);
 if(month===12){
  const annual=f.experimentalMonthlyLedger.filter(e=>e.year===state.year);
  const totalIncome=annual.reduce((a,e)=>a+e.income,0);
  const actions=distress(state,totalIncome);
  entry.distressActions=actions;
  state.history.push({age:state.player.age,kind:'finance',text:'Yıllık bütçe: gelir ₺'+totalIncome.toLocaleString('tr-TR')+
   ' • temel gider ₺'+annual.reduce((a,e)=>a+e.expense,0).toLocaleString('tr-TR')+
   ' • nakit ₺'+Math.round(f.cash).toLocaleString('tr-TR')+' • birikim ₺'+Math.round(f.savings).toLocaleString('tr-TR')+
   (f.debt?' • borç ₺'+f.debt.toLocaleString('tr-TR'):'')+(actions.length?' • finansal önlem: '+actions.join(', '):'')});
 }
 return entry;
}
