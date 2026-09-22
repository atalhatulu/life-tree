import {ensureConditionProgression} from './disease_progression.js';
import {treatmentResilience} from './physical_capacity.js';
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

 const resilience=treatmentResilience(state);
 const severityPenalty=Math.max(0,(condition.severity??1)-1)*.06;
 const success=Math.min(.88,Math.max(.42,.42+resilience*.0035+rng.next()*.10-severityPenalty));
 condition.treated=true;
 condition.treatmentAge=state.player.age;
 condition.treatmentSuccessful=rng.chance(success);
 condition.familyCovered=familyCovered;
 const progression=ensureConditionProgression(condition);
 if(condition.treatmentSuccessful){
  // Treatment controls the disease course; it does not magically refill the
  // body's Health reserve or rewrite the condition's intrinsic severity.
  progression.score=Math.max(0,progression.score-12);
  progression.status='stable';
  progression.stableYears=Math.max(1,progression.stableYears??0);
 }else{
  progression.score=Math.min(100,progression.score+6);
  progression.status='active';
  state.player.health.current=Math.max(0,state.player.health.current-2);
 }
 return {condition,cost,familyCovered};
}
