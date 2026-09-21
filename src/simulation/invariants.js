function bounded(value,min=0,max=100){return Number.isFinite(value)&&value>=min&&value<=max;}

export function validateState(state){
 const errors=[];
 const p=state.player;
 const checks=[
  ['health.current',p.health.current],['health.constitution',p.health.constitution],
  ['appearance.attractiveness',p.appearance.attractiveness],['appearance.build',p.appearance.build],
  ['personality.discipline',p.personality.discipline],['personality.sociability',p.personality.sociability],
  ['personality.ambition',p.personality.ambition],['personality.curiosity',p.personality.curiosity],['personality.patience',p.personality.patience]
 ];
 for(const [name,value] of checks) if(!bounded(value)) errors.push(name+' out of range: '+value);
 if(p.age<0||!Number.isInteger(p.age)) errors.push('invalid player age: '+p.age);
 if(state.parents.mother.age-p.age<18) errors.push('mother/player age gap below 18');
 if(state.parents.father.age-p.age<18) errors.push('father/player age gap below 18');
 if(state.actions&&(state.actions.remaining<0||state.actions.remaining>state.actions.max)) errors.push('invalid action economy');

 if(state.education){
  for(const key of ['quality','performance','motivation','attendance']){
   if(state.education[key]!=null&&!bounded(state.education[key])) errors.push('education.'+key+' out of range: '+state.education[key]);
  }
 }
 for(const friend of state.social?.friends??[]){
  if(!bounded(friend.relationship)) errors.push('friend relationship out of range: '+friend.relationship);
  if(Math.abs(friend.age-p.age)>2) errors.push('friend age gap too high: '+friend.age+' vs '+p.age);
 }

 const partner=state.social?.romance;
 if(partner){
  if(!bounded(partner.relationship)) errors.push('romance relationship out of range');
  if(partner.compatibility!=null&&!bounded(partner.compatibility))errors.push('partner compatibility out of range');
  if(!Number.isFinite(partner.monthlyIncome)||partner.monthlyIncome<0)errors.push('invalid partner income');
 }

 if(state.higherEducation?.performance!=null&&!bounded(state.higherEducation.performance)) errors.push('university performance out of range');
 if(state.career?.performance!=null&&!bounded(state.career.performance)) errors.push('career performance out of range');
 if(state.career?.satisfaction!=null&&!bounded(state.career.satisfaction)) errors.push('career satisfaction out of range');
 if(state.career?.stability!=null&&!bounded(state.career.stability)) errors.push('career stability out of range');

 if(state.finance){
  if(!Number.isFinite(state.finance.cash)||state.finance.cash<0) errors.push('invalid cash');
  if(!Number.isFinite(state.finance.debt)||state.finance.debt<0) errors.push('invalid debt');
  if(!Number.isFinite(state.finance.monthlyExpenses)||state.finance.monthlyExpenses<0) errors.push('invalid monthly expenses');
 }

 if(state.healthProfile){
  if(!bounded(state.healthProfile.stress))errors.push('health stress out of range');
  if(!bounded(state.healthProfile.fitness))errors.push('fitness out of range');
 }

 for(const child of state.children??[]){
  if(child.age<0||child.age>p.age)errors.push('invalid child age');
  if(!bounded(child.health.current))errors.push('child health out of range');
  if(!bounded(child.relationship??70))errors.push('child relationship out of range');
 }

 if(state.assets?.car&&state.finance?.lifestyle?.transport!=='car')errors.push('car asset without car transport lifestyle');
 if(!p.alive&&!state.death)errors.push('dead player missing death record');
 return errors;
}

export function assertValidState(state){
 const errors=validateState(state);
 if(errors.length) throw new Error(errors.join('; '));
 return true;
}
