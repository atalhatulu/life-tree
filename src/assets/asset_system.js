import {TURKEY_2026_ECONOMY} from '../data/countries/turkey/economy.js';
import {locationProfile} from '../data/countries/turkey/profile.js';
import {addDebt,settleSecuredAssetSale} from '../finance/personal_finance.js';
import {economy} from '../world/world_state.js';
import {safeCashAmount} from '../finance/safe_cash.js';

export function ensureAssets(state){
 state.assets??={home:null,car:null};
 return state.assets;
}

export function affordableCarOptions(state){
 if(state.assets?.car)return [];
 const cash=state.finance?.cash??0;
 if(!Number.isSafeInteger(cash)||cash<0)return [];
 return TURKEY_2026_ECONOMY.assets.cars
  .map(car=>({...car}))
  .filter(car=>cash>=car.price*.30);
}

// A rejected credit application must not first remove the down payment.
// Validate on an isolated ledger because addDebt reconciles legacy saves.
function previewAssetLoan(state,type,price,down){
 const cash=safeCashAmount(state.finance?.cash,'Purchase cash');
 const value=safeCashAmount(price,'Asset price');
 const deposit=safeCashAmount(down,'Down payment');
 if(deposit>cash||deposit>value)throw new RangeError('Insufficient purchase cash');
 const loan=value-deposit;
 const preview={...state,
  finance:structuredClone(state.finance),
  assets:state.assets?structuredClone(state.assets):undefined};
 addDebt(preview,type,loan);
 return loan;
}

export function buyCar(state,id){
 if(state.assets?.car)throw new Error('Önce mevcut aracı satmalısın.');
 const option=affordableCarOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu aracı karşılayamıyorsun.');
 const down=Math.round(option.price*.30);
 const loan=previewAssetLoan(state,'car',option.price,down);
 addDebt(state,'car',loan);
 state.finance.cash-=down;
 ensureAssets(state).car={...option,purchasedAtAge:state.player.age,remainingDebt:loan};
 state.finance.lifestyle.transport='car';
 return option;
}

export function affordableHomeOptions(state){
 if(state.assets?.home)return [];
 const cash=state.finance?.cash??0;
 if(!Number.isSafeInteger(cash)||cash<0)return [];
 const income=state.career?.monthlyIncome??state.retirement?.pensionMonthly??0;
 const city=locationProfile(state);
 return TURKEY_2026_ECONOMY.assets.homes
  .map(home=>({...home,price:Math.round(home.price*city.housing*(economy(state).housingMarket??1)),cityId:city.id,cityName:city.name}))
  .filter(home=>cash>=home.price*.12&&income>=30000*city.wage);
}

export function buyHome(state,id){
 if(state.assets?.home)throw new Error('Önce mevcut evi satmalısın.');
 const option=affordableHomeOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu evi karşılayamıyorsun.');
 const down=Math.round(option.price*.12);
 const loan=previewAssetLoan(state,'housing',option.price,down);
 addDebt(state,'housing',loan);
 state.finance.cash-=down;
 ensureAssets(state).home={...option,purchasedAtAge:state.player.age,remainingDebt:loan};
 state.finance.lifestyle.housing='owned';
 return option;
}


export function sellCar(state){
 const car=state.assets?.car;
 if(!car)throw new Error('Satılacak aracın yok.');
 const sale=Math.round((car.price??0)*.72);
 const {payoff,net}=settleSecuredAssetSale(state,'car',sale);
 state.assets.car=null;
 if(state.finance?.lifestyle)state.finance.lifestyle.transport='public';
 return {sale,payoff,net};
}

export function sellHome(state){
 const home=state.assets?.home;
 if(!home)throw new Error('Satılacak evin yok.');
 const sale=Math.round((home.price??0)*.90);
 const {payoff,net}=settleSecuredAssetSale(state,'housing',sale);
 state.assets.home=null;
 if(state.finance?.lifestyle)state.finance.lifestyle.housing='shared';
 return {sale,payoff,net};
}

export function moveHousing(state,mode){
 const allowed=['family','shared','studio','apartment'];
 if(!allowed.includes(mode))throw new Error('Bu konut düzeni seçilemez.');
 if(state.assets?.home)throw new Error('Önce sahip olduğun evi satmalısın.');
 // Choosing the current arrangement again is not another move or deposit.
 if(state.finance?.lifestyle?.housing===mode)return {mode,cost:0,changed:false};
 const deposits={family:0,shared:12000,studio:24000,apartment:38000};
 const cost=deposits[mode]??0;
 const cash=state.finance?.cash;
 if(!Number.isSafeInteger(cash)||cash<0)throw new RangeError('Invalid housing cash balance');
 if(cash<cost)throw new Error('Taşınma/depozito için yeterli nakdin yok.');
 state.finance.cash=cash-cost;
 state.finance.lifestyle.housing=mode;
 return {mode,cost,changed:true};
}
