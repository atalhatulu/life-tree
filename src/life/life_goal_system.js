import {annualYearStatus} from '../core/annual_clock.js';
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

// Goal selection is a direct API, not only a UI action. Corrupted legacy
// ledgers must be rejected before history is appended or defaults are created.
function isRecord(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function assertGoalSelectionLedger(state){
 const ledger=state.lifeGoals;
 if(ledger==null)return;
 if(!isRecord(ledger))throw new TypeError('Geçersiz yaşam hedefi kaydı.');
 for(const key of ['completed','history']){
  if(ledger[key]!=null&&!Array.isArray(ledger[key]))
   throw new TypeError('Geçersiz yaşam hedefi listesi: '+key);
 }
 if(ledger.completed?.some(id=>typeof id!=='string'||!LIFE_GOALS.some(g=>g.id===id)))
  throw new TypeError('Geçersiz tamamlanmış yaşam hedefi.');
 if(ledger.history?.some(entry=>!isRecord(entry)))
  throw new TypeError('Geçersiz yaşam hedefi geçmişi.');
 if(ledger.active!=null&&(!isRecord(ledger.active)||
    typeof ledger.active.id!=='string'||!LIFE_GOALS.some(g=>g.id===ledger.active.id)))
  throw new TypeError('Geçersiz aktif yaşam hedefi.');
}
export function availableLifeGoals(state){
 // Menus are read-only even for malformed or partially migrated saves.
 if(!Number.isSafeInteger(state.player?.age)||state.player.age<0)return [];
 try{assertGoalSelectionLedger(state);}catch{return [];}
 const completed=state.lifeGoals?.completed??[];
 return LIFE_GOALS.filter(g=>state.player.age>=g.minAge&&!completed.includes(g.id));
}

export function setLifeGoal(state,id){
 // Check the requested goal and ledger independently: invalid choices must
 // never create a missing ledger, and a valid choice cannot mutate bad data.
 const def=LIFE_GOALS.find(g=>g.id===id);
 if(!def||!Number.isSafeInteger(state.player?.age)||state.player.age<def.minAge)
  throw new Error('Bu yaşam hedefi şu anda kullanılamıyor.');
 assertGoalSelectionLedger(state);
 if(state.lifeGoals?.completed?.includes(id))
  throw new Error('Bu yaşam hedefi şu anda kullanılamıyor.');
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
  if(state.social?.romance&&state.social.romance.alive!==false)values.push(state.social.romance.relationship??50,state.social.romance.trust??50);
  for(const child of state.children??[]){
   if(child.alive===false)continue;
   values.push(child.relationship??60,child.development?.parentAttachment??60);
  }
  const parents=[state.parents?.mother,state.parents?.father].filter(p=>p&&p.alive!==false);
  for(const p of parents)values.push(state.player.relationships?.[p.id]??p.relationship??60);
  return values.length?clamp(values.reduce((a,b)=>a+b,0)/values.length):45;
 }
 if(id==='wellbeing'){
  return clamp((state.player.health?.current??60)*.38+(state.healthProfile?.fitness??50)*.27+(100-(state.healthProfile?.stress??30))*.22+(100-(state.mentalHealth?.strain??20))*.13);
 }
 if(id==='social-circle'){
  const friends=(state.social?.friends??[]).filter(f=>f.alive!==false);
  const close=friends.filter(f=>f.closeFriend).length;
  const avg=friends.length?friends.reduce((s,f)=>s+(f.relationship??50),0)/friends.length:20;
  return clamp(avg*.65+Math.min(50,close*14+friends.length*5));
 }
 return 0;
}

// The focus action must be all-or-nothing even for manually altered or
// partially migrated saves. Reuse this check when offering the action.
export function validLifeGoalFocus(state){
 const active=state.lifeGoals?.active;
 if(!active||!Number.isSafeInteger(state.player?.age)||state.player.age<0)return false;
 if(typeof active.progress!=='number'||!Number.isFinite(active.progress)||
    active.progress<0||active.progress>100)return false;
 if(active.focusYears!=null&&(!Number.isSafeInteger(active.focusYears)||
    active.focusYears<0||active.focusYears===Number.MAX_SAFE_INTEGER))return false;
 if(active.lastFocusedAge!=null&&(!Number.isSafeInteger(active.lastFocusedAge)||
    active.lastFocusedAge<0||active.lastFocusedAge>state.player.age))return false;
 return true;
}

export function focusLifeGoal(state){
 // Validate before creating legacy goal defaults: a rejected action is a no-op.
 const active=state.lifeGoals?.active;
 if(!active)throw new Error('Önce bir yaşam hedefi seçmelisin.');
 if(!validLifeGoalFocus(state))throw new TypeError('Geçersiz yaşam hedefi ilerlemesi.');
 if(!Number.isSafeInteger(state.actions?.remaining)||state.actions.remaining<=0)
  throw new Error('Bu yıl için aksiyon hakkın kalmadı.');
 if(active.lastFocusedAge!=null&&state.player.age-active.lastFocusedAge<2)throw new Error('Bu hedefe yakın zamanda zaten özel olarak odaklandın.');
 active.lastFocusedAge=state.player.age;
 active.focusYears=(active.focusYears??0)+1;
 active.progress=clamp((active.progress??0)+1);
 state.actions.remaining-=1;
 return active.label+' hedefin için bilinçli bir adım attın.';
}

// Annual goal scoring reads many optional subledgers. Validate the fields
// for the selected goal before writing progress or annual replay markers.
function assertGoalScoreInputs(state,id){
 const numeric=(value,label)=>{
  if(value!=null&&(typeof value!=='number'||!Number.isFinite(value)))
   throw new TypeError('Geçersiz yaşam hedefi girdisi: '+label);
 };
 const record=(value,label)=>{
  if(value!=null&&!isRecord(value))throw new TypeError('Geçersiz yaşam hedefi girdisi: '+label);
 };
 const fields=(value,keys,label)=>{
  record(value,label);
  if(value!=null)for(const key of keys)numeric(value[key],label+'.'+key);
 };
 if(id==='financial-security'){
  fields(state.finance,['cash','savings','debt'],'finans');
  fields(state.career,['monthlyIncome'],'kariyer');
  fields(state.retirement,['pensionMonthly'],'emeklilik');
 }else if(id==='career-mastery'){
  fields(state.career,['performance','satisfaction','level'],'kariyer');
  fields(state.careerProfile,['totalExperience'],'kariyer profili');
 }else if(id==='family-bond'){
  record(state.social,'sosyal');
  fields(state.social?.romance,['relationship','trust'],'partner');
  if(state.children!=null&&!Array.isArray(state.children))
   throw new TypeError('Geçersiz yaşam hedefi girdisi: çocuklar');
  for(const child of state.children??[]){
   record(child,'çocuk');
   if(child==null)throw new TypeError('Geçersiz yaşam hedefi girdisi: çocuk');
   if(child.alive!==false){
    numeric(child.relationship,'çocuk ilişkisi');
    fields(child.development,['parentAttachment'],'çocuk gelişimi');
   }
  }
  record(state.parents,'ebeveynler');
  for(const parent of [state.parents?.mother,state.parents?.father]){
   record(parent,'ebeveyn');
   if(parent!=null&&parent.alive!==false){
    numeric(parent.relationship,'ebeveyn ilişkisi');
    record(state.player.relationships,'ilişkiler');
    numeric(state.player.relationships?.[parent.id],'ebeveyn ilişki kaydı');
   }
  }
 }else if(id==='wellbeing'){
  fields(state.player.health,['current'],'sağlık');
  fields(state.healthProfile,['fitness','stress'],'sağlık profili');
  fields(state.mentalHealth,['strain'],'ruh sağlığı');
 }else if(id==='social-circle'){
  record(state.social,'sosyal');
  if(state.social?.friends!=null&&!Array.isArray(state.social.friends))
   throw new TypeError('Geçersiz yaşam hedefi girdisi: arkadaşlar');
  for(const friend of state.social?.friends??[]){
   record(friend,'arkadaş');
   if(friend==null)throw new TypeError('Geçersiz yaşam hedefi girdisi: arkadaş');
   if(friend.alive!==false)numeric(friend.relationship,'arkadaş ilişkisi');
  }
 }else throw new TypeError('Geçersiz yaşam hedefi kimliği.');
}

export function processLifeGoalsYear(state){
 const entries=[];
 // No active goal is a no-op, including for legacy saves without a goal ledger.
 if(!state.lifeGoals?.active)return entries;
 const active=state.lifeGoals.active;
 const {calendarYear,replayed}=annualYearStatus(state.year,active.lastProcessedYear,'life goals');
 if(replayed)return entries;
 if(!isRecord(active)||!LIFE_GOALS.some(goal=>goal.id===active.id)||
    (active.progress!=null&&(typeof active.progress!=='number'||
      !Number.isFinite(active.progress)||active.progress<0||active.progress>100))||
    !Number.isSafeInteger(state.player?.age)||state.player.age<0||
    (active.startedAtAge!=null&&(!Number.isSafeInteger(active.startedAtAge)||
      active.startedAtAge<0||active.startedAtAge>state.player.age)))
  throw new TypeError('Geçersiz yaşam hedefi ilerlemesi.');
 assertGoalSelectionLedger(state);
 assertGoalScoreInputs(state,active.id);
 const goals=ensureLifeGoals(state);
 const score=scoreGoal(state,active.id);
 const focused=active.lastFocusedAge===state.player.age-1;
 active.progress=clamp(Math.round((active.progress??0)*.76+score*.24+(focused?4:0)));
 if(calendarYear!==null)active.lastProcessedYear=calendarYear;
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
