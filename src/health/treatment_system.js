import {economy} from '../world/world_state.js';
import {ensurePersonalFinance} from '../finance/personal_finance.js';
const COSTS={1:18000,2:45000,3:110000};

export function untreatedConditions(state){
 return (state.healthProfile?.conditions??[]).filter(c=>!c.treated);
}

export function treatmentOptions(state){
 const macro=economy(state);
 const familyCovered=state.player.age<19;
 return untreatedConditions(state).map(c=>({
  id:c.id,
  label:c.label,
  cost:familyCovered?0:Math.round((COSTS[c.severity]??30000)*macro.healthcareCost),
  familyCovered,
  severity:c.severity
 }));
}

export function treatCondition(state,id,rng){
 const condition=(state.healthProfile?.conditions??[]).find(c=>c.id===id&&!c.treated);
 if(!condition)throw new Error('Tedavi edilebilir aktif durum bulunamadı.');

 const familyCovered=state.player.age<19;
 const cost=familyCovered?0:Math.round((COSTS[condition.severity]??30000)*economy(state).healthcareCost);
 if(!familyCovered){
  ensurePersonalFinance(state);
  const used=Math.min(state.finance.cash,cost);
  state.finance.cash-=used;
  state.finance.debt+=(cost-used);
 }

 const success=Math.min(.94,.58+state.player.health.constitution*.003+rng.next()*.12);
 condition.treated=true;
 condition.treatmentAge=state.player.age;
 condition.treatmentSuccessful=rng.chance(success);
 condition.familyCovered=familyCovered;
 if(condition.treatmentSuccessful){
  condition.severity=Math.max(1,condition.severity-1);
  state.player.health.current=Math.min(100,state.player.health.current+6);
 }else{
  state.player.health.current=Math.max(0,state.player.health.current-2);
 }
 return {condition,cost,familyCovered};
}
