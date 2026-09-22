import {ensurePersonalFinance} from '../finance/personal_finance.js';
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
 const m=refreshMilitaryEligibility(state);
 if(!m.eligible||m.status==='completed')throw new Error('Askerlik hizmeti uygulanamaz.');
 if(mode==='paid'){
  ensurePersonalFinance(state);
  const fee=paidMilitaryFee(state);
  if((state.finance.cash??0)+(state.finance.savings??0)<fee)throw new Error('Bedelli askerlik için yeterli likit varlık yok.');
  let remaining=fee;
  const cashUsed=Math.min(state.finance.cash??0,remaining);
  state.finance.cash-=cashUsed;remaining-=cashUsed;
  if(remaining>0){state.finance.savings=Math.max(0,(state.finance.savings??0)-remaining);}
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
 m.status='deferred';
 m.deferredUntilAge=state.player.age+Math.max(1,years);
 state.nextMilitaryDecisionAge=m.deferredUntilAge;
 return m;
}

export function processMilitaryYear(state){
 const m=refreshMilitaryEligibility(state);
 const entries=[];
 const leave=state.career?.serviceLeave;
 if(leave&&leave.startedAtAge<state.player.age){
  state.player.monthlyIncome=state.career.monthlyIncome??0;
  state.career.stability=Math.min(100,(state.career.stability??60)+2);
  delete state.career.serviceLeave;
  entries.push({age:state.player.age,kind:'career',text:'Askerlik sonrası iş hayatına geri döndün.'});
 }
 return entries;
}
