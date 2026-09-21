import {familyCompatibility} from './career_taxonomy.js';

export function careerSequence(state){
 const archived=[...(state.careerProfile?.recentJobs??[])].reverse().map(x=>({
  jobId:x.jobId,title:x.title,reason:x.reason,leftAtAge:x.leftAtAge,
  enteredAtAge:null,transitionReason:null
 }));
 const current=state.career?.jobId?[{
  jobId:state.career.jobId,
  title:state.career.title,
  reason:'current',
  leftAtAge:null,
  enteredAtAge:state.career.enteredAtAge??state.player.age,
  transitionReason:state.career.transitionReason??null
 }]:[];
 return [...archived,...current];
}

export function auditCareerTransitions(state){
 const seq=careerSequence(state);
 const issues=[];
 const degreeTags=state.higherEducation?.completed?(state.higherEducation.careerTags??[]):[];

 for(let i=1;i<seq.length;i++){
  const from=seq[i-1],to=seq[i];
  if(!from.jobId||!to.jobId)continue;

  if(from.jobId===to.jobId){
   const gap=(from.leftAtAge!=null&&to.enteredAtAge!=null)?to.enteredAtAge-from.leftAtAge:null;
   if(from.reason==='career-switch'&&gap!=null&&gap<4){
    issues.push({type:'rapid-voluntary-return',job:to.title,gapYears:gap});
   }
   continue;
  }

  if(familyCompatibility(from.jobId,to.jobId)!==0)continue;

  const degreeBacked=degreeTags.includes(to.jobId);
  const transitionReason=to.transitionReason;

  // Long unemployment can legitimately force a fallback entry job.
  if(transitionReason==='long-unemployment-fallback')continue;

  // Returning to a degree-backed profession or a prior occupation after an
  // involuntary exit is coherent and should not be treated as an anomaly.
  if(degreeBacked&&['degree','prior-job','family-experience','adjacent-family'].includes(transitionReason))continue;

  if(from.reason==='career-switch'){
   issues.push({type:'voluntary-unrelated-switch',from:from.title,to:to.title});
  }else if(from.reason==='entrepreneurship'){
   if(!['prior-job','family-experience','adjacent-family'].includes(transitionReason)){
    issues.push({type:'post-business-distant-reentry',from:from.title,to:to.title});
   }
  }else{
   issues.push({
    type:'forced-unrelated-reemployment',
    from:from.title,to:to.title,after:from.reason,transitionReason
   });
  }
 }
 return issues;
}

export function careerTransitionCount(state){return Math.max(0,careerSequence(state).length-1);}
