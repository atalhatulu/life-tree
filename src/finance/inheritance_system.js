export function processInheritance(state){
 const pending=state.pendingInheritance??[];
 if(!pending.length)return [];
 state.finance??={cash:0,debt:0,monthlyIncome:0,monthlyExpenses:0,familySupportMonthly:0,childMonthlyCost:0,lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 const total=pending.reduce((sum,x)=>sum+x.amount,0);
 state.finance.cash+=total;
 state.inheritanceHistory??=[];
 state.inheritanceHistory.push(...pending.map(x=>({...x,receivedAtAge:state.player.age,year:state.year})));
 state.pendingInheritance=[];
 return [{age:state.player.age,kind:'finance',text:'Ailenden ₺'+Math.round(total).toLocaleString('tr-TR')+' miras kaldı.'}];
}
