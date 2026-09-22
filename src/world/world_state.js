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
   confidence:1,
   housingMarket:1,
   creditConditions:1,
   entrepreneurship:1
  },
  activeShock:null,
  shockHistory:[],
  lastShock:null
 };
}

function meanRevert(value,strength=.12){return value+(1-value)*strength;}

function applyPersistentShock(e,shock){
 if(!shock)return;
 if(shock.type==='recession'){
  e.laborMarket-=.05;e.confidence-=.05;e.creditConditions+=.05;e.entrepreneurship-=.04;
 }
 if(shock.type==='boom'){
  e.laborMarket+=.04;e.confidence+=.04;e.wageIndex+=.015;e.entrepreneurship+=.04;e.creditConditions-=.02;
 }
 if(shock.type==='housing-surge'){
  e.housingMarket+=.06;e.costOfLiving+=.015;
 }
 if(shock.type==='health-cost'){
  e.healthcareCost+=.05;
 }
}

export function processWorldYear(state,rng){
 state.world??=createWorldState(state.year);
 const w=state.world;
 const e=w.economy;
 e.housingMarket??=1;e.creditConditions??=1;e.entrepreneurship??=1;
 w.shockHistory??=[];
 const entries=[];

 e.laborMarket=meanRevert(e.laborMarket,.13)+rng.int(-3,3)/100;
 e.costOfLiving=meanRevert(e.costOfLiving,.16)+rng.int(-2,2)/100;
 e.wageIndex=meanRevert(e.wageIndex,.13)+rng.int(-2,2)/100;
 e.healthcareCost=meanRevert(e.healthcareCost,.10)+rng.int(-2,2)/100;
 e.confidence=meanRevert(e.confidence,.17)+rng.int(-4,4)/100;
 e.housingMarket=meanRevert(e.housingMarket,.10)+rng.int(-2,2)/100;
 e.creditConditions=meanRevert(e.creditConditions,.16)+rng.int(-2,2)/100;
 e.entrepreneurship=meanRevert(e.entrepreneurship,.14)+rng.int(-3,3)/100;

 if(w.activeShock){
  applyPersistentShock(e,w.activeShock);
  w.activeShock.remainingYears-=1;
  if(w.activeShock.remainingYears<=0)w.activeShock=null;
 }

 if(!w.activeShock){
  const roll=rng.next();
  let shock=null;
  if(roll<.018)shock={type:'recession',remainingYears:rng.int(2,3)};
  else if(roll<.033)shock={type:'boom',remainingYears:rng.int(2,3)};
  else if(roll<.041)shock={type:'health-cost',remainingYears:rng.int(1,2)};
  else if(roll<.049)shock={type:'housing-surge',remainingYears:rng.int(2,4)};

  if(shock){
   w.activeShock=shock;
   w.lastShock={type:shock.type,year:state.year};
   w.shockHistory.push({...w.lastShock});
   if(shock.type==='recession')entries.push({age:state.player.age,kind:'world',text:'Ekonomik durgunluk başladı; iş piyasası, kredi koşulları ve tüketici güveni zayıfladı.'});
   if(shock.type==='boom')entries.push({age:state.player.age,kind:'world',text:'Ekonomik genişleme başladı; iş fırsatları ve girişimcilik ortamı güçlendi.'});
   if(shock.type==='health-cost')entries.push({age:state.player.age,kind:'world',text:'Sağlık hizmetlerinin reel maliyetinde belirgin artış başladı.'});
   if(shock.type==='housing-surge')entries.push({age:state.player.age,kind:'world',text:'Konut piyasasında birkaç yıl sürebilecek hızlı fiyat artışı başladı.'});
  }
 }

 e.laborMarket=clamp(e.laborMarket,.70,1.30);
 e.costOfLiving=clamp(e.costOfLiving,.78,1.30);
 e.wageIndex=clamp(e.wageIndex,.80,1.26);
 e.healthcareCost=clamp(e.healthcareCost,.84,1.35);
 e.confidence=clamp(e.confidence,.68,1.32);
 e.housingMarket=clamp(e.housingMarket,.75,1.38);
 e.creditConditions=clamp(e.creditConditions,.78,1.35);
 e.entrepreneurship=clamp(e.entrepreneurship,.72,1.32);

 return entries;
}

export function economy(state){
 return state.world?.economy??{
  laborMarket:1,costOfLiving:1,wageIndex:1,healthcareCost:1,confidence:1,
  housingMarket:1,creditConditions:1,entrepreneurship:1
 };
}
