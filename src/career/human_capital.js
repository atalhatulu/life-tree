import {metaFor} from './career_taxonomy.js';
import {yearsInFamily,yearsInJob} from './career_profile.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function degreeMatch(state,jobId){
 const tags=state.higherEducation?.completed?(state.higherEducation.careerTags??[]):[];
 const meta=metaFor(jobId);
 if(tags.includes(jobId))return 1;
 if((meta.degreeTags??[]).some(tag=>tags.includes(tag)))return 1;
 return 0;
}

export function humanCapitalFor(state,jobId=state.career?.jobId){
 if(!jobId)return {score:0,experience:0,education:0,performance:0,continuity:0};
 const meta=metaFor(jobId);
 const direct=yearsInJob(state,jobId);
 const family=yearsInFamily(state,meta.family);
 const experience=clamp(direct*7+Math.max(0,family-direct)*3,0,100);
 const education=degreeMatch(state,jobId)
  ?90
  :state.education?.path==='vocational'&&['trades','transport','hospitality'].includes(meta.family)
   ?72
   :Math.min(55,(state.player?.education?.level??0)*12);
 const performance=clamp(state.career?.performance??50,0,100);
 const continuity=clamp((state.career?.years??0)*10,0,100);
 const score=clamp(Math.round(experience*.38+education*.27+performance*.23+continuity*.12),0,100);
 return {score,experience,education,performance,continuity};
}

export function promotionChance(state){
 const c=state.career;
 if(!c?.employed)return 0;
 const capital=humanCapitalFor(state,c.jobId);
 const base=.025+capital.score*.00145;
 const performance=Math.max(0,(c.performance??50)-65)*.003;
 const tenure=Math.min(.08,(c.years??0)*.012);
 const stability=(c.stability??50)>=55?.025:-.02;
 return clamp(base+performance+tenure+stability,0,.42);
}

export function salaryGrowthRate(state){
 const capital=humanCapitalFor(state);
 return clamp(.025+capital.score*.00055,0.025,.08);
}
