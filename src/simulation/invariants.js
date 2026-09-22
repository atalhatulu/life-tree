import {TURKEY_CITIES} from '../data/countries/turkey/cities.js';
function bounded(value,min=0,max=100){return Number.isFinite(value)&&value>=min&&value<=max;}

export function validateState(state){
 const errors=[];
 const p=state.player;
 const validCityIds=new Set(TURKEY_CITIES.map(city=>city.id));
 if(state.schemaVersion!=null&&state.schemaVersion!==2)errors.push('unsupported state schema version: '+state.schemaVersion);
 if(!Array.isArray(state.history))errors.push('history must be an array');
 if(!Array.isArray(state.lifeTree?.nodes))errors.push('life tree nodes must be an array');
 if(state.country?.id==='TR'){
  if(!validCityIds.has(state.origin?.cityId))errors.push('invalid origin city: '+state.origin?.cityId);
  if(!validCityIds.has(state.location?.cityId))errors.push('invalid current city: '+state.location?.cityId);
  let lastMigrationYear=-Infinity;
  for(const move of state.migrationHistory??[]){
   if(!validCityIds.has(move.fromCityId))errors.push('invalid migration origin city: '+move.fromCityId);
   if(!validCityIds.has(move.toCityId))errors.push('invalid migration target city: '+move.toCityId);
   if(!Number.isFinite(move.cost)||move.cost<0)errors.push('invalid migration cost');
   if(move.year<lastMigrationYear)errors.push('migration history year order invalid');
   lastMigrationYear=move.year;
  }
  if((state.migrationHistory?.length??0)>0){
   const last=state.migrationHistory.at(-1);
   if(last.toCityId!==state.location?.cityId)errors.push('current city does not match last migration');
  }
 }
 const checks=[
  ['health.current',p.health.current],['health.constitution',p.health.constitution],
  ['appearance.attractiveness',p.appearance.attractiveness],['appearance.build',p.appearance.build],
  ['personality.discipline',p.personality.discipline],['personality.sociability',p.personality.sociability],
  ['personality.ambition',p.personality.ambition],['personality.curiosity',p.personality.curiosity],['personality.patience',p.personality.patience]
 ];
 for(const [name,value] of checks) if(!bounded(value)) errors.push(name+' out of range: '+value);
 if(p.age<0||!Number.isInteger(p.age)) errors.push('invalid player age: '+p.age);
 if(state.parents.mother.alive&&state.parents.mother.age-p.age<18) errors.push('mother/player age gap below 18');
 if(state.parents.father.alive&&state.parents.father.age-p.age<18) errors.push('father/player age gap below 18');
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
  if(partner.alive===false)errors.push('dead partner still active romance');
  if(partner.status==='divorced'||partner.status==='ended')errors.push('ended partner still active romance');
  if(!bounded(partner.relationship)) errors.push('romance relationship out of range');
  if(partner.compatibility!=null&&!bounded(partner.compatibility))errors.push('partner compatibility out of range');
  if(!Number.isFinite(partner.monthlyIncome)||partner.monthlyIncome<0)errors.push('invalid partner income');
 }

 if(state.higherEducation?.performance!=null&&!bounded(state.higherEducation.performance)) errors.push('university performance out of range');
 if(state.career?.performance!=null&&!bounded(state.career.performance)) errors.push('career performance out of range');
 if(state.career?.satisfaction!=null&&!bounded(state.career.satisfaction)) errors.push('career satisfaction out of range');
 if(state.career?.stability!=null&&!bounded(state.career.stability)) errors.push('career stability out of range');
 if(state.career?.employed&&state.unemployment?.longTerm)errors.push('employed player marked long-term unemployed');
 if(state.career?.employed&&state.unemployedSinceAge!=null)errors.push('employed player has unemployment start age');
 if(state.retraining){
  if(!Number.isInteger(state.retraining.requiredYears)||state.retraining.requiredYears<1)errors.push('invalid retraining duration');
  if(!Number.isInteger(state.retraining.yearsCompleted)||state.retraining.yearsCompleted<0)errors.push('invalid retraining progress');
  if(state.retraining.yearsCompleted>state.retraining.requiredYears)errors.push('retraining progress exceeds requirement');
  if(state.retraining.completed&&state.retraining.yearsCompleted<state.retraining.requiredYears)errors.push('retraining completed too early');
 }
 if(state.militaryService){
  const m=state.militaryService;
  if(!['pending','deferred','completed','not-applicable'].includes(m.status))errors.push('invalid military status');
  if(m.status==='completed'&&!['standard','paid'].includes(m.mode))errors.push('completed military service missing mode');
  if(m.mode==='standard'&&m.serviceMonths!==6)errors.push('invalid standard military duration');
  if(m.mode==='paid'&&m.serviceMonths!==1)errors.push('invalid paid military duration');
 }

 if(state.finance){
  if(!Number.isFinite(state.finance.cash)||state.finance.cash<0) errors.push('invalid cash');
  if(!Number.isFinite(state.finance.debt)||state.finance.debt<0) errors.push('invalid debt');
  if(!Number.isFinite(state.finance.monthlyExpenses)||state.finance.monthlyExpenses<0) errors.push('invalid monthly expenses');
  if(state.finance.debts){
   let debtSum=0;
   for(const [kind,value] of Object.entries(state.finance.debts)){
    if(!Number.isFinite(value)||value<0)errors.push('invalid debt bucket '+kind);
    debtSum+=Number(value)||0;
   }
   // Legacy systems may update aggregate debt during the year; Finance v3
   // reconciles that delta into typed buckets on the next finance pass.
  }
 }

 if(state.healthProfile){
  if(!bounded(state.healthProfile.stress))errors.push('health stress out of range');
  if(!bounded(state.healthProfile.fitness))errors.push('fitness out of range');
  for(const [id,value] of Object.entries(state.healthProfile.riskExposure??{})){
   if(!bounded(value))errors.push('health risk exposure out of range: '+id);
  }
 }
 if(state.mentalHealth){
  if(!bounded(state.mentalHealth.resilience))errors.push('mental resilience out of range');
  if(!bounded(state.mentalHealth.strain))errors.push('mental strain out of range');
  if(!['stable','strained','distressed','crisis'].includes(state.mentalHealth.status))errors.push('invalid mental health status');
 }

 const childIds=new Set();
 for(const child of state.children??[]){
  if(childIds.has(child.id))errors.push('duplicate child id: '+child.id);
  childIds.add(child.id);
  if(child.age<0||child.age>p.age)errors.push('invalid child age');
  if(p.age-child.age<14)errors.push('parent-child age gap below 14');
  if(!bounded(child.health.current))errors.push('child health out of range');
  if(!bounded(child.relationship??70))errors.push('child relationship out of range');
 }

 if(state.business){
  if(!Number.isFinite(state.business.capital)||state.business.capital<0)errors.push('invalid business capital');
  if(!bounded(state.business.health))errors.push('invalid business health');
  if(!Number.isFinite(state.business.monthlyProfit))errors.push('invalid business profit');
  if(!['full-time','side'].includes(state.business.mode))errors.push('invalid business mode');
  if(state.business.mode==='full-time'&&state.business.active&&state.career?.employed)errors.push('full-time entrepreneur still salaried');
  if(state.business.active&&state.business.closedAtAge!=null)errors.push('closed business still active');
 }
 if(state.retirement?.retired){
  if(state.career?.employed)errors.push('retired player still employed');
  if(!Number.isFinite(state.retirement.pensionMonthly)||state.retirement.pensionMonthly<0)errors.push('invalid pension');
 }
 if(state.trustFund){
  if(!Number.isFinite(state.trustFund.balance)||state.trustFund.balance<0)errors.push('invalid trust fund balance');
 }
 if(state.lateLife){
  if(!bounded(state.lateLife.mobility))errors.push('late-life mobility out of range');
  if(!bounded(state.lateLife.isolation))errors.push('late-life isolation out of range');
  if(state.lateLife.careMode&&!['family','home-care','assisted'].includes(state.lateLife.careMode))errors.push('invalid elder care mode');
 }
 if(state.guardianship&&state.player.age>=18&&!state.guardianship.endedAtAge)errors.push('adult player has active minor guardianship');
 if(state.estate){
  if(!Number.isFinite(state.estate.net)||state.estate.net<0)errors.push('invalid estate net');
  if(!Array.isArray(state.estate.heirs))errors.push('invalid estate heirs');
 }
 if(state.world?.economy){
  const e=state.world.economy;
  if(!Number.isFinite(e.laborMarket)||e.laborMarket<.65||e.laborMarket>1.35)errors.push('world labor market out of range');
  if(!Number.isFinite(e.costOfLiving)||e.costOfLiving<.70||e.costOfLiving>1.35)errors.push('world cost of living out of range');
  if(!Number.isFinite(e.wageIndex)||e.wageIndex<.75||e.wageIndex>1.30)errors.push('world wage index out of range');
  if(!Number.isFinite(e.healthcareCost)||e.healthcareCost<.75||e.healthcareCost>1.40)errors.push('world healthcare cost out of range');
  if(e.housingMarket!=null&&(!Number.isFinite(e.housingMarket)||e.housingMarket<.70||e.housingMarket>1.45))errors.push('world housing market out of range');
  if(e.creditConditions!=null&&(!Number.isFinite(e.creditConditions)||e.creditConditions<.70||e.creditConditions>1.40))errors.push('world credit conditions out of range');
  if(e.entrepreneurship!=null&&(!Number.isFinite(e.entrepreneurship)||e.entrepreneurship<.65||e.entrepreneurship>1.40))errors.push('world entrepreneurship out of range');
 }
 if(state.assets?.car&&state.finance?.lifestyle?.transport!=='car')errors.push('car asset without car transport lifestyle');
 if(!state.social?.romance&&(state.finance?.partnerContributionMonthly??0)>0)errors.push('partner contribution without active partner');
 const branchIds=new Set();
 for(const branch of state.lifeTree?.branches??[]){
  if(!branch.id||branchIds.has(branch.id))errors.push('invalid or duplicate life tree branch id');
  branchIds.add(branch.id);
  if(branch.originalChoiceId===branch.alternateChoiceId)errors.push('life tree branch does not change choice');
 }
 for(const node of state.lifeTree?.nodes??[]){
  if(!Number.isFinite(node.age)||node.age<0)errors.push('invalid life tree node age');
  if(!node.eventId||!node.choiceId)errors.push('incomplete life tree node');
 }
 if(!p.alive&&!state.death)errors.push('dead player missing death record');
 if(!p.alive&&!state.deathSummary)errors.push('dead player missing death summary');
 return errors;
}

export function assertValidState(state){
 const errors=validateState(state);
 if(errors.length) throw new Error(errors.join('; '));
 return true;
}
