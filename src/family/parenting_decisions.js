const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function pendingYoungChild(state){
 return (state.children??[]).find(c=>c.age>=3&&c.age<=7&&!c.upbringingStyle)??null;
}

export function setUpbringingStyle(state,childId,style){
 const child=(state.children??[]).find(c=>c.id===childId);
 if(!child)throw new Error('Çocuk bulunamadı.');
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
 return (state.children??[]).find(c=>c.age>=16&&c.age<=18&&!c.educationPlan)??null;
}

export function setChildEducationPlan(state,childId,plan){
 const child=(state.children??[]).find(c=>c.id===childId);
 if(!child)throw new Error('Çocuk bulunamadı.');
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
