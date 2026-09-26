const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const GOALS={
 career:{id:'career',label:'Kariyerde ilerlemek'},
 security:{id:'security',label:'Güvenli bir yaşam kurmak'},
 family:{id:'family',label:'Aile ve yakın bağlar'},
 freedom:{id:'freedom',label:'Bağımsız ve özgür yaşamak'},
 wellbeing:{id:'wellbeing',label:'Dengeli ve sağlıklı yaşamak'}
};

function chooseGoal(person,kind='adult'){
 const ambition=person.personality?.ambition??50;
 const sociability=person.personality?.sociability??50;
 const patience=person.personality?.patience??50;
 if(kind==='child'){
  if(ambition>=65)return GOALS.career;
  if(sociability>=65)return GOALS.family;
  return GOALS.freedom;
 }
 if(ambition>=68)return GOALS.career;
 if(sociability>=66)return GOALS.family;
 if(patience>=65)return GOALS.security;
 return GOALS.wellbeing;
}

export function ensureNpcGoal(person,kind='adult'){
 person.lifeGoals??={active:null,history:[]};
 person.lifeGoals.history??=[];
 if(!person.lifeGoals.active){
  const def=chooseGoal(person,kind);
  person.lifeGoals.active={...def,startedAtAge:person.age??0,progress:35};
 }
 return person.lifeGoals.active;
}

export function updateNpcGoal(person,signals={}){
 const goal=ensureNpcGoal(person,signals.kind??'adult');
 let delta=0;
 if(goal.id==='career')delta+=(signals.careerSatisfaction??50)>=60?3:-2;
 if(goal.id==='security')delta+=(signals.financialStability??50)>=60?3:-2;
 if(goal.id==='family')delta+=(signals.relationshipQuality??50)>=65?3:-2;
 if(goal.id==='freedom')delta+=(signals.independence??50)>=60?3:-2;
 if(goal.id==='wellbeing')delta+=(signals.wellbeing??50)>=60?3:-2;
 goal.progress=clamp((goal.progress??35)+delta);
 return goal;
}

export function goalAlignment(playerGoalId,npcGoalId){
 if(!playerGoalId||!npcGoalId)return 0;
 if(playerGoalId==='career-mastery'&&npcGoalId==='career')return 1;
 if(playerGoalId==='financial-security'&&npcGoalId==='security')return 1;
 if(playerGoalId==='family-bond'&&npcGoalId==='family')return 1;
 if(playerGoalId==='wellbeing'&&npcGoalId==='wellbeing')return 1;
 if(playerGoalId==='social-circle'&&npcGoalId==='family')return .5;
 if(playerGoalId==='career-mastery'&&npcGoalId==='family')return -1;
 if(playerGoalId==='family-bond'&&npcGoalId==='career')return -.5;
 if(playerGoalId==='financial-security'&&npcGoalId==='freedom')return -.5;
 return 0;
}

export function applyPartnerGoalAlignment(state){
 const partner=state.social?.romance;
 if(!partner||partner.alive===false)return null;
 const playerGoal=state.lifeGoals?.active?.id;
 const npcGoal=ensureNpcGoal(partner).id;
 const alignment=goalAlignment(playerGoal,npcGoal);
 partner.goalAlignment=alignment;
 if(alignment>0){
  partner.trust=clamp((partner.trust??60)+1);
  partner.sharedGoals=clamp((partner.sharedGoals??60)+2);
 }else if(alignment<0){
  partner.resentment=clamp((partner.resentment??20)+2);
  partner.sharedGoals=clamp((partner.sharedGoals??60)-2);
 }
 return {alignment,playerGoal,npcGoal};
}
