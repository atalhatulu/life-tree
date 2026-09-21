function aliveGrandparents(state){
 return [
  ['maternal-grandmother',state.grandparents.maternal.grandmother,'Anneanne'],
  ['maternal-grandfather',state.grandparents.maternal.grandfather,'Anne tarafından dede'],
  ['paternal-grandmother',state.grandparents.paternal.grandmother,'Babaanne'],
  ['paternal-grandfather',state.grandparents.paternal.grandfather,'Baba tarafından dede']
 ].filter(([,person])=>person?.alive);
}

export function ensureGuardianship(state){
 if(state.player.age>=18)return null;
 if(state.parents.mother.alive||state.parents.father.alive)return null;
 if(state.guardianship)return state.guardianship;

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
 return state.guardianship;
}
