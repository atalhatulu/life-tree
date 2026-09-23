const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureHouseholdDepth(state){
 state.householdDynamics??={
  financialPressure:0,
  maintenanceBurden:0,
  familySupportBurden:0,
  emergencyReserveMonths:0,
  stability:65,
  recentShock:null
 };
 return state.householdDynamics;
}

export function processHouseholdDepthYear(state,rng){
 const entries=[];
 const h=ensureHouseholdDepth(state);
 const f=state.finance;
 if(!f)return entries;
 const monthlyOut=(f.monthlyExpenses??0)+(f.ownershipCostsMonthly??0);
 const liquid=(f.cash??0)+(f.savings??0);
 h.emergencyReserveMonths=monthlyOut>0?Math.round((liquid/monthlyOut)*10)/10:0;
 const debtIncome=(f.debt??0)/Math.max(1,(f.monthlyIncome??0)*12);
 h.financialPressure=clamp(
  Math.round(
   debtIncome*18+
   (h.emergencyReserveMonths<2?22:h.emergencyReserveMonths<4?10:0)+
   ((f.financialDistressYears??0)>0?25:0)
  )
 );
 const homeAge=state.assets?.home?Math.max(0,state.player.age-(state.assets.home.purchasedAtAge??state.player.age)):0;
 const carAge=state.assets?.car?Math.max(0,state.player.age-(state.assets.car.purchasedAtAge??state.player.age)):0;
 h.maintenanceBurden=clamp(Math.round(homeAge*1.4+carAge*2+(state.assets?.home?8:0)+(state.assets?.car?6:0)));
 const dependentChildren=state.children?.filter(c=>c.age<22).length??0;
 const elderCare=state.parentCare?.active?1:0;
 h.familySupportBurden=clamp(dependentChildren*12+elderCare*25);
 h.stability=clamp(82-h.financialPressure*.45-h.maintenanceBurden*.12-h.familySupportBurden*.18);

 let shock=null;
 if(state.assets?.car&&rng.fork('car-repair').chance(.07+carAge*.008)){
  const cost=Math.round(4500+carAge*1100+rng.int(0,7500));
  shock={type:'car-repair',cost,text:'Araban beklenmedik bir bakım masrafı çıkardı.'};
 }
 if(!shock&&state.assets?.home&&rng.fork('home-repair').chance(.055+homeAge*.006)){
  const cost=Math.round(8000+homeAge*1600+rng.int(0,16000));
  shock={type:'home-repair',cost,text:'Evde beklenmedik bir tamir masrafı çıktı.'};
 }
 if(shock){
  const fromCash=Math.min(f.cash??0,shock.cost);
  f.cash=(f.cash??0)-fromCash;
  const remaining=shock.cost-fromCash;
  if(remaining>0){
    f.debt=(f.debt??0)+remaining;
    f.debts??={consumer:0,medical:0,housing:0,car:0,emergency:0};
    f.debts.emergency=(f.debts.emergency??0)+remaining;
  }
  h.recentShock={...shock,age:state.player.age};
  state.healthProfile.stress=clamp((state.healthProfile?.stress??20)+(remaining>0?6:3));
  entries.push({age:state.player.age,kind:'household',text:shock.text+' Masraf: ₺'+shock.cost.toLocaleString('tr-TR')+'.'});
 }
 if(h.financialPressure>=70&&state.social?.romance){
  state.social.romance.resentment=clamp((state.social.romance.resentment??20)+3);
  state.social.romance.relationshipTension=clamp((state.social.romance.relationshipTension??10)+2);
 }
 return entries;
}
