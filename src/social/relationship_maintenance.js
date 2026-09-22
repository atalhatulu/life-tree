import {socialTargets,relationshipValue,setRelationshipValue} from './social_activity_system.js';
import {neglectPenalty} from './relationship_memory.js';

function rules(state,target){
 if(target.kind==='partner'){
  const status=state.social?.romance?.status;
  if(status==='married'||status==='cohabiting')return {graceYears:2,maxPenalty:1};
  return {graceYears:1,maxPenalty:2};
 }
 if(target.kind==='child'){
  const age=target.person?.age??0;
  return age<18?{graceYears:1,maxPenalty:1}:{graceYears:2,maxPenalty:2};
 }
 if(target.kind==='friend')return {graceYears:2,maxPenalty:2};
 return {graceYears:3,maxPenalty:1};
}

export function processRelationshipMaintenanceYear(state){
 const entries=[];
 for(const target of socialTargets(state)){
  const penalty=neglectPenalty(state,target.id,rules(state,target));
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
