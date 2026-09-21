import {archiveCareer} from './career_profile.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function canStartBusiness(state){
 return state.player.age>=25&&
  !state.business?.active&&
  (state.finance?.cash??0)>=250000&&
  (state.player.personality.ambition??0)>=55;
}

export function startBusiness(state,rng,mode='full-time'){
 if(!canStartBusiness(state))throw new Error('Şirket kurmak için koşullar uygun değil.');
 if(!['full-time','side'].includes(mode))throw new Error('Geçersiz girişimcilik modu.');
 const maxShare=mode==='full-time'?.55:.30;
 const investment=Math.min(state.finance.cash*maxShare,rng.int(250000,650000));
 state.finance.cash-=Math.round(investment);

 const previousCareer=state.career?.employed?{
  title:state.career.title,
  jobId:state.career.jobId,
  monthlyIncome:state.career.monthlyIncome,
  years:state.career.years,
  totalYears:state.career.totalYears??state.career.years??0
 }:null;

 state.business={
  active:true,
  mode,
  startedAtAge:state.player.age,
  capital:Math.round(investment),
  monthlyProfit:0,
  health:55,
  years:0,
  employees:0,
  previousCareer
 };

 if(mode==='full-time'&&state.career?.employed){
  archiveCareer(state,'entrepreneurship');
  state.career.exitReason='entrepreneurship';
  state.career.employed=false;
  state.player.job='Girişimci';
  state.player.jobId='entrepreneur';
  state.player.monthlyIncome=0;
 }else if(mode==='side'){
  state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  state.healthProfile.stress=clamp(state.healthProfile.stress+5);
 }
 state.nextPath='business';
 return state.business;
}

export function processBusinessYear(state,rng){
 const b=state.business;
 if(!b?.active)return [];
 b.years+=1;

 const founderScore=(state.player.personality.ambition??50)*.25+
  (state.player.personality.discipline??50)*.25+
  (state.player.personality.sociability??50)*.15;
 const timePenalty=b.mode==='side'?8:0;
 const volatility=rng.int(-18,22);
 b.health=clamp(b.health+(founderScore-35)*.10+volatility*.42-2-timePenalty*.12);
 b.monthlyProfit=Math.max(-55000,Math.round(b.capital*.016*(b.health/55)+rng.int(-24000,26000)));

 if(b.monthlyProfit<0)b.health=clamp(b.health-5);
 if(b.monthlyProfit>35000&&rng.chance(.25))b.employees+=rng.int(1,3);

 if(b.monthlyProfit>0){
  const retained=Math.round(b.monthlyProfit*12*.20);
  const ownerDraw=Math.round(b.monthlyProfit*12*.65);
  b.capital+=retained;
  state.finance.cash+=ownerDraw;
 }else{
  const loss=Math.abs(b.monthlyProfit*12);
  const used=Math.min(state.finance.cash,loss);
  state.finance.cash-=used;
  state.finance.debt+=loss-used;
 }

 if(b.mode==='side'){
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)+2);
 }

 const closureChance=b.health<15?.55:b.health<28?.20:.01;
 if(rng.chance(closureChance)){
  b.active=false;
  b.closedAtAge=state.player.age;
  b.exitType='closure';
  if(b.mode==='full-time'){
   state.player.job=null;
   state.player.jobId=null;
   state.player.monthlyIncome=0;
   state.nextPath='work';
   state.unemployedSinceAge=state.player.age;
  }else{
   state.nextPath=state.career?.employed?'work':'gap';
  }
  return [{age:state.player.age,kind:'career',text:'Kurduğun işletme kapandı.'}];
 }

 if(b.years===1)return [{age:state.player.age,kind:'career',text:'İşletmen ilk yılını tamamladı.'}];
 return [];
}
