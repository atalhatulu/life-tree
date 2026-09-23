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
  .filter(home=>cash>=home.price*.12&&income>=30000*city.wage);
}

export function buyHome(state,id){
 const option=affordableHomeOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu evi karşılayamıyorsun.');
 const down=Math.round(option.price*.12);
 state.finance.cash-=down;
 addDebt(state,'housing',option.price-down);
 ensureAssets(state).home={...option,purchasedAtAge:state.player.age,remainingDebt:option.price-down};
 state.finance.lifestyle.housing='owned';
 return option;
}


export function sellCar(state){
 const car=state.assets?.car;
 if(!car)throw new Error('Satılacak aracın yok.');
 const sale=Math.round((car.price??0)*.72);
 const debt=Math.max(0,state.finance?.debts?.car??car.remainingDebt??0);
 const payoff=Math.min(sale,debt);
 if(state.finance?.debts)state.finance.debts.car=Math.max(0,(state.finance.debts.car??0)-payoff);
 state.finance.debt=Math.max(0,(state.finance.debt??0)-payoff);
 state.finance.cash=(state.finance.cash??0)+Math.max(0,sale-payoff);
 state.assets.car=null;
 if(state.finance?.lifestyle)state.finance.lifestyle.transport='public';
 return {sale,payoff,net:sale-payoff};
}

export function sellHome(state){
 const home=state.assets?.home;
 if(!home)throw new Error('Satılacak evin yok.');
 const sale=Math.round((home.price??0)*.90);
 const debt=Math.max(0,state.finance?.debts?.housing??home.remainingDebt??0);
 const payoff=Math.min(sale,debt);
 if(state.finance?.debts)state.finance.debts.housing=Math.max(0,(state.finance.debts.housing??0)-payoff);
 state.finance.debt=Math.max(0,(state.finance.debt??0)-payoff);
 state.finance.cash=(state.finance.cash??0)+Math.max(0,sale-payoff);
 state.assets.home=null;
 if(state.finance?.lifestyle)state.finance.lifestyle.housing='shared';
 return {sale,payoff,net:sale-payoff};
}

export function moveHousing(state,mode){
 const allowed=['family','shared','studio','apartment'];
 if(!allowed.includes(mode))throw new Error('Bu konut düzeni seçilemez.');
 if(state.assets?.home)throw new Error('Önce sahip olduğun evi satmalısın.');
 const deposits={family:0,shared:12000,studio:24000,apartment:38000};
 const cost=deposits[mode]??0;
 if((state.finance?.cash??0)<cost)throw new Error('Taşınma/depozito için yeterli nakdin yok.');
 state.finance.cash-=cost;
 state.finance.lifestyle.housing=mode;
 return {mode,cost};
}
