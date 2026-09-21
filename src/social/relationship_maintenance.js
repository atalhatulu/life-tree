import {socialTargets,relationshipValue,setRelationshipValue} from './social_activity_system.js';
import {neglectPenalty} from './relationship_memory.js';

function rules(kind){
 if(kind==='partner')return {graceYears:0,maxPenalty:3};
 if(kind==='child')return {graceYears:0,maxPenalty:2};
 if(kind==='friend')return {graceYears:1,maxPenalty:3};
 return {graceYears:2,maxPenalty:2};
}

export function processRelationshipMaintenanceYear(state){
 const entries=[];
 for(const target of socialTargets(state)){
  const penalty=neglectPenalty(state,target.id,rules(target.kind));
  if(penalty<=0)continue;
  const before=relationshipValue(state,target);
  const after=setRelationshipValue(state,target,before-penalty);
  if(before>=45&&after<45){
   entries.push({
    age:state.player.age,
    kind:'relationship',
    text:target.person.name+' ile uzun süredir yeterince vakit geçirmediğin için aranız soğudu.'
   });
  }
 }
 return entries;
}
