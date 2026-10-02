import {recordNpcActivity} from './npc_activity_ledger.js';
import {npcDaySchedule} from './npc_daily_routine.js';

/** Deterministic representative sampling: at most one activity per week. */
export function generateNpcYearActivities(person,{year,anchorDay=3}={}){
 if(!Number.isInteger(year)||year<1900||year>9999)throw new RangeError('Valid calendar year required');
 if(!Number.isInteger(anchorDay)||anchorDay<1||anchorDay>7)throw new RangeError('Invalid anchor weekday');
 if(person.alive===false)return {recorded:0,skipped:0};
 const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
 let recorded=0,skipped=0;
 // Monday-based weekday is computed from the real calendar, not from a guessed day offset.
 const jan1Weekday=(new Date(Date.UTC(year,0,1)).getUTCDay()+6)%7+1;
 const firstDay=1+(anchorDay-jan1Weekday+7)%7;
 for(let day=firstDay;day<=days;day+=7){
  // Alternate a weekday and a weekend observation, without increasing sampling cost.
  // This avoids systematically excluding weekend social opportunities.
  const observationIndex=Math.floor((day-firstDay)/7);
  const targetWeekday=observationIndex%2===0?1:6; // Monday / Saturday
  const sampleDay=day+(targetWeekday-anchorDay+7)%7;
  if(sampleDay>days)break;
  const date=new Date(Date.UTC(year,0,sampleDay));
  const weekday=(date.getUTCDay()+6)%7+1;
  const schedule=npcDaySchedule(person,{dayOfYear:sampleDay,weekday});
  const activity=schedule.duty==='school'?'study':schedule.available?'socialize':'recover';
  const result=recordNpcActivity(person,{year,dayOfYear:sampleDay,weekday,activity});
  if(result.status==='recorded')recorded++;else skipped++;
 }
 return {recorded,skipped};
}
