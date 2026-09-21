import {UNIVERSITY_PROGRAMS} from '../data/university_programs.js';
import {UNIVERSITIES} from '../data/countries/turkey/education.js';
import {cityById,TURKEY_CITIES} from '../data/countries/turkey/cities.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

function interestFit(state,program){
 const values=program.interests.map(i=>state.player.interests?.[i]??0);
 return values.length?Math.max(...values):0;
}

function campusFor(rng){
 const campus=rng.weighted(UNIVERSITIES.map(value=>{
  const city=cityById(value.cityId);
  return {value,weight:Math.max(.5,city.university*city.weight)};
 }));
 const city=cityById(campus.cityId);
 return {universityId:campus.id,universityName:campus.name,cityId:city.id,cityName:city.name};
}

export function generateUniversityApplications(state,rng,count=3){
 const readiness=state.education?.graduationReadiness??0;
 const scored=UNIVERSITY_PROGRAMS.map(program=>{
  const fit=interestFit(state,program);
  const campus=campusFor(rng.fork('campus-'+program.id));
  const city=cityById(campus.cityId);
  const chance=clamp(Math.round(
   readiness*.62+
   fit*.20+
   state.player.personality.ambition*.10+
   state.household.educationSupport*.08-
   Math.max(0,program.minReadiness-readiness)*1.2+
   (city.university-1)*8+
   rng.fork(program.id).int(-5,5)
  ),8,95);
  return {...program,...campus,fit,admissionChance:chance,score:chance+fit*.15};
 }).sort((a,b)=>b.score-a.score);

 const top=scored.slice(0,Math.max(1,count-1));
 const safe=[...scored].sort((a,b)=>b.admissionChance-a.admissionChance)[0];
 if(!top.some(p=>p.id===safe.id)) top.push(safe);
 return [...new Map(top.map(p=>[p.id,p])).values()].slice(0,count);
}

export function applyUniversityProgram(state,rng,programId){
 const offer=state.pendingUniversityApplications?.find(p=>p.id===programId);
 if(!offer) throw new Error('Bu bölüm başvurusu artık geçerli değil.');
 const admitted=rng.int(1,100)<=offer.admissionChance;
 if(admitted){
  const previousLocation=structuredClone(state.location);
  const moved=previousLocation?.cityId!==offer.cityId;
  state.higherEducation={
   enrolled:true,
   programId:offer.id,
   programTitle:offer.title,
   universityId:offer.universityId,
   universityName:offer.universityName,
   cityId:offer.cityId,
   cityName:offer.cityName,
   movedForUniversity:moved,
   previousLocation,
   careerTags:[...(offer.careerTags??[])],
   duration:offer.duration,
   year:1,
   performance:clamp(Math.round((state.education.performance??50)*.55+state.player.personality.discipline*.25+state.player.personality.curiosity*.20)),
   completed:false
  };
  state.location={countryId:'TR',cityId:offer.cityId,cityName:offer.cityName,sinceYear:state.year,reason:moved?'university':'education'};
  state.nextPath='university';
 }else{
  state.nextPath='gap';
  state.gapReason='university_rejection';
 }
 state.pendingUniversityApplications=null;
 return {admitted,offer};
}

export function progressUniversityYear(state,rng){
 const u=state.higherEducation;
 if(!u?.enrolled||u.completed) return [];
 const entries=[];
 const target=clamp(
  state.player.personality.discipline*.30+
  state.player.personality.curiosity*.20+
  state.player.health.current*.10+
  (state.education?.aptitude??50)*.20+
  20
 );
 u.performance=clamp(u.performance+(target-u.performance)*.35+rng.int(-4,4));
 if(state.player.age>19){
  u.year+=1;
  if(u.year>u.duration){
   u.completed=true;
   u.enrolled=false;
   state.player.education.level=Math.max(state.player.education.level??0,4);
   state.nextPath='work';
   entries.push({
    age:state.player.age,
    kind:'education',
    text:u.universityName+' '+u.programTitle+' bölümünden '+u.cityName+' şehrinde mezun oldun.'
   });
  }
 }
 return entries;
}
