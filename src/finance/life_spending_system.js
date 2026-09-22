export const SPENDING_CATEGORIES=[
 'daily-life',
 'durable-goods',
 'experiences',
 'family',
 'ownership',
 'unexpected'
];

export function ensureSpendingHistory(state){
 state.finance??={cash:0,savings:0,debt:0};
 state.finance.spendingHistory??=[];
 state.finance.spendingTotals??={};
 return state.finance.spendingHistory;
}

export function recordSpending(state,{category,amount,label,source='system',metadata=null}){
 if(!SPENDING_CATEGORIES.includes(category))throw new Error('Geçersiz harcama kategorisi: '+category);
 const value=Math.max(0,Math.round(amount??0));
 if(value<=0)return null;
 ensureSpendingHistory(state);
 const entry={
  age:state.player?.age??null,
  year:state.year??null,
  category,
  amount:value,
  label:label??category,
  source
 };
 if(metadata)entry.metadata=metadata;
 state.finance.spendingHistory.push(entry);
 state.finance.spendingTotals[category]=(state.finance.spendingTotals[category]??0)+value;
 state.finance.totalRecordedSpending=(state.finance.totalRecordedSpending??0)+value;
 return entry;
}

export function spendingSummary(state){
 ensureSpendingHistory(state);
 return {
  total:state.finance.totalRecordedSpending??0,
  byCategory:{...state.finance.spendingTotals},
  entries:state.finance.spendingHistory.length
 };
}
