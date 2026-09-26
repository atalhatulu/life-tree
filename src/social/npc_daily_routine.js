// A compact, deterministic weekly routine model. It records representative days,
// rather than pretending the annual simulation already advances day by day.
const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const DAYS=['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];
const workDay=i=>i<5;
export function ensureNpcRoutine(person){
 person.routine??={week:[],lastYear:null,workload:0,freeEvenings:0,availability:50,pattern:'unassigned'};
 return person.routine;
}
export function simulateNpcRoutineWeek(person,{year,kind='friend'}={}){
 if(person.alive===false)return null;
 const routine=ensureNpcRoutine(person);
 const age=person.age??25;
 const life=person.life??{};
 const employed=age>=18&&age<67&&(person.jobId?person.jobId!=='unemployed':(life.workStability??55)>=35);
 const student=age>=6&&age<18;
 const moved=Boolean(life.movedAway);
 const stress=life.personalStress??life.workStress??25;
 const sociability=person.personality?.sociability??50;
 const familyLoad=kind==='partner'?2:life.relationshipStatus==='partnered'?1:0;
 const week=DAYS.map((name,index)=>{
  const weekday=workDay(index);
  const duty=weekday?(student?'school':employed?'work':'home'):'home';
  const recovery=stress>=65&&(index===5||index===6);
  const available=!recovery&&(duty==='home'||(stress<55&&index===4));
  return {day:index+1,name,duty,evening:recovery?'rest':available?(sociability>=55?'social':'personal'):'rest',available};
 });
 const workload=week.filter(d=>d.duty==='work'||d.duty==='school').length;
 const freeEvenings=week.filter(d=>d.available).length;
 const availability=clamp(20+freeEvenings*11-stress*.2-(moved?12:0)-familyLoad*4);
 Object.assign(routine,{week,lastYear:year??routine.lastYear,workload,freeEvenings,availability,pattern:student?'student':employed?'employed':'home',kind});
 return routine;
}
export function npcCanMeet(person,day){
 if(person.alive===false)return false;
 const slot=person.routine?.week?.find(d=>d.day===day);
 return Boolean(slot?.available);
}
