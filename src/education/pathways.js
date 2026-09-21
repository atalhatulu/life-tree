const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const talentScore=(state)=>{
 const p=state.player;
 const interests=p.interests??{};
 const creative=Math.max(interests.müzik??0,interests.resim??0,interests.dans??0,interests.fotoğraf??0);
 const sport=Math.max(interests.futbol??0,interests.koşu??0,p.appearance.build??0);
 return Math.max(creative,sport);
};

export function highSchoolOptions(state){
 const e=state.education;
 if(!e) return [];
 const academic=clamp(Math.round(e.performance*.48+e.motivation*.14+e.quality*.10+state.household.educationSupport*.12+state.player.personality.discipline*.16));
 const technicalInterest=Math.max(state.player.interests.teknoloji??0,state.player.interests.otomobil??0,state.player.interests.yemek??0);
 const vocational=clamp(Math.round(e.performance*.28+state.player.personality.discipline*.24+technicalInterest*.28+state.household.educationSupport*.08+e.motivation*.12));
 const talent=talentScore(state);
 const specialist=clamp(Math.round(talent*.48+e.performance*.16+state.household.hobbySupport*.18+state.player.personality.curiosity*.10+e.motivation*.08));
 return [
  {id:'academic',label:'Akademik lise',successChance:academic,available:true},
  {id:'vocational',label:'Mesleki ve teknik lise',successChance:vocational,available:true},
  {id:'specialist',label:'Yetenek odaklı lise',successChance:specialist,available:talent>=35}
 ];
}

export function enterMiddleSchool(state,rng){
 const e=state.education;
 if(!e?.enrolled||e.stage!=='primary') return false;
 e.stage='middle';
 e.schoolName=rng.pick(['Atatürk','Cumhuriyet','Yunus Emre','Mevlana','Şehitler','Güneş'])+' Ortaokulu';
 e.quality=clamp(e.quality+rng.int(-5,5),25,95);
 e.motivation=clamp(e.motivation+rng.int(-5,4));
 return true;
}

export function selectHighSchoolPath(state,rng,pathId){
 const option=highSchoolOptions(state).find(o=>o.id===pathId&&o.available);
 if(!option) throw new Error('Bu lise yolu şu anda kullanılamıyor.');
 const admitted=rng.int(1,100)<=option.successChance;
 const suffix={academic:'Anadolu Lisesi',vocational:'Mesleki ve Teknik Anadolu Lisesi',specialist:'Güzel Sanatlar ve Spor Lisesi'}[pathId];
 state.education.stage='high';
 state.education.path=pathId;
 state.education.pathLabel=option.label;
 state.education.admissionChance=option.successChance;
 state.education.admissionSucceeded=admitted;
 state.education.schoolName=admitted?rng.pick(['Atatürk','Cumhuriyet','Bilim','Gelecek','Mimar Sinan','Barış'])+' '+suffix:'Yerel Anadolu Lisesi';
 state.education.quality=clamp(state.education.quality+(admitted?rng.int(1,8):rng.int(-8,-1)),25,95);
 state.education.motivation=clamp(state.education.motivation+(admitted?5:-7));
 return {admitted,option};
}

export function graduationReadiness(state){
 const e=state.education;
 if(!e?.enrolled) return 0;
 return clamp(Math.round(e.performance*.44+e.motivation*.18+e.attendance*.12+state.player.personality.discipline*.14+state.household.educationSupport*.06+e.quality*.06));
}
