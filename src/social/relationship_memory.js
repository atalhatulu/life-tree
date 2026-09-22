const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function ensureRelationshipMemory(state,targetId){
 state.relationshipMemories??={};
 state.relationshipMemories[targetId]??={
  interactions:0,
  lastInteractionAge:null,
  recentActivities:[],
  positiveImpact:0,
  negativeImpact:0,
  knownPreferences:{}
 };
 return state.relationshipMemories[targetId];
}

export function repetitionPenalty(memory,activityId){
 const recent=memory.recentActivities??[];
 const repeats=recent.slice(-3).filter(id=>id===activityId).length;
 return repeats===0?0:repeats===1?-1:repeats===2?-2:-3;
}

export function recordRelationshipInteraction(state,targetId,{activityId,delta,preferenceKind=null,preferenceKey=null,preference=null}){
 const memory=ensureRelationshipMemory(state,targetId);
 memory.interactions+=1;
 memory.lastInteractionAge=state.player.age;
 memory.recentActivities.push(activityId);
 memory.recentActivities=memory.recentActivities.slice(-6);
 if(delta>=0)memory.positiveImpact+=delta;
 else memory.negativeImpact+=Math.abs(delta);
 memory.knownPreferences??={};
 if(preferenceKind&&preferenceKey&&preference!=null)memory.knownPreferences[preferenceKind+':'+preferenceKey]=preference;
 return memory;
}

export function neglectPenalty(state,targetId,{graceYears=1,maxPenalty=3}={}){
 const memory=ensureRelationshipMemory(state,targetId);
 if(memory.lastInteractionAge==null)return state.player.age>=12?1:0;
 const years=state.player.age-memory.lastInteractionAge;
 if(years<=graceYears)return 0;
 return Math.min(maxPenalty,years-graceYears);
}

export function clampRelationship(value){return clamp(value);}


export function knownPreference(state,targetId,kind,key){
 const memory=ensureRelationshipMemory(state,targetId);
 const id=kind+':'+key;
 return Object.prototype.hasOwnProperty.call(memory.knownPreferences??{},id)
  ?memory.knownPreferences[id]
  :null;
}
