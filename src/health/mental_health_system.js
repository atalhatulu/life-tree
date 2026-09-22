const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureMentalHealth(state){
 state.mentalHealth??={
  resilience:clamp(Math.round(45+(state.player.health.constitution??60)*.25+(state.player.personality?.patience??50)*.20),20,90),
  strain:18,
  status:'stable',
  episodes:[],
  therapyYears:0,
  recoveryYears:0
 };
 return state.mentalHealth;
}

function recentLossCount(state){
 const year=state.year;
 const family=[
  state.parents?.mother,state.parents?.father,
  ...(state.siblings??[]),
  state.grandparents?.maternal?.grandmother,state.grandparents?.maternal?.grandfather,
  state.grandparents?.paternal?.grandmother,state.grandparents?.paternal?.grandfather
 ].filter(Boolean);
 const familyLosses=family.filter(p=>p.deathYear===year).length;
 const friendLosses=(state.social?.deceasedFriends??[]).filter(p=>p.deathYear===year).length;
 const partnerLosses=(state.social?.deceasedPartners??[]).filter(p=>p.deathYear===year).length;
 return familyLosses+friendLosses+partnerLosses;
}

function statusFromStrain(strain){
 if(strain>=78)return 'crisis';
 if(strain>=62)return 'distressed';
 if(strain>=42)return 'strained';
 return 'stable';
}

export function processMentalHealthYear(state,rng){
 const m=ensureMentalHealth(state);
 const entries=[];
 const stress=state.healthProfile?.stress??20;
 const debt=state.finance?.debt??0;
 const unemployed=state.player.age>=20&&!state.career?.employed&&!state.higherEducation?.enrolled&&!state.retirement?.retired;
 const relationship=state.social?.romance;
 const conflict=relationship?.relationshipState==='conflict';
 const isolation=(state.social?.friends?.length??0)===0;
 const losses=recentLossCount(state);
 const overwork=(state.activityMemory?.['work-hard']?.streak??0)>=4;

 let pressure=.55;
 pressure+=Math.max(0,stress-35)*.075;
 if(debt>500000)pressure+=1.1;
 if(debt>1500000)pressure+=1.5;
 if(debt>4000000)pressure+=1.8;
 if(unemployed)pressure+=2.6;
 if(conflict)pressure+=3.0;
 if(isolation)pressure+=1.35;
 if(overwork)pressure+=1.8;
 if(state.parentCare?.active)pressure+=1.25;
 if((state.finance?.financialDistressYears??0)>0)pressure+=1.1;
 if(state.lastDivorceAge===state.player.age)pressure+=7;
 if(state.widowedAtAge===state.player.age)pressure+=9;
 pressure+=losses*9;

 let recovery=.60+(m.resilience-50)*.015;
 if((state.healthProfile?.fitness??50)>=65)recovery+=.25;
 if((state.social?.friends?.length??0)>=2)recovery+=.25;
 if(relationship?.relationshipState==='stable')recovery+=.20;
 if(m.therapyYears>0)recovery+=.30;
 recovery=Math.max(.15,recovery);

 m.strain=clamp(m.strain+pressure-recovery+rng.int(-2,2));
 const before=m.status;
 m.status=statusFromStrain(m.strain);

 if(losses>0){
  m.episodes.push({type:'grief',age:state.player.age,year:state.year,severity:Math.min(3,losses)});
  entries.push({age:state.player.age,kind:'mental-health',text:'Yakın kaybının duygusal yükünü taşıyorsun.'});
 }
 if(before!==m.status&&m.status!=='stable'){
  m.episodes.push({type:m.status,age:state.player.age,year:state.year,severity:m.status==='crisis'?3:m.status==='distressed'?2:1});
  entries.push({age:state.player.age,kind:'mental-health',paceBlock:m.status==='crisis',text:'Ruhsal durumun '+m.status+' seviyesine geçti.'});
 }
 if(m.status==='stable')m.recoveryYears=(m.recoveryYears??0)+1;
 else m.recoveryYears=0;

 state.healthProfile.stress=clamp((state.healthProfile.stress??20)+(m.status==='crisis'?4:m.status==='distressed'?2:m.status==='strained'?1:-1));
 return entries;
}

export function applyMentalHealthActivity(state,id){
 const m=ensureMentalHealth(state);
 if(id==='exercise')m.strain=clamp(m.strain-1.5);
 if(id==='socialize')m.strain=clamp(m.strain-2);
 if(id==='hobby')m.strain=clamp(m.strain-1.5);
 if(id==='date')m.strain=clamp(m.strain-1.5);
 if(id==='therapy'){
  m.strain=clamp(m.strain-11);
  m.therapyYears=(m.therapyYears??0)+1;
  m.status=statusFromStrain(m.strain);
 }
 if(id==='work-hard'&&(state.activityMemory?.['work-hard']?.streak??0)>=3)m.strain=clamp(m.strain+2);
 return m;
}
