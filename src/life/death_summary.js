import {settleEstate} from '../finance/estate_system.js';
import {buildLifeRecap} from './life_recap.js';

function lifeHighlights(state,recap){
 const highlights=[];
 if(recap.education.university)highlights.push({kind:'education',text:recap.education.university+' eğitimini tamamladı.'});
 const careerTitles=recap.work.history.map(x=>x.title).filter(Boolean);
 if(careerTitles.length)highlights.push({kind:'career',text:'Kariyer yolu: '+careerTitles.join(' → ')+'.'});
 const currentOrLast=recap.relationships.at(-1);
 if(currentOrLast)highlights.push({kind:'relationship',text:currentOrLast.name+' ile '+currentOrLast.years+' yıllık bir ilişki geçmişi oldu.'});
 if(recap.family.children.length)highlights.push({kind:'family',text:recap.family.children.length+' çocuk ve '+recap.family.grandchildren+' torunla bir aile kurdu.'});
 if(recap.origin.migrations.length)highlights.push({kind:'migration',text:recap.origin.migrations.length+' kez şehir değiştirdi; son olarak '+recap.origin.currentCity+' şehrinde yaşadı.'});
 if(state.business)highlights.push({kind:'business',text:'Hayatının bir döneminde kendi işini kurdu.'});
 if(recap.health.conditions.length)highlights.push({kind:'health',text:'Sağlık geçmişinde '+recap.health.conditions.join(', ')+' yer aldı.'});
 const decisionHighlights=recap.decisions.slice(-5).map(d=>({kind:'decision',age:d.age,text:d.age+' yaşında '+d.title+': '+d.choice}));
 return [...highlights,...decisionHighlights].slice(0,10);
}


export function buildDeathSummary(state){
 const estate=settleEstate(state);
 const recap=buildLifeRecap(state);
 const tree=state.lifeTree?.nodes??[];
 const highlights=lifeHighlights(state,recap);
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
  highlights,
  recap
 };
}

export function finalizeDeath(state){
 if(!state.death)return null;
 if(!state.deathSummary)state.deathSummary=buildDeathSummary(state);
 return state.deathSummary;
}
