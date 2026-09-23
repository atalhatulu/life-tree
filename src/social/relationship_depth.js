const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureRelationshipDepth(state){
 const r=state.social?.romance;
 if(r){
  r.trust??=clamp(Math.round((r.relationship??60)*.85+10));
  r.intimacy??=clamp(Math.round((r.relationship??60)*.8+12));
  r.resentment??=clamp(Math.round((r.relationshipTension??10)*.7));
  r.sharedGoals??=clamp(Math.round(70-Math.abs((state.preferences?.parenthoodDesire??50)-(r.preferences?.parenthoodDesire??50))*.35-Math.abs((state.preferences?.hometownAttachment??50)-(r.preferences?.hometownAttachment??50))*.2));
  r.moneyAlignment??=clamp(Math.round(72-Math.abs((state.preferences?.riskTolerance??50)-(r.preferences?.riskTolerance??50))*.45));
  r.conflictMemory??=0;
  r.supportMemory??=0;
 }
 for(const friend of state.social?.friends??[]){
  friend.trust??=clamp(Math.round((friend.relationship??55)*.8+12));
  friend.reciprocity??=50;
  friend.sharedHistory??=friend.yearsKnown??0;
 }
}

export function processRelationshipDepthYear(state,rng){
 const entries=[];
 ensureRelationshipDepth(state);
 const r=state.social?.romance;
 if(r){
  const financeStress=(state.finance?.financialDistressYears??0)>0?1:0;
  const workStress=(state.career?.workplace?.burnout??0)>=65?1:0;
  const moveStress=state.migrationHistory?.at(-1)?.age===state.player.age?1:0;
  const quality=r.lastQualityTimeAge===state.player.age-1?1:0;
  const parentingPressure=(state.children?.filter(c=>c.age<18).length??0)>0?1:0;
  const friction=financeStress*3+workStress*3+moveStress*2+parentingPressure;
  r.trust=clamp(r.trust+rng.int(-2,2)+(quality?2:0)-financeStress);
  r.intimacy=clamp(r.intimacy+rng.int(-2,2)+(quality?4:0)-workStress-parentingPressure);
  r.resentment=clamp(r.resentment+friction+rng.int(-2,2)-(quality?4:0));
  r.sharedGoals=clamp(r.sharedGoals+rng.int(-1,1)-(moveStress?2:0));
  r.moneyAlignment=clamp(r.moneyAlignment+rng.int(-1,1)-(financeStress?2:0));
  r.supportMemory=clamp((r.supportMemory??0)*.8+(quality?8:0));
  r.conflictMemory=clamp((r.conflictMemory??0)*.82+Math.max(0,r.resentment-55)*.12);
  const delta=Math.round((r.trust-55)*.025+(r.intimacy-55)*.02-(r.resentment-35)*.03+(r.sharedGoals-50)*.012);
  r.relationship=clamp((r.relationship??60)+delta);
  r.relationshipTension=clamp((r.relationshipTension??10)+Math.round((r.resentment-45)*.05-(r.trust-55)*.025));
  if(r.resentment>=72&&rng.chance(.3))entries.push({age:state.player.age,kind:'relationship-depth',text:r.name+' ile biriken kırgınlıklar ilişkinizi zorlamaya başladı.'});
  else if(r.trust>=78&&r.intimacy>=72&&quality)entries.push({age:state.player.age,kind:'relationship-depth',text:r.name+' ile ilişkinizde güven ve yakınlık belirgin biçimde güçlendi.'});
 }
 for(const friend of state.social?.friends??[]){
  const contacted=friend.lastContactAge===state.player.age-1||friend.lastContactAge===state.player.age;
  friend.trust=clamp((friend.trust??55)+(contacted?2:-1)+rng.fork('friend-trust-'+friend.id).int(-1,1));
  friend.reciprocity=clamp((friend.reciprocity??50)+rng.fork('friend-rec-'+friend.id).int(-2,2)+(contacted?1:0));
  friend.sharedHistory=(friend.sharedHistory??0)+1;
  if(friend.closeFriend&&friend.trust>=72&&(state.healthProfile?.stress??0)>=65&&rng.fork('friend-support-'+friend.id).chance(.18)){
    state.healthProfile.stress=clamp(state.healthProfile.stress-4);
    entries.push({age:state.player.age,kind:'social',text:friend.name+' zor bir döneminde sana destek oldu.'});
  }
 }
 return entries;
}
