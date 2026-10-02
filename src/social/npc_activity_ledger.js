import {npcDaySchedule} from './npc_daily_routine.js';

// Explicit opt-in daily layer. Annual simulation must not apply these deltas again.
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));
const ledgerFor=(person,year)=>person.activityLedger?.year===year?person.activityLedger:person.activityLedgerHistory?.[year];
const ACTIVITIES=Object.freeze({
 study:{duty:'school',effects:{academic:0.15,stress:0.05}},
 socialize:{effects:{social:0.12,stress:-0.08}},
 recover:{effects:{stress:-0.18}}
});

/** Record one chosen activity per calendar day, idempotently, without touching annual stats. */
export function recordNpcActivity(person,{year,dayOfYear,weekday,activity}={}){
 if(!Number.isInteger(year)||!Number.isInteger(dayOfYear)||!Number.isInteger(weekday))throw new TypeError('Calendar year/day/weekday required');
 if(dayOfYear<1||dayOfYear>(new Date(Date.UTC(year+1,0,1))-new Date(Date.UTC(year,0,1)))/86400000)throw new RangeError('Invalid day of year');
 if(weekday<1||weekday>7)throw new RangeError('Invalid weekday');
 const actualWeekday=(new Date(Date.UTC(year,0,dayOfYear)).getUTCDay()+6)%7+1;
 if(weekday!==actualWeekday)throw new RangeError('Weekday does not match calendar date');
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
 for(const [name,amount] of Object.entries(entry.effects))current.totals[name]=clamp((current.totals[name]??0)+amount,-12,12);
 return {status:'recorded',entry};
}

/** Snapshot of the daily layer; no mutation to annual education/social/health stats. */
export function npcActivitySummary(person,year){
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
 if(!Number.isInteger(year))throw new TypeError('Calendar year required');
 const ledger=ledgerFor(person,year);
 if(!ledger)return {status:'no-activities',deltas:{academic:0,social:0}};
 if(ledger.settled)return {status:'already-settled',deltas:{academic:0,social:0}};
 const deltas={};
 for(const metric of ['academic','social']){
  const annual=annualGains[metric]??0;
  if(typeof annual!=='number'||!Number.isFinite(annual)||annual<0)throw new RangeError('Annual gains must be finite nonnegative numbers');
  deltas[metric]=Math.max(0,Math.min(12,ledger.totals[metric]??0)-annual);
 }
 ledger.settled=true;
 return {status:'settled',deltas};
}
