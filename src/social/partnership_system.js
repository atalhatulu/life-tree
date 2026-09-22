const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function partnerMortalityChance(partner){
 const age=partner.age??30;
 const health=partner.health?.current??75;
 if(age<50)return .0005;
 if(age<70)return .002+(age-50)*.0012+(100-health)*.00015;
 return Math.min(.22,.026+(age-70)*.006+(100-health)*.00025);
}

function preferenceGap(state,r,key){
 return Math.abs((state.preferences?.[key]??50)-(r.preferences?.[key]??50));
}

function relationshipStress(state,r){
 let stress=0;
 const debt=state.finance?.debt??0;
 const income=(state.career?.monthlyIncome??state.retirement?.pensionMonthly??0)*12;
 if(debt>Math.max(750000,income*2))stress+=3;
 else if(debt>Math.max(250000,income))stress+=1;
 if(state.player.age>=23&&!state.career?.employed&&!state.retirement?.retired&&!state.higherEducation?.enrolled)stress+=2;
 if((state.healthProfile?.stress??0)>=70)stress+=2;
 else if((state.healthProfile?.stress??0)>=50)stress+=1;
 stress+=Math.min(2,(state.children?.filter(c=>c.age<18).length??0)*.55);
 const latestMove=state.migrationHistory?.at(-1);
 if(latestMove?.age===state.player.age)stress+=1.5;
 if(preferenceGap(state,r,'parenthoodDesire')>=30)stress+=1.5;
 if(preferenceGap(state,r,'hometownAttachment')>=35)stress+=1;
 if(Math.abs((state.player.personality?.ambition??50)-(r.personality?.ambition??50))>=35)stress+=1;
 return stress;
}

function endRelationship(state,r,{divorce=false}={}){
 if(divorce){
  r.status='divorced';
  r.divorcedAtAge=state.player.age;
  state.social.exSpouses??=[];
  state.social.exSpouses.push({...r});
  state.lastDivorceAge=state.player.age;
  if(state.healthProfile)state.healthProfile.stress=clamp(state.healthProfile.stress+12);
  for(const child of state.children??[]){
   child.relationship=clamp((child.relationship??70)-4);
   child.parenting??={};
   child.parenting.emotionalSecurity=clamp((child.parenting.emotionalSecurity??70)-8);
  }
 }else{
  r.status='ended';
  state.social.exPartners??=[];
  state.social.exPartners.push({...r});
  if(state.healthProfile)state.healthProfile.stress=clamp(state.healthProfile.stress+6);
 }
 state.social.romance=null;
 state.nextDatingAge=state.player.age+2;
 state.datingAttempts=Math.max(0,(state.datingAttempts??0)-2);
}

export function ensurePartnershipState(state){
 if(state.social?.romance){
  const r=state.social.romance;
  r.status??='dating';
  r.yearsTogether??=0;
  r.relationshipTension??=10;
  r.relationshipState??='stable';
  r.preferences??={
   partnershipDesire:55,marriageDesire:45,parenthoodDesire:50,riskTolerance:50,hometownAttachment:50
  };
  r.compatibility??=clamp(Math.round(
   92-
   Math.abs((state.player.personality.sociability??50)-(r.personality?.sociability??50))*.28-
   Math.abs((state.player.personality.ambition??50)-(r.personality?.ambition??50))*.20-
   preferenceGap(state,r,'parenthoodDesire')*.14-
   preferenceGap(state,r,'hometownAttachment')*.08
  ),30,95);
 }
}

export function processPartnershipYear(state,rng){
 const r=state.social?.romance;
 const entries=[];
 if(!r) return entries;
 ensurePartnershipState(state);
 r.yearsTogether+=1;

 if(r.health){
  const agePenalty=r.age>=65?2:r.age>=50?1:0;
  r.health.current=clamp(r.health.current+rng.int(-2,1)-agePenalty);
 }
 if(rng.fork('partner-mortality').chance(partnerMortalityChance(r))){
  const wasMarried=r.status==='married';
  r.alive=false;
  r.deathAge=r.age;
  r.deathYear=state.year;
  state.social.deceasedPartners??=[];
  state.social.deceasedPartners.push({...r});
  state.social.romance=null;
  state.widowedAtAge=wasMarried?state.player.age:null;
  state.nextDatingAge=state.player.age+2;
  state.datingAttempts=Math.max(0,(state.datingAttempts??0)-2);
  entries.push({age:state.player.age,kind:'relationship',paceBlock:true,text:r.name+' '+r.surname+' hayatını kaybetti.'});
  return entries;
 }

 const stress=relationshipStress(state,r);
 const qualityTime=r.lastQualityTimeAge===state.player.age-1?1:0;
 const compatibility=r.compatibility??60;
 const mismatch=Math.max(0,70-compatibility)/10;
 r.relationshipTension=clamp(
  (r.relationshipTension??10)*.72+stress*3.2+mismatch*1.4-qualityTime*7+rng.int(-2,3)
 );
 const conflictChance=Math.min(.34,.07+stress*.018+Math.max(0,72-compatibility)*.006);
 if(rng.fork('relationship-conflict').chance(conflictChance)){
  r.relationshipTension=clamp(r.relationshipTension+rng.int(10,22));
  r.relationship=clamp(r.relationship-rng.int(3,8));
  entries.push({age:state.player.age,kind:'relationship',text:r.name+' ile aranızda bir süredir biriken bir anlaşmazlık yaşandı.'});
 }
 const delta=Math.round(
  -1.6+(compatibility-70)*.055+qualityTime*2.5-stress*.8-(r.relationshipTension??0)/22+rng.int(-3,3)
 );
 r.relationship=clamp((r.relationship??55)+delta);

 if(r.relationship>=72&&r.relationshipTension<30)r.relationshipState='stable';
 else if(r.relationship>=45&&r.relationshipTension<60)r.relationshipState='strained';
 else r.relationshipState='conflict';

 if(r.status!=='married'&&r.yearsTogether>=1&&r.relationship<=18&&r.relationshipTension>=80){
  entries.push({age:state.player.age,kind:'relationship',paceBlock:true,text:r.name+' ile ilişkin sona erdi.'});
  endRelationship(state,r);
  return entries;
 }
 if(r.status!=='married'&&r.yearsTogether>=2&&r.relationship<42&&r.relationshipTension>45){
  const chance=Math.min(.72,.12+(42-r.relationship)*.018+(r.relationshipTension-45)*.008);
  if(rng.fork('breakup').chance(chance)){
   entries.push({age:state.player.age,kind:'relationship',paceBlock:true,text:r.name+' ile ilişkin sona erdi.'});
   endRelationship(state,r);
   return entries;
  }
 }

 if(r.status==='married'){
  r.marriageYears=(r.marriageYears??0)+1;
  if(r.marriageYears>=2&&r.relationship<=15&&r.relationshipTension>=85){
   entries.push({age:state.player.age,kind:'relationship',paceBlock:true,text:r.name+' ile evliliğiniz boşanmayla sona erdi.'});
   endRelationship(state,r,{divorce:true});
   return entries;
  }
  if(r.marriageYears>=2&&r.relationship<50&&r.relationshipTension>50){
   const chance=Math.min(.62,.10+(50-r.relationship)*.014+(r.relationshipTension-50)*.007);
   if(rng.fork('divorce').chance(chance)){
    entries.push({age:state.player.age,kind:'relationship',paceBlock:true,text:r.name+' ile evliliğiniz boşanmayla sona erdi.'});
    endRelationship(state,r,{divorce:true});
   }
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
 r.relationship=clamp(r.relationship+4);
 r.relationshipTension=clamp((r.relationshipTension??10)-5);
 return r;
}

export function moveInTogether(state){
 const r=state.social?.romance;
 if(!r) throw new Error('Aktif ilişkin yok.');
 r.status=r.status==='married'?'married':'cohabiting';
 if(state.finance?.lifestyle?.housing==='family') state.finance.lifestyle.housing='shared';
 r.relationship=clamp(r.relationship+2);
 r.relationshipTension=clamp((r.relationshipTension??10)-2);
}
