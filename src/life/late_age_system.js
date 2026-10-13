import {annualYearStatus} from '../core/annual_clock.js';
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

function mobilityWear(age){
 if(age<65)return 0;
 if(age<75)return .4;
 if(age<85)return .8;
 if(age<95)return 1.4;
 return 2.2;
}

function adultChildSupport(state){
 const adult=(state.children??[]).filter(c=>c.alive!==false&&c.age>=22);
 if(!adult.length)return 0;
 const supportive=adult.filter(c=>(c.relationship??50)>=65);
 if(!supportive.length)return 0;
 return Math.min(12000,supportive.length*3500);
}

export function processLateLifeYear(state,rng){
 // No annual late-life work exists below age 60. For eligible ages,
 // validate the calendar before ensureLateLifeState creates a persisted record.
 if(state.player.age<60)return [];
 const {calendarYear,replayed}=annualYearStatus(state.year,state.lateLife?.lastProcessedYear,'late life');
 if(replayed)return [];
 const late=ensureLateLifeState(state);
 const entries=[];
 const age=state.player.age;
 const fitness=state.healthProfile?.fitness??50;

 if(age>=65){
  const previousMobility=late.mobility;
  const simulatedMobility=clamp(late.mobility+rng.int(-3,1)+(fitness-50)*.02);
  late.mobility=Math.min(simulatedMobility,clamp(previousMobility-mobilityWear(age)));
  const livingPartner=state.social?.romance?.alive!==false&&state.social?.romance;
  const livingFriends=(state.social?.friends??[]).filter(f=>f.alive!==false).length;
  const livingChildren=(state.children??[]).filter(c=>c.alive!==false).length;
  const socialBuffer=(livingPartner?8:0)+Math.min(12,livingFriends*2)+livingChildren*2;
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

 if(calendarYear!==null)late.lastProcessedYear=calendarYear;
 return entries;
}

export function setRetirementStyle(state,style){
 if(!['active','family','quiet'].includes(style))throw new RangeError('Invalid retirement style');
 // The retirement lifestyle event is a one-time decision. In particular,
 // replaying a saved choice must not award its immediate benefits again.
 const existing=state.lateLife?.retirementStyle;
 if(existing===style)return;
 if(existing)throw new Error('Retirement style already chosen');
 const late=ensureLateLifeState(state);
 if(!late)throw new RangeError('Retirement style requires age 60 or older');
 late.retirementStyle=style;
 if(style==='active'){
  late.mobility=clamp(late.mobility+6);
  state.healthProfile.fitness=clamp(state.healthProfile.fitness+5);
 }
 if(style==='family'){
  late.isolation=clamp(late.isolation-10);
  for(const child of state.children??[]){
   if(child.alive!==false)child.relationship=clamp((child.relationship??70)+5);
  }
 }
 if(style==='quiet'){
  state.healthProfile.stress=clamp(state.healthProfile.stress-7);
 }
}

export function setCareMode(state,mode){
 if(!['family','home-care','assisted'].includes(mode))throw new RangeError('Invalid care mode');
 // Care arrangements are chosen through a one-time event; keep the original
 // start age and one-off wellbeing benefit when a decision is replayed.
 const existing=state.lateLife?.careMode;
 if(existing===mode)return;
 if(existing)throw new Error('Care mode already chosen');
 const late=ensureLateLifeState(state);
 if(!late)throw new RangeError('Care mode requires age 60 or older');
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
