import {TURKEY_CITIES,cityById} from '../data/countries/turkey/cities.js';
import {ensurePersonalFinance} from '../finance/personal_finance.js';

function cloneLocation(location){return location?structuredClone(location):null;}

export function movingCost(fromCityId,toCityId,householdSize=1){
 const from=cityById(fromCityId);
 const to=cityById(toCityId);
 const distanceFactor=from.id===to.id?0:1+Math.abs(from.cost-to.cost)*.8;
 const base=14000+Math.max(0,householdSize-1)*4500;
 return Math.round(base*distanceFactor*to.cost);
}

export function chooseJobOfferCity(state,rng){
 const current=cityById(state.location?.cityId??state.origin?.cityId);
 if(rng.chance(.62))return current;

 const alternatives=TURKEY_CITIES.filter(city=>city.id!==current.id);
 return rng.weighted(alternatives.map(city=>({
  value:city,
  weight:Math.max(.2,city.weight*city.jobs*(city.wage/Math.max(.75,city.cost)))
 })));
}

export function relocationHouseholdSize(state){
 let size=1;
 const partner=state.social?.romance;
 if(partner&&['cohabiting','married'].includes(partner.status))size+=1;
 size+=(state.children??[]).filter(child=>child.age<18).length;
 return size;
}

export function canAffordMove(state,toCityId){
 const fromCityId=state.location?.cityId??state.origin?.cityId;
 if(fromCityId===toCityId)return true;
 const cost=movingCost(fromCityId,toCityId,relocationHouseholdSize(state));
 const cash=state.finance?.cash??0;
 return cash>=cost*.35;
}

export function moveToCity(state,toCityId,reason='personal',options={}){
 const from=cloneLocation(state.location??state.origin);
 const to=cityById(toCityId);
 if(!from)throw new Error('Mevcut konum bilgisi yok.');
 if(from.cityId===to.id)return {moved:false,cost:0,from,to:cloneLocation(from)};

 const cost=Math.round(movingCost(from.cityId,to.id,relocationHouseholdSize(state))*(options.costMultiplier??1));
 ensurePersonalFinance(state);

 const paid=Math.min(state.finance.cash??0,cost);
 state.finance.cash=Math.max(0,(state.finance.cash??0)-paid);
 state.finance.debt=(state.finance.debt??0)+Math.max(0,cost-paid);

 if(state.assets?.home?.cityId&&state.assets.home.cityId!==to.id){
  state.assets.home.isPrimaryResidence=false;
  if(state.finance.lifestyle)state.finance.lifestyle.housing=options.housing??'shared';
 }else if(state.assets?.home?.cityId===to.id){
  state.assets.home.isPrimaryResidence=true;
  if(state.finance.lifestyle)state.finance.lifestyle.housing='owned';
 }else if(state.finance.lifestyle?.housing==='family'&&to.id!==state.origin?.cityId){
  state.finance.lifestyle.housing=options.housing??'shared';
 }

 state.location={
  countryId:'TR',
  cityId:to.id,
  cityName:to.name,
  sinceYear:state.year,
  reason
 };

 const partner=state.social?.romance;
 if(partner&&['cohabiting','married'].includes(partner.status)){
  partner.cityId=to.id;
  partner.cityName=to.name;
 }

 state.migrationHistory??=[];
 state.migrationHistory.push({
  age:state.player.age,
  year:state.year,
  fromCityId:from.cityId,
  fromCityName:from.cityName,
  toCityId:to.id,
  toCityName:to.name,
  reason,
  cost
 });

 if(state.healthProfile){
  state.healthProfile.stress=Math.min(100,(state.healthProfile.stress??20)+(options.stress??3));
 }

 return {moved:true,cost,from,to};
}

export function returnHome(state){
 const useOwned=state.assets?.home?.cityId===state.origin.cityId;
 const previousJob=state.career?.employed?{
  title:state.career.title,
  years:state.career.years??0
 }:null;

 if(state.career?.employed){
  state.career.previousJobs??=[];
  state.career.previousJobs.push(previousJob);
  state.career.employed=false;
  state.player.job=null;
  state.player.jobId=null;
  state.player.monthlyIncome=0;
  state.nextPath='work';
  state.unemployedSinceAge=state.player.age;
  state.pendingJobOffers=null;
 }

 const result=moveToCity(state,state.origin.cityId,'return-home',{housing:useOwned?'owned':'family',stress:1});
 state.hasReturnedHome=true;
 if(state.finance?.lifestyle)state.finance.lifestyle.housing=useOwned?'owned':'family';
 return {...result,leftJob:Boolean(previousJob),previousJob};
}


export function generatePartnerMoveOpportunity(state,rng){
 const partner=state.social?.romance;
 if(!partner||!['cohabiting','married'].includes(partner.status))return null;
 if(state.pendingPartnerMove)return state.pendingPartnerMove;
 if(state.player.age<23||state.player.age>58)return null;
 if(state.player.age<(state.nextPartnerMoveAge??23))return null;
 if(!rng.chance(.065))return null;

 const current=cityById(state.location?.cityId??state.origin?.cityId);
 const candidates=TURKEY_CITIES.filter(city=>city.id!==current.id);
 const city=rng.weighted(candidates.map(value=>({
  value,
  weight:Math.max(.2,value.weight*value.jobs*value.wage/Math.max(.75,value.cost))
 })));

 const currentIncome=partner.monthlyIncome??30000;
 const targetIncome=Math.max(
  currentIncome,
  Math.round(currentIncome*(city.wage/current.wage)*(rng.int(102,126)/100))
 );

 state.pendingPartnerMove={
  cityId:city.id,
  cityName:city.name,
  previousCityId:current.id,
  previousCityName:current.name,
  partnerJob:partner.job,
  oldIncome:currentIncome,
  newIncome:targetIncome
 };
 return state.pendingPartnerMove;
}

export function resolvePartnerMove(state,accept){
 const opportunity=state.pendingPartnerMove;
 const partner=state.social?.romance;
 if(!opportunity||!partner)throw new Error('Aktif eş taşınma fırsatı yok.');

 if(!accept){
  partner.relationship=Math.max(0,(partner.relationship??60)-2);
  state.nextPartnerMoveAge=state.player.age+4;
  state.pendingPartnerMove=null;
  return {moved:false};
 }

 const move=moveToCity(state,opportunity.cityId,'partner-job',{housing:'shared',stress:4});
 partner.monthlyIncome=opportunity.newIncome;
 partner.cityId=opportunity.cityId;
 partner.cityName=opportunity.cityName;
 partner.relationship=Math.min(100,(partner.relationship??60)+2);
 state.nextPartnerMoveAge=state.player.age+5;
 state.pendingPartnerMove=null;
 return move;
}

export function canConsiderReturnHome(state){
 if(!state.origin?.cityId||!state.location?.cityId)return false;
 if(state.origin.cityId===state.location.cityId)return false;
 if(state.hasReturnedHome)return false;
 if(state.player.age<28||state.player.age>70)return false;
 if(state.player.age<(state.nextReturnHomeAge??28))return false;
 if((state.preferences?.hometownAttachment??50)<58)return false;
 const yearsAway=state.year-(state.location.sinceYear??state.year);
 return yearsAway>=3;
}

export function deferReturnHome(state,years=8){
 state.nextReturnHomeAge=state.player.age+years;
}
