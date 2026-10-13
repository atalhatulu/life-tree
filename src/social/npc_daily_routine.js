import {schoolSeason} from '../life/school_calendar.js';
// Representative schedules only: the annual engine does not advance each day.
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const validScore=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
// A weekly schedule is an annual side effect. Validate its inputs before
// creating the routine object or replacing an existing saved week.
export function assertNpcRoutineInputs(person,{checkRoutine=true}={}){
 if(!isRecord(person))throw new TypeError('Invalid NPC record');
 if(person.age!=null&&(!Number.isSafeInteger(person.age)||person.age<0))
  throw new RangeError('Invalid NPC age');
 if(person.life!=null&&!isRecord(person.life))throw new TypeError('Invalid NPC life');
 for(const key of ['personalStress','workStress','workStability']){
  const value=person.life?.[key];
  if(value!=null&&!validScore(value))throw new RangeError('Invalid NPC '+key);
 }
 if(person.personality!=null&&!isRecord(person.personality))
  throw new TypeError('Invalid NPC personality');
 if(person.personality?.sociability!=null&&!validScore(person.personality.sociability))
  throw new RangeError('Invalid NPC sociability');
 if(person.life?.movedAway!=null&&typeof person.life.movedAway!=='boolean')
  throw new TypeError('Invalid NPC movedAway');
 if(checkRoutine&&person.routine!=null){
  if(!isRecord(person.routine)||
     (person.routine.week!=null&&(!Array.isArray(person.routine.week)||
      person.routine.week.some(day=>!isRecord(day)))))
   throw new TypeError('Invalid NPC routine');
 }
}
const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
export function ensureNpcRoutine(person){
 person.routine??={week:[],lastYear:null,workload:0,freeEvenings:0,availability:50,pattern:'unassigned'};
 return person.routine;
}
function scheduleContext(person,dayOfYear){
 const age=person.age??25,life=person.life??{};
 return {student:age>=6&&age<18,
  employed:age>=18&&age<67&&(person.jobId?person.jobId!=='unemployed':(life.workStability??55)>=35),
  season:dayOfYear===undefined?null:schoolSeason(dayOfYear),
  stress:life.personalStress??life.workStress??25,
  sociability:person.personality?.sociability??50};
}
function daySlot(ctx,index){
 const weekday=index<5;
 const duty=weekday?(ctx.student?(ctx.season===null||ctx.season==='term'?'school':'home'):ctx.employed?'work':'home'):'home';
 const recovery=ctx.stress>=65&&index>=5;
 const available=!recovery&&(duty==='home'||(ctx.stress<55&&index===4));
 return {day:index+1,name:DAYS[index],duty,evening:recovery?'rest':available?(ctx.sociability>=55?'social':'personal'):'rest',available};
}
export function simulateNpcRoutineWeek(person,{year,kind='friend',dayOfYear}={}){
 if(person.alive===false)return null;
 assertNpcRoutineInputs(person);
 const ctx=scheduleContext(person,dayOfYear),life=person.life??{};
 const routine=ensureNpcRoutine(person);
 const week=DAYS.map((_,i)=>daySlot(ctx,i));
 const workload=week.filter(d=>d.duty==='work'||d.duty==='school').length;
 const freeEvenings=week.filter(d=>d.available).length;
 const familyLoad=kind==='partner'?2:life.relationshipStatus==='partnered'?1:0;
 const availability=clamp(20+freeEvenings*11-ctx.stress*.2-(life.movedAway?12:0)-familyLoad*4);
 Object.assign(routine,{week,lastYear:year??routine.lastYear,workload,freeEvenings,availability,pattern:ctx.student?(ctx.season&&ctx.season!=='term'?'student-break':'student'):ctx.employed?'employed':'home',kind,season:ctx.season});
 return routine;
}
export function npcCanMeet(person,day){
 if(person.alive===false)return false;
 const slot=person.routine?.week?.find(d=>d.day===day);
 return Boolean(slot?.available);
}
export function npcDaySchedule(person,{dayOfYear,weekday=1}={}){
 if(!Number.isInteger(weekday)||weekday<1||weekday>7)throw new RangeError('Invalid weekday');
 if(person.alive!==false)assertNpcRoutineInputs(person,{checkRoutine:false});
 const ctx=scheduleContext(person,dayOfYear);
 if(person.alive===false)return {duty:'unavailable',season:ctx.season,available:false};
 const slot=daySlot(ctx,weekday-1);
 return {duty:slot.duty,season:ctx.season,available:slot.available,evening:slot.evening};
}
