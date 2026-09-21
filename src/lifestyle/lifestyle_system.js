const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const LIFESTYLE_COSTS={
 housing:{family:1000,shared:11000,studio:18000,apartment:28000,owned:6500},
 food:{frugal:2800,standard:4000,healthy:6500,premium:12000},
 clothing:{basic:1200,standard:3000,premium:7000},
 transport:{public:1800,car:9000}
};

export function lifestyleMonthlyCost(state){
 const l=state.finance?.lifestyle??{housing:'family',food:'standard',clothing:'basic',transport:'public'};
 const leisure={family:1800,shared:2600,studio:3200,apartment:4500,owned:4200}[l.housing]??3000;
 return LIFESTYLE_COSTS.housing[l.housing]+LIFESTYLE_COSTS.food[l.food]+LIFESTYLE_COSTS.clothing[l.clothing]+LIFESTYLE_COSTS.transport[l.transport]+leisure;
}

export function lifestyleEffects(state){
 const l=state.finance?.lifestyle;
 if(!l) return {health:0,status:0,stress:0};
 let health=0,status=0,stress=0;
 if(l.food==='frugal'){health-=2;stress+=1;}
 if(l.food==='healthy'){health+=3;}
 if(l.food==='premium'){health+=1;status+=2;}
 if(l.clothing==='premium')status+=4;
 if(l.transport==='car')status+=3;
 if(l.housing==='family'&&state.player.age>=28)stress+=2;
 if(['apartment','owned'].includes(l.housing))status+=4;
 return {health:clamp(health,-10,10),status:clamp(status,-10,20),stress:clamp(stress,0,20)};
}

export function setLifestyle(state,changes){
 if(!state.finance) throw new Error('Kişisel finans henüz başlamadı.');
 const l=state.finance.lifestyle;
 for(const [key,value] of Object.entries(changes)){
  if(!LIFESTYLE_COSTS[key]?.[value]&&LIFESTYLE_COSTS[key]?.[value]!==0) throw new Error('Geçersiz yaşam standardı seçimi.');
  l[key]=value;
 }
}
