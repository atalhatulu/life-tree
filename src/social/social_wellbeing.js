const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function socialWellbeing(state){
 const friends=(state.social?.friends??[]).filter(f=>f.alive!==false);
 const partner=state.social?.romance;
 const childLinks=(state.children??[]).map(c=>c.relationship??60);
 const parentLinks=['mother','father']
  .filter(id=>state.parents?.[id]?.alive)
  .map(id=>state.player?.relationships?.[id]??60);

 const friendQuality=friends.length
  ?friends.reduce((s,f)=>s+(f.relationship??55),0)/friends.length
  :20;
 const partnerQuality=partner?.alive!==false?(partner?.relationship??0):0;
 const familyValues=[...childLinks,...parentLinks];
 const familyQuality=familyValues.length?familyValues.reduce((a,b)=>a+b,0)/familyValues.length:35;
 const network=Math.min(100,friends.length*14+(partner?28:0)+familyValues.length*7);
 const connection=clamp(Math.round(friendQuality*.28+partnerQuality*.32+familyQuality*.20+network*.20));
 const isolation=clamp(100-connection);
 return {connection,isolation,friendCount:friends.length};
}

export function processSocialWellbeingYear(state){
 const wellbeing=socialWellbeing(state);
 state.socialWellbeing=wellbeing;
 if(!state.healthProfile)return [];
 const stressDelta=wellbeing.isolation>=70?3:wellbeing.isolation>=50?1:wellbeing.connection>=75?-2:0;
 state.healthProfile.stress=clamp((state.healthProfile.stress??30)+stressDelta);
 if(state.lateLife)state.lateLife.isolation=wellbeing.isolation;
 return [];
}
