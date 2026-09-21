const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function physicalCapacity(state){
 const health=clamp(state.player?.health?.current??50);
 const fitness=clamp(state.healthProfile?.fitness??50);
 const mobility=state.player?.age>=60?clamp(state.lateLife?.mobility??fitness):fitness;
 const score=state.player?.age>=60
  ?health*.55+fitness*.25+mobility*.20
  :health*.65+fitness*.35;
 return Number(clamp(score).toFixed(1));
}

export function capacityBand(state){
 const score=physicalCapacity(state);
 if(score<20)return 'critical';
 if(score<40)return 'low';
 if(score<60)return 'reduced';
 if(score<80)return 'good';
 return 'strong';
}

export function workCapacityModifier(state){
 const score=physicalCapacity(state);
 if(score>=60)return 0;
 if(score>=40)return -(60-score)*.12;
 if(score>=20)return -2.4-(40-score)*.22;
 return -6.8-(20-score)*.30;
}

export function treatmentResilience(state){
 const score=physicalCapacity(state);
 const constitution=clamp(state.player?.health?.constitution??50);
 return clamp(constitution*.50+score*.50);
}

export function activityEfficiency(state){
 const score=physicalCapacity(state);
 if(score<20)return .45;
 if(score<40)return .65;
 if(score<60)return .82;
 return 1;
}
