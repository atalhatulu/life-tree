import {ensurePersonalFinance,addDebt} from '../finance/personal_finance.js';
import {lifestyleMonthlyCost} from '../lifestyle/lifestyle_system.js';
import {economy} from '../world/world_state.js';

// Experimental monthly cash flow. Annual finance is disabled for these sessions;
// the existing annual finance implementation remains unchanged for normal games.
export function settleExperimentalMonth(state,month){
 if(!Number.isInteger(month)||month<1||month>12)throw new RangeError('Invalid month');
 if(state.player.age<19||!state.player.alive)return null;
 const f=ensurePersonalFinance(state);
 f.experimentalMonthlyLedger??=[];
 if(f.experimentalMonthlyLedger.some(e=>e.year===state.year&&e.month===month))throw new Error('Month already settled');
 const gross=state.career?.employed&&!state.career.serviceLeave?state.career.monthlyIncome??0:
   state.retirement?.retired?state.retirement.pensionMonthly??0:0;
 const tax=Math.round(gross*(state.retirement?.retired ? .06 :gross<=40000?.12:gross<=80000?.18:gross<=140000?.23:.28));
 const partner=state.social?.romance&&['cohabiting','married'].includes(state.social.romance.status)?
   Math.round((state.social.romance.monthlyIncome??0)*.55):0;
 const income=gross-tax+partner+(f.familySupportMonthly??0)+(state.lateLife?.familySupportMonthly??0);
 const costs=Math.round((lifestyleMonthlyCost(state)+(f.childMonthlyCost??0)+
   (state.parentCare?.active?state.parentCare.monthlyCost??0:0))*(economy(state).costOfLiving??1));
 const ownership=Math.round(((state.assets?.home?.price??0)*.007+(state.assets?.car?.price??0)*.025)/12)+
   (state.healthProfile?.conditions?.length??0)*1200;
 const expense=costs+ownership;
 const net=income-expense;
 if(net>=0)f.cash+=net;
 else{
  const shortage=Math.max(0,-net-(f.cash??0)-(f.savings??0));
  const fromCash=Math.min(f.cash??0,-net);f.cash-=fromCash;
  const fromSavings=Math.min(f.savings??0,-net-fromCash);f.savings-=fromSavings;
  if(shortage>0)addDebt(state,'emergency',shortage);
 }
 f.monthlyIncome=gross;f.monthlyTax=tax;f.monthlyExpenses=costs;f.ownershipCostsMonthly=ownership;
 const entry={year:state.year,month,income,expense,net,cash:f.cash,savings:f.savings,debt:f.debt};
 f.experimentalMonthlyLedger.push(entry);
 return entry;
}
