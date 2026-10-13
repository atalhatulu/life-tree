import {annualYearStatus} from '../core/annual_clock.js';
import {archiveCareer} from './career_profile.js';
import {addDebt} from '../finance/personal_finance.js';
import {safeCashAmount,previewCashCredit} from '../finance/safe_cash.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function canStartBusiness(state){
 return state.player.age>=25&&
  !state.business?.active&&
  Number.isSafeInteger(state.finance?.cash)&&
  state.finance.cash>=250000&&
  (state.player.personality.ambition??0)>=55;
}

export function startBusiness(state,rng,mode='full-time'){
 if(!canStartBusiness(state))throw new Error('Şirket kurmak için koşullar uygun değil.');
 if(!['full-time','side'].includes(mode))throw new Error('Geçersiz girişimcilik modu.');
 const maxShare=mode==='full-time'?.55:.30;
 const proposed=rng.int(250000,650000);
 // Invalid random values must never create negative or nonnumeric capital.
 if(typeof proposed!=='number'||!Number.isSafeInteger(proposed)||proposed<0)
  throw new RangeError('Invalid business investment');
 const investment=safeCashAmount(Math.min(state.finance.cash*maxShare,proposed),'Business investment');
 state.finance.cash-=investment;

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
  capital:investment,
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
 const {calendarYear,replayed}=annualYearStatus(state.year,b.lastProcessedYear,'business');
 if(replayed)return [];
 // Calculate the financial outcome before advancing the business year. An
 // invalid legacy balance or debt overflow must leave the entire state intact.
 const capital=safeCashAmount(b.capital,'Business capital');
 const founderScore=(state.player.personality.ambition??50)*.25+
  (state.player.personality.discipline??50)*.25+
  (state.player.personality.sociability??50)*.15;
 const timePenalty=b.mode==='side'?8:0;
 const volatility=rng.int(-18,22);
 const nextHealth=clamp(b.health+(founderScore-35)*.10+volatility*.42-2-timePenalty*.12);
 const profitRoll=rng.int(-24000,26000);
 const monthlyProfit=Math.max(-55000,Math.round(capital*.016*(nextHealth/55)+profitRoll));
 if(!Number.isSafeInteger(monthlyProfit))throw new RangeError('Invalid business profit');
 const adjustedHealth=monthlyProfit<0?clamp(nextHealth-5):nextHealth;
 let retained=0,ownerDraw=0,loss=0,used=0;
 if(monthlyProfit>0){
  retained=safeCashAmount(monthlyProfit*12*.20,'Retained business earnings');
  ownerDraw=safeCashAmount(monthlyProfit*12*.65,'Owner draw');
  if(retained>Number.MAX_SAFE_INTEGER-capital)
   throw new RangeError('Business capital exceeds safe monetary limit');
  previewCashCredit(state,ownerDraw);
 }else{
  const cash=state.finance?.cash;
  if(!Number.isSafeInteger(cash))throw new RangeError('Invalid business cash balance');
  loss=safeCashAmount(Math.abs(monthlyProfit*12),'Business annual loss');
  used=Math.min(Math.max(0,cash),loss);
  if(loss>used){
   // The debt API reconciles old saves; validate against a copy so that an
   // unsuccessful annual loss cannot partially repair the original ledger.
   const preview={...state,finance:state.finance?structuredClone(state.finance):undefined,
    assets:state.assets?structuredClone(state.assets):undefined};
   addDebt(preview,'consumer',loss-used);
  }
 }

 b.years+=1;
 b.health=adjustedHealth;
 b.monthlyProfit=monthlyProfit;
 if(monthlyProfit>35000&&rng.chance(.25))b.employees+=rng.int(1,3);
 if(monthlyProfit>0){
  b.capital+=retained;
  state.finance.cash+=ownerDraw;
 }else{
  state.finance.cash-=used;
  if(loss>used)addDebt(state,'consumer',loss-used);
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
  if(calendarYear!==null)b.lastProcessedYear=calendarYear;
  return [{age:state.player.age,kind:'career',text:'Kurduğun işletme kapandı.'}];
 }

 if(calendarYear!==null)b.lastProcessedYear=calendarYear;
 if(b.years===1)return [{age:state.player.age,kind:'career',text:'İşletmen ilk yılını tamamladı.'}];
 return [];
}
