const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export function createWorldState(startYear=2026){
 return {
  baseYear:startYear,
  currencyBasis:'2026-real-TRY',
  economy:{
   laborMarket:1,
   costOfLiving:1,
   wageIndex:1,
   healthcareCost:1,
   confidence:1
  },
  lastShock:null
 };
}

function meanRevert(value,strength=.12){
 return value+(1-value)*strength;
}

export function processWorldYear(state,rng){
 state.world??=createWorldState(state.year);
 const e=state.world.economy;
 const entries=[];

 e.laborMarket=clamp(meanRevert(e.laborMarket)+rng.int(-4,4)/100,0.72,1.28);
 e.costOfLiving=clamp(meanRevert(e.costOfLiving,.16)+rng.int(-3,3)/100,0.78,1.28);
 e.wageIndex=clamp(meanRevert(e.wageIndex,.14)+rng.int(-2,2)/100,0.82,1.22);
 e.healthcareCost=clamp(meanRevert(e.healthcareCost,.10)+rng.int(-2,3)/100,0.85,1.30);
 e.confidence=clamp(meanRevert(e.confidence,.18)+rng.int(-5,5)/100,0.70,1.30);

 const shockRoll=rng.next();
 let shock=null;
 if(shockRoll<.025){
  shock='recession';
  e.laborMarket=clamp(e.laborMarket-.16,0.72,1.28);
  e.confidence=clamp(e.confidence-.14,0.70,1.30);
  e.costOfLiving=clamp(e.costOfLiving+.05,0.78,1.28);
  entries.push({age:state.player.age,kind:'world',text:'Ekonomik durgunluk iş piyasasını ve hane bütçelerini zorlaştırdı.'});
 }else if(shockRoll<.045){
  shock='boom';
  e.laborMarket=clamp(e.laborMarket+.14,0.72,1.28);
  e.confidence=clamp(e.confidence+.12,0.70,1.30);
  e.wageIndex=clamp(e.wageIndex+.05,0.82,1.22);
  entries.push({age:state.player.age,kind:'world',text:'Güçlü ekonomik dönem iş fırsatlarını artırdı.'});
 }else if(shockRoll<.055){
  shock='health-cost';
  e.healthcareCost=clamp(e.healthcareCost+.14,0.85,1.30);
  entries.push({age:state.player.age,kind:'world',text:'Sağlık hizmetlerinin reel maliyeti belirgin biçimde yükseldi.'});
 }

 state.world.lastShock=shock?{type:shock,year:state.year}:state.world.lastShock;
 return entries;
}

export function economy(state){
 return state.world?.economy??{
  laborMarket:1,costOfLiving:1,wageIndex:1,healthcareCost:1,confidence:1
 };
}
