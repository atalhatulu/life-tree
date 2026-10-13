// Keep the web UI's relationship actions aligned with the simulation's living-person rules.
export function isLivingPerson(person){return Boolean(person&&person.alive!==false);}
export function hasLivingPartner(state){return isLivingPerson(state.social?.romance);}
export function hasLivingChildren(state){return (state.children??[]).some(isLivingPerson);}
export function canInteractWithPerson(state,person){
 return state.player?.alive!==false&&isLivingPerson(person)&&(state.actions?.remaining??0)>0;
}
export function livingCompanionsFromState(state){
 const out=[{id:'alone',label:'Yalnız',type:'alone'}];
 for(const f of state.social?.friends??[]){
  if(isLivingPerson(f))out.push({id:'friend:'+f.id,label:f.name+' (arkadaş)',type:'friend',person:f});
 }
 const r=state.social?.romance;
 if(isLivingPerson(r))out.push({id:'partner',label:(r.name??'Partner')+' (partner)',type:'partner',person:r});
 for(const [i,c] of (state.children??[]).entries()){
  if(isLivingPerson(c))out.push({id:'child:'+i,label:(c.name??('Çocuk '+(i+1))),type:'child',person:c});
 }
 return out;
}
