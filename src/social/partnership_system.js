const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensurePartnershipState(state){
 if(state.social?.romance){
  const r=state.social.romance;
  r.status??='dating';
  r.yearsTogether??=0;
  r.compatibility??=clamp(Math.round(
   100-Math.abs((state.player.personality.sociability??50)-(r.personality?.sociability??50))*.35-
   Math.abs((state.player.personality.ambition??50)-(r.personality?.ambition??50))*.25
  ),25,95);
 }
}

export function processPartnershipYear(state,rng){
 const r=state.social?.romance;
 const entries=[];
 if(!r) return entries;
 ensurePartnershipState(state);
 r.yearsTogether+=1;

 const financeStress=(state.finance?.debt??0)>750000?3:0;
 const compatibility=(r.compatibility??60)-50;
 const delta=Math.round(compatibility*.03)-financeStress+rng.int(-4,4);
 r.relationship=clamp((r.relationship??55)+delta);

 if(r.status==='married'){
  r.marriageYears=(r.marriageYears??0)+1;
  if(r.relationship<25&&rng.chance(.18)){
   entries.push({age:state.player.age,kind:'relationship',text:r.name+' ile evliliğiniz sona erdi.'});
   state.social.exSpouses??=[];
   state.social.exSpouses.push({...r});
   state.social.romance=null;
  }
 }
 return entries;
}

export function marryPartner(state){
 const r=state.social?.romance;
 if(!r) throw new Error('Aktif ilişkin yok.');
 r.status='married';
 r.marriedAtAge=state.player.age;
 r.marriageYears=0;
 r.relationship=clamp(r.relationship+8);
 return r;
}

export function moveInTogether(state){
 const r=state.social?.romance;
 if(!r) throw new Error('Aktif ilişkin yok.');
 r.status=r.status==='married'?'married':'cohabiting';
 if(state.finance?.lifestyle?.housing==='family') state.finance.lifestyle.housing='shared';
 r.relationship=clamp(r.relationship+4);
}
