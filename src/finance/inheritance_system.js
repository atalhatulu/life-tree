import {safeCashAmount,previewCashCredit} from './safe_cash.js';

export function processInheritance(state){
 const pending=state.pendingInheritance??[];
 if(!Array.isArray(pending))throw new RangeError('Invalid pending inheritance ledger');
 if(!pending.length)return [];
 // Validate the entire batch before creating finance/history or consuming any
 // pending estate. A corrupt later entry must not credit an earlier one.
 let total=0;
 for(const item of pending){
  const amount=safeCashAmount(item?.amount,'Inheritance amount');
  if(amount>Number.MAX_SAFE_INTEGER-total)
   throw new RangeError('Inheritance aggregate exceeds safe monetary limit');
  total+=amount;
 }
 const newCash=previewCashCredit(state,total);
 if(state.inheritanceHistory!=null&&!Array.isArray(state.inheritanceHistory))
  throw new RangeError('Invalid inheritance history');
 state.finance??={cash:0,debt:0,monthlyIncome:0,monthlyExpenses:0,familySupportMonthly:0,childMonthlyCost:0,lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 state.finance.cash=newCash;
 state.inheritanceHistory??=[];
 state.inheritanceHistory.push(...pending.map(x=>({...x,receivedAtAge:state.player.age,year:state.year})));
 state.pendingInheritance=[];
 return [{age:state.player.age,kind:'finance',text:'Ailenden ₺'+total.toLocaleString('tr-TR')+' miras kaldı.'}];
}
