import {annualYearStatus} from '../core/annual_clock.js';
import {addDebt} from './personal_finance.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

// Annual household ratios must not be computed from malformed legacy money
// or sums beyond the exact integer range, even when no repair is triggered.
function householdMoney(value,label,{allowNegative=false}={}){
 if(typeof value!=='number'||!Number.isSafeInteger(value)||(!allowNegative&&value<0))
  throw new RangeError('Invalid household finance '+label);
 return value;
}
function safeHouseholdSum(left,right,label){
 const total=BigInt(left)+BigInt(right);
 if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER))
  throw new RangeError('Unsafe household finance '+label);
 return Number(total);
}
function householdScore(value,label){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)
  throw new RangeError('Invalid household '+label);
 return value;
}

export function ensureHouseholdDepth(state){
 state.householdDynamics??={
  financialPressure:0,
  maintenanceBurden:0,
  familySupportBurden:0,
  emergencyReserveMonths:0,
  stability:65,
  recentShock:null
 };
 return state.householdDynamics;
}

export function processHouseholdDepthYear(state,rng){
 const entries=[];
 const f=state.finance;
 if(!f)return entries;
 const {calendarYear,replayed}=annualYearStatus(state.year,state.householdDynamics?.lastProcessedYear,'household finances');
 if(replayed)return entries;
 // Build annual household metrics on a detached record. A rejected repair
 // loan must not leave a new annual marker or partial household statistics.
 const draft={...state,householdDynamics:state.householdDynamics?{...state.householdDynamics}:undefined};
 const h=ensureHouseholdDepth(draft);
 const cash=householdMoney(f.cash??0,'cash balance',{allowNegative:true});
 const savings=householdMoney(f.savings??0,'savings');
 const monthlyExpenses=householdMoney(f.monthlyExpenses??0,'monthly expenses');
 const ownershipCosts=householdMoney(f.ownershipCostsMonthly??0,'ownership costs');
 const monthlyIncome=householdMoney(f.monthlyIncome??0,'monthly income');
 const debt=householdMoney(f.debt??0,'debt');
 const monthlyOut=safeHouseholdSum(monthlyExpenses,ownershipCosts,'monthly expenses');
 const liquid=safeHouseholdSum(cash,savings,'liquid reserves');
 const annualIncome=BigInt(monthlyIncome)*12n;
 if(annualIncome>BigInt(Number.MAX_SAFE_INTEGER))
  throw new RangeError('Unsafe household finance annual income');
 // A decade of liquidity is already ample; cap the display/pressure metric
 // before multiplying a very large safe balance into an imprecise ratio.
 h.emergencyReserveMonths=monthlyOut>0?Math.min(120,Math.max(0,Math.round((liquid/monthlyOut)*10)/10)):0;
 const debtIncome=debt/Math.max(1,Number(annualIncome));
 h.financialPressure=clamp(
  Math.round(
   debtIncome*18+
   (h.emergencyReserveMonths<2?22:h.emergencyReserveMonths<4?10:0)+
   ((f.financialDistressYears??0)>0?25:0)
  )
 );
 const homeAge=state.assets?.home?Math.max(0,state.player.age-(state.assets.home.purchasedAtAge??state.player.age)):0;
 const carAge=state.assets?.car?Math.max(0,state.player.age-(state.assets.car.purchasedAtAge??state.player.age)):0;
 h.maintenanceBurden=clamp(Math.round(homeAge*1.4+carAge*2+(state.assets?.home?8:0)+(state.assets?.car?6:0)));
 const dependentChildren=state.children?.filter(c=>c.alive!==false&&c.age<22).length??0;
 const elderCare=state.parentCare?.active?1:0;
 h.familySupportBurden=clamp(dependentChildren*12+elderCare*25);
 h.stability=clamp(82-h.financialPressure*.45-h.maintenanceBurden*.12-h.familySupportBurden*.18);
 if(h.financialPressure>=70&&state.social?.romance){
  householdScore(state.social.romance.resentment??20,'relationship resentment');
  householdScore(state.social.romance.relationshipTension??10,'relationship tension');
 }

 let shock=null;
 if(state.assets?.car&&rng.fork('car-repair').chance(.07+carAge*.008)){
  const cost=Math.round(4500+carAge*1100+rng.int(0,7500));
  shock={type:'car-repair',cost,text:'Araban beklenmedik bir bakım masrafı çıkardı.'};
 }
 if(!shock&&state.assets?.home&&rng.fork('home-repair').chance(.055+homeAge*.006)){
  const cost=Math.round(8000+homeAge*1600+rng.int(0,16000));
  shock={type:'home-repair',cost,text:'Evde beklenmedik bir tamir masrafı çıktı.'};
 }
 if(shock){
  if(!Number.isSafeInteger(shock.cost)||shock.cost<0)
   throw new RangeError('Invalid household repair cost');
  if(state.healthProfile)householdScore(state.healthProfile.stress??20,'health stress');
  // A pre-existing negative balance must not become a free cash credit.
  const fromCash=Math.min(Math.max(0,cash),shock.cost);
  const remaining=shock.cost-fromCash;
  if(remaining>0){
   const preview={...state,finance:structuredClone(f),
    assets:state.assets?structuredClone(state.assets):undefined};
   addDebt(preview,'emergency',remaining);
   addDebt(state,'emergency',remaining);
  }
  f.cash=cash-fromCash;
  // Track only this shock's unpaid amount, not older emergency debts.
  h.recentShock={...shock,age:state.player.age,remainingDebt:remaining};
  if(state.healthProfile)state.healthProfile.stress=clamp((state.healthProfile.stress??20)+(remaining>0?6:3));
  entries.push({age:state.player.age,kind:'household',text:shock.text+' Masraf: ₺'+shock.cost.toLocaleString('tr-TR')+'.'});
 }
 if(h.financialPressure>=70&&state.social?.romance){
  const romance=state.social.romance;
  romance.resentment=clamp((romance.resentment??20)+3);
  romance.relationshipTension=clamp((romance.relationshipTension??10)+2);
 }
 if(calendarYear!==null)h.lastProcessedYear=calendarYear;
 if(state.householdDynamics)Object.assign(state.householdDynamics,h);
 else state.householdDynamics=h;
 return entries;
}
