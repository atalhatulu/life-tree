import {scoreSocialActivity,relationshipValue} from '../social/social_activity_system.js';
import {ensureRelationshipMemory} from '../social/relationship_memory.js';
import {physicalCapacity} from '../health/physical_capacity.js';

function policyBias(policy,key){
 const table={
  balanced:{physical:1,social:1,study:1,career:1,finance:1,health:1,hobby:.7},
  academic:{physical:.6,social:.5,study:3,career:.8,finance:.6,health:1,hobby:1},
  social:{physical:.8,social:3,study:.5,career:.5,finance:.5,health:.8,hobby:1.2},
  vocational:{physical:.8,social:.6,study:.6,career:3,finance:1.5,health:.8,hobby:.5},
  healthy:{physical:3,social:1,study:.7,career:.7,finance:1,health:2.5,hobby:.8},
  frugal:{physical:1,social:.7,study:1,career:1.2,finance:3,health:1,hobby:.6},
  'career-focused':{physical:.6,social:.4,study:1.2,career:3.2,finance:1.5,health:.7,hobby:.3},
  reckless:{physical:.7,social:1.8,study:.2,career:.5,finance:.1,health:.2,hobby:1.5}
 };
 return table[policy]?.[key]??1;
}

function bestSocialPlan(game,policy,rng){
 const state=game.state;
 const targets=game.socialTargets();
 const plans=[];
 for(const target of targets){
  const current=relationshipValue(state,target);
  const memory=ensureRelationshipMemory(state,target.id);
  const yearsSince=memory.lastInteractionAge==null?2:Math.max(0,state.player.age-memory.lastInteractionAge);
  const need=Math.max(0,70-current)*.08+Math.min(4,yearsSince)*.9+
   (target.kind==='partner'?1.8:target.kind==='child'?1.4:0);
  for(const activity of game.availableSocialActivities(target.id)){
   const scored=scoreSocialActivity(state,target.id,activity.id);
   if(!scored)continue;
   const affordability=(state.finance?.cash??0)>0?activity.cost/Math.max(1,state.finance.cash):1;
   const frugalPenalty=policy==='frugal'?affordability*8:affordability*3;
   const utility=need+scored.expectedDelta*.45-frugalPenalty+rng.int(-2,2)*.15;
   plans.push({targetId:target.id,activityId:activity.id,utility});
  }
 }
 return plans.sort((a,b)=>b.utility-a.utility)[0]??null;
}

function bestPhysicalPlan(game,policy,rng){
 const state=game.state;
 const options=game.availablePhysicalActivities();
 if(!options.length)return null;
 const fitness=state.healthProfile?.fitness??50;
 const capacity=physicalCapacity(state);
 const need=Math.max(0,75-fitness)*.09+Math.max(0,65-capacity)*.03;
 const ranked=options.map(activity=>{
  const costRatio=(state.finance?.cash??0)>0?activity.cost/Math.max(1,state.finance.cash):1;
  const frugalPenalty=policy==='frugal'?costRatio*8:costRatio*2;
  const intensityFit=Math.max(0,activity.minCapacity-capacity)*.2;
  return {
   id:activity.id,
   utility:need+activity.fitnessGain*.55-frugalPenalty-intensityFit+rng.int(-2,2)*.12
  };
 }).sort((a,b)=>b.utility-a.utility);
 return ranked[0]??null;
}

function bestHobbyPlan(game,policy,rng){
 const options=game.availableHobbies();
 if(!options.length)return null;
 const stress=game.state.healthProfile?.stress??20;
 const ranked=options.map(hobby=>{
  const interest=game.state.player.interests?.[hobby.interest]??0;
  const costRatio=(game.state.finance?.cash??0)>0?hobby.cost/Math.max(1,game.state.finance.cash):1;
  const frugalPenalty=policy==='frugal'?costRatio*8:costRatio*2;
  const utility=1.5+interest*.025+Math.max(0,stress-35)*.03-frugalPenalty+rng.int(-2,2)*.15;
  return {id:hobby.id,utility};
 }).sort((a,b)=>b.utility-a.utility);
 return ranked[0]??null;
}

function genericCandidates(game,policy,rng){
 const state=game.state;
 const ids=new Set(game.availableActivities().map(a=>a.id));
 const out=[];
 const add=(id,utility)=>{if(ids.has(id))out.push({type:'generic',id,utility:utility+rng.int(-2,2)*.12});};

 const lastCheck=state.healthProfile?.lastCheckupAge;
 const yearsSinceCheck=lastCheck==null?10:state.player.age-lastCheck;
 if(ids.has('study'))add('study',policyBias(policy,'study')*2.2+(state.education?.performance<65?1:0));
 if(ids.has('course'))add('course',policyBias(policy,'study')*1.2+(state.career?.employed ? 0.6 : 1));
 if(ids.has('work-hard'))add('work-hard',policyBias(policy,'career')*1.6+(state.career?.performance<65?1:0));
 if(ids.has('budget'))add('budget',policyBias(policy,'finance')*1.4+Math.min(4,(state.finance?.debt??0)/1000000));
 if(ids.has('checkup'))add('checkup',policyBias(policy,'health')*1.2+Math.min(4,yearsSinceCheck*.6)+(state.healthProfile?.conditions?.length??0));
 return out;
}

export function proceduralActionPlan(game,policy,rng){
 const candidates=genericCandidates(game,policy,rng);

 const physical=bestPhysicalPlan(game,policy,rng.fork('physical'));
 if(physical)candidates.push({
  type:'physical',
  id:physical.id,
  utility:physical.utility+policyBias(policy,'physical')*1.8
 });

 const hobby=bestHobbyPlan(game,policy,rng.fork('hobby'));
 if(hobby)candidates.push({
  type:'hobby',
  id:hobby.id,
  utility:hobby.utility+policyBias(policy,'hobby')*1.4
 });

 const social=bestSocialPlan(game,policy,rng.fork('social'));
 if(social)candidates.push({
  type:'social',
  targetId:social.targetId,
  id:social.activityId,
  utility:social.utility+policyBias(policy,'social')*1.7
 });

 return candidates.sort((a,b)=>b.utility-a.utility);
}

export function performProceduralYearActions(game,policy,rng){
 const results=[];
 const usedTypes=new Set();

 while(game.state.actions.remaining>0){
  const plan=proceduralActionPlan(game,policy,rng.fork('slot-'+game.state.actions.remaining))
   .filter(candidate=>{
    if(candidate.type==='social'&&usedTypes.has('social')&&policy!=='social')return false;
    if(candidate.type==='physical'&&usedTypes.has('physical'))return false;
    if(candidate.type==='hobby'&&usedTypes.has('hobby'))return false;
    if(candidate.type==='generic'&&usedTypes.has('generic:'+candidate.id))return false;
    return true;
   });
  const selected=plan[0];
  if(!selected)break;

  try{
   let result;
   if(selected.type==='social')result=game.performSocialActivity(selected.targetId,selected.id);
   else if(selected.type==='physical')result=game.performPhysicalActivity(selected.id);
   else if(selected.type==='hobby')result=game.performHobby(selected.id);
   else result=game.performActivity(selected.id);
   results.push({selected,result});
   usedTypes.add(selected.type==='generic'?'generic:'+selected.id:selected.type);
  }catch{
   usedTypes.add(selected.type==='generic'?'generic:'+selected.id:selected.type);
   if(usedTypes.size>8)break;
  }
 }
 return results;
}
