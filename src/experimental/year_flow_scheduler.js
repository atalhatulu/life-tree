import {RNG} from '../core/rng.js';
import {scheduleEventDay} from './event_calendar.js';

// Experimental, pure presentation scheduler. Does not mutate Game or its RNG.
export function daysInYear(year){
  return year%4===0&&(year%100!==0||year%400===0)?366:365;
}
export function calendarDate(year,day){
  if(!Number.isInteger(year)||!Number.isInteger(day)||day<1||day>daysInYear(year))throw new RangeError('Invalid calendar day');
  return new Date(Date.UTC(year,0,day));
}
export function scheduleYearPresentation({seed,year,history=[],decision=null}){
  const rng=new RNG(String(seed)+':experimental-year:'+year);
  const total=daysInYear(year);
  const title=String(decision?.title??'').toLocaleLowerCase('tr-TR');
  const fallback={...decision};
  if(!decision?.calendar){
    if(/yaz tatili|yazlık|yaz kampı/.test(title))fallback.calendar={earliest_date:'06-13',latest_date:'07-18'};
    else if(/okul açıl|yeni eğitim yılı|dershane/.test(title))fallback.calendar={earliest_date:'09-01',latest_date:'09-30'};
    else if(/yılbaşı/.test(title))fallback.calendar={earliest_date:'12-26',latest_date:'12-31'};
  }
  const decisionDay=decision?scheduleEventDay({event:fallback,year,rng,totalDays:total}):null;
  const notices=history.filter(item=>typeof(item.text??item.result)==='string'&&String(item.text??item.result).trim()).slice(0,8);
  const timeline=notices.map((item,index)=>({
    type:'notice',day:total,
    text:item.text??item.result,sourceKind:item.kind??null
  }));
  if(decision&&decisionDay!=null)timeline.push({type:'decision',day:decisionDay,title:decision.title,id:decision.id??null});
  timeline.sort((a,b)=>a.day-b.day||(a.type==='notice'?-1:1));
  return {year,totalDays:total,timeline};
}
