import {addToTrustFund} from '../finance/trust_fund.js';
import {ensureGuardianship} from './guardianship_system.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function economicClass(income,people){
 const perCapita=income/Math.max(1,people);
 if(perCapita<18000)return 'düşük';
 if(perCapita<38000)return 'orta';
 if(perCapita<65000)return 'üst-orta';
 return 'yüksek';
}

function mortalityChance(person){
 if(!person.alive)return 0;
 const age=person.age;
 if(age<45)return .00035;
 if(age<55)return .001;
 const ageBase=(age-54)*.0022;
 const healthRisk=(100-(person.health?.current??70))*.00045;
 return Math.min(.28,ageBase+healthRisk);
}

function estateValue(person,rng){
 const income=Math.max(0,person.monthlyIncome??0);
 return Math.round(income*rng.int(5,14));
}

function parentInheritanceShare(state,person,amount){
 const survivingSpouse=person.id==='mother'?state.parents.father:state.parents.mother;
 const spouseShare=survivingSpouse?.alive?Math.round(amount*.40):0;
 const childPool=amount-spouseShare;
 const heirs=1+(state.siblings?.length??0);
 return Math.round(childPool/Math.max(1,heirs));
}

function grandparentInheritanceShare(state,person,amount){
 const maternal=person.id.startsWith('maternal');
 const parent=maternal?state.parents.mother:state.parents.father;
 if(parent?.alive)return 0;
 const heirs=1+(state.siblings?.length??0);
 return Math.round((amount*.45)/Math.max(1,heirs));
}

function updateHouseholdAfterParentDeath(state,person){
 if(person.id!=='mother'&&person.id!=='father')return;
 state.household.monthlyIncome=Math.max(0,state.household.monthlyIncome-(person.monthlyIncome??0));
 state.household.people=Math.max(1,(state.household.people??1)-1);
 state.household.economicClass=economicClass(state.household.monthlyIncome,state.household.people);
 state.household.educationSupport=Math.max(10,Math.round((state.household.educationSupport??50)*.88));
 state.household.hobbySupport=Math.max(10,Math.round((state.household.hobbySupport??50)*.90));
}

function routeInheritance(state,person,amount){
 if(amount<=0)return;
 const source={sourceId:person.id,sourceName:person.name};
 if(state.player.age<18){
  addToTrustFund(state,amount,source);
 }else{
  state.pendingInheritance??=[];
  state.pendingInheritance.push({...source,amount});
 }
}

function markDeath(state,person,relation,rng){
 person.alive=false;
 person.deathAge=person.age;
 person.deathYear=state.year;
 updateHouseholdAfterParentDeath(state,person);

 const gross=estateValue(person,rng);
 const share=person.id==='mother'||person.id==='father'
  ? parentInheritanceShare(state,person,gross)
  : grandparentInheritanceShare(state,person,gross);
 routeInheritance(state,person,share);

 const entry={
  age:state.player.age,
  kind:'family',
  paceBlock:true,
  text:relation+' '+person.name+' '+person.surname+' '+person.age+' yaşında hayatını kaybetti.'
 };
 return entry;
}

export function processElderFamilyYear(state,rng){
 const entries=[];
 const members=[
  [state.parents.mother,'Annen'],
  [state.parents.father,'Baban'],
  [state.grandparents.maternal.grandmother,'Anneannen'],
  [state.grandparents.maternal.grandfather,'Anne tarafından deden'],
  [state.grandparents.paternal.grandmother,'Babaannen'],
  [state.grandparents.paternal.grandfather,'Baba tarafından deden']
 ];

 for(const [person,relation] of members){
  if(!person?.alive)continue;
  person.health.current=clamp((person.health.current??70)-Math.max(0,person.age-60)*.08+rng.fork(person.id).int(-2,1));
  if(rng.fork('death-'+person.id).chance(mortalityChance(person))){
   entries.push(markDeath(state,person,relation,rng.fork('inheritance-'+person.id)));
  }
 }

 if(state.player.age<18&&!state.parents.mother.alive&&!state.parents.father.alive){
  const before=state.guardianship;
  const guardian=ensureGuardianship(state);
  if(guardian&&!before){
   entries.push({
    age:state.player.age,
    kind:'family',
    text:guardian.type==='family'
      ? guardian.relation+' '+guardian.guardianName+' vasin oldu.'
      : 'Aile içinde uygun bir vasi kalmadığı için koruyucu sisteme alındın.'
   });
  }
 }

 return entries;
}
