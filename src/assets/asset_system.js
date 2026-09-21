export function ensureAssets(state){
 state.assets??={home:null,car:null};
 return state.assets;
}

export function affordableCarOptions(state){
 const cash=state.finance?.cash??0;
 return [
  {id:'used',label:'İkinci el otomobil',price:180000,runningCost:6500,status:2},
  {id:'standard',label:'Standart otomobil',price:420000,runningCost:9000,status:4},
  {id:'premium',label:'Premium otomobil',price:950000,runningCost:16000,status:8}
 ].filter(x=>cash>=x.price*.35);
}

export function buyCar(state,id){
 const option=affordableCarOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu aracı karşılayamıyorsun.');
 const down=Math.round(option.price*.35);
 state.finance.cash-=down;
 state.finance.debt+=option.price-down;
 ensureAssets(state).car={...option,purchasedAtAge:state.player.age,remainingDebt:option.price-down};
 state.finance.lifestyle.transport='car';
 return option;
}

export function affordableHomeOptions(state){
 const cash=state.finance?.cash??0;
 const income=state.career?.monthlyIncome??0;
 return [
  {id:'small-flat',label:'Küçük daire',price:1800000,housing:'owned'},
  {id:'family-flat',label:'Standart daire',price:3200000,housing:'owned'}
 ].filter(x=>cash>=x.price*.2&&income>=35000);
}

export function buyHome(state,id){
 const option=affordableHomeOptions(state).find(x=>x.id===id);
 if(!option) throw new Error('Bu evi karşılayamıyorsun.');
 const down=Math.round(option.price*.2);
 state.finance.cash-=down;
 state.finance.debt+=option.price-down;
 ensureAssets(state).home={...option,purchasedAtAge:state.player.age,remainingDebt:option.price-down};
 state.finance.lifestyle.housing='owned';
 return option;
}
