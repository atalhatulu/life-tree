export function liquidFunds(state){
 return Math.max(0,state.finance?.cash??0)+Math.max(0,state.finance?.savings??0);
}

export function spendLiquidFunds(state,amount){
 const target=Math.max(0,Math.round(amount));
 state.finance??={cash:0,savings:0,debt:0};
 state.finance.cash??=0;
 state.finance.savings??=0;
 let remaining=target;
 const cashUsed=Math.min(state.finance.cash,remaining);
 state.finance.cash-=cashUsed;
 remaining-=cashUsed;
 const savingsUsed=Math.min(state.finance.savings,remaining);
 state.finance.savings-=savingsUsed;
 remaining-=savingsUsed;
 return {paid:target-remaining,remaining,cashUsed,savingsUsed};
}
