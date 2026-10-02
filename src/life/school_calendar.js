// Fictional fixed school calendar. This is not a claim about official dates.
export const SCHOOL_DATES=Object.freeze({termStart:258,midyearBreakStart:20,midyearBreakEnd:34,summerStart:170});
export function schoolSeason(day){
 if(!Number.isInteger(day)||day<1||day>366)throw new RangeError('Invalid day of year');
 if(day>=SCHOOL_DATES.summerStart&&day<SCHOOL_DATES.termStart)return 'summer';
 if(day>=SCHOOL_DATES.midyearBreakStart&&day<=SCHOOL_DATES.midyearBreakEnd)return 'midyear-break';
 return 'term';
}
export function schoolCalendarNotices(age){
 if(!Number.isFinite(age)||age<6||age>=18)return [];
 return [
  {day:SCHOOL_DATES.midyearBreakStart,text:'Yarıyıl tatili başladı; dersler kısa süreliğine durdu.',kind:'school-calendar'},
  {day:SCHOOL_DATES.midyearBreakEnd+1,text:'Yarıyıl tatili bitti; dersler yeniden başladı.',kind:'school-calendar'},
  {day:SCHOOL_DATES.summerStart,text:'Okul yılı sona erdi; yaz tatili başladı.',kind:'school-calendar'},
  {day:SCHOOL_DATES.termStart,text:'Yaz tatili sona erdi; yeni okul dönemi başladı.',kind:'school-calendar'}
 ];
}
