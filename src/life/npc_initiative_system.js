import {TURKEY_CITIES} from '../data/countries/turkey/cities.js';
import {moveToCity} from '../world/migration_system.js';
import {ensureNpcGoal} from './npc_goal_system.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureNpcInitiatives(state){
 state.npcInitiatives??={pending:[],history:[],nextId:1};
 state.npcInitiatives.pending??=[];
 state.npcInitiatives.history??=[];
 state.npcInitiatives.nextId??=1;
 return state.npcInitiatives;
}

function addInitiative(state,type,actorId,actorName,data={}){
 const store=ensureNpcInitiatives(state);
 if(store.pending.some(x=>x.type===type&&x.actorId===actorId))return null;
 const id='npc-'+store.nextId++;
 const initiative={
  id,type,actorId,actorName,
  createdAtAge:state.player.age,
  expiresAtAge:state.player.age+1,
  status:'pending',
  data
 };
 store.pending.push(initiative);
 return initiative;
}

function currentCityId(state){return state.location?.cityId??state.origin?.cityId;}

function actorFor(state,initiative){
 if(!initiative)return null;
 if(initiative.type.startsWith('partner-')){
  const p=state.social?.romance;
  if(!p)return null;
  const id=p.id??'partner';
  return id===initiative.actorId?p:null;
 }
 if(initiative.type==='child-direction')return (state.children??[]).find(c=>c.id===initiative.actorId)??null;
 if(initiative.type==='friend-support-request')return (state.social?.friends??[]).find(f=>f.id===initiative.actorId)??null;
 return null;
}

function prunePending(state){
 const store=ensureNpcInitiatives(state);
 const keep=[];
 for(const item of store.pending){
  const valid=item.status==='pending'&&item.expiresAtAge>=state.player.age&&Boolean(actorFor(state,item));
  if(valid)keep.push(item);
  else{
   item.status='expired';
   item.expiredAtAge=state.player.age;
   store.history.push(structuredClone(item));
  }
 }
 store.pending=keep;
 return store;
}

function initiativeChance(state,base){
 const history=state.npcInitiatives?.history??[];
 const resolved=history.filter(x=>x.status==='resolved');
 const last=resolved.length?Math.max(...resolved.map(x=>x.resolvedAtAge??x.createdAtAge??-99)):-99;
 const years=state.player.age-last;
 return Math.min(.68,base+Math.max(0,years-4)*.035);
}

function partnerInitiative(state,rng){
 const p=state.social?.romance;
 if(!p||!['cohabiting','married'].includes(p.status))return null;
 const goal=ensureNpcGoal(p);
 const last=p.lastInitiativeAge??-99;
 if(state.player.age-last<3)return null;

 if((goal.id==='career'||(p.personality?.ambition??50)>=68)&&(p.life?.careerSatisfaction??55)<=48&&rng.fork('partner-relocate').chance(initiativeChance(state,.34))){
  const alternatives=TURKEY_CITIES.filter(c=>c.id!==currentCityId(state));
  if(!alternatives.length)return null;
  const target=rng.fork('partner-city').weighted(alternatives.map(city=>({
   value:city,weight:Math.max(.1,city.jobs*city.wage/Math.max(.75,city.cost))
  })));
  p.lastInitiativeAge=state.player.age;
  return addInitiative(state,'partner-relocation',p.id??'partner',p.name,{
   targetCityId:target.id,targetCityName:target.name,goalId:goal.id,
   reason:'career',urgency:clamp(45+(70-(p.life?.careerSatisfaction??55)))
  });
 }

 if((goal.id==='family'||(p.sharedGoals??50)<58)&&(p.sharedGoals??50)<68&&rng.fork('partner-family').chance(initiativeChance(state,.30))){
  p.lastInitiativeAge=state.player.age;
  return addInitiative(state,'partner-family-priority',p.id??'partner',p.name,{
   goalId:goal.id,urgency:clamp(50+(65-(p.sharedGoals??50)))
  });
 }

 if((goal.id==='wellbeing'||(p.life?.workStress??25)>=68)&&(p.life?.workStress??25)>=58&&rng.fork('partner-balance').chance(initiativeChance(state,.32))){
  p.lastInitiativeAge=state.player.age;
  return addInitiative(state,'partner-life-balance',p.id??'partner',p.name,{
   goalId:goal.id,urgency:clamp(50+(p.life?.workStress??60)-60)
  });
 }
 return null;
}

function childInitiative(state,rng){
 for(const child of state.children??[]){
  if(child.age<16||child.age>20)continue;
  const goal=ensureNpcGoal(child,'child');
  const last=child.lastInitiativeAge??-99;
  if(state.player.age-last<2)continue;

  let desired=null;
  if(goal.id==='career')desired='university';
  else if(goal.id==='freedom')desired='work';
  else if(goal.id==='family')desired='vocational';
  if(!desired)continue;

  const current=child.educationPlan??(child.age>=18?'work':null);
  if(current===desired)continue;
  const similar=(state.npcInitiatives?.history??[]).filter(x=>x.type==='child-direction'&&x.actorId===child.id&&x.data?.desiredPlan===desired);
  const lastSimilar=similar.length?Math.max(...similar.map(x=>x.resolvedAtAge??x.createdAtAge??-99)):-99;
  if(state.player.age-lastSimilar<5)continue;
  if(!rng.fork('child-direction-'+child.id).chance(initiativeChance(state,.46)))continue;

  child.lastInitiativeAge=state.player.age;
  return addInitiative(state,'child-direction',child.id,child.name,{
   desiredPlan:desired,currentPlan:current,goalId:goal.id,
   urgency:clamp(45+(goal.progress??35)*.45)
  });
 }
 return null;
}

function friendInitiative(state,rng){
 const friend=(state.social?.friends??[]).find(f=>f.closeFriend&&f.needsSupport);
 if(!friend)return null;
 const last=friend.lastInitiativeAge??-99;
 if(state.player.age-last<3)return null;
 if(!rng.fork('friend-request-'+friend.id).chance(initiativeChance(state,.58)))return null;
 friend.lastInitiativeAge=state.player.age;
 return addInitiative(state,'friend-support-request',friend.id,friend.name,{
  goalId:ensureNpcGoal(friend).id,
  urgency:clamp(55+(friend.life?.personalStress??70)-70),
  supportType:(friend.life?.workStability??50)<35?'career':'emotional'
 });
}

export function generateNpcInitiatives(state,rng){
 const store=prunePending(state);
 if(store.pending.length)return [];
 const created=[
  partnerInitiative(state,rng.fork('partner')),
  childInitiative(state,rng.fork('child')),
  friendInitiative(state,rng.fork('friend'))
 ].filter(Boolean);
 return created.map(x=>({age:state.player.age,kind:'npc-initiative',paceBlock:true,text:x.actorName+' senden önemli bir konuda konuşmak istiyor.'}));
}

export function pendingInitiative(state,type){
 return ensureNpcInitiatives(state).pending.find(x=>x.status==='pending'&&x.expiresAtAge>=state.player.age&&Boolean(actorFor(state,x))&&(!type||x.type===type))??null;
}

function archive(state,initiative,response){
 const store=ensureNpcInitiatives(state);
 initiative.status='resolved';
 initiative.resolvedAtAge=state.player.age;
 initiative.response=response;
 initiative.followUpAtAge=state.player.age+2;
 store.history.push(structuredClone(initiative));
 store.pending=store.pending.filter(x=>x.id!==initiative.id);
}

export function resolveNpcInitiative(state,type,response){
 const initiative=pendingInitiative(state,type);
 if(!initiative)throw new Error('Bekleyen NPC isteği artık geçerli değil.');
 const actor=actorFor(state,initiative);
 if(!actor)throw new Error('Bu isteği başlatan kişi artık aktif yaşamında değil.');

 if(type==='partner-relocation'){
  const p=actor;
  if(response==='accept'){
   moveToCity(state,initiative.data.targetCityId,'partner-job',{costMultiplier:.85});
   p.trust=clamp((p.trust??60)+7);p.sharedGoals=clamp((p.sharedGoals??55)+6);p.resentment=clamp((p.resentment??20)-4);
  }else if(response==='compromise'){
   p.trust=clamp((p.trust??60)+3);p.sharedGoals=clamp((p.sharedGoals??55)+2);p.resentment=clamp((p.resentment??20)+1);
   p.life.careerSatisfaction=clamp((p.life?.careerSatisfaction??50)+4);
  }else{
   p.trust=clamp((p.trust??60)-5);p.sharedGoals=clamp((p.sharedGoals??55)-7);p.resentment=clamp((p.resentment??20)+8);
  }
 }
 if(type==='partner-family-priority'){
  const p=actor;
  if(response==='accept'){p.trust=clamp((p.trust??60)+6);p.intimacy=clamp((p.intimacy??60)+5);p.sharedGoals=clamp((p.sharedGoals??55)+7);}
  else if(response==='compromise'){p.trust=clamp((p.trust??60)+2);p.sharedGoals=clamp((p.sharedGoals??55)+2);}
  else{p.resentment=clamp((p.resentment??20)+7);p.sharedGoals=clamp((p.sharedGoals??55)-6);}
 }
 if(type==='partner-life-balance'){
  const p=actor;
  if(response==='accept'){p.life??={};p.life.workStress=clamp((p.life.workStress??60)-12);p.trust=clamp((p.trust??60)+5);p.intimacy=clamp((p.intimacy??60)+4);}
  else if(response==='compromise'){p.life.workStress=clamp((p.life.workStress??60)-5);p.trust=clamp((p.trust??60)+2);}
  else{p.life.workStress=clamp((p.life.workStress??60)+4);p.resentment=clamp((p.resentment??20)+6);}
 }
 if(type==='child-direction'){
  const child=actor;
  if(response==='accept'){
   child.educationPlan=initiative.data.desiredPlan;
   child.relationship=clamp((child.relationship??65)+7);
   if(child.development){child.development.confidence=clamp(child.development.confidence+6);child.development.parentAttachment=clamp(child.development.parentAttachment+4);}
  }else if(response==='compromise'){
   child.relationship=clamp((child.relationship??65)+2);
   if(child.development){child.development.independence=clamp(child.development.independence+3);child.development.identityStress=clamp(child.development.identityStress-2);}
  }else{
   child.relationship=clamp((child.relationship??65)-7);
   if(child.development){child.development.identityStress=clamp(child.development.identityStress+9);child.development.parentAttachment=clamp(child.development.parentAttachment-6);}
  }
 }
 if(type==='friend-support-request'){
  const f=actor;
  if(response==='accept'){
   f.relationship=clamp((f.relationship??55)+8);f.trust=clamp((f.trust??55)+9);f.reciprocity=clamp((f.reciprocity??50)+6);
   if(f.life)f.life.personalStress=clamp((f.life.personalStress??70)-12);
   f.needsSupport=false;
  }else if(response==='compromise'){
   f.relationship=clamp((f.relationship??55)+3);f.trust=clamp((f.trust??55)+3);
   if(f.life)f.life.personalStress=clamp((f.life.personalStress??70)-4);
  }else{
   f.relationship=clamp((f.relationship??55)-6);f.trust=clamp((f.trust??55)-8);f.reciprocity=clamp((f.reciprocity??50)-4);
  }
 }
 archive(state,initiative,response);
 return initiative;
}

export function processNpcInitiativeFollowups(state){
 const entries=[];
 const history=ensureNpcInitiatives(state).history;
 for(const item of history){
  if(item.followedUp||item.followUpAtAge!==state.player.age)continue;
  item.followedUp=true;
  if(item.type.startsWith('partner-')){
   const p=actorFor(state,item);
   if(!p)continue;
   if(item.response==='accept'){
    p.trust=clamp((p.trust??60)+2);p.sharedGoals=clamp((p.sharedGoals??55)+2);
    entries.push({age:state.player.age,kind:'npc-followup',text:item.actorName+' iki yıl önce onu ciddiye almış olmanı hâlâ hatırlıyor.'});
   }else if(item.response==='reject'){
    p.resentment=clamp((p.resentment??20)+3);
    entries.push({age:state.player.age,kind:'npc-followup',text:item.actorName+' iki yıl önce reddettiğin isteği hâlâ ilişkinizde taşıyor.'});
   }
  }
  if(item.type==='child-direction'){
   const child=(state.children??[]).find(c=>c.id===item.actorId);
   if(child){
    if(item.response==='accept'){child.relationship=clamp((child.relationship??65)+2);entries.push({age:state.player.age,kind:'npc-followup',text:child.name+' kendi yolunu seçmesine izin vermeni önemli bir dönüm noktası olarak görüyor.'});}
    if(item.response==='reject'){child.relationship=clamp((child.relationship??65)-2);entries.push({age:state.player.age,kind:'npc-followup',text:child.name+' geleceğiyle ilgili eski anlaşmazlığınızı hâlâ unutmuş değil.'});}
   }
  }
  if(item.type==='friend-support-request'){
   const f=(state.social?.friends??[]).find(x=>x.id===item.actorId);
   if(f){
    if(item.response==='accept'){f.reciprocity=clamp((f.reciprocity??50)+5);entries.push({age:state.player.age,kind:'npc-followup',text:f.name+' zor zamanında yanında olmanı unutmadı; artık sana daha çok destek oluyor.'});}
    if(item.response==='reject'){f.reciprocity=clamp((f.reciprocity??50)-5);entries.push({age:state.player.age,kind:'npc-followup',text:f.name+' eski destek talebinin karşılıksız kalmasını arkadaşlığınızda hâlâ hissediyor.'});}
   }
  }
 }
 return entries;
}
