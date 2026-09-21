const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function mortalityChance(person){
 if(!person.alive)return 0;
 const age=person.age;
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
 const survivingSpouse=
  person.id==='mother'?state.parents.father:
  person.id==='father'?state.parents.mother:null;
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

function markDeath(state,person,relation,rng){
 person.alive=false;
 person.deathAge=person.age;
 person.deathYear=state.year;
 const gross=estateValue(person,rng);
 const share=person.id==='mother'||person.id==='father'
  ? parentInheritanceShare(state,person,gross)
  : grandparentInheritanceShare(state,person,gross);
 return {
  entry:{age:state.player.age,kind:'family',text:relation+' '+person.name+' '+person.surname+' '+person.age+' yaşında hayatını kaybetti.'},
  inheritance:share
 };
}

export function processElderFamilyYear(state,rng){
 const entries=[];
 const inheritances=[];
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
   const result=markDeath(state,person,relation,rng.fork('inheritance-'+person.id));
   entries.push(result.entry);
   if(result.inheritance>0)inheritances.push({sourceId:person.id,sourceName:person.name,amount:result.inheritance});
  }
 }

 if(inheritances.length){
  state.pendingInheritance??=[];
  state.pendingInheritance.push(...inheritances);
 }
 return entries;
}
