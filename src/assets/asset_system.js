import {TURKEY_2026_ECONOMY} from '../data/countries/turkey/economy.js';
import {liquidFunds,spendLiquidFunds} from '../finance/liquidity.js';
import {locationProfile} from '../data/countries/turkey/profile.js';

export function ensureAssets(state){
 state.assets??={home:null,car:null};
 return state.assets;
}

export function affordableCarOptions(state){
 const available=liquidFunds(state);
 return TURKEY_2026_ECONOMY.assets.cars
  .map(car=>({...car}))
  .filter(car=>available>=car.price*.35);
}

export function buyCar(state,id){
 const option=affordableCarOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu aracı karşılayamıyorsun.');
 const down=Math.round(option.price*.35);
 spendLiquidFunds(state,down);
 state.finance.debt+=option.price-down;
 ensureAssets(state).car={...option,assetType:'car',purchasedAtAge:state.player.age,remainingDebt:option.price-down,condition:100,maintenanceSpent:0};
 state.finance.lifestyle.transport='car';
 return option;
}

export function affordableHomeOptions(state){
 const available=liquidFunds(state);
 const income=state.career?.monthlyIncome??state.retirement?.pensionMonthly??0;
 const city=locationProfile(state);
 return TURKEY_2026_ECONOMY.assets.homes
  .map(home=>({...home,price:Math.round(home.price*city.housing),cityId:city.id,cityName:city.name}))
  .filter(home=>available>=home.price*.2&&income>=TURKEY_2026_ECONOMY.netMinimumWage*1.2*city.wage);
}

export function buyHome(state,id){
 const option=affordableHomeOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu evi karşılayamıyorsun.');
 const down=Math.round(option.price*.2);
 spendLiquidFunds(state,down);
 state.finance.debt+=option.price-down;
 ensureAssets(state).home={...option,assetType:'home',purchasedAtAge:state.player.age,remainingDebt:option.price-down,condition:100,maintenanceSpent:0};
 state.finance.lifestyle.housing='owned';
 return option;
}
