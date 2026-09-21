function aliveGrandparents(state){
 return [
  ['maternal-grandmother',state.grandparents.maternal.grandmother,'Anneanne'],
  ['maternal-grandfather',state.grandparents.maternal.grandfather,'Anne tarafından dede'],
  ['paternal-grandmother',state.grandparents.paternal.grandmother,'Babaanne'],
  ['paternal-grandfather',state.grandparents.paternal.grandfather,'Baba tarafından dede']
 ].filter(([,person])=>person?.alive);
}

function guardianPerson(state,id){
 const all=[
  state.grandparents.maternal.grandmother,
  state.grandparents.maternal.grandfather,
  state.grandparents.paternal.grandmother,
  state.grandparents.paternal.grandfather
 ];
 return all.find(p=>p.id===id)??null;
}

export function ensureGuardianship(state){
 if(state.player.age>=18){
  if(state.guardianship&&!state.guardianship.endedAtAge)state.guardianship.endedAtAge=state.player.age;
  return null;
 }
 if(state.parents.mother.alive||state.parents.father.alive)return null;

 if(state.guardianship){
  if(state.guardianship.type==='state-care')return state.guardianship;
  const current=guardianPerson(state,state.guardianship.guardianId);
  if(current?.alive)return state.guardianship;
  state.guardianshipHistory??=[];
  state.guardianshipHistory.push({...state.guardianship,endedAtAge:state.player.age,reason:'guardian-death'});
  state.guardianship=null;
 }

 const candidates=aliveGrandparents(state);
 if(candidates.length){
  const [id,person,relation]=candidates.sort((a,b)=>(b[1].health?.current??0)-(a[1].health?.current??0))[0];
  state.guardianship={
   type:'family',
   guardianId:id,
   guardianName:person.name+' '+person.surname,
   relation,
   startedAtAge:state.player.age
  };
  state.household.monthlyIncome=person.monthlyIncome??state.household.monthlyIncome;
  state.household.people=Math.max(1,(state.household.people??1)+1);
  state.household.educationSupport=Math.min(100,Math.round((state.household.educationSupport??50)*.75+(person.education?.level??1)*7));
  state.household.hobbySupport=Math.min(100,Math.round((state.household.hobbySupport??50)*.80+(person.personality?.curiosity??50)*.12));
  return state.guardianship;
 }

 state.guardianship={
  type:'state-care',
  guardianId:'state-care',
  guardianName:'Kamu koruması',
  relation:'Koruyucu sistem',
  startedAtAge:state.player.age
 };
 state.household.monthlyIncome=Math.max(18000,Math.round(state.household.monthlyIncome*.45));
 state.household.educationSupport=Math.max(20,Math.round((state.household.educationSupport??50)*.65));
 state.household.hobbySupport=Math.max(15,Math.round((state.household.hobbySupport??50)*.60));
 return state.guardianship;
}
