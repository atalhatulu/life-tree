const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureUnemploymentState(state){
 if(state.career?.employed){
  state.unemployment=null;
  return null;
 }
 if(state.nextPath!=='work')return state.unemployment??null;
 state.unemployment??={
  startedAtAge:state.unemployedSinceAge??state.player.age,
  durationYears:0,
  longTerm:false,
  applications:0,
  fallbackOpened:false,
  retrainingSuggested:false
 };
 return state.unemployment;
}

export function processUnemploymentYear(state){
 const u=ensureUnemploymentState(state);
 if(!u)return [];
 const entries=[];
 u.durationYears=Math.max(0,state.player.age-u.startedAtAge);
 u.longTerm=u.durationYears>=2;
 if(u.durationYears>=3)u.fallbackOpened=true;
 if(u.durationYears>=2)u.retrainingSuggested=true;

 if(state.healthProfile){
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)+(u.durationYears>=2?4:2));
 }
 if(state.mentalHealth){
  state.mentalHealth.strain=clamp((state.mentalHealth.strain??20)+(u.durationYears>=2?3:1));
 }
 if(state.finance){
  state.finance.unemploymentYears=(state.finance.unemploymentYears??0)+1;
 }

 if(u.durationYears===2)entries.push({age:state.player.age,kind:'career',text:'İşsizlik uzadıkça yeni kariyer veya yeniden eğitim seçeneklerini değerlendirmeye başladın.'});
 if(u.durationYears===3)entries.push({age:state.player.age,kind:'career',text:'Uzun süreli işsizlik nedeniyle daha geniş bir iş havuzuna yönelmeye başladın.'});
 return entries;
}

export function recordJobApplication(state){
 const u=ensureUnemploymentState(state);
 if(u)u.applications+=1;
}
