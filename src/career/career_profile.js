import {metaFor} from './career_taxonomy.js';

export function ensureCareerProfile(state){
 state.careerProfile??={
  experienceByJob:{},
  experienceByFamily:{},
  recentJobs:[],
  coreFamily:null,
  totalExperience:0
 };
 return state.careerProfile;
}

export function recordCareerYear(state){
 const c=state.career;
 if(!c?.employed)return;
 const profile=ensureCareerProfile(state);
 const meta=metaFor(c.jobId);
 profile.experienceByJob[c.jobId]=(profile.experienceByJob[c.jobId]??0)+1;
 profile.experienceByFamily[meta.family]=(profile.experienceByFamily[meta.family]??0)+1;
 profile.totalExperience+=1;

 const best=Object.entries(profile.experienceByFamily).sort((a,b)=>b[1]-a[1])[0];
 profile.coreFamily=best?.[0]??meta.family;
}

export function archiveCareer(state,reason='change'){
 const c=state.career;
 if(!c?.jobId)return;
 const profile=ensureCareerProfile(state);
 profile.recentJobs.unshift({
  jobId:c.jobId,
  title:c.title,
  family:metaFor(c.jobId).family,
  years:c.years??0,
  leftAtAge:state.player.age,
  reason
 });
 profile.recentJobs=profile.recentJobs.slice(0,8);
}

export function yearsInJob(state,jobId){
 return ensureCareerProfile(state).experienceByJob[jobId]??0;
}

export function yearsInFamily(state,family){
 return ensureCareerProfile(state).experienceByFamily[family]??0;
}

export function recentlyLeftJob(state,jobId,years=4){
 const recent=ensureCareerProfile(state).recentJobs.find(x=>x.jobId===jobId);
 return Boolean(recent&&state.player.age-recent.leftAtAge<years);
}

export function dominantCareerFamily(state){
 return ensureCareerProfile(state).coreFamily;
}
