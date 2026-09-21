export function buildDeathSummary(state){
 const tree=state.lifeTree?.nodes??[];
 const children=state.children??[];
 const relationships=state.social?.exSpouses?.length??0;
 const career=state.career;
 return {
  name:state.player.name+' '+state.player.surname,
  age:state.player.age,
  birthYear:state.year-state.player.age,
  deathYear:state.year,
  cause:state.death?.cause??'unknown',
  education:state.higherEducation?.completed?state.higherEducation.programTitle:(state.education?.pathLabel??'Temel eğitim'),
  career:state.retirement?.previousTitle??career?.title??state.player.job??'Belirgin kariyer yok',
  retired:Boolean(state.retirement?.retired),
  businessFounded:Boolean(state.business),
  children:children.length,
  grandchildren:state.grandchildren??0,
  marriages:(state.social?.romance?.status==='married'?1:0)+relationships,
  homeOwned:Boolean(state.assets?.home),
  carOwned:Boolean(state.assets?.car),
  finalCash:Math.round(state.finance?.cash??0),
  finalDebt:Math.round(state.finance?.debt??0),
  majorDecisions:tree.length,
  healthConditions:state.healthProfile?.conditions?.map(c=>c.label)??[]
 };
}

export function finalizeDeath(state){
 if(!state.death)return null;
 if(!state.deathSummary)state.deathSummary=buildDeathSummary(state);
 return state.deathSummary;
}
