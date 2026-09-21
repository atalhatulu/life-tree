import {SCHOOL_PREFIXES} from '../data/countries/turkey/education.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));


function schoolQualityFromHousehold(state,rng){
 const classBase={düşük:42,orta:56,'üst-orta':68,yüksek:78}[state.household.economicClass]??52;
 const support=(state.household.educationSupport-50)*0.18;
 return clamp(Math.round(classBase+support+rng.int(-9,9)),25,95);
}

export function enrollPrimarySchool(state,rng,attitude='neutral'){
 const quality=schoolQualityFromHousehold(state,rng);
 const aptitude=clamp(Math.round(
  state.player.personality.curiosity*.48+
  state.player.personality.discipline*.18+
  state.player.health.constitution*.14+
  rng.int(8,28)
 ));
 const motivation=attitude==='embrace'?72:48;
 const performance=clamp(Math.round(
  aptitude*.32+
  state.player.personality.discipline*.16+
  state.household.educationSupport*.18+
  quality*.14+
  motivation*.12+
  state.player.health.current*.08
 ));
 state.education={
  enrolled:true,
  stage:'primary',
  schoolName:`${rng.pick(SCHOOL_PREFIXES)} İlkokulu`,
  cityId:state.location?.cityId??state.origin?.cityId,
  cityName:state.location?.cityName??state.origin?.cityName,
  quality,
  aptitude,
  performance,
  motivation,
  attendance:95,
  studyEffort:0
 };
}
