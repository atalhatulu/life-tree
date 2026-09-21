const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureLateLifeState(state){
 if(state.player.age<60)return null;
 state.lateLife??={
  mobility:Math.min(100,Math.round((state.healthProfile?.fitness??50)*.55+state.player.health.current*.45)),
  isolation:15,
  careNeed:false,
  careMode:null,
  retirementStyle:null
 };
 return state.lateLife;
}

function adultChildSupport(state){
 const adult=(state.children??[]).filter(c=>c.age>=22);
 if(!adult.length)return 0;
 const supportive=adult.filter(c=>(c.relationship??50)>=65);
 if(!supportive.length)return 0;
 return Math.min(12000,supportive.length*3500);
}

export function processLateLifeYear(state,rng){
 const late=ensureLateLifeState(state);
 if(!late)return [];
 const entries=[];
 const age=state.player.age;
 const fitness=state.healthProfile?.fitness??50;

 if(age>=65){
  late.mobility=clamp(late.mobility+rng.int(-3,1)+(fitness-50)*.02-(age>=75?1:0));
  const socialBuffer=(state.social?.romance?8:0)+Math.min(12,(state.social?.friends?.length??0)*2)+(state.children?.length??0)*2;
  late.isolation=clamp(late.isolation+rng.int(-2,3)+(age>=75?1:0)-socialBuffer*.08);
 }

 if(state.retirement?.retired){
  state.healthProfile.stress=clamp(state.healthProfile.stress-1);
 }

 late.familySupportMonthly=adultChildSupport(state);
 late.careNeed=age>=75&&(late.mobility<45||state.player.health.current<50||(state.healthProfile?.conditions?.filter(c=>c.severity>=3).length??0)>0);

 if(late.isolation>70&&rng.chance(.18)){
  state.healthProfile.stress=clamp(state.healthProfile.stress+5);
  entries.push({age,kind:'health',text:'Sosyal yalnızlık ruh hâlini ve stresini etkilemeye başladı.'});
 }

 return entries;
}

export function setRetirementStyle(state,style){
 const late=ensureLateLifeState(state);
 late.retirementStyle=style;
 if(style==='active'){
  late.mobility=clamp(late.mobility+6);
  state.healthProfile.fitness=clamp(state.healthProfile.fitness+5);
 }
 if(style==='family'){
  late.isolation=clamp(late.isolation-10);
  for(const child of state.children??[])child.relationship=clamp((child.relationship??70)+5);
 }
 if(style==='quiet'){
  state.healthProfile.stress=clamp(state.healthProfile.stress-7);
 }
}

export function setCareMode(state,mode){
 const late=ensureLateLifeState(state);
 late.careMode=mode;
 late.careStartedAtAge=state.player.age;
 if(mode==='family'){
  late.isolation=clamp(late.isolation-12);
 }
 if(mode==='home-care'){
  state.healthProfile.stress=clamp(state.healthProfile.stress-4);
 }
 if(mode==='assisted'){
  late.isolation=clamp(late.isolation-8);
  state.healthProfile.stress=clamp(state.healthProfile.stress-5);
 }
}
