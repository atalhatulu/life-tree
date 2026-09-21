const EVENT_PACING={
 'career-switch':{category:'career',globalGap:2,categoryGap:4},
 'start-business':{category:'career',globalGap:2,categoryGap:5},
 'retirement-decision':{category:'career',globalGap:1,categoryGap:3},

 'relationship-commitment':{category:'relationship',globalGap:2,categoryGap:4},
 'marriage-after-cohabiting':{category:'relationship',globalGap:2,categoryGap:4},
 'child-decision':{category:'family',globalGap:2,categoryGap:4},
 'child-education-plan':{category:'family',globalGap:1,categoryGap:3},

 'move-out':{category:'housing',globalGap:2,categoryGap:4},
 'buy-car':{category:'asset',globalGap:2,categoryGap:5},
 'buy-home':{category:'asset',globalGap:2,categoryGap:6},

 'partner-job-relocation':{category:'migration',globalGap:2,categoryGap:4},
 'return-to-hometown':{category:'migration',globalGap:2,categoryGap:6}
};

const ALWAYS_URGENT=new Set([
 'school-start',
 'high-school-path',
 'after-high-school',
 'university-application',
 'first-job',
 'gap-year-direction',
 'health-treatment'
]);

export function pacingRule(event){
 return EVENT_PACING[event?.id]??null;
}

export function inferPacingCategory(eventId){
 return EVENT_PACING[eventId]?.category??null;
}

function lastMajorNode(state){
 const nodes=state.lifeTree?.nodes??[];
 return nodes.length?nodes[nodes.length-1]:null;
}

function lastCategoryAge(state,category){
 const nodes=state.lifeTree?.nodes??[];
 for(let i=nodes.length-1;i>=0;i--){
  const node=nodes[i];
  const nodeCategory=node.pacingCategory??inferPacingCategory(node.eventId);
  if(nodeCategory===category)return node.age;
 }
 return null;
}

export function canPresentPacedEvent(state,event){
 if(ALWAYS_URGENT.has(event?.id))return true;
 const rule=pacingRule(event);
 if(!rule)return true;
 if(state.player.age<21)return true;

 const latest=lastMajorNode(state);
 if(latest&&state.player.age-latest.age<rule.globalGap)return false;

 const categoryAge=lastCategoryAge(state,rule.category);
 if(categoryAge!=null&&state.player.age-categoryAge<rule.categoryGap)return false;

 return true;
}

export function shouldPresentEventThisYear(state,candidates,rng){
 if(!candidates.length)return false;
 if(candidates.some(event=>ALWAYS_URGENT.has(event.id)||(event.priority??0)>=100))return true;
 if(state.player.age<21)return true;

 state.pacing??={};
 const lastAge=state.pacing.lastEventAge??-Infinity;
 const yearsSince=state.player.age-lastAge;

 let chance=.54;
 if(yearsSince<=1)chance=.34;
 else if(yearsSince===2)chance=.58;
 else if(yearsSince===3)chance=.76;
 else if(yearsSince>=4)chance=.90;

 const majorCandidate=candidates.some(event=>Boolean(pacingRule(event)));
 if(majorCandidate&&yearsSince<=1)chance=Math.min(chance,.26);

 return rng.chance(chance);
}

export function annotateDecisionPacing(decision,event){
 if(!decision)return null;
 const rule=pacingRule(event);
 if(rule)decision.pacingCategory=rule.category;
 return decision;
}

export function recordPresentedEvent(state,event){
 state.pacing??={};
 state.pacing.lastEventAge=state.player.age;
 state.pacing.lastEventId=event.id;
}

export function pacingSummary(state){
 const nodes=state.lifeTree?.nodes??[];
 const adultNodes=nodes.filter(node=>node.age>=21);
 let shortestGap=null;
 for(let i=1;i<adultNodes.length;i++){
  const gap=adultNodes[i].age-adultNodes[i-1].age;
  shortestGap=shortestGap==null?gap:Math.min(shortestGap,gap);
 }
 return {
  adultMajorDecisions:adultNodes.length,
  shortestAdultMajorGap:shortestGap,
  lastVisibleEventAge:state.pacing?.lastEventAge??null
 };
}
