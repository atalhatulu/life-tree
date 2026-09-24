const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const avg=(xs,fallback=50)=>{
 const values=xs.filter(Number.isFinite);
 return values.length?values.reduce((a,b)=>a+b,0)/values.length:fallback;
};

function relationshipWellbeing(state){
 const values=[];
 const romance=state.social?.romance;
 if(romance)values.push(romance.relationship??50,romance.trust??50,100-(romance.relationshipTension??20));
 for(const friend of state.social?.friends??[])values.push(friend.relationship??50);
 for(const child of state.children??[])values.push(child.relationship??65);
 const rels=state.player?.relationships??{};
 for(const value of Object.values(rels))if(Number.isFinite(value))values.push(value);
 return clamp(avg(values,55));
}

export function computePrimaryStats(state){
 const player=state.player??{};
 const health=clamp(Math.round(player.health?.current??70));
 const appearance=clamp(Math.round(player.appearance?.attractiveness??50));

 const curiosity=player.personality?.curiosity??50;
 const discipline=player.personality?.discipline??50;
 const performance=state.education?.performance??player.education?.performance??50;
 const educationLevel=state.education?.level??player.education?.level??0;
 const higherBonus=state.higherEducation?.completed?10:state.higherEducation?.enrolled?4:0;
 const intelligence=clamp(Math.round(
  curiosity*.34+
  discipline*.18+
  performance*.30+
  Math.min(18,educationLevel*4)+
  higherBonus
 ));

 const stress=state.healthProfile?.stress??25;
 const strain=state.mentalHealth?.strain??0;
 const relationships=relationshipWellbeing(state);
 const career=state.career?.employed?(state.career?.satisfaction??55):55;
 const goal=state.lifeGoals?.active?.progress??(state.lifeGoals?.completed?.length?75:50);
 const household=state.householdDynamics?.stability??60;
 const happiness=clamp(Math.round(
  54+
  (health-50)*.16+
  (relationships-50)*.27+
  (career-50)*.14+
  (goal-50)*.10+
  (household-50)*.09-
  stress*.28-
  strain*.18
 ));

 return {health,intelligence,appearance,happiness};
}

export function refreshPrimaryStats(state){
 state.primaryStats=computePrimaryStats(state);
 return state.primaryStats;
}
