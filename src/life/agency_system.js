import {focusLifeGoal,validLifeGoalFocus} from './life_goal_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const isRecord=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
// Old saves may omit collections. Explicitly malformed collections should
// not crash menu rendering or be silently treated as a valid direct target.
function peopleForMenu(value){return Array.isArray(value)?value:[];}
function peopleForAction(value,label){
 if(value==null)return [];
 if(!Array.isArray(value))throw new TypeError('Geçersiz '+label+' listesi.');
 return value;
}
function assertContactAge(value,currentAge){
 if(value!=null&&(!Number.isSafeInteger(value)||value<0||value>currentAge))
  throw new TypeError('Geçersiz son arkadaş görüşme yaşı.');
}
// Preflight every value that will be modified so failed actions do not
// consume credits or leave half-written relationship/development state.
function assertFiniteFields(record,fields,label,{optional=true}={}){
 if(!record||typeof record!=='object'||Array.isArray(record))
  throw new TypeError('Geçersiz '+label+' kaydı.');
 for(const field of fields){
  const value=record[field];
  if(optional&&value==null)continue;
  if(typeof value!=='number'||!Number.isFinite(value))
   throw new TypeError('Geçersiz '+label+' değeri: '+field);
 }
}
function assertOptionalLife(person,fields,label){
 if(person.life!=null)assertFiniteFields(person.life,fields,label);
}
const needsMentoring=child=>isRecord(child)&&child.alive!==false&&Number.isSafeInteger(child.age)&&child.age>=8&&child.age<18&&
 ((child.development?.identityStress??0)>=45||(child.development?.confidence??50)<=45);
const needsPartnerSupport=partner=>Boolean(isRecord(partner)&&partner.alive!==false&&
 (partner.life?.workStress>=60||partner.resentment>=55));

// The menu must not offer actions that the direct API rejects. These
// preflights are shared with execution and never mutate legacy records.
function assertPartnerSupport(partner){
 assertFiniteFields(partner,['trust','intimacy','resentment'],'partner');
 assertOptionalLife(partner,['workStress'],'partner yaşam');
}
function assertFriendSupport(friend,currentAge){
 assertFiniteFields(friend,['relationship','trust'],'arkadaş');
 assertOptionalLife(friend,['personalStress'],'arkadaş yaşam');
 assertContactAge(friend.lastContactAge,currentAge);
}
function assertChildMentoring(child){
 assertFiniteFields(child,['relationship'],'çocuk');
 if(child.development!=null)
  assertFiniteFields(child.development,['confidence','identityStress','parentAttachment'],'çocuk gelişimi',{optional:false});
}
function isActionable(check){try{check();return true;}catch{return false;}}

export function availableLifeActions(state){
 if(!state.player?.alive||!Number.isSafeInteger(state.actions?.remaining)||state.actions.remaining<=0)return [];
 const actions=[];
 const activeGoal=state.lifeGoals?.active;
 if(activeGoal&&validLifeGoalFocus(state)&&(activeGoal.lastFocusedAge==null||state.player.age-activeGoal.lastFocusedAge>=2))actions.push({id:'focus-goal',label:'Uzun vadeli hedefime odaklan'});
 const partner=state.social?.romance;
 if(needsPartnerSupport(partner)&&isActionable(()=>assertPartnerSupport(partner)))
  actions.push({id:'support-partner',label:'Partnerime destek ol'});
 // A single first match hid other eligible people from the interface even
 // though the direct action API already accepts their individual IDs.
 const seenFriends=new Set();
 for(const friend of peopleForMenu(state.social?.friends)){
  if(!isRecord(friend)||friend.alive===false||!friend.needsSupport||
     typeof friend.id!=='string'||!friend.id||seenFriends.has(friend.id))continue;
  seenFriends.add(friend.id);
  if(!isActionable(()=>assertFriendSupport(friend,state.player.age)))continue;
  actions.push({id:'support-friend:'+friend.id,label:friend.name+' için yanında ol'});
 }
 const seenChildren=new Set();
 for(const child of peopleForMenu(state.children)){
  if(!needsMentoring(child)||typeof child.id!=='string'||!child.id||seenChildren.has(child.id))continue;
  seenChildren.add(child.id);
  if(!isActionable(()=>assertChildMentoring(child)))continue;
  actions.push({id:'mentor-child:'+child.id,label:child.name+' ile birebir ilgilen'});
 }
 return actions;
}

export function performLifeAction(state,id){
 if(!state.player?.alive)throw new Error('Hayat sona erdi; artık eylem yapılamaz.');
 // Validate the ledger before changing relationships or child development.
 // Missing/fractional balances must not turn a successful action into NaN.
 if(!Number.isSafeInteger(state.actions?.remaining)||state.actions.remaining<=0)
  throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 if(typeof id!=='string')throw new Error('Bilinmeyen yaşam aksiyonu: '+id);
 if(id==='focus-goal')return focusLifeGoal(state);

 const partner=state.social?.romance;
 if(id==='support-partner'&&needsPartnerSupport(partner)){
  assertPartnerSupport(partner);
  partner.trust=clamp((partner.trust??60)+4);
  partner.intimacy=clamp((partner.intimacy??60)+3);
  partner.resentment=clamp((partner.resentment??20)-5);
  if(partner.life)partner.life.workStress=clamp((partner.life.workStress??25)-5);
  state.actions.remaining-=1;
  return partner.name+' ile gerçekten ilgilenip yükünü paylaşmaya çalıştın.';
 }

 if(id.startsWith('support-friend:')){
  const friendId=id.slice('support-friend:'.length);
  const friend=peopleForAction(state.social?.friends,'arkadaş').find(f=>isRecord(f)&&f.id===friendId&&f.alive!==false&&f.needsSupport);
  if(!friend)throw new Error('Bu destek aksiyonu artık kullanılamıyor.');
  assertFriendSupport(friend,state.player.age);
  friend.relationship=clamp((friend.relationship??55)+6);
  friend.trust=clamp((friend.trust??55)+7);
  if(friend.life)friend.life.personalStress=clamp((friend.life.personalStress??25)-8);
  friend.needsSupport=false;
  friend.lastContactAge=state.player.age;
  state.actions.remaining-=1;
  return friend.name+' zor bir dönemden geçerken yanında oldun.';
 }

 if(id.startsWith('mentor-child:')){
  const childId=id.slice('mentor-child:'.length);
  const child=peopleForAction(state.children,'çocuk').find(c=>isRecord(c)&&c.id===childId&&needsMentoring(c));
  if(!child)throw new Error('Bu çocuk aksiyonu artık kullanılamıyor.');
  assertChildMentoring(child);
  child.relationship=clamp((child.relationship??65)+4);
  if(child.development){
   child.development.confidence=clamp(child.development.confidence+5);
   child.development.identityStress=clamp(child.development.identityStress-7);
   child.development.parentAttachment=clamp(child.development.parentAttachment+4);
  }
  state.actions.remaining-=1;
  return child.name+' ile birebir zaman geçirip onu dinledin ve destekledin.';
 }

 throw new Error('Bilinmeyen yaşam aksiyonu: '+id);
}
