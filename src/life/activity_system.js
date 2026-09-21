import {growTrait} from '../character/personality_dynamics.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const ACTIVITY_DEFS=[
 {id:'study',label:'Ders çalış',minAge:6,condition:s=>(s.player.age<=18&&s.education?.enrolled)||s.higherEducation?.enrolled},
 {id:'course',label:'Kurs / eğitim al',minAge:19,condition:s=>!s.higherEducation?.enrolled},
 {id:'exercise',label:'Egzersiz yap',minAge:6},
 {id:'socialize',label:'Sosyalleş',minAge:7},
 {id:'hobby',label:'Hobiyle ilgilen',minAge:5},
 {id:'work-hard',label:'İşe odaklan',minAge:19,condition:s=>s.career?.employed},
 {id:'date',label:'Partnerinle vakit geçir',minAge:18,condition:s=>Boolean(s.social?.romance)},
 {id:'checkup',label:'Sağlık kontrolü yaptır',minAge:18},
 {id:'budget',label:'Bütçeni gözden geçir',minAge:20,condition:s=>Boolean(s.finance)}
];

export function availableActivities(state){
 return ACTIVITY_DEFS.filter(a=>state.player.age>=a.minAge&&(!a.condition||a.condition(state)));
}

export function performActivity(state,id,rng){
 state.actions??={remaining:3,max:3};
 if(state.actions.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 const def=ACTIVITY_DEFS.find(a=>a.id===id);
 if(!def||state.player.age<def.minAge||(def.condition&&!def.condition(state)))throw new Error('Bu aktivite şu anda kullanılamıyor.');
 let result='';

 if(id==='study'){
  if(state.higherEducation?.enrolled){
   state.higherEducation.performance=clamp(state.higherEducation.performance+rng.int(2,5));
   state.player.personality.discipline=growTrait(state.player.personality.discipline,1);
   result='Üniversite çalışmalarına zaman ayırdın.';
  }else{
   state.education.studyEffort=clamp((state.education.studyEffort??0)+rng.int(25,40));
   state.player.personality.discipline=growTrait(state.player.personality.discipline,1);
   result='Ders çalıştın. Bu yılki çalışma düzenin güçlendi.';
  }
 }
 if(id==='course'){
  state.player.personality.curiosity=growTrait(state.player.personality.curiosity,rng.int(1,3));
  state.player.personality.discipline=growTrait(state.player.personality.discipline,rng.int(0,2));
  if(state.career?.employed){
   state.career.performance=clamp(state.career.performance+rng.int(1,3));
   result='Mesleki bir kursa katılıp kendini geliştirdin.';
  }else result='Yeni bir beceri öğrenmek için kursa katıldın.';
 }
 if(id==='exercise'){
  state.player.health.current=clamp(state.player.health.current+rng.int(1,3));
  state.player.appearance.build=clamp(state.player.appearance.build+rng.int(0,2));
  if(state.healthProfile)state.healthProfile.fitness=clamp(state.healthProfile.fitness+rng.int(2,5));
  result='Egzersiz yaptın ve fiziksel durumuna yatırım yaptın.';
 }
 if(id==='socialize'){
  state.social??={friends:[]};
  state.player.personality.sociability=growTrait(state.player.personality.sociability,2);
  if(state.social.friends.length){const f=rng.pick(state.social.friends);f.relationship=clamp(f.relationship+4);result=f.name+' ile vakit geçirdin.';} else result='İnsanlarla vakit geçirip daha sosyal olmaya çalıştın.';
 }
 if(id==='hobby'){
  const interests=Object.entries(state.player.interests).sort((a,b)=>b[1]-a[1]);
  if(!interests.length){state.player.personality.curiosity=growTrait(state.player.personality.curiosity,2);result='Yeni uğraşlar keşfetmeye çalıştın.';}
  else {const [name]=interests[0];state.player.interests[name]=clamp(state.player.interests[name]+rng.int(3,6));result=name+' hobinle ilgilendin.';}
 }
 if(id==='work-hard'){
  state.career.performance=clamp(state.career.performance+rng.int(3,6));
  state.career.satisfaction=clamp((state.career.satisfaction??50)-rng.int(0,2));
  result='İşine ekstra emek verdin.';
 }
 if(id==='date'){
  state.social.romance.relationship=clamp(state.social.romance.relationship+rng.int(3,6));
  result=state.social.romance.name+' ile kaliteli zaman geçirdin.';
 }
 if(id==='checkup'){
  state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  state.healthProfile.lastCheckupAge=state.player.age;
  state.healthProfile.stress=clamp(state.healthProfile.stress-4);
  result='Sağlık kontrolünden geçtin.';
 }
 if(id==='budget'){
  state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  state.healthProfile.stress=clamp(state.healthProfile.stress-2);
  if(state.finance.debt>0&&state.finance.cash>10000){
   const payment=Math.min(state.finance.debt,Math.round(state.finance.cash*.20));
   state.finance.cash-=payment;
   state.finance.debt-=payment;
   result='Bütçeni düzenleyip borcunun bir kısmını kapattın.';
  }else result='Bütçeni gözden geçirip finansal planını güncelledin.';
 }

 state.actions.remaining-=1;
 return result;
}
