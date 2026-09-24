import {UNIVERSITY_PROGRAMS} from '../data/university_programs.js';
import {UNIVERSITIES} from '../data/countries/turkey/education.js';
import {cityById} from '../data/countries/turkey/cities.js';
import {moveToCity} from '../world/migration_system.js';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));

export function calculateYksScore(state,rng){
 const education=state.education??{};
 const household=state.household??{};
 const p=state.player.personality??{};
 const aptitude=education.aptitude??50;
 const performance=education.performance??50;
 const schoolQuality=education.quality??50;
 const support=household.educationSupport??50;
 const study=(state.activityMemory?.study?.streak??0);
 return clamp(Math.round(
  aptitude*.34+performance*.28+schoolQuality*.12+p.discipline*.12+support*.08+Math.min(8,study*1.5)+rng.int(-5,5)
 ));
}

export function ensureUniversityPlanning(state,rng){
 state.universityPlanning??={
  yksScore:calculateYksScore(state,rng.fork('yks')),
  attempt:(state.universityPlanning?.attempt??0)+1,
  preferenceList:[],
  scholarship:null,
  housing:null,
  studentAid:null
 };
 return state.universityPlanning;
}

function interestFit(state,program){
 const values=program.interests.map(i=>state.player.interests?.[i]??0);
 return values.length?Math.max(...values):0;
}

function campusFor(rng,homeCityId=null){
 // Birth-city weights represent resident population, not university admission.
 // Each listed campus receives its own bounded attractiveness; studying in
 // one's current city is a modest preference, never a requirement.
 const campus=rng.weighted(UNIVERSITIES.map(value=>{
  const city=cityById(value.cityId);
  const citySize=Math.max(.65,Math.min(3,Math.sqrt(city.population2025/400000)));
  const localBonus=city.id===homeCityId?1.35:1;
  return {value,weight:Math.max(.45,city.university*citySize*localBonus)};
 }));
 const city=cityById(campus.cityId);
 return {universityId:campus.id,universityName:campus.name,cityId:city.id,cityName:city.name};
}

export function generateUniversityApplications(state,rng,count=3){
 const readiness=state.education?.graduationReadiness??0;
 const planning=ensureUniversityPlanning(state,rng.fork('planning'));
 const yks=planning.yksScore;
 const scored=UNIVERSITY_PROGRAMS.map(program=>{
  const fit=interestFit(state,program);
  const campus=campusFor(rng.fork('campus-'+program.id),state.location?.cityId??state.origin?.cityId);
  const city=cityById(campus.cityId);
  const chance=clamp(Math.round(
   readiness*.42+
   yks*.28+
   fit*.18+
   state.player.personality.ambition*.10+
   state.household.educationSupport*.08-
   Math.max(0,program.minReadiness-readiness)*1.2+
   (city.university-1)*8+
   rng.fork(program.id).int(-5,5)
  ),8,95);
  return {...program,...campus,fit,yksScore:yks,admissionChance:chance,score:chance+fit*.15};
 }).sort((a,b)=>b.score-a.score);

 const top=scored.slice(0,Math.max(1,count-1));
 planning.preferenceList=top.map((p,index)=>({rank:index+1,programId:p.id,universityId:p.universityId,score:p.score}));
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
   completed:false,
   funding:null,
   housingChoice:null
  };
  const wealth=state.household?.economicClass??'orta';
  const support=state.household?.educationSupport??50;
  const scholarshipChance=clamp(Math.round(25+(offer.admissionChance-55)*.5+(state.education.performance??50)*.25-(wealth==='yüksek'?25:wealth==='üst-orta'?10:0)),5,80);
  const scholarship=rng.fork('scholarship').int(1,100)<=scholarshipChance;
  state.universityPlanning.scholarship=scholarship?'merit':'none';
  state.universityPlanning.studentAid=scholarship?'scholarship':(wealth==='düşük'||wealth==='orta'?'kyk':'family');
  const local=!moved;
  state.universityPlanning.housing=local?'family':(wealth==='düşük'?'dorm':wealth==='yüksek'?'studio':'shared-flat');
  state.higherEducation.funding=state.universityPlanning.studentAid;
  state.higherEducation.housingChoice=state.universityPlanning.housing;
  if(moved)moveToCity(state,offer.cityId,'university',{housing:'shared',stress:2,costMultiplier:.55});
  else state.location={...state.location,reason:'education'};
  state.nextPath='university';
 }else{
  state.nextPath='gap';
  state.gapReason='university_rejection';
  state.universityPlanning??={};
  state.universityPlanning.lastRejectedAtAge=state.player.age;
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
