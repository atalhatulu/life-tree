import {HOBBIES} from '../data/catalog.js';
import {activityEfficiency,capacityBand} from '../health/physical_capacity.js';
import {growTrait} from '../character/personality_dynamics.js';
import {repayBudgetDebt} from '../finance/personal_finance.js';
import {applyMentalHealthActivity} from '../health/mental_health_system.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const ACTIVITY_DEFS=[
 {id:'study',label:'Ders çalış',minAge:6,condition:s=>(s.player.age<=18&&s.education?.enrolled)||s.higherEducation?.enrolled},
 {id:'course',label:'Kurs / eğitim al',minAge:19,condition:s=>!s.higherEducation?.enrolled},
 {id:'exercise',label:'Egzersiz yap',minAge:6},
 {id:'socialize',label:'Sosyalleş',minAge:7},
 {id:'hobby',label:'Hobiyle ilgilen',minAge:5},
 {id:'work-hard',label:'İşe odaklan',minAge:19,condition:s=>s.career?.employed},
 {id:'date',label:'Partnerinle vakit geçir',minAge:18,condition:s=>Boolean(s.social?.romance&&s.social.romance.alive!==false)},
 {id:'checkup',label:'Sağlık kontrolü yaptır',minAge:18},
 {id:'budget',label:'Bütçeni gözden geçir',minAge:20,condition:s=>Boolean(s.finance)},
 {id:'therapy',label:'Terapi / psikolojik destek',minAge:16,condition:s=>(s.mentalHealth?.strain??0)>=40}
];

// Check the memory before any activity effect or budget repayment. A broken
// counter otherwise produces NaN after the action has already changed state.
function assertActivityMemory(state,id){
 const ledger=state.activityMemory;
 if(ledger===undefined)return;
 if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))
  throw new TypeError('Geçersiz aktivite hafızası.');
 const entry=ledger[id];
 if(entry===undefined)return;
 if(!entry||typeof entry!=='object'||Array.isArray(entry))
  throw new TypeError('Geçersiz aktivite hafızası kaydı.');
 for(const key of ['uses','streak']){
  const value=entry[key];
  if(value!==undefined&&(!Number.isSafeInteger(value)||value<0||value===Number.MAX_SAFE_INTEGER))
   throw new TypeError('Geçersiz aktivite sayacı: '+key);
  // recordUse increments uses on every success, and streak only when the
  // previous use was last year. Reject impending unsafe integers up front.
  if(value>=Number.MAX_SAFE_INTEGER-1&&
     (key==='uses'||(key==='streak'&&entry.lastAge===state.player.age-1)))
   throw new TypeError('Geçersiz aktivite sayacı: '+key);
 }
 const age=entry.lastAge;
 if(age!=null&&(!Number.isSafeInteger(age)||age<0||age>state.player.age))
  throw new TypeError('Geçersiz son aktivite yaşı.');
}
// Interactive activities must reject malformed legacy subrecords *before*
// changing personality, consuming RNG, repaying debt, or spending an action.
function assertScore(value,label){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)
  throw new TypeError('Geçersiz '+label+'.');
}
function assertContactAge(value,currentAge,label){
 if(value!=null&&(!Number.isSafeInteger(value)||value<0||value>currentAge))
  throw new TypeError('Geçersiz '+label+'.');
}
function assertSocialActivity(state,id){
 if(id==='socialize'){
  const traits=state.player.personality;
  if(!traits||typeof traits!=='object'||Array.isArray(traits))
   throw new TypeError('Geçersiz kişilik kaydı.');
  if(traits.sociability!=null)assertScore(traits.sociability,'sosyallik puanı');
  const social=state.social;
  if(social!=null&&(typeof social!=='object'||Array.isArray(social)))
   throw new TypeError('Geçersiz sosyal kayıt.');
  const friends=social?.friends;
  if(friends!=null){
   if(!Array.isArray(friends))throw new TypeError('Geçersiz arkadaş listesi.');
   for(const friend of friends){
    if(!friend||typeof friend!=='object'||Array.isArray(friend))
     throw new TypeError('Geçersiz arkadaş kaydı.');
    if(friend.alive!==false){
     assertScore(friend.relationship,'arkadaş ilişki puanı');
     assertContactAge(friend.lastContactAge,state.player.age,'son arkadaş görüşme yaşı');
     if(friend.yearsKnown!=null&&(!Number.isSafeInteger(friend.yearsKnown)||friend.yearsKnown<0))
      throw new TypeError('Geçersiz arkadaşlık yılı sayacı.');
     if(friend.closeFriend!=null&&typeof friend.closeFriend!=='boolean')
      throw new TypeError('Geçersiz yakın arkadaş işareti.');
    }
   }
  }
 }
 if(id==='date'){
  const partner=state.social?.romance;
  if(!partner||typeof partner!=='object'||Array.isArray(partner))
   throw new TypeError('Geçersiz partner kaydı.');
  assertScore(partner.relationship,'partner ilişki puanı');
  assertContactAge(partner.lastQualityTimeAge,state.player.age,'son partner görüşme yaşı');
  if(partner.relationshipTension!=null)
   assertScore(partner.relationshipTension,'partner gerilim puanı');
 }
}
function assertHealthActivity(state,id){
 if(!['checkup','therapy','budget'].includes(id))return;
 const profile=state.healthProfile;
 if(profile==null)return;
 if(!profile||typeof profile!=='object'||Array.isArray(profile))
  throw new TypeError('Geçersiz sağlık profili.');
 if(profile.stress!=null)assertScore(profile.stress,'stres puanı');
 if(id==='checkup'&&profile.lastCheckupAge!=null){
  const age=profile.lastCheckupAge;
  if(!Number.isSafeInteger(age)||age<0)
   throw new TypeError('Geçersiz sağlık kontrolü yaşı.');
  // Keep the established unavailable-activity error for a future age.
  if(age>state.player.age)throw new Error('Bu aktivite şu anda kullanılamıyor.');
 }
}
// The shared mental-health hook runs after every activity. Reject malformed
// ledgers before an earlier activity effect can spend RNG or change state.
function assertMentalHealthActivity(state,id){
 const mental=state.mentalHealth;
 if(mental==null){
  // ensureMentalHealth derives resilience from these two optional traits.
  if(state.player.health?.constitution!=null)
   assertScore(state.player.health.constitution,'sağlık dayanıklılığı');
  if(state.player.personality?.patience!=null)
   assertScore(state.player.personality.patience,'sabır puanı');
  return;
 }
 if(typeof mental!=='object'||Array.isArray(mental))
  throw new TypeError('Geçersiz ruh sağlığı kaydı.');
 assertScore(mental.strain,'ruhsal yük');
 if(id==='therapy'&&mental.therapyYears!=null&&
    (!Number.isSafeInteger(mental.therapyYears)||mental.therapyYears<0||
     mental.therapyYears===Number.MAX_SAFE_INTEGER))
  throw new TypeError('Geçersiz terapi yılı sayacı.');
}
// Capacity calculations silently turn invalid scores into NaN. Validate all
// inputs before physical activity mutates performance, health or appearance.
function assertPhysicalActivity(state,id){
 if(id!=='exercise'&&id!=='work-hard')return;
 assertScore(state.player.health?.current,'mevcut sağlık puanı');
 const profile=state.healthProfile;
 if(profile!=null){
  if(typeof profile!=='object'||Array.isArray(profile))
   throw new TypeError('Geçersiz sağlık profili.');
  if(profile.fitness!=null)assertScore(profile.fitness,'kondisyon puanı');
 }
 if(state.player.age>=60&&state.lateLife!=null){
  if(typeof state.lateLife!=='object'||Array.isArray(state.lateLife))
   throw new TypeError('Geçersiz ileri yaş kaydı.');
  if(state.lateLife.mobility!=null)assertScore(state.lateLife.mobility,'hareketlilik puanı');
 }
 if(id==='exercise')assertScore(state.player.appearance?.build,'vücut yapısı puanı');
 if(id==='work-hard'){
  if(!state.career||typeof state.career!=='object'||Array.isArray(state.career))
   throw new TypeError('Geçersiz kariyer kaydı.');
  assertScore(state.career.performance,'iş performansı');
  if(state.career.satisfaction!=null)assertScore(state.career.satisfaction,'iş memnuniyeti');
  if(profile?.stress!=null)assertScore(profile.stress,'stres puanı');
 }
}
// Study and training write into different ledgers depending on enrollment.
// Check the branch that will actually run before it consumes RNG or actions.
function assertLearningActivity(state,id){
 if(id!=='study'&&id!=='course')return;
 const traits=state.player.personality;
 if(!traits||typeof traits!=='object'||Array.isArray(traits))
  throw new TypeError('Geçersiz kişilik kaydı.');
 if(traits.discipline!=null)assertScore(traits.discipline,'disiplin puanı');
 if(id==='study'){
  if(state.higherEducation?.enrolled){
   const university=state.higherEducation;
   if(!university||typeof university!=='object'||Array.isArray(university))
    throw new TypeError('Geçersiz üniversite kaydı.');
   assertScore(university.performance,'üniversite performansı');
  }else{
   const education=state.education;
   if(!education||typeof education!=='object'||Array.isArray(education))
    throw new TypeError('Geçersiz okul kaydı.');
   if(education.studyEffort!=null)assertScore(education.studyEffort,'çalışma gayreti');
  }
 }else{
  if(traits.curiosity!=null)assertScore(traits.curiosity,'merak puanı');
  if(state.career?.employed){
   if(typeof state.career!=='object'||Array.isArray(state.career))
    throw new TypeError('Geçersiz kariyer kaydı.');
   assertScore(state.career.performance,'iş performansı');
  }
 }
}
// The highest-scored hobby is selected by sorting all interests. A malformed
// non-selected score can therefore change selection even for explicit hobbies.
function assertHobbyActivity(state,id){
 if(id!=='hobby'&&!id.startsWith('hobby:'))return;
 const interests=state.player.interests;
 if(interests!=null&&(typeof interests!=='object'||Array.isArray(interests)))
  throw new TypeError('Geçersiz ilgi alanları kaydı.');
 for(const score of Object.values(interests??{}))assertScore(score,'ilgi puanı');
 if(id==='hobby'&&Object.keys(interests??{}).length===0){
  const traits=state.player.personality;
  if(!traits||typeof traits!=='object'||Array.isArray(traits))
   throw new TypeError('Geçersiz kişilik kaydı.');
  if(traits.curiosity!=null)assertScore(traits.curiosity,'merak puanı');
 }
}
// A broken RNG counter otherwise throws on its first draw, potentially
// after a social trait update or budget repayment. Check required methods for
// the branch that will run; legacy deterministic stubs need not expose state.
function assertActivityRng(state,id,rng){
 if(rng?.state!==undefined&&(!Number.isSafeInteger(rng.state)||rng.state<0))
  throw new TypeError('Geçersiz rastgele sayı sayacı.');
 const needsInt=['study','course','exercise','work-hard','date'].includes(id)||
  (id==='hobby'&&(Object.keys(state.player.interests??{}).length>0))||
  (id.startsWith('hobby:'));
 if(needsInt&&typeof rng?.int!=='function')
  throw new TypeError('Geçersiz rastgele sayı üreticisi: int.');
 if(id==='socialize'&&(state.social?.friends??[]).some(f=>f.alive!==false)&&
    typeof rng?.pick!=='function')
  throw new TypeError('Geçersiz rastgele sayı üreticisi: pick.');
 if(id==='exercise'&&(state.activityMemory?.exercise?.streak??0)>=5&&
    typeof rng?.chance!=='function')
  throw new TypeError('Geçersiz rastgele sayı üreticisi: chance.');
}
function activityMemory(state,id){
 state.activityMemory??={};
 state.activityMemory[id]??={uses:0,lastAge:null,streak:0};
 const memory=state.activityMemory[id];
 memory.uses??=0;
 memory.streak??=0;
 memory.lastAge??=null;
 return memory;
}
function repeatEfficiency(state,id){
 const m=activityMemory(state,id);
 if(m.lastAge===state.player.age)return .55;
 if(m.lastAge===state.player.age-1&&m.streak>=3)return .78;
 return 1;
}
function recordUse(state,id){
 const m=activityMemory(state,id);
 m.streak=m.lastAge===state.player.age-1?m.streak+1:1;
 m.lastAge=state.player.age;
 m.uses+=1;
}
export function availableActivities(state){
 if(state.player?.alive===false)return [];
 return ACTIVITY_DEFS.filter(a=>{
  if(state.player.age<a.minAge|| (a.condition&&!a.condition(state)))return false;
  // Do not offer actions that their direct API would reject as malformed.
  try{
   assertActivityMemory(state,a.id);
   assertSocialActivity(state,a.id);
   assertHealthActivity(state,a.id);
   assertMentalHealthActivity(state,a.id);
   assertPhysicalActivity(state,a.id);
   assertLearningActivity(state,a.id);
   assertHobbyActivity(state,a.id);
  }catch{return false;}
  if(a.id==='checkup'){
   const profile=state.healthProfile;
   if(profile!=null&&(typeof profile!=='object'||Array.isArray(profile)))return false;
   const last=profile?.lastCheckupAge;
   if(last!=null&&(!Number.isSafeInteger(last)||last<0||last>state.player.age||state.player.age-last<2))return false;
   if(profile?.stress!=null&&(typeof profile.stress!=='number'||!Number.isFinite(profile.stress)||profile.stress<0||profile.stress>100))return false;
  }
  if(state.activityMemory?.[a.id]?.lastAge===state.player.age)return false;
  return true;
 });
}

export function performActivity(state,id,rng){
 if(state.player?.alive===false)throw new Error('Hayat sona erdi; artık aktivite yapılamaz.');
 if(typeof id!=='string')throw new Error('Bilinmeyen aktivite.');
 const hobbyName=id.startsWith('hobby:')?id.slice(6):null;
 const activityId=hobbyName!=null?'hobby':id;
 if(hobbyName!=null&&!HOBBIES.includes(hobbyName))throw new Error('Bilinmeyen hobi.');
 // An absent ledger is supported for legacy states (three default actions).
 // An explicitly present but malformed ledger must never be spent or repaired
 // implicitly, as that can corrupt the action economy or turn it into NaN.
 if(state.actions!==undefined&&
    (!Number.isSafeInteger(state.actions?.remaining)||state.actions.remaining<=0))
  throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 const def=ACTIVITY_DEFS.find(a=>a.id===activityId);
 if(!def||state.player.age<def.minAge||(def.condition&&!def.condition(state)))throw new Error('Bu aktivite şu anda kullanılamıyor.');
 assertActivityMemory(state,activityId);
 assertSocialActivity(state,id);
 assertHealthActivity(state,id);
 assertMentalHealthActivity(state,id);
 assertPhysicalActivity(state,id);
 assertLearningActivity(state,id);
 assertHobbyActivity(state,id);
 assertActivityRng(state,id,rng);
 if(state.activityMemory?.[activityId]?.lastAge===state.player.age)throw new Error('Bu aktiviteyi bu yıl zaten yaptın.');
 // Enforce the same two-year medical cooldown on direct API calls as on
 // availableActivities; otherwise callers can skip the menu restriction.
 if(id==='checkup'&&state.healthProfile?.lastCheckupAge!=null&&
    state.player.age-state.healthProfile.lastCheckupAge<2)
  throw new Error('Bu aktivite şu anda kullanılamıyor.');
 // A failed repayment must not consume an action or change stress/memory.
 const budgetPaid=id==='budget'?repayBudgetDebt(state):0;
 state.actions??={remaining:3,max:3};
 let result='';
 const repeat=repeatEfficiency(state,activityId);

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
  const efficiency=activityEfficiency(state);
  const healthGain=Math.max(0,Math.round(rng.int(1,3)*efficiency*repeat));
  const fitnessGain=Math.max(1,Math.round(rng.int(2,5)*efficiency*repeat));
  state.player.health.current=clamp(state.player.health.current+healthGain);
  state.player.appearance.build=clamp(state.player.appearance.build+Math.round(rng.int(0,2)*efficiency));
  if(state.healthProfile)state.healthProfile.fitness=clamp((state.healthProfile.fitness??50)+fitnessGain);
  if(activityMemory(state,'exercise').streak>=5&&rng.chance(.08)){
   state.player.health.current=clamp(state.player.health.current-2);
   result='Düzenli egzersiz sırasında küçük bir zorlanma yaşadın.';
  }else result=capacityBand(state)==='critical'
   ?'Hafif egzersiz yapabildin; fiziksel durumun yoğun antrenmanı sınırladı.'
   :'Egzersiz yaptın ve fiziksel durumuna yatırım yaptın.';
 }
 if(id==='socialize'){
  state.social??={friends:[]};
  state.player.personality.sociability=growTrait(state.player.personality.sociability,2);
  const livingFriends=(state.social.friends??[]).filter(f=>f.alive!==false);
  if(livingFriends.length){
   const f=rng.pick(livingFriends);
   f.relationship=clamp(f.relationship+7);
   f.lastContactAge=state.player.age;
   f.closeFriend=Boolean((f.closeFriend&&f.relationship>=55)||(f.relationship>=78&&(f.yearsKnown??0)>=4));
   result=f.name+' ile vakit geçirdin.';
  } else result='İnsanlarla vakit geçirip daha sosyal olmaya çalıştın.';
 }
 if(activityId==='hobby'){
  const interests=Object.entries(state.player.interests??{}).sort((a,b)=>b[1]-a[1]);
  const name=hobbyName??interests[0]?.[0]??null;
  if(name){
   state.player.interests??={};
   state.player.interests[name]=clamp((state.player.interests[name]??0)+rng.int(3,6));
   result=name+' hobinle ilgilendin.';
  }else{
   state.player.personality.curiosity=growTrait(state.player.personality.curiosity,2);
   result='Yeni uğraşlar keşfetmeye çalıştın.';
  }
 }
 if(id==='work-hard'){
  const efficiency=activityEfficiency(state);
  state.career.performance=clamp(state.career.performance+Math.max(1,Math.round(rng.int(3,6)*efficiency*repeat)));
  state.career.satisfaction=clamp((state.career.satisfaction??50)-rng.int(0,2));
  const m=activityMemory(state,'work-hard');
  if(m.streak>=4){
   state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
   state.healthProfile.stress=clamp((state.healthProfile.stress??20)+5);
   state.career.satisfaction=clamp((state.career.satisfaction??50)-3);
  }
  if(efficiency<.7){
   state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
   state.healthProfile.stress=clamp((state.healthProfile.stress??20)+3);
   result='Fiziksel durumuna rağmen işe ekstra yüklendin; verimin sınırlı kaldı ve stresin arttı.';
  }else result='İşine ekstra emek verdin.';
 }
 if(id==='date'){
  state.social.romance.relationship=clamp(state.social.romance.relationship+rng.int(3,5));
  state.social.romance.relationshipTension=clamp((state.social.romance.relationshipTension??10)-rng.int(4,8));
  state.social.romance.lastQualityTimeAge=state.player.age;
  result=state.social.romance.name+' ile kaliteli zaman geçirdin.';
 }
 if(id==='checkup'){
  state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  state.healthProfile.lastCheckupAge=state.player.age;
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)-4);
  result='Sağlık kontrolünden geçtin.';
 }
 if(id==='therapy'){
  state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)-7);
  result='Profesyonel psikolojik destek aldın.';
 }
 if(id==='budget'){
  state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)-2);
  result=budgetPaid>0
   ?'Bütçeni düzenleyip borcunun bir kısmını kapattın.'
   :'Bütçeni gözden geçirip finansal planını güncelledin.';
 }

 recordUse(state,activityId);
 applyMentalHealthActivity(state,activityId);
 state.actions.remaining-=1;
 return result;
}
