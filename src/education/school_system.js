const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

const SCHOOL_PREFIXES=['Atatürk','Cumhuriyet','Mevlana','Yunus Emre','Barış','Güneş','Yenişehir','Şehitler'];

function schoolQualityFromHousehold(state,rng){
 const classBase={düşük:42,orta:56,'üst-orta':68,yüksek:78}[state.household.economicClass]??52;
 const support=(state.household.educationSupport-50)*0.18;
 return clamp(Math.round(classBase+support+rng.int(-9,9)),25,95);
}

export function enrollPrimarySchool(state,rng,attitude='neutral'){
 const quality=schoolQualityFromHousehold(state,rng);
 const attitudeBonus=attitude==='embrace'?8:-4;
 const performance=clamp(Math.round(35+state.player.personality.curiosity*0.22+state.player.personality.discipline*0.12+state.household.educationSupport*0.18+quality*0.12+attitudeBonus));
 state.education={
  enrolled:true,
  stage:'primary',
  schoolName:`${rng.pick(SCHOOL_PREFIXES)} İlkokulu`,
  quality,
  performance,
  motivation:attitude==='embrace'?72:48,
  attendance:95
 };
}
