// Reject malformed persisted annual markers before an annual system consumes RNG
// or writes to the state. A missing year is supported for legacy standalone calls.
export function annualYearStatus(year,previous,label){
 if(year!=null&&(!Number.isSafeInteger(year)||year<0))
  throw new RangeError('Invalid calendar year for '+label);
 if(previous!=null&&(!Number.isSafeInteger(previous)||previous<0))
  throw new RangeError('Invalid processed year for '+label);
 if(year!=null&&previous!=null){
  if(year===previous)return {calendarYear:year,replayed:true};
  if(year<previous)throw new RangeError('Cannot process '+label+' in an earlier year');
 }
 return {calendarYear:year??null,replayed:false};
}

// A top-level age transition must never wrap or coerce an age or calendar year.
export function assertIncrementableCounter(value,label){
 if(!Number.isSafeInteger(value)||value<0||value===Number.MAX_SAFE_INTEGER)
  throw new RangeError('Invalid or overflowing '+label);
}
