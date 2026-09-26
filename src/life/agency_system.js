import {focusLifeGoal} from './life_goal_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function availableLifeActions(state){
 if(!state.player?.alive)return [];
 const actions=[];
 const activeGoal=state.lifeGoals?.active;
 if(activeGoal&&(activeGoal.lastFocusedAge==null||state.player.age-activeGoal.lastFocusedAge>=2))actions.push({id:'focus-goal',label:'Uzun vadeli hedefime odaklan'});
 const partner=state.social?.romance;
 if(partner?.life?.workStress>=60||partner?.resentment>=55)actions.push({id:'support-partner',label:'Partnerime destek ol'});
 const friend=(state.social?.friends??[]).find(f=>f.needsSupport);
 if(friend)actions.push({id:'support-friend:'+friend.id,label:friend.name+' için yanında ol'});
 const child=(state.children??[]).find(c=>c.age>=8&&c.age<18&&((c.development?.identityStress??0)>=45||(c.development?.confidence??50)<=45));
 if(child)actions.push({id:'mentor-child:'+child.id,label:child.name+' ile birebir ilgilen'});
 return actions;
}

export function performLifeAction(state,id){
 if(!state.player?.alive)throw new Error('Hayat sona erdi; artık eylem yapılamaz.');
 if(state.actions?.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 if(id==='focus-goal')return focusLifeGoal(state);

 const partner=state.social?.romance;
 if(id==='support-partner'&&partner){
  partner.trust=clamp((partner.trust??60)+4);
  partner.intimacy=clamp((partner.intimacy??60)+3);
  partner.resentment=clamp((partner.resentment??20)-5);
  if(partner.life)partner.life.workStress=clamp((partner.life.workStress??25)-5);
  state.actions.remaining-=1;
  return partner.name+' ile gerçekten ilgilenip yükünü paylaşmaya çalıştın.';
 }

 if(id.startsWith('support-friend:')){
  const friendId=id.slice('support-friend:'.length);
  const friend=(state.social?.friends??[]).find(f=>f.id===friendId&&f.needsSupport);
  if(!friend)throw new Error('Bu destek aksiyonu artık kullanılamıyor.');
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
  const child=(state.children??[]).find(c=>c.id===childId);
  if(!child)throw new Error('Bu çocuk aksiyonu artık kullanılamıyor.');
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
