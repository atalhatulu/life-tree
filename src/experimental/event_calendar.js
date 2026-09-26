// Calendar constraints for the experimental flow. Dates are inclusive MM-DD.
export const EVENT_CALENDAR={
 'school-start':{earliest_date:'08-20',latest_date:'09-20',trigger:'school-year'},
 'high-school-path':{earliest_date:'05-15',latest_date:'08-31',trigger:'education-transition'},
 'after-high-school':{earliest_date:'06-15',latest_date:'09-30',trigger:'graduation'},
 'university-application':{earliest_date:'06-15',latest_date:'09-15',trigger:'application'},
 'gap-year-direction':{earliest_date:'01-01',latest_date:'12-15',trigger:'gap-year'},
 'first-job':{earliest_date:'01-01',latest_date:'12-15',trigger:'job-offer'},
 'career-switch':{earliest_date:'01-01',latest_date:'12-15',trigger:'career-opportunity'},
 'military-service-decision':{earliest_date:'01-01',latest_date:'12-15',cooldown:3,trigger:'service-eligibility'},
 'adult-dating':{earliest_date:'01-01',latest_date:'12-15',cooldown:2,trigger:'social-opportunity'},
 'parent-study-pressure':{earliest_date:'08-15',latest_date:'11-30',cooldown:3,trigger:'school-year'},
 'health-treatment':{earliest_date:'01-01',latest_date:'12-15',trigger:'diagnosed-condition'},
 'retirement-decision':{earliest_date:'01-01',latest_date:'12-15',trigger:'retirement-eligibility'},
 'retirement-lifestyle':{earliest_date:'01-01',latest_date:'12-31',trigger:'retired'},
 'first-family-hobby':{earliest_date:'01-01',latest_date:'12-15',trigger:'family-opportunity'},
 'return-to-hometown':{earliest_date:'01-01',latest_date:'12-15',trigger:'relocation-opportunity'}
};
export function eventCalendar(event){
 const override=EVENT_CALENDAR[event?.id]??{};
 return {...override,...(event?.calendar??{})};
}
export function calendarDay(year,monthDay){
 if(!/^\d{2}-\d{2}$/.test(monthDay??''))throw new RangeError('Invalid MM-DD');
 const [month,day]=monthDay.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)throw new RangeError('Invalid calendar date');
 return Math.round((date-Date.UTC(year,0,1))/86400000)+1;
}
export function eventWindow(event,year,totalDays){
 const meta=eventCalendar(event);
 const start=meta.earliest_date?calendarDay(year,meta.earliest_date):1;
 const end=meta.latest_date?calendarDay(year,meta.latest_date):totalDays;
 if(start>end)throw new RangeError('Event calendar window is inverted: '+event?.id);
 return {start,end,trigger:meta.trigger??'eligible',cooldown:meta.cooldown??0};
}
export function eventTriggerDay(event,{year,yearStartState}){
 const meta=eventCalendar(event);
 if(meta.trigger!=='diagnosed-condition')return 0;
 // Annual health progression is currently precomputed. Do not expose a newly
 // diagnosed condition before the engine has a real diagnosis date.
 const prior=yearStartState?.healthProfile?.conditions??[];
 if(!prior.length)return null;
 const dated=prior.map(c=>c.diagnosedOn??c.diagnosedDate).filter(Boolean);
 const dates=dated.filter(d=>/^\\d{4}-\\d{2}-\\d{2}$/.test(d)&&Number(d.slice(0,4))===year);
 return dates.length?Math.min(...dates.map(d=>calendarDay(year,d.slice(5)))):0;
}
export function scheduleEventDay({event,year,rng,afterDay=0,totalDays,triggerDay=0}){
 const {start,end}=eventWindow(event,year,totalDays);
 if(triggerDay==null)return null;
 const earliest=Math.max(start,afterDay+1,triggerDay);
 return earliest>end?null:rng.int(earliest,end);
}
