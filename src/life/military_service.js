import {annualYearStatus} from '../core/annual_clock.js';
const BASE_PAID_FEE_2026=472653.60;

export function ensureMilitaryState(state){
 state.militaryService??={
  eligible:state.player.sex==='male',
  status:state.player.sex==='male'?'pending':'not-applicable',
  deferredUntilAge:null,
  mode:null,
  completedAtAge:null,
  serviceMonths:0,
  paidFee:0,
  interruption:null
 };
 return state.militaryService;
}

export function refreshMilitaryEligibility(state){
 const m=ensureMilitaryState(state);
 if(!m.eligible||m.status==='completed'||m.status==='not-applicable')return m;
 if(state.higherEducation?.enrolled){
  m.status='deferred';
  m.deferredUntilAge=Math.max(m.deferredUntilAge??0,state.player.age+1);
  return m;
 }
 if(m.status==='deferred'&&state.player.age<(m.deferredUntilAge??0))return m;
 if(state.player.age>=20)m.status='pending';
 return m;
}

export function paidMilitaryFee(state){
 const macro=state.world?.economy?.costOfLiving??1;
 return Math.round(BASE_PAID_FEE_2026*macro);
}

function interruptCareer(state,months,mode){
 const c=state.career;
 if(c?.employed){
  c.serviceLeave={
   startedAtAge:state.player.age,
   months,
   mode,
   title:c.title,
   income:c.monthlyIncome
  };
  c.stability=Math.max(0,(c.stability??60)-(mode==='standard'?4:1));
  state.player.monthlyIncome=0;
 }
}

export function completeMilitaryService(state,mode){
 if(mode!=='paid'&&mode!=='standard')throw new RangeError('Unknown military service mode');
 // Paid service must not refresh eligibility or normalize finance until its
 // charge can succeed. Both actions may otherwise alter a rejected save.
 let fee=0,cashUsed=0,savingsUsed=0;
 if(mode==='paid'){
  fee=paidMilitaryFee(state);
  if(!Number.isSafeInteger(fee)||fee<=0)throw new RangeError('Invalid paid military fee');
  const f=state.finance;
  if(!f)throw new Error('Bedelli askerlik için yeterli likit varlık yok.');
  const cash=f.cash??0,savings=f.savings??0;
  if(!Number.isSafeInteger(cash)||cash<0||!Number.isSafeInteger(savings)||savings<0)
   throw new RangeError('Invalid liquid military funds');
  cashUsed=Math.min(cash,fee);
  savingsUsed=fee-cashUsed;
  if(savingsUsed>savings)throw new Error('Bedelli askerlik için yeterli likit varlık yok.');
 }
 const m=refreshMilitaryEligibility(state);
 if(!m.eligible||m.status==='completed')throw new Error('Askerlik hizmeti uygulanamaz.');
 if(mode==='paid'){
  state.finance.cash-=cashUsed;
  state.finance.savings=(state.finance.savings??0)-savingsUsed;
  m.paidFee=fee;
  m.serviceMonths=1;
  interruptCareer(state,1,'paid');
 }else{
  m.serviceMonths=6;
  interruptCareer(state,6,'standard');
  if(state.healthProfile)state.healthProfile.stress=Math.min(100,(state.healthProfile.stress??20)+5);
 }
 m.mode=mode;
 m.status='completed';
 m.completedAtAge=state.player.age;
 m.interruption={year:state.year,age:state.player.age,months:m.serviceMonths};
 state.nextMilitaryDecisionAge=null;
 return m;
}

export function deferMilitaryService(state,years=1){
 const m=refreshMilitaryEligibility(state);
 if(!m.eligible||m.status==='completed')return m;
 m.deferralCount=(m.deferralCount??0)+1;
 const extraYears=Math.min(2,Math.max(0,m.deferralCount-1));
 m.status='deferred';
 m.deferredUntilAge=state.player.age+Math.max(1,years)+extraYears;
 state.nextMilitaryDecisionAge=m.deferredUntilAge;
 return m;
}

export function processMilitaryYear(state){
 // Guard before eligibility refresh, which can change deferral status.
 const {calendarYear,replayed}=annualYearStatus(state.year,state.militaryService?.lastProcessedYear,'military service');
 if(replayed)return [];
 const m=refreshMilitaryEligibility(state);
 const entries=[];
 const leave=state.career?.serviceLeave;
 if(leave&&leave.startedAtAge<state.player.age){
  state.player.monthlyIncome=state.career.monthlyIncome??0;
  state.career.stability=Math.min(100,(state.career.stability??60)+2);
  delete state.career.serviceLeave;
  entries.push({age:state.player.age,kind:'career',text:'Askerlik sonrası iş hayatına geri döndün.'});
 }
 if(calendarYear!==null)m.lastProcessedYear=calendarYear;
 return entries;
}
