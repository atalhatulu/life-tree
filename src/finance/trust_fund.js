export function addToTrustFund(state,amount,source){
 if(amount<=0)return;
 state.trustFund??={balance:0,sources:[],released:false};
 state.trustFund.balance+=amount;
 state.trustFund.sources.push({...source,amount});
}

export function releaseTrustFund(state){
 if(!state.trustFund||state.trustFund.released||state.player.age<18)return [];
 state.finance??={
  cash:0,debt:0,monthlyIncome:0,monthlyExpenses:0,familySupportMonthly:0,childMonthlyCost:0,
  lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}
 };
 state.finance.cash+=state.trustFund.balance;
 state.trustFund.released=true;
 state.trustFund.releasedAtAge=state.player.age;
 return [{
  age:state.player.age,
  kind:'finance',
  text:'Çocukluğundan kalan ₺'+Math.round(state.trustFund.balance).toLocaleString('tr-TR')+' tutarındaki miras hesabı kullanımına açıldı.'
 }];
}
