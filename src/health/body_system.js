const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureBody(state){
 state.body??={cardioReserve:70,mobility:80,recovery:75,chronicLoad:0};
 return state.body;
}

export function processBodyYear(state){
 const b=ensureBody(state);
 const age=state.player?.age??0;
 const fitness=state.healthProfile?.fitness??50;
 const conditions=state.healthProfile?.conditions??[];
 const severe=conditions.reduce((sum,c)=>sum+Math.max(0,(c.severity??1)-1),0);
 const aging=age>=80?3.0:age>=70?1.8:age>=60?.9:age>=45?.35:.10;
 b.chronicLoad=clamp(severe*10+conditions.length*4);
 b.cardioReserve=clamp(b.cardioReserve-aging+(fitness-50)*.025-b.chronicLoad*.012);
 b.mobility=clamp(b.mobility-aging*.8+(fitness-50)*.03-b.chronicLoad*.010);
 b.recovery=clamp(90-age*.35+(fitness-50)*.20-b.chronicLoad*.15);
 if(state.lateLife)state.lateLife.mobility=Math.min(state.lateLife.mobility??100,b.mobility);
 return [];
}
