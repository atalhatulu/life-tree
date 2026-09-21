const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function pendingYoungChild(state){
 return (state.children??[]).find(c=>c.age>=3&&c.age<=7&&!c.upbringingStyle)??null;
}

export function setUpbringingStyle(state,childId,style){
 const child=(state.children??[]).find(c=>c.id===childId);
 if(!child)throw new Error('Çocuk bulunamadı.');
 child.upbringingStyle=style;
 if(style==='supportive'){
  child.relationship=clamp((child.relationship??70)+8);
  child.personality.curiosity=clamp(child.personality.curiosity+7);
  child.personality.sociability=clamp(child.personality.sociability+4);
 }
 if(style==='strict'){
  child.relationship=clamp((child.relationship??70)-4);
  child.personality.discipline=clamp(child.personality.discipline+10);
  child.personality.patience=clamp(child.personality.patience+3);
 }
 if(style==='free'){
  child.relationship=clamp((child.relationship??70)+3);
  child.personality.curiosity=clamp(child.personality.curiosity+9);
  child.personality.discipline=clamp(child.personality.discipline-4);
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
 if(plan==='university'){
  child.educationSupport=85;
  child.personality.ambition=clamp(child.personality.ambition+6);
 }
 if(plan==='vocational'){
  child.educationSupport=55;
  child.personality.discipline=clamp(child.personality.discipline+5);
 }
 if(plan==='independent'){
  child.educationSupport=25;
  child.personality.sociability=clamp(child.personality.sociability+3);
 }
 return child;
}
