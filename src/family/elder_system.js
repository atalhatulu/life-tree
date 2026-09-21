const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function mortalityChance(person){
 if(!person.alive)return 0;
 const age=person.age;
 if(age<55)return .001;
 const ageBase=(age-54)*.0022;
 const healthRisk=(100-(person.health?.current??70))*.00045;
 return Math.min(.28,ageBase+healthRisk);
}

function markDeath(state,person,relation,rng){
 person.alive=false;
 person.deathAge=person.age;
 person.deathYear=state.year;
 const inheritanceBase=Math.max(0,(person.monthlyIncome??0)*rng.int(5,18));
 return {
  entry:{age:state.player.age,kind:'family',text:relation+' '+person.name+' '+person.surname+' '+person.age+' yaşında hayatını kaybetti.'},
  inheritance:Math.round(inheritanceBase)
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
