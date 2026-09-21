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
  lifestyle:{
   housing:'family',
   food:'standard',
   clothing:'basic',
   transport:'public'
  }
 };
 return state.finance;
}

function monthlyExpenses(state){
 const f=state.finance;
 const base={
  housing:{family:1000,shared:11000,studio:18000},
  food:{frugal:2800,standard:4000,premium:12000},
  clothing:{basic:1200,standard:3000,premium:7000},
  transport:{public:1800,car:9000}
 };
 const leisure=f.lifestyle.housing==='family'?1800:3000;
 return base.housing[f.lifestyle.housing]+base.food[f.lifestyle.food]+base.clothing[f.lifestyle.clothing]+base.transport[f.lifestyle.transport]+leisure;
}

function familySupport(state){
 const isStudent=state.higherEducation?.enrolled;
 const isYoungGap=state.nextPath==='gap'&&state.player.age<=22;
 if(!isStudent&&!isYoungGap) return 0;
 const relationship=((state.player.relationships.mother??60)+(state.player.relationships.father??60))/2;
 const relationFactor=relationship>=70?1:relationship>=50?.8:.55;
 return Math.round((STUDENT_SUPPORT_BY_CLASS[state.household.economicClass]??4500)*relationFactor);
}

export function processPersonalFinanceYear(state){
 const f=ensurePersonalFinance(state);
 f.monthlyIncome=state.career?.employed?state.career.monthlyIncome:0;
 f.familySupportMonthly=familySupport(state);
 f.monthlyExpenses=monthlyExpenses(state);
 const annualNet=(f.monthlyIncome+f.familySupportMonthly-f.monthlyExpenses)*12;

 if(annualNet>=0){
  if(f.debt>0){
   const repayment=Math.min(f.debt,annualNet);
   f.debt-=repayment;
   f.cash+=annualNet-repayment;
  }else f.cash+=annualNet;
 }else{
  const deficit=Math.abs(annualNet);
  const used=Math.min(f.cash,deficit);
  f.cash-=used;
  f.debt+=deficit-used;
 }

 return [{
  age:state.player.age,
  kind:'finance',
  text:'Yıllık bütçen işlendi. Birikim: ₺'+Math.round(f.cash).toLocaleString('tr-TR')+(f.debt>0?' • Borç: ₺'+Math.round(f.debt).toLocaleString('tr-TR'):'')
 }];
}
