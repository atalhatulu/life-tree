import {TURKEY_CITIES,cityById} from '../data/countries/turkey/cities.js';

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

 const cost=movingCost(from.cityId,to.id,relocationHouseholdSize(state));
 state.finance??={cash:0,debt:0,lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};

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
 return moveToCity(state,state.origin.cityId,'return-home',{housing:state.assets?.home?.cityId===state.origin.cityId?'owned':'family',stress:1});
}
