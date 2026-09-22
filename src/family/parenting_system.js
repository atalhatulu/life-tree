import {createChild} from './descendant_generator.js';
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureChildren(state){
 state.children??=[];
 return state.children;
}

export function parenthoodReadiness(state){
 const r=state.social?.romance;
 if(!r||!['cohabiting','married'].includes(r.status))return 0;
 const age=state.player.age;
 const playerDesire=state.preferences?.parenthoodDesire??50;
 const partnerDesire=r.preferences?.parenthoodDesire??50;
 const desire=(playerDesire+partnerDesire)/2;
 const relationship=r.relationship??50;
 const tension=r.relationshipTension??20;
 const income=(state.career?.monthlyIncome??state.retirement?.pensionMonthly??0)+(r.monthlyIncome??0)*.45;
 const liquid=(state.finance?.cash??0)+(state.finance?.savings??0);
 let score=desire*.42+relationship*.28-tension*.16;
 if(r.status==='married')score+=8;
 if(income>=70000)score+=8;
 else if(income>=40000)score+=4;
 if(liquid>=250000)score+=5;
 if(state.assets?.home||['owned','apartment','studio'].includes(state.finance?.lifestyle?.housing))score+=4;
 score-=(state.children?.length??0)*9;
 if(age>=40)score-=4;
 if(age>=44)score-=8;
 return clamp(Math.round(score));
}

function fertilityChance(state){
 const r=state.social?.romance;
 const olderAge=Math.max(state.player.age,r?.age??state.player.age);
 if(olderAge<=34)return .87;
 if(olderAge<=38)return .78;
 if(olderAge<=41)return .64;
 if(olderAge<=44)return .47;
 return .28;
}

export function addChild(state,rng){
 const children=ensureChildren(state);
 const child=createChild(state,rng,'child-'+state.year+'-'+children.length);
 child.parenting={
  involvement:55,
  stability:68,
  emotionalSecurity:72,
  conflict:8,
  accumulatedSupport:0
 };
 children.push(child);
 state.finance??={};
 state.finance.childMonthlyCost=(state.finance.childMonthlyCost??0)+6500;
 return child;
}

export function attemptChild(state,rng){
 const chance=fertilityChance(state);
 const success=rng.chance(chance);
 const child=success?addChild(state,rng.fork('new-child')):null;
 state.lastParenthoodAttempt={
  age:state.player.age,
  success,
  childId:child?.id??null,
  childName:child?.name??null,
  chance
 };
 return child;
}

export function processChildrenYear(state,rng){
 const entries=[];
 for(const child of ensureChildren(state)){
  child.age+=1;
  child.parenting??={involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0};
  const p=child.parenting;
  const style=child.upbringingStyle;
  const parentStress=state.healthProfile?.stress??20;
  const financialStress=(state.finance?.financialDistressYears??0)>0?1:0;
  const householdConflict=state.social?.romance?.relationshipState==='conflict'?1:0;
  const recentDivorce=state.lastDivorceAge!=null&&state.player.age-state.lastDivorceAge<=2;

  let relDelta=rng.fork('child-rel-'+child.id).int(-1,1);
  if(style==='supportive'){
   p.involvement=clamp(p.involvement+1);
   p.accumulatedSupport=(p.accumulatedSupport??0)+2;
   p.conflict=clamp(p.conflict-1);
   p.emotionalSecurity=clamp(p.emotionalSecurity+1);
   relDelta+=1;
   if(rng.fork('support-'+child.id).chance(.35))child.personality.curiosity=clamp(child.personality.curiosity+1);
  }else if(style==='strict'){
   p.involvement=clamp(p.involvement+1);
   p.accumulatedSupport=(p.accumulatedSupport??0)+1;
   p.conflict=clamp(p.conflict+1);
   child.personality.discipline=clamp(child.personality.discipline+(rng.fork('strict-'+child.id).chance(.45)?1:0));
   relDelta-=rng.fork('strict-rel-'+child.id).chance(.35)?1:0;
  }else if(style==='free'){
   p.involvement=clamp(p.involvement);
   p.accumulatedSupport=(p.accumulatedSupport??0)+1;
   p.conflict=clamp(p.conflict-1);
   if(rng.fork('free-'+child.id).chance(.4))child.personality.curiosity=clamp(child.personality.curiosity+1);
  }

  if(parentStress>=70){p.stability=clamp(p.stability-2);p.emotionalSecurity=clamp(p.emotionalSecurity-1);relDelta-=1;}
  else if(parentStress<=30){p.stability=clamp(p.stability+1);}
  if(financialStress){p.stability=clamp(p.stability-1);}
  if(householdConflict){p.conflict=clamp(p.conflict+2);p.emotionalSecurity=clamp(p.emotionalSecurity-2);relDelta-=1;}
  if(recentDivorce){p.emotionalSecurity=clamp(p.emotionalSecurity-2);p.conflict=clamp(p.conflict+1);}

  child.health.current=clamp(child.health.current+rng.fork('child-health-'+child.id).int(-2,2));
  child.relationship=clamp((child.relationship??70)+relDelta);
  if(child.age===6) entries.push({age:state.player.age,kind:'family',text:child.name+' okula başladı.'});
  if(child.age===18) entries.push({age:state.player.age,kind:'family',text:child.name+' yetişkinliğe adım attı.'});
 }
 if(state.finance){
  state.finance.childMonthlyCost=ensureChildren(state).reduce((sum,child)=>{
   if(child.age>=22)return sum;
   if(child.age>=18)return sum+(child.educationPlan==='university'?8500:child.educationPlan==='vocational'?4000:2500);
   if(child.age>=13)return sum+7500;
   return sum+6500;
  },0);
 }
 return entries;
}
