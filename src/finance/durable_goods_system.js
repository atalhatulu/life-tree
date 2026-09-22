import {recordSpending} from './life_spending_system.js';

export const DURABLE_GOODS=[
 {id:'phone',label:'Telefon',price:30000,lifespanYears:4,minAge:15,interestKeys:['teknoloji']},
 {id:'computer',label:'Bilgisayar',price:65000,lifespanYears:6,minAge:16,interestKeys:['teknoloji','oyun']},
 {id:'household',label:'Ev eşyaları',price:90000,lifespanYears:8,minAge:22,requiresIndependentHousing:true,interestKeys:[]}
];

export function ensureDurableGoods(state){
 state.finance??={cash:0,savings:0,debt:0};
 state.finance.durableGoods??={};
 return state.finance.durableGoods;
}

function interestScore(state,item){
 if(!item.interestKeys?.length)return 50;
 const interests=state.player?.interests??{};
 const total=item.interestKeys.reduce((sum,key)=>sum+(interests[key]??50),0);
 return total/item.interestKeys.length;
}

function eligible(state,item){
 if((state.player?.age??0)<item.minAge)return false;
 if(item.requiresIndependentHousing){
  const housing=state.finance?.lifestyle?.housing;
  if(!housing||housing==='family')return false;
 }
 return true;
}

function needScore(state,item,current){
 if(!current)return 100+interestScore(state,item)*.15;
 const age=(state.player?.age??0)-(current.purchasedAtAge??state.player?.age??0);
 const overdue=Math.max(0,age-item.lifespanYears);
 return overdue*25+(age/item.lifespanYears)*40+interestScore(state,item)*.12;
}

export function processDurableGoodsBudget(state,budget){
 const totalBudget=Math.max(0,Math.round(budget??0));
 const goods=ensureDurableGoods(state);
 let remaining=totalBudget;
 const purchased=[];

 const candidates=DURABLE_GOODS
  .filter(item=>eligible(state,item))
  .map(item=>({item,current:goods[item.id]??null,score:needScore(state,item,goods[item.id]??null)}))
  .filter(({item,current})=>{
   if(!current)return true;
   const age=(state.player?.age??0)-(current.purchasedAtAge??0);
   return age>=item.lifespanYears;
  })
  .sort((a,b)=>b.score-a.score);

 for(const {item,current} of candidates){
  if(item.price>remaining)continue;
  const generation=(current?.generation??0)+1;
  goods[item.id]={
   id:item.id,
   label:item.label,
   purchasedAtAge:state.player?.age??null,
   purchasedYear:state.year??null,
   price:item.price,
   lifespanYears:item.lifespanYears,
   generation
  };
  recordSpending(state,{
   category:'durable-goods',
   amount:item.price,
   label:(current?'Yenilenen ':'Satın alınan ')+item.label.toLocaleLowerCase('tr-TR'),
   source:'durable-goods',
   metadata:{itemId:item.id,generation,replacement:Boolean(current)}
  });
  remaining-=item.price;
  purchased.push(goods[item.id]);
 }

 if(remaining>0){
  recordSpending(state,{
   category:'durable-goods',
   amount:remaining,
   label:'Diğer ev ve kişisel eşyalar',
   source:'annual-budget'
  });
 }

 return {budget:totalBudget,spent:totalBudget,remaining:0,purchased};
}
