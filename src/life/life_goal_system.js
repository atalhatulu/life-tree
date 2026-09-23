const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export const LIFE_GOALS=[
 {id:'financial-security',label:'Finansal güvenlik',minAge:18},
 {id:'career-mastery',label:'Kariyerde ustalaşmak',minAge:18},
 {id:'family-bond',label:'Güçlü aile bağları',minAge:18},
 {id:'wellbeing',label:'Sağlıklı ve dengeli yaşam',minAge:16},
 {id:'social-circle',label:'Kalıcı sosyal çevre',minAge:16}
];

export function ensureLifeGoals(state){
 state.lifeGoals??={active:null,completed:[],history:[]};
 state.lifeGoals.completed??=[];
 state.lifeGoals.history??=[];
 return state.lifeGoals;
}

export function availableLifeGoals(state){
 const goals=ensureLifeGoals(state);
 return LIFE_GOALS.filter(g=>state.player.age>=g.minAge&&!goals.completed.includes(g.id));
}

export function setLifeGoal(state,id){
 const def=availableLifeGoals(state).find(g=>g.id===id);
 if(!def)throw new Error('Bu yaşam hedefi şu anda kullanılamıyor.');
 const goals=ensureLifeGoals(state);
 if(goals.active?.id===id)return goals.active;
 if(goals.active)goals.history.push({...goals.active,endedAtAge:state.player.age,status:'changed'});
 goals.active={id:def.id,label:def.label,startedAtAge:state.player.age,progress:0,lastFocusedAge:null};
 return goals.active;
}

function scoreGoal(state,id){
 if(id==='financial-security'){
  const finance=state.finance??{};
  const net=(finance.cash??0)+(finance.savings??0)-(finance.debt??0);
  const annual=Math.max(1,(state.career?.monthlyIncome??state.retirement?.pensionMonthly??0)*12);
  return clamp(45+Math.min(40,net/Math.max(annual,100000)*18)-(finance.debt??0)/Math.max(annual,100000)*10);
 }
 if(id==='career-mastery'){
  if(state.retirement?.retired)return 75;
  if(!state.career?.employed)return 15;
  return clamp((state.career.performance??50)*.42+(state.career.satisfaction??50)*.23+(state.career.level??1)*8+(state.careerProfile?.totalExperience??0)*1.2);
 }
 if(id==='family-bond'){
  const values=[];
  if(state.social?.romance)values.push(state.social.romance.relationship??50,state.social.romance.trust??50);
  for(const child of state.children??[])values.push(child.relationship??60,child.development?.parentAttachment??60);
  const parents=[state.parents?.mother,state.parents?.father].filter(Boolean);
  for(const p of parents)values.push(state.player.relationships?.[p.id]??p.relationship??60);
  return values.length?clamp(values.reduce((a,b)=>a+b,0)/values.length):45;
 }
 if(id==='wellbeing'){
  return clamp((state.player.health?.current??60)*.38+(state.healthProfile?.fitness??50)*.27+(100-(state.healthProfile?.stress??30))*.22+(100-(state.mentalHealth?.strain??20))*.13);
 }
 if(id==='social-circle'){
  const friends=state.social?.friends??[];
  const close=friends.filter(f=>f.closeFriend).length;
  const avg=friends.length?friends.reduce((s,f)=>s+(f.relationship??50),0)/friends.length:20;
  return clamp(avg*.65+Math.min(45,close*12+friends.length*3));
 }
 return 0;
}

export function focusLifeGoal(state){
 const goals=ensureLifeGoals(state);
 const active=goals.active;
 if(!active)throw new Error('Önce bir yaşam hedefi seçmelisin.');
 if(state.actions?.remaining<=0)throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 if(active.lastFocusedAge!=null&&state.player.age-active.lastFocusedAge<2)throw new Error('Bu hedefe yakın zamanda zaten özel olarak odaklandın.');
 active.lastFocusedAge=state.player.age;
 active.focusYears=(active.focusYears??0)+1;
 active.progress=clamp((active.progress??0)+1);
 state.actions.remaining-=1;
 return active.label+' hedefin için bilinçli bir adım attın.';
}

export function processLifeGoalsYear(state){
 const goals=ensureLifeGoals(state);
 const entries=[];
 if(!goals.active)return entries;
 const active=goals.active;
 const score=scoreGoal(state,active.id);
 const focused=active.lastFocusedAge===state.player.age-1;
 active.progress=clamp(Math.round((active.progress??0)*.76+score*.24+(focused?4:0)));
 if(active.progress>=88&&(state.player.age-active.startedAtAge)>=4){
  goals.completed.push(active.id);
  goals.history.push({...active,completedAtAge:state.player.age,status:'completed'});
  entries.push({age:state.player.age,kind:'life-goal',paceBlock:true,text:'Uzun vadeli hedefin gerçekleşti: '+active.label+'.'});
  goals.active=null;
 }else if(focused&&active.progress>=65){
  entries.push({age:state.player.age,kind:'life-goal',text:active.label+' hedefinde ilerlediğini somut biçimde hissetmeye başladın.'});
 }
 return entries;
}
