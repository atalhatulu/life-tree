const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function canStartBusiness(state){
 return state.player.age>=25&&
  !state.business?.active&&
  (state.finance?.cash??0)>=250000&&
  (state.player.personality.ambition??0)>=55;
}

export function startBusiness(state,rng){
 if(!canStartBusiness(state))throw new Error('Şirket kurmak için koşullar uygun değil.');
 const investment=Math.min(state.finance.cash*.45,rng.int(250000,650000));
 state.finance.cash-=Math.round(investment);
 state.business={
  active:true,
  startedAtAge:state.player.age,
  capital:Math.round(investment),
  monthlyProfit:0,
  health:55,
  years:0,
  employees:0
 };
 state.nextPath='business';
 return state.business;
}

export function processBusinessYear(state,rng){
 const b=state.business;
 if(!b?.active)return [];
 b.years+=1;
 const founderScore=(state.player.personality.ambition??50)*.25+(state.player.personality.discipline??50)*.25+(state.player.personality.sociability??50)*.15;
 const volatility=rng.int(-18,22);
 b.health=clamp(b.health+(founderScore-35)*.10+volatility*.42-2);
 b.monthlyProfit=Math.max(-55000,Math.round(b.capital*.016*(b.health/55)+rng.int(-24000,26000)));
 if(b.monthlyProfit<0)b.health=clamp(b.health-5);
 if(b.monthlyProfit>35000&&rng.chance(.25))b.employees+=rng.int(1,3);

 if(b.monthlyProfit>0)state.finance.cash+=Math.round(b.monthlyProfit*12*.80);
 else{
  const loss=Math.abs(b.monthlyProfit*12);
  const used=Math.min(state.finance.cash,loss);
  state.finance.cash-=used;
  state.finance.debt+=loss-used;
 }

 const closureChance=b.health<15?.55:b.health<28?.20:.01;
 if(rng.chance(closureChance)){
  b.active=false;
  b.closedAtAge=state.player.age;
  state.nextPath=state.career?.employed?'work':'gap';
  return [{age:state.player.age,kind:'career',text:'Kurduğun işletme kapandı.'}];
 }
 if(b.years===1)return [{age:state.player.age,kind:'career',text:'İşletmen ilk yılını tamamladı.'}];
 return [];
}
