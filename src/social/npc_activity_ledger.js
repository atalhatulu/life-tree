import {npcDaySchedule} from './npc_daily_routine.js';

// Explicit opt-in daily layer. Annual simulation must not apply these deltas again.
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));
const ledgerFor=(person,year)=>person.activityLedger?.year===year?person.activityLedger:person.activityLedgerHistory?.[year];
const ACTIVITIES=Object.freeze({
 study:{duty:'school',effects:{academic:0.15,stress:0.05}},
 socialize:{effects:{social:0.12,stress:-0.08}},
 recover:{effects:{stress:-0.18}}
});
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
// A saved daily ledger may be recorded out of date order. Recompute the
// saturating stress metric in calendar order to make it deterministic.
function calendarStressTotal(entries){
 let stress=0;
 for(const day of Object.keys(entries).sort((a,b)=>Number(a)-Number(b))){
  stress=clamp(stress+(entries[day].effects.stress??0),-12,12);
 }
 return stress;
}

// Date.UTC treats years 0–99 as 1900–1999. Use setUTCFullYear so saved
// ledger dates and new recordings share the same actual calendar semantics.
function calendarWeekday(year,day){
 if(!Number.isSafeInteger(year)||year<0||!Number.isSafeInteger(day)||day<1)
  throw new RangeError('Invalid NPC activity calendar date');
 const first=new Date(0),next=new Date(0);
 first.setUTCFullYear(year,0,1);first.setUTCHours(0,0,0,0);
 next.setUTCFullYear(year+1,0,1);next.setUTCHours(0,0,0,0);
 const days=(next-first)/86400000;
 if(!Number.isFinite(days)||day>days)
  throw new RangeError('Invalid NPC activity calendar date');
 return (new Date(first.getTime()+(day-1)*86400000).getUTCDay()+6)%7+1;
}
function assertActivityLedger(ledger){
 if(!isRecord(ledger)||!Number.isSafeInteger(ledger.year)||ledger.year<0||
    !isRecord(ledger.entries)||!isRecord(ledger.totals)||
    (ledger.settled!=null&&typeof ledger.settled!=='boolean')||
    (ledger.stressOrder!=null&&ledger.stressOrder!=='calendar'))
  throw new TypeError('Invalid NPC activity ledger');
 calendarWeekday(ledger.year,1);
 for(const metric of ['academic','social','stress']){
  const value=ledger.totals[metric];
  if(typeof value!=='number'||!Number.isFinite(value)||value < -12||value>12)
   throw new RangeError('Invalid NPC activity total: '+metric);
 }
 for(const [day,entry] of Object.entries(ledger.entries)){
  if(!/^[1-9]\d*$/.test(day)||Number(day)>366||!isRecord(entry)||
     !Object.hasOwn(ACTIVITIES,entry.activity)||!isRecord(entry.effects))
   throw new TypeError('Invalid NPC activity entry');
  const dayNumber=Number(day);
  if(entry.dayOfYear!==dayNumber||entry.weekday!==calendarWeekday(ledger.year,dayNumber))
   throw new RangeError('Invalid NPC activity entry calendar');
  const expected=ACTIVITIES[entry.activity].effects;
  const effectNames=Object.keys(entry.effects);
  if(effectNames.length!==Object.keys(expected).length||
     effectNames.some(name=>!Object.hasOwn(expected,name)||entry.effects[name]!==expected[name]))
   throw new RangeError('Invalid NPC activity entry effects');
 }
 // Older ledgers lack the marker and retain their historical stress totals;
 // new writes upgrade to the calendar-order contract explicitly.
 if(ledger.stressOrder==='calendar'&&
    Math.abs(ledger.totals.stress-calendarStressTotal(ledger.entries))>1e-8)
  throw new RangeError('Invalid NPC activity total coherence: stress');
 // Positive academic/social gains commute even when activities were recorded
 // out of calendar order. Their persisted totals must match the entry ledger.
 for(const metric of ['academic','social']){
  const expected=Math.min(12,Object.values(ledger.entries).reduce(
   (sum,entry)=>sum+(entry.effects[metric]??0),0));
  if(Math.abs(ledger.totals[metric]-expected)>1e-8)
   throw new RangeError('Invalid NPC activity total coherence: '+metric);
 }
}
function assertActivityStorage(person,year){
 if(person.activityLedger!=null)assertActivityLedger(person.activityLedger);
 if(person.activityLedgerHistory!=null&&!isRecord(person.activityLedgerHistory))
  throw new TypeError('Invalid NPC activity history');
 // A corrupted, unrelated year must not silently survive a rollover. In
 // particular, duplicate current-year records would otherwise be shadowed.
 for(const [key,historical] of Object.entries(person.activityLedgerHistory??{})){
  if(!/^(0|[1-9]\d*)$/.test(key)||!Number.isSafeInteger(Number(key)))
   throw new TypeError('Invalid NPC activity history key');
  assertActivityLedger(historical);
  if(historical.year!==Number(key))throw new RangeError('Mismatched NPC activity history year');
  if(person.activityLedger&&historical.year>=person.activityLedger.year)
   throw new RangeError('Invalid duplicate or future NPC activity history year');
 }
}


/** Record one chosen activity per calendar day, idempotently, without touching annual stats. */
export function recordNpcActivity(person,{year,dayOfYear,weekday,activity}={}){
 if(!Number.isInteger(year)||!Number.isInteger(dayOfYear)||!Number.isInteger(weekday))throw new TypeError('Calendar year/day/weekday required');
 const actualWeekday=calendarWeekday(year,dayOfYear);
 if(weekday<1||weekday>7)throw new RangeError('Invalid weekday');
 if(weekday!==actualWeekday)throw new RangeError('Weekday does not match calendar date');
 assertActivityStorage(person,year);
 if(person.activityLedger&&year<person.activityLedger.year)throw new RangeError('Cannot record activity in a past year');
 const existing=ledgerFor(person,year);
 if(existing?.settled) return {status:'year-settled'};
 const schedule=npcDaySchedule(person,{dayOfYear,weekday});
 if(person.alive===false)return {status:'unavailable'};
 const definition=ACTIVITIES[activity];
 if(!definition)throw new RangeError('Unknown activity');
 if(definition.duty&&definition.duty!==schedule.duty)return {status:'not-eligible'};
 if(activity==='socialize'&&!schedule.available)return {status:'not-eligible'};
 const ledger=person.activityLedger??={year,entries:{},totals:{academic:0,social:0,stress:0}};
 if(ledger.year!==year){
  person.activityLedgerHistory??={};
  person.activityLedgerHistory[ledger.year]=ledger;
  person.activityLedger={year,entries:{},totals:{academic:0,social:0,stress:0}};
 }
 const current=person.activityLedger;
 const key=String(dayOfYear);
 if(current.entries[key])return {status:'already-recorded',entry:current.entries[key]};
 const entry={activity,dayOfYear,weekday,effects:{...definition.effects}};
 current.entries[key]=entry;
 for(const [name,amount] of Object.entries(entry.effects)){
  if(name==='stress')continue;
  current.totals[name]=clamp((current.totals[name]??0)+amount,-12,12);
 }
 current.totals.stress=calendarStressTotal(current.entries);
 current.stressOrder='calendar';
 return {status:'recorded',entry};
}

/** Snapshot of the daily layer; no mutation to annual education/social/health stats. */
export function npcActivitySummary(person,year){
 assertActivityStorage(person,year);
 const ledger=ledgerFor(person,year);
 if(!ledger)return {days:0,totals:{academic:0,social:0,stress:0}};
 return {days:Object.keys(ledger.entries).length,totals:{...ledger.totals}};
}

/**
 * Reconcile daily contributions with an annual engine's already-awarded gains.
 * Only the positive *shortfall* is returned: daily activity never stacks on
 * top of an equal or greater annual gain. Caller applies the returned deltas
 * once to its own domain-specific stats; no state is changed here except the
 * settlement marker. Stress is a signed net change and is deliberately excluded
 * until the annual stress model has an explicit integration contract.
 */
export function settleNpcActivityYear(person,{year,annualGains={}}={}){
 if(!Number.isSafeInteger(year)||year<0)throw new TypeError('Calendar year required');
 assertActivityStorage(person,year);
 const ledger=ledgerFor(person,year);
 if(!ledger)return {status:'no-activities',deltas:{academic:0,social:0}};
 if(ledger.settled)return {status:'already-settled',deltas:{academic:0,social:0}};
 if(!isRecord(annualGains))throw new TypeError('Invalid annual gains');
 const deltas={};
 for(const metric of ['academic','social']){
  const annual=annualGains[metric]??0;
  if(typeof annual!=='number'||!Number.isFinite(annual)||annual<0)throw new RangeError('Annual gains must be finite nonnegative numbers');
  deltas[metric]=Math.max(0,Math.min(12,ledger.totals[metric]??0)-annual);
 }
 ledger.settled=true;
 return {status:'settled',deltas};
}
