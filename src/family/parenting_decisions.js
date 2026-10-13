const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const UPBRINGING_STYLES=new Set(['supportive','strict','free']);
const EDUCATION_PLANS=new Set(['university','vocational','independent']);

// Keep the event menu and direct decision API in sync. Reject coerced strings.
export function canFundChildUniversity(state){
 const atLeast=(value,threshold)=>typeof value==='number'&&Number.isFinite(value)&&value>=threshold;
 return atLeast(state.finance?.cash,150000)||atLeast(state.career?.monthlyIncome,60000)||
  atLeast(state.retirement?.pensionMonthly,45000);
}

// Reject malformed nested values before committing a one-time decision.
// Legacy missing parenting ledgers are still initialized on valid choices.
function assertChildDecisionFields(child,personalityFields,parentingFields=[]){
 const personality=child.personality;
 if(!personality||typeof personality!=='object'||Array.isArray(personality))
  throw new TypeError('Geçersiz çocuk kişilik kaydı.');
 for(const field of personalityFields){
  if(typeof personality[field]!=='number'||!Number.isFinite(personality[field]))
   throw new TypeError('Geçersiz çocuk kişilik değeri: '+field);
 }
 const parenting=child.parenting;
 if(parenting!=null){
  if(typeof parenting!=='object'||Array.isArray(parenting))
   throw new TypeError('Geçersiz ebeveynlik kaydı.');
  for(const field of parentingFields){
   // Accumulated support is optional in older saves, unlike style counters.
   if(field==='accumulatedSupport'&&parenting[field]==null)continue;
   if(typeof parenting[field]!=='number'||!Number.isFinite(parenting[field]))
    throw new TypeError('Geçersiz ebeveynlik değeri: '+field);
  }
 }
 if(child.relationship!=null&&(typeof child.relationship!=='number'||!Number.isFinite(child.relationship)))
  throw new TypeError('Geçersiz çocuk ilişki değeri.');
}

export function pendingYoungChild(state){
 return (state.children??[]).find(c=>c.alive!==false&&c.age>=3&&c.age<=7&&!c.upbringingStyle)??null;
}

export function setUpbringingStyle(state,childId,style){
 const child=(state.children??[]).find(c=>c.id===childId);
 if(!child||child.alive===false)throw new Error('Çocuk bulunamadı.');
 if(!UPBRINGING_STYLES.has(style))throw new RangeError('Geçersiz ebeveynlik yaklaşımı.');
 // A one-time parenting decision must not grant the initial bonus again.
 if(child.upbringingStyle===style)return child;
 if(child.upbringingStyle)throw new Error('Ebeveynlik yaklaşımı zaten seçildi.');
 // The event offers this one-time decision only for children aged 3–7.
 if(!Number.isSafeInteger(child.age)||child.age<3||child.age>7)
  throw new Error('Bu yaşta ebeveynlik yaklaşımı seçimi kullanılamıyor.');
 const requiredPersonality=style==='supportive'?['curiosity','sociability']
  :style==='strict'?['discipline','patience']:['curiosity','discipline'];
 const requiredParenting=style==='supportive'?['involvement','emotionalSecurity']
  :style==='strict'?['involvement','conflict']:['conflict'];
 assertChildDecisionFields(child,requiredPersonality,requiredParenting);
 child.upbringingStyle=style;
 child.parenting??={involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0};
 if(style==='supportive'){
  child.relationship=clamp((child.relationship??70)+6);
  child.personality.curiosity=clamp(child.personality.curiosity+5);
  child.personality.sociability=clamp(child.personality.sociability+3);
  child.parenting.involvement=clamp(child.parenting.involvement+8);
  child.parenting.emotionalSecurity=clamp(child.parenting.emotionalSecurity+6);
 }
 if(style==='strict'){
  child.relationship=clamp((child.relationship??70)-3);
  child.personality.discipline=clamp(child.personality.discipline+8);
  child.personality.patience=clamp(child.personality.patience+2);
  child.parenting.involvement=clamp(child.parenting.involvement+6);
  child.parenting.conflict=clamp(child.parenting.conflict+7);
 }
 if(style==='free'){
  child.relationship=clamp((child.relationship??70)+3);
  child.personality.curiosity=clamp(child.personality.curiosity+7);
  child.personality.discipline=clamp(child.personality.discipline-3);
  child.parenting.conflict=clamp(child.parenting.conflict-2);
 }
 return child;
}

export function pendingTeenEducation(state){
 return (state.children??[]).find(c=>c.alive!==false&&c.age>=16&&c.age<=18&&!c.educationPlan)??null;
}

export function setChildEducationPlan(state,childId,plan){
 const child=(state.children??[]).find(c=>c.id===childId);
 if(!child||child.alive===false)throw new Error('Çocuk bulunamadı.');
 if(!EDUCATION_PLANS.has(plan))throw new RangeError('Geçersiz eğitim planı.');
 // Preserve the first choice, including choices loaded from older saves.
 if(child.educationPlan===plan)return child;
 if(child.educationPlan)throw new Error('Eğitim planı zaten seçildi.');
 // Direct API calls must respect the same 16–18 age window as the event.
 if(!Number.isSafeInteger(child.age)||child.age<16||child.age>18)
  throw new Error('Bu yaşta eğitim planı seçimi kullanılamıyor.');
 const requiredPersonality=plan==='university'?['ambition']
  :plan==='vocational'?['discipline']:['sociability'];
 assertChildDecisionFields(child,requiredPersonality,['accumulatedSupport']);
 if(plan==='university'&&!canFundChildUniversity(state))
  throw new Error('Üniversite desteği için yeterli maddi kaynak bulunmuyor.');
 child.educationPlan=plan;
 child.parenting??={involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0};
 if(plan==='university'){
  child.educationSupport=85;
  child.personality.ambition=clamp(child.personality.ambition+6);
  child.parenting.accumulatedSupport=(child.parenting.accumulatedSupport??0)+8;
 }
 if(plan==='vocational'){
  child.educationSupport=55;
  child.personality.discipline=clamp(child.personality.discipline+5);
  child.parenting.accumulatedSupport=(child.parenting.accumulatedSupport??0)+5;
 }
 if(plan==='independent'){
  child.educationSupport=25;
  child.personality.sociability=clamp(child.personality.sociability+3);
  child.parenting.accumulatedSupport=(child.parenting.accumulatedSupport??0)+2;
 }
 return child;
}
