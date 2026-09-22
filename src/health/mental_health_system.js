const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureMentalHealth(state){
 state.mentalHealth??={resilience:60,wellbeing:70,burnout:0,lowMoodYears:0};
 return state.mentalHealth;
}

export function processMentalHealthYear(state){
 const m=ensureMentalHealth(state);
 const stress=state.healthProfile?.stress??30;
 const connection=state.socialWellbeing?.connection??50;
 const careerSatisfaction=state.career?.employed?(state.career.satisfaction??50):45;
 const financialPressure=(state.finance?.debt??0)>3000000?18:(state.finance?.debt??0)>750000?8:0;
 const healthPressure=Math.max(0,55-(state.player?.health?.current??75))*.35;
 const support=(connection-50)*.18;
 const pressure=Math.max(0,stress-45)*.45+financialPressure+healthPressure-support;
 m.resilience=clamp(m.resilience+(connection>=70?1:0)-(stress>=75?2:0));
 m.burnout=clamp(m.burnout+pressure*.12+(careerSatisfaction<35?4:0)-(careerSatisfaction>=65?2:0)-m.resilience*.025);
 const target=clamp(88-pressure*.65+m.resilience*.18+(connection-50)*.12);
 m.wellbeing=clamp(Math.round(m.wellbeing+(target-m.wellbeing)*.28));
 m.lowMoodYears=m.wellbeing<38?m.lowMoodYears+1:Math.max(0,m.lowMoodYears-1);
 if(m.burnout>=70&&state.career?.employed){
  state.career.performance=clamp((state.career.performance??50)-3);
  state.career.satisfaction=clamp((state.career.satisfaction??50)-4);
 }
 return [];
}
