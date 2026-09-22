import {TURKEY_2026_ECONOMY} from '../data/countries/turkey/economy.js';
import {locationProfile} from '../data/countries/turkey/profile.js';
import {addDebt} from '../finance/personal_finance.js';
import {economy} from '../world/world_state.js';

export function ensureAssets(state){
 state.assets??={home:null,car:null};
 return state.assets;
}

export function affordableCarOptions(state){
 const cash=state.finance?.cash??0;
 return TURKEY_2026_ECONOMY.assets.cars
  .map(car=>({...car}))
  .filter(car=>cash>=car.price*.30);
}

export function buyCar(state,id){
 const option=affordableCarOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu aracı karşılayamıyorsun.');
 const down=Math.round(option.price*.30);
 state.finance.cash-=down;
 addDebt(state,'car',option.price-down);
 ensureAssets(state).car={...option,purchasedAtAge:state.player.age,remainingDebt:option.price-down};
 state.finance.lifestyle.transport='car';
 return option;
}

export function affordableHomeOptions(state){
 const cash=state.finance?.cash??0;
 const income=state.career?.monthlyIncome??state.retirement?.pensionMonthly??0;
 const city=locationProfile(state);
 return TURKEY_2026_ECONOMY.assets.homes
  .map(home=>({...home,price:Math.round(home.price*city.housing*(economy(state).housingMarket??1)),cityId:city.id,cityName:city.name}))
  .filter(home=>cash>=home.price*.15&&income>=30000*city.wage);
}

export function buyHome(state,id){
 const option=affordableHomeOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu evi karşılayamıyorsun.');
 const down=Math.round(option.price*.15);
 state.finance.cash-=down;
 addDebt(state,'housing',option.price-down);
 ensureAssets(state).home={...option,purchasedAtAge:state.player.age,remainingDebt:option.price-down};
 state.finance.lifestyle.housing='owned';
 return option;
}
