const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const ACTIVITY_DEFS=[
 {id:'study',label:'Ders çalış',minAge:6},
 {id:'exercise',label:'Egzersiz yap',minAge:6},
 {id:'socialize',label:'Sosyalleş',minAge:7},
 {id:'hobby',label:'Hobiyle ilgilen',minAge:5}
];

export function availableActivities(state){return ACTIVITY_DEFS.filter(a=>state.player.age>=a.minAge);}

export function performActivity(state,id,rng){
 state.actions??={remaining:3,max:3};
 if(state.actions.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 const def=ACTIVITY_DEFS.find(a=>a.id===id);
 if(!def||state.player.age<def.minAge)throw new Error('Bu aktivite şu anda kullanılamıyor.');
 let result='';
 if(id==='study'){
  if(!state.education?.enrolled)throw new Error('Henüz okula başlamadın.');
  state.education.studyEffort=clamp((state.education.studyEffort??0)+rng.int(25,40));
  state.player.personality.discipline=clamp(state.player.personality.discipline+1);
  result='Ders çalıştın. Bu yılki çalışma düzenin güçlendi.';
 }
 if(id==='exercise'){
  state.player.health.current=clamp(state.player.health.current+rng.int(1,3));
  state.player.appearance.build=clamp(state.player.appearance.build+rng.int(0,2));
  result='Egzersiz yaptın ve fiziksel durumuna yatırım yaptın.';
 }
 if(id==='socialize'){
  state.social??={friends:[]};
  state.player.personality.sociability=clamp(state.player.personality.sociability+2);
  if(state.social.friends.length){const f=rng.pick(state.social.friends);f.relationship=clamp(f.relationship+4);result=`${f.name} ile vakit geçirdin.`;} else result='İnsanlarla vakit geçirip daha sosyal olmaya çalıştın.';
 }
 if(id==='hobby'){
  const interests=Object.entries(state.player.interests).sort((a,b)=>b[1]-a[1]);
  if(!interests.length){state.player.personality.curiosity=clamp(state.player.personality.curiosity+2);result='Yeni uğraşlar keşfetmeye çalıştın.';}
  else {const [name]=interests[0];state.player.interests[name]=clamp(state.player.interests[name]+rng.int(3,6));result=`${name} hobinle ilgilendin.`;}
 }
 state.actions.remaining-=1;
 return result;
}
