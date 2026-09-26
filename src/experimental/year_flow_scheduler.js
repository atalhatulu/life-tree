import {RNG} from '../core/rng.js';

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
  let decisionDay=75+rng.int(0,225);
  if(/yaz tatili|yazlık|yaz kampı/.test(title))decisionDay=165+rng.int(0,35);
  else if(/okul açıl|yeni eğitim yılı|dershane/.test(title))decisionDay=245+rng.int(0,25);
  else if(/yılbaşı/.test(title))decisionDay=total-rng.int(0,5);
  const notices=history.filter(item=>typeof(item.text??item.result)==='string'&&String(item.text??item.result).trim()).slice(0,8);
  const timeline=notices.map((item,index)=>({
    type:'notice',day:total,
    text:item.text??item.result,sourceKind:item.kind??null
  }));
  if(decision)timeline.push({type:'decision',day:decisionDay,title:decision.title,id:decision.id??null});
  timeline.sort((a,b)=>a.day-b.day||(a.type==='notice'?-1:1));
  return {year,totalDays:total,timeline};
}
