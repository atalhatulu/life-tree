function sumInheritance(state){
 return (state.inheritanceHistory??[]).reduce((sum,item)=>sum+(item.amount??0),0)+
  (state.trustFund?.released?state.trustFund.balance??0:0);
}

function careerHistory(state){
 const previous=state.career?.previousJobs??[];
 const history=previous.map(job=>({
  title:job.title,
  years:job.years??0
 }));
 if(state.career?.title){
  history.push({
   title:state.career.title,
   years:state.career.totalYears??state.career.years??0,
   current:Boolean(state.career.employed)
  });
 }
 return history;
}

function relationshipHistory(state){
 const result=[];
 for(const ex of state.social?.exSpouses??[]){
  result.push({
   name:ex.name+' '+ex.surname,
   status:'divorced',
   years:ex.marriageYears??ex.yearsTogether??0
  });
 }
 for(const deceased of state.social?.deceasedPartners??[]){
  result.push({
   name:deceased.name+' '+deceased.surname,
   status:deceased.status==='married'?'widowed':'deceased-partner',
   years:deceased.marriageYears??deceased.yearsTogether??0
  });
 }
 const current=state.social?.romance;
 if(current){
  result.push({
   name:current.name+' '+current.surname,
   status:current.status??'dating',
   years:current.marriageYears??current.yearsTogether??0
  });
 }
 return result;
}

function familyLosses(state){
 const close=[
  ['mother',state.parents.mother],
  ['father',state.parents.father],
  ['maternal-grandmother',state.grandparents.maternal.grandmother],
  ['maternal-grandfather',state.grandparents.maternal.grandfather],
  ['paternal-grandmother',state.grandparents.paternal.grandmother],
  ['paternal-grandfather',state.grandparents.paternal.grandfather],
  ...(state.siblings??[]).map(person=>['sibling',person])
 ];
 return close.filter(([,person])=>person&&!person.alive).map(([relation,person])=>({
  relation,
  name:person.name+' '+person.surname,
  age:person.deathAge??person.age,
  year:person.deathYear??null
 }));
}

export function buildLifeRecap(state){
 const children=(state.children??[]).map(child=>({
  name:child.name+' '+child.surname,
  age:child.age,
  relationship:child.relationship??null,
  educationPlan:child.educationPlan??null,
  adultCareer:child.adultLife?.jobTitle??null,
  children:child.adultLife?.children??0
 }));

 const decisions=(state.lifeTree?.nodes??[]).map(node=>({
  age:node.age,
  eventId:node.eventId,
  title:node.title,
  choice:node.label
 }));

 const treated=(state.healthProfile?.conditions??[]).filter(c=>c.treated);
 const untreated=(state.healthProfile?.conditions??[]).filter(c=>!c.treated);

 return {
  identity:{
   name:state.player.name+' '+state.player.surname,
   sex:state.player.sex,
   birthYear:state.year-state.player.age,
   finalAge:state.player.age,
   finalYear:state.year
  },
  origin:{
   childhoodClass:state.player.background?.childhoodClass??state.household.economicClass,
   orphaned:Boolean(state.guardianship),
   trustFundReceived:state.trustFund?.released?state.trustFund.balance??0:0
  },
  education:{
   highSchoolPath:state.education?.pathLabel??null,
   school:state.education?.schoolName??null,
   university:state.higherEducation?.programTitle??null,
   graduated:Boolean(state.higherEducation?.completed)
  },
  work:{
   history:careerHistory(state),
   retired:Boolean(state.retirement?.retired),
   retirementSource:state.retirement?.source??null,
   businessFounded:Boolean(state.business),
   businessYears:state.business?.years??0,
   businessActive:Boolean(state.business?.active)
  },
  relationships:relationshipHistory(state),
  family:{
   children,
   grandchildren:state.grandchildren??0,
   losses:familyLosses(state),
   deceasedFriends:(state.social?.deceasedFriends??[]).map(friend=>({
    name:friend.name+' '+friend.surname,
    age:friend.deathAge??friend.age
   }))
  },
  health:{
   finalHealth:Math.round(state.player.health.current),
   conditions:(state.healthProfile?.conditions??[]).map(c=>c.label),
   treated:treated.map(c=>c.label),
   untreated:untreated.map(c=>c.label),
   finalFitness:Math.round(state.healthProfile?.fitness??0),
   finalStress:Math.round(state.healthProfile?.stress??0)
  },
  finances:{
   cash:Math.round(state.finance?.cash??0),
   debt:Math.round(state.finance?.debt??0),
   inheritanceReceived:Math.round(sumInheritance(state)),
   homeOwned:Boolean(state.assets?.home),
   carOwned:Boolean(state.assets?.car),
   estatePlan:state.estatePlan?.type??null
  },
  decisions
 };
}
