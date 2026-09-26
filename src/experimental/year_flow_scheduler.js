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
export function fixedCalendarMoments(year,age,birthday=null){
 const schoolAge=age>=6&&age<=18;
 const dates=[
  ['01-01','Yılbaşı','Yeni bir yıl başladı.'],
  ...(birthday&&/^\\d{4}-\\d{2}-\\d{2}$/.test(birthday)?[[birthday.slice(5),'Doğum günü','Bugün doğum günün.']]:[]),
  ...(schoolAge?[['01-20','Sömestr tatili','Okulun ilk dönemi sona erdi; ara tatil başladı.'],['02-03','Sömestr bitişi','Ara tatil bitti, okul yeniden başladı.'],['06-20','Yaz tatili','Okul yılı bitti; yaz tatili başladı.'],['09-01','Yaz tatili bitişi','Yaz tatili sona eriyor; yeni eğitim yılı yaklaşıyor.']]:[]),
  ['12-31','Yıl sonu','Bir yıl daha geride kaldı.']
 ];
 return dates.map(([date,title,text])=>({type:'calendar',day:Math.min(daysInYear(year),Math.round((Date.UTC(year,Number(date.slice(0,2))-1,Number(date.slice(3)))-Date.UTC(year,0,1))/86400000)+1),title,text}));
}
export function scheduleYearPresentation({seed,year,history=[],decision=null,age=null,birthday=null}){
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
  if(Number.isInteger(age))timeline.push(...fixedCalendarMoments(year,age,birthday));
  if(decision&&decisionDay!=null)timeline.push({type:'decision',day:decisionDay,title:decision.title,id:decision.id??null});
  timeline.sort((a,b)=>a.day-b.day||(a.type==='notice'?-1:1));
  return {year,totalDays:total,timeline};
}
