import {SOCIAL_ACTIVITIES,socialActivityById} from './social_activity_catalog.js';
import {preferenceFor} from './preference_profile.js';
import {ensureRelationshipMemory,repetitionPenalty,recordRelationshipInteraction,clampRelationship} from './relationship_memory.js';
import {economy} from '../world/world_state.js';

function targetRecords(state){
 const records=[];
 const add=(person,kind)=>{if(person?.alive!==false)records.push({id:person.id,kind,person});};
 add(state.parents?.mother,'family');
 add(state.parents?.father,'family');
 for(const p of state.siblings??[])add(p,'family');
 for(const p of [
  state.grandparents?.maternal?.grandmother,state.grandparents?.maternal?.grandfather,
  state.grandparents?.paternal?.grandmother,state.grandparents?.paternal?.grandfather
 ])add(p,'family');
 for(const p of state.children??[])add(p,'child');
 for(const p of state.social?.friends??[])add(p,'friend');
 if(state.social?.romance)add(state.social.romance,'partner');
 return records;
}

export function socialTargets(state){return targetRecords(state);}

export function socialTarget(state,targetId){
 return targetRecords(state).find(x=>x.id===targetId)??null;
}

export function relationshipValue(state,target){
 if(!target)return 0;
 if(target.kind==='family')return state.player.relationships?.[target.id]??60;
 return target.person.relationship??60;
}

export function setRelationshipValue(state,target,value){
 const next=clampRelationship(value);
 if(target.kind==='family'){
  state.player.relationships??={};
  state.player.relationships[target.id]=next;
 }else target.person.relationship=next;
 return next;
}

function activityCost(state,activity){
 return Math.round(activity.cost*(economy(state).costOfLiving??1));
}

export function availableSocialActivities(state,targetId){
 const target=socialTarget(state,targetId);
 if(!target)return [];
 const cash=state.finance?.cash??0;
 return SOCIAL_ACTIVITIES
  .map(activity=>({...activity,cost:activityCost(state,activity)}))
  .filter(activity=>activity.cost<=cash);
}

function socialSkillModifier(state){
 const sociability=state.player.personality?.sociability??50;
 const attractiveness=state.player.appearance?.attractiveness??50;
 return Math.max(-1.5,Math.min(1.5,(sociability-50)*.018+(attractiveness-50)*.008));
}

export function scoreSocialActivity(state,targetId,activityId){
 const target=socialTarget(state,targetId);
 const activity=socialActivityById(activityId);
 if(!target||!activity)return null;
 const cost=activityCost(state,activity);
 const preference=preferenceFor(target.person,activity.preferenceKey,activity.preferenceKind);
 const memory=ensureRelationshipMemory(state,targetId);
 const repetition=repetitionPenalty(memory,activityId);
 const current=relationshipValue(state,target);
 const saturation=current>=85?.55:current>=70?.75:1;
 const expectedDelta=(activity.baseRelationship+preference*2+socialSkillModifier(state)+repetition)*saturation;
 return {target,activity,cost,preference,repetition,current,expectedDelta};
}

export function performSocialActivity(state,targetId,activityId,rng){
 state.actions??={remaining:3,max:3};
 if(state.actions.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 const scored=scoreSocialActivity(state,targetId,activityId);
 if(!scored)throw new Error('Geçersiz sosyal etkinlik.');
 if(scored.cost>(state.finance?.cash??0))throw new Error('Bu etkinliği karşılayacak nakdin yok.');

 if(scored.cost>0)state.finance.cash-=scored.cost;
 const uncertainty=rng.int(-1,1);
 const raw=scored.expectedDelta+uncertainty;
 const delta=Math.round(Math.max(-6,Math.min(8,raw)));
 const relationship=setRelationshipValue(state,scored.target,scored.current+delta);
 recordRelationshipInteraction(state,targetId,{
  activityId,delta,
  preferenceKind:scored.activity.preferenceKind,
  preferenceKey:scored.activity.preferenceKey,
  preference:scored.preference
 });

 state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 state.healthProfile.stress=Math.max(0,state.healthProfile.stress-scored.activity.stressRelief);

 if(scored.activity.physical&&state.healthProfile){
  const adaptation=Math.max(.20,1-(state.healthProfile.fitness??50)/120);
  state.healthProfile.fitness=Math.min(100,state.healthProfile.fitness+adaptation);
  state.healthProfile.lastExerciseAge=state.player.age;
  state.healthProfile.exerciseSessions=(state.healthProfile.exerciseSessions??0)+1;
 }

 state.actions.remaining-=1;
 return {
  targetId,
  targetName:scored.target.person.name,
  activityId,
  activityLabel:scored.activity.label,
  cost:scored.cost,
  preference:scored.preference,
  repetitionPenalty:scored.repetition,
  relationshipDelta:delta,
  relationship,
  text:scored.target.person.name+' ile '+scored.activity.label.toLocaleLowerCase('tr-TR')+
   '. İlişki '+(delta>=0?'+':'')+delta+'.'
 };
}
