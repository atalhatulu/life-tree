import {settleEstate} from '../finance/estate_system.js';
import {buildLifeRecap} from './life_recap.js';

export function buildDeathSummary(state){
 const estate=settleEstate(state);
 const recap=buildLifeRecap(state);
 const tree=state.lifeTree?.nodes??[];
 const children=state.children??[];
 const exSpouses=state.social?.exSpouses?.length??0;
 const deceasedSpouses=(state.social?.deceasedPartners??[]).filter(p=>p.status==='married').length;
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
  marriages:(state.social?.romance?.status==='married'?1:0)+exSpouses+deceasedSpouses,
  widowed:deceasedSpouses>0||state.widowedAtAge!=null,
  familyLosses:recap.family.losses.length,
  siblingLosses:recap.family.losses.filter(x=>x.relation==='sibling').length,
  friendLosses:recap.family.deceasedFriends.length,
  homeOwned:Boolean(state.assets?.home),
  carOwned:Boolean(state.assets?.car),
  finalCash:Math.round(state.finance?.cash??0),
  finalSavings:Math.round(state.finance?.savings??0),
  finalDebt:Math.round(state.finance?.debt??0),
  inheritanceReceived:recap.finances.inheritanceReceived,
  estateNet:estate.net,
  heirs:estate.heirs,
  estatePlan:estate.plan,
  majorDecisions:tree.length,
  healthConditions:state.healthProfile?.conditions?.map(c=>c.label)??[],
  recap
 };
}

export function finalizeDeath(state){
 if(!state.death)return null;
 if(!state.deathSummary)state.deathSummary=buildDeathSummary(state);
 return state.deathSummary;
}
