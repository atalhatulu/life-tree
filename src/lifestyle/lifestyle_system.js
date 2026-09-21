import {TURKEY_2026_ECONOMY} from '../data/countries/turkey/economy.js';
import {locationProfile} from '../data/countries/turkey/profile.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const LIFESTYLE_COSTS=TURKEY_2026_ECONOMY.lifestyle;

export function lifestyleMonthlyCost(state){
 const l=state.finance?.lifestyle??{housing:'family',food:'standard',clothing:'basic',transport:'public'};
 const city=locationProfile(state);
 const baseHousing=LIFESTYLE_COSTS.housing[l.housing];
 const baseFood=LIFESTYLE_COSTS.food[l.food];
 const baseClothing=LIFESTYLE_COSTS.clothing[l.clothing];
 const baseTransport=LIFESTYLE_COSTS.transport[l.transport];
 const leisure=LIFESTYLE_COSTS.leisure[l.housing]??3000;

 const housing=Math.round(baseHousing*city.housing);
 const other=Math.round((baseFood+baseClothing+baseTransport+leisure)*city.cost);
 return housing+other;
}

export function lifestyleEffects(state){
 const l=state.finance?.lifestyle;
 if(!l) return {health:0,status:0,stress:0};
 let health=0,status=0,stress=0;
 if(l.food==='frugal'){health-=2;stress+=1;}
 if(l.food==='healthy'){health+=3;}
 if(l.food==='premium'){health+=1;status+=2;}
 if(l.clothing==='premium')status+=4;
 if(l.transport==='car')status+=3;
 if(l.housing==='family'&&state.player.age>=28)stress+=2;
 if(['apartment','owned'].includes(l.housing))status+=4;
 return {health:clamp(health,-10,10),status:clamp(status,-10,20),stress:clamp(stress,0,20)};
}

export function setLifestyle(state,changes){
 if(!state.finance) throw new Error('Kişisel finans henüz başlamadı.');
 const l=state.finance.lifestyle;
 for(const [key,value] of Object.entries(changes)){
  if(!LIFESTYLE_COSTS[key]?.[value]&&LIFESTYLE_COSTS[key]?.[value]!==0) throw new Error('Geçersiz yaşam standardı seçimi.');
  l[key]=value;
 }
}
