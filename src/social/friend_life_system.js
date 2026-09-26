import {ensureNpcGoal,updateNpcGoal} from '../life/npc_goal_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureFriendLife(friend){
 friend.life??={
  workStability:55,
  relationshipStatus:'single',
  personalStress:25,
  lifeSatisfaction:55,
  movedAway:false,
  majorEvents:0
 };
 return friend.life;
}

export function processFriendLivesYear(state,rng){
 const entries=[];
 for(const friend of state.social?.friends??[]){
  if(friend.alive===false)continue;
  const life=ensureFriendLife(friend);
  ensureNpcGoal(friend);
  life.personalStress=clamp(life.personalStress+rng.fork(friend.id+'-stress').int(-3,4));
  life.workStability=clamp(life.workStability+rng.fork(friend.id+'-work').int(-4,4));
  life.lifeSatisfaction=clamp(
    38+
    (friend.relationship??55)*.18+
    life.workStability*.18-
    life.personalStress*.16+
    (friend.closeFriend?8:0)
  );
  updateNpcGoal(friend,{
   careerSatisfaction:life.workStability,
   financialStability:life.workStability,
   relationshipQuality:friend.relationship??55,
   wellbeing:life.lifeSatisfaction
  });

  if(life.relationshipStatus==='single'&&friend.age>=20&&rng.fork(friend.id+'-partner').chance(.08+(friend.personality?.sociability??50)*.001)){
    life.relationshipStatus='partnered';
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' ciddi bir ilişkiye başladı.'});
  }else if(life.relationshipStatus==='partnered'&&rng.fork(friend.id+'-breakup').chance(.035+Math.max(0,45-life.lifeSatisfaction)*.002)){
    life.relationshipStatus='single';
    life.personalStress=clamp(life.personalStress+10);
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' ilişkisinin bittiğini anlattı.'});
  }

  if(!life.movedAway&&friend.age>=22&&rng.fork(friend.id+'-move').chance(.035)){
    life.movedAway=true;
    friend.cityName='Başka şehir';
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' işi veya özel hayatı nedeniyle başka bir şehre taşındı.'});
  }

  if(life.workStability<=28&&rng.fork(friend.id+'-job-loss').chance(.18)){
    life.personalStress=clamp(life.personalStress+12);
    life.workStability=38;
    life.majorEvents++;
    entries.push({age:state.player.age,kind:'friend-life',text:friend.name+' işini kaybetti ve zor bir döneme girdi.'});
  }

  if(friend.closeFriend&&life.personalStress>=72&&rng.fork(friend.id+'-reach-out').chance(.25)){
    friend.needsSupport=true;
    entries.push({age:state.player.age,kind:'friend-life',paceBlock:true,text:friend.name+' zorlandığı için özellikle sana ulaşmaya başladı.'});
  }else if(life.personalStress<50){
    friend.needsSupport=false;
  }
 }
 return entries;
}
