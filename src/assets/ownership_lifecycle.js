import {recordSpending} from '../finance/life_spending_system.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function ageOf(state,asset){
 return Math.max(0,(state.player?.age??0)-(asset?.purchasedAtAge??state.player?.age??0));
}

function assetWear(state,asset,type,rng){
 if(!asset)return [];
 asset.condition??=100;
 asset.maintenanceSpent??=0;
 const years=ageOf(state,asset);
 const wear=type==='car'
  ?rng.int(4,8)+Math.floor(years/4)
  :rng.int(1,3)+Math.floor(years/15);
 asset.condition=clamp(asset.condition-wear,0,100);

 const threshold=type==='car'?72:68;
 if(asset.condition>=threshold)return [];

 const base=Math.max(1000,Math.round((asset.price??0)*(type==='car'?.018:.006)));
 const severity=(threshold-asset.condition)/threshold;
 const maintenance=Math.round(base*(1+severity*2));
 asset.maintenanceSpent+=maintenance;
 asset.condition=clamp(asset.condition+(type==='car'?rng.int(8,16):rng.int(5,11)),0,100);
 recordSpending(state,{
  category:'ownership',
  amount:maintenance,
  label:type==='car'?'Araç bakım ve onarımı':'Ev bakım ve onarımı',
  source:'ownership-lifecycle',
  metadata:{assetType:type,condition:asset.condition,yearsOwned:years}
 });
 return [{age:state.player.age,kind:'finance',text:(type==='car'?'Aracın':'Evin')+' için bakım ve onarım gideri oluştu.'}];
}

function amortizeDebt(asset){
 if(!asset?.remainingDebt)return;
 const annualRate=asset.id?.includes('home')?.055:.11;
 const payment=Math.max(0,Math.round(asset.remainingDebt*annualRate));
 asset.remainingDebt=Math.max(0,asset.remainingDebt-payment);
}

export function processOwnershipYear(state,rng){
 const assets=state.assets;
 if(!assets)return [];
 const entries=[];
 if(assets.car){
  amortizeDebt(assets.car);
  entries.push(...assetWear(state,assets.car,'car',rng.fork('car-wear')));
 }
 if(assets.home){
  amortizeDebt(assets.home);
  entries.push(...assetWear(state,assets.home,'home',rng.fork('home-wear')));
 }
 return entries;
}
