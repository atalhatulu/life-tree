import {ensureRelationshipMemory} from './relationship_memory.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function partnerMortalityChance(partner){
 const age=partner.age??30;
 const health=partner.health?.current??75;
 if(age<50)return .0005;
 if(age<70)return .002+(age-50)*.0012+(100-health)*.00015;
 return Math.min(.22,.026+(age-70)*.006+(100-health)*.00025);
}

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

 const currentRelationship=r.relationship??55;
 const compatibility=r.compatibility??60;
 const memory=ensureRelationshipMemory(state,r.id);
 const yearsSinceInteraction=memory.lastInteractionAge==null
  ?Math.min(4,r.yearsTogether)
  :Math.max(0,state.player.age-memory.lastInteractionAge);
 const sharedHousehold=['married','cohabiting'].includes(r.status);
 const recentConnection=yearsSinceInteraction<=1;
 const sharedLifeFactor=sharedHousehold?.035:.025;
 const compatibilityGrowth=recentConnection
  ?Math.max(0,(compatibility-currentRelationship)*sharedLifeFactor)
  :0;
 const financeStress=(state.finance?.debt??0)>3000000?2.2:(state.finance?.debt??0)>750000?1.1:0;
 const ambitionGap=Math.abs((state.player.personality.ambition??50)-(r.personality?.ambition??50));
 const goalFriction=ambitionGap>=45?.7:ambitionGap>=30?.3:0;
 const compatibilityEquilibrium=Math.max(0,currentRelationship-(compatibility+5))*.10;
 // Explicit neglect decay is handled once by relationship_maintenance.js.
 // Very high scores also need continuing positive experiences to stay far
 // above the couple's underlying compatibility.
 r.relationship=clamp(currentRelationship+compatibilityGrowth-financeStress-goalFriction-compatibilityEquilibrium);

 if(r.status!=='married'&&r.yearsTogether>=2&&r.relationship<40&&rng.chance(.18)){
  entries.push({age:state.player.age,kind:'relationship',text:r.name+' ile ilişkin sona erdi.'});
  state.social.exPartners??=[];
  state.social.exPartners.push({...r,endedAtAge:state.player.age});
  state.social.romance=null;
  return entries;
 }

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
