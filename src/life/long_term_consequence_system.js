const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function hasMilestone(node,years){return (node.longTermMilestones??[]).includes(years);}
function mark(node,years){node.longTermMilestones??=[];node.longTermMilestones.push(years);}

function applyCareer(state,node,years){
 if(!state.career?.employed)return null;
 if(years===5){
  state.career.satisfaction=clamp((state.career.satisfaction??50)+2);
  return 'Beş yıl önceki kariyer kararın artık mesleki yönünün kalıcı bir parçası oldu.';
 }
 if(years===10){
  state.career.stability=clamp((state.career.stability??50)+4);
  return 'On yıl önceki kariyer kararının etkisi iş güvenliği ve deneyiminde belirginleşti.';
 }
 if(years===20){
  state.career.satisfaction=clamp((state.career.satisfaction??50)+3);
  return 'Yirmi yıl önce verdiğin kariyer kararı, hayat hikâyenin ana eksenlerinden biri haline geldi.';
 }
}

function applyRelationship(state,node,years){
 const r=state.social?.romance;
 if(!r)return null;
 if(years===5){r.trust=clamp((r.trust??60)+2);return 'Beş yıl önceki ilişki kararının etkisi güven ve ortak geçmişinizde birikti.';}
 if(years===10){r.sharedGoals=clamp((r.sharedGoals??60)+4);return 'On yıl önceki ilişki kararın ortak yaşamınızın yönünü hâlâ belirliyor.';}
 if(years===20){r.intimacy=clamp((r.intimacy??60)+3);return 'Yirmi yıl önceki ilişki kararın artık birlikte kurduğunuz hayatın temel parçalarından biri.';}
}

function applyFamily(state,node,years){
 if(!state.children?.length)return null;
 const delta=years===5?1:years===10?2:3;
 for(const child of state.children)child.relationship=clamp((child.relationship??60)+delta);
 return years+' yıl önceki aile kararının etkisi çocuklarınla kurduğun bağda yaşamaya devam ediyor.';
}

function applyMigration(state,node,years){
 if(!state.location)return null;
 if(years===5)return 'Beş yıl önceki taşınma kararın artık yeni çevrenin doğal bir parçası haline geldi.';
 if(years===10)return 'On yıl önceki taşınma kararının kariyer, sosyal çevre ve yaşam düzenindeki etkileri kalıcılaştı.';
 if(years===20)return 'Yirmi yıl önceki taşınma kararın yaşam öykünün coğrafi dönüm noktalarından biri oldu.';
}

function resolve(state,node,years){
 const category=node.pacingCategory??null;
 if(category==='career')return applyCareer(state,node,years);
 if(category==='relationship')return applyRelationship(state,node,years);
 if(category==='family')return applyFamily(state,node,years);
 if(category==='migration')return applyMigration(state,node,years);
 if(years===10)return 'On yıl önce verdiğin “'+node.label+'” kararı bugün hâlâ yaşam çizginde görülebiliyor.';
 return null;
}

export function processLongTermConsequences(state){
 const entries=[];
 for(const node of state.lifeTree?.nodes??[]){
  const elapsed=state.player.age-node.age;
  for(const years of [5,10,20]){
   if(elapsed!==years||hasMilestone(node,years))continue;
   const text=resolve(state,node,years);
   mark(node,years);
   if(text)entries.push({age:state.player.age,kind:'long-term-consequence',paceBlock:years>=10,text});
  }
 }
 return entries;
}
