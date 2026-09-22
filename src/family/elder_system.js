import {addToTrustFund} from '../finance/trust_fund.js';
import {ensureGuardianship} from './guardianship_system.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function economicClass(income,people){
 const perCapita=income/Math.max(1,people);
 if(perCapita<18000)return 'düşük';
 if(perCapita<38000)return 'orta';
 if(perCapita<65000)return 'üst-orta';
 return 'yüksek';
}

function mortalityChance(person){
 if(!person.alive)return 0;
 const age=person.age;
 if(age<45)return .00035;
 if(age<55)return .001;
 const ageBase=(age-54)*.0022;
 const healthRisk=(100-(person.health?.current??70))*.00045;
 return Math.min(.28,ageBase+healthRisk);
}

function estateValue(person,rng){
 const income=Math.max(0,person.monthlyIncome??0);
 return Math.round(income*rng.int(5,14));
}

function parentInheritanceShare(state,person,amount){
 const survivingSpouse=person.id==='mother'?state.parents.father:state.parents.mother;
 const spouseShare=survivingSpouse?.alive?Math.round(amount*.40):0;
 const childPool=amount-spouseShare;
 const heirs=1+(state.siblings?.length??0);
 return Math.round(childPool/Math.max(1,heirs));
}

function grandparentInheritanceShare(state,person,amount){
 const maternal=person.id.startsWith('maternal');
 const parent=maternal?state.parents.mother:state.parents.father;
 if(parent?.alive)return 0;
 const heirs=1+(state.siblings?.length??0);
 return Math.round((amount*.45)/Math.max(1,heirs));
}

function updateHouseholdAfterParentDeath(state,person){
 if(person.id!=='mother'&&person.id!=='father')return;
 state.household.monthlyIncome=Math.max(0,state.household.monthlyIncome-(person.monthlyIncome??0));
 state.household.people=Math.max(1,(state.household.people??1)-1);
 state.household.economicClass=economicClass(state.household.monthlyIncome,state.household.people);
 state.household.educationSupport=Math.max(10,Math.round((state.household.educationSupport??50)*.88));
 state.household.hobbySupport=Math.max(10,Math.round((state.household.hobbySupport??50)*.90));
}

function routeInheritance(state,person,amount){
 if(amount<=0)return;
 const source={sourceId:person.id,sourceName:person.name};
 if(state.player.age<18){
  addToTrustFund(state,amount,source);
 }else{
  state.pendingInheritance??=[];
  state.pendingInheritance.push({...source,amount});
 }
}

function markDeath(state,person,relation,rng){
 person.alive=false;
 person.deathAge=person.age;
 person.deathYear=state.year;
 updateHouseholdAfterParentDeath(state,person);

 const gross=estateValue(person,rng);
 const share=person.id==='mother'||person.id==='father'
  ? parentInheritanceShare(state,person,gross)
  : grandparentInheritanceShare(state,person,gross);
 routeInheritance(state,person,share);

 const entry={
  age:state.player.age,
  kind:'family',
  paceBlock:true,
  text:relation+' '+person.name+' '+person.surname+' '+person.age+' yaşında hayatını kaybetti.'
 };
 return entry;
}

export function ensureParentCareState(state){
 state.parentCare??={active:false,parentId:null,mode:null,monthlyCost:0,startedAtAge:null,siblingShare:0};
 return state.parentCare;
}

function parentCareCandidate(state){
 return [state.parents?.mother,state.parents?.father]
  .filter(p=>p?.alive&&p.age>=68)
  .sort((a,b)=>(a.health?.current??70)-(b.health?.current??70))[0]??null;
}

export function evaluateParentCareNeed(state){
 const care=ensureParentCareState(state);
 if(state.player.age<28||care.active)return null;
 const parent=parentCareCandidate(state);
 if(!parent)return null;
 const health=parent.health?.current??70;
 if(parent.age<76&&health>=48)return null;
 care.pendingParentId=parent.id;
 care.pendingParentName=parent.name;
 return parent;
}

export function setParentCareMode(state,mode){
 const care=ensureParentCareState(state);
 const parent=[state.parents?.mother,state.parents?.father].find(p=>p?.id===(care.pendingParentId??care.parentId));
 if(!parent)throw new Error('Bakım gerektiren ebeveyn bulunamadı.');
 const adultSiblings=(state.siblings??[]).filter(s=>s.alive&&s.age>=22);
 const siblingShare=mode==='sibling-share'?Math.min(.65,adultSiblings.length*.18):0;
 const base={family:4500,'home-care':18000,facility:30000,'sibling-share':15000}[mode];
 if(base==null)throw new Error('Geçersiz ebeveyn bakım modu.');
 care.active=true;
 care.parentId=parent.id;
 care.parentName=parent.name;
 care.mode=mode;
 care.startedAtAge=state.player.age;
 care.siblingShare=siblingShare;
 care.monthlyCost=Math.round(base*(1-siblingShare));
 care.pendingParentId=null;
 care.pendingParentName=null;
 parent.careMode=mode;
 parent.careStartedAtYear=state.year;
 if(state.healthProfile){
  const stressDelta=mode==='family'?7:mode==='home-care'?3:mode==='facility'?2:4;
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)+stressDelta);
 }
 state.player.relationships??={};
 state.player.relationships[parent.id]=clamp((state.player.relationships[parent.id]??60)+(mode==='family'?7:mode==='sibling-share'?4:2));
 return care;
}

function processParentCareYear(state){
 const care=state.parentCare;
 if(!care?.active)return [];
 const parent=[state.parents?.mother,state.parents?.father].find(p=>p?.id===care.parentId);
 if(!parent?.alive){
  care.active=false;
  care.monthlyCost=0;
  care.endedAtAge=state.player.age;
  return [{age:state.player.age,kind:'family',text:'Ebeveyn bakım sorumluluğun sona erdi.'}];
 }
 if(state.healthProfile){
  const stress=care.mode==='family'?2:care.mode==='sibling-share'?1:0;
  state.healthProfile.stress=clamp((state.healthProfile.stress??20)+stress);
 }
 return [];
}

export function processElderFamilyYear(state,rng){
 const entries=[];
 evaluateParentCareNeed(state);
 const members=[
  [state.parents.mother,'Annen'],
  [state.parents.father,'Baban'],
  [state.grandparents.maternal.grandmother,'Anneannen'],
  [state.grandparents.maternal.grandfather,'Anne tarafından deden'],
  [state.grandparents.paternal.grandmother,'Babaannen'],
  [state.grandparents.paternal.grandfather,'Baba tarafından deden']
 ];

 for(const [person,relation] of members){
  if(!person?.alive)continue;
  person.health.current=clamp((person.health.current??70)-Math.max(0,person.age-60)*.08+rng.fork(person.id).int(-2,1));
  if(rng.fork('death-'+person.id).chance(mortalityChance(person))){
   entries.push(markDeath(state,person,relation,rng.fork('inheritance-'+person.id)));
  }
 }

 entries.push(...processParentCareYear(state));

 if(state.player.age<18&&!state.parents.mother.alive&&!state.parents.father.alive){
  const before=state.guardianship;
  const guardian=ensureGuardianship(state);
  if(guardian&&!before){
   entries.push({
    age:state.player.age,
    kind:'family',
    text:guardian.type==='family'
      ? guardian.relation+' '+guardian.guardianName+' vasin oldu.'
      : 'Aile içinde uygun bir vasi kalmadığı için koruyucu sisteme alındın.'
   });
  }
 }

 return entries;
}
