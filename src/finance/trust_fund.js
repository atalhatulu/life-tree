import {safeCashAmount,previewCashCredit} from './safe_cash.js';

export function addToTrustFund(state,amount,source){
 const credit=safeCashAmount(amount,'Trust fund contribution');
 if(credit===0)return;
 const fund=state.trustFund;
 if(fund?.released)throw new Error('Released trust fund cannot accept contributions');
 const balance=safeCashAmount(fund?.balance??0,'Trust fund balance');
 if(credit>Number.MAX_SAFE_INTEGER-balance)
  throw new RangeError('Trust fund aggregate exceeds safe monetary limit');
 if(fund?.sources!=null&&!Array.isArray(fund.sources))
  throw new RangeError('Invalid trust fund sources');
 state.trustFund??={balance:0,sources:[],released:false};
 state.trustFund.sources??=[];
 state.trustFund.balance=balance+credit;
 state.trustFund.sources.push({...source,amount:credit});
}

export function releaseTrustFund(state){
 if(!state.trustFund||state.trustFund.released||state.player.age<18)return [];
 const balance=safeCashAmount(state.trustFund.balance,'Trust fund balance');
 const newCash=previewCashCredit(state,balance);
 state.finance??={
  cash:0,debt:0,monthlyIncome:0,monthlyExpenses:0,familySupportMonthly:0,childMonthlyCost:0,
  lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}
 };
 state.finance.cash=newCash;
 state.trustFund.released=true;
 state.trustFund.releasedAtAge=state.player.age;
 return [{
  age:state.player.age,
  kind:'finance',
  text:'Çocukluğundan kalan ₺'+balance.toLocaleString('tr-TR')+' tutarındaki miras hesabı kullanımına açıldı.'
 }];
}
