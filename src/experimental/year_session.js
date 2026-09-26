import {RNG} from '../core/rng.js';
import {createSavePayload} from '../core/save_system.js';
import {settleExperimentalMonth} from './monthly_finance.js';
import {daysInYear,scheduleYearPresentation} from './year_flow_scheduler.js';
import {eventCalendar,scheduleEventDay} from './event_calendar.js';

// Experimental session: the live Game is never mutated. A year is calculated
// once on a private clone; subsequent decisions are resolved on that clone.
export class ExperimentalYearSession {
  constructor(game,{maxDecisions=3}={}){
    if(!game?.state?.player?.alive)throw new Error('Cannot start a year for a deceased player');
    if(!Number.isInteger(maxDecisions)||maxDecisions<1||maxDecisions>5)throw new RangeError('maxDecisions must be 1..5');
    this.game=game;
    this.preview=game.constructor.fromSave(createSavePayload(game));
    this.maxDecisions=maxDecisions;
    this.year=this.preview.state.year+1;
    this.day=1;
    this.phase='ready';
    this.committed=false;
    this.timeline=[];
    this.cursor=0;
    this.currentEvent=null;
    this.decisions=0;
    this.presentedIds=new Set();
    this.historyStart=this.preview.state.history.length;
    this.seed=game.seedText;
    this.rng=new RNG(this.seed+':experimental-session:'+this.year);
  }
  start(){
    if(this.phase!=='ready')throw new Error('Year already started');
    const first=this.preview.ageOneYear({deferFinance:true});
    if(this.preview.state.finance){
      this.preview.state.finance.discretionaryAnnual=0;
      this.preview.state.finance.activitySpendingAnnual=0;
    }
    // A repeated event can be replaced by another currently eligible event.
    const initial=first&&this.recentlyRepeated(first)?this.preview.events.eligible(this.preview.state)
      .filter(e=>e.id!==first.id&&!this.recentlyRepeated(e))
      .sort((a,b)=>(b.priority??0)-(a.priority??0))[0]??null:first;
    this.timeline=scheduleYearPresentation({
      seed:this.seed,year:this.year,
      history:this.preview.state.history.slice(this.historyStart),
      decision:initial
    }).timeline;
    this.phase='running';
    return this.snapshot();
  }
  snapshot(){
    const date=new Date(Date.UTC(this.year,0,this.day));
    return {year:this.year,day:this.day,month:date.getUTCMonth()+1,dayOfMonth:date.getUTCDate(),
      isoDate:date.toISOString().slice(0,10),totalDays:daysInYear(this.year),
      phase:this.phase,decisions:this.decisions,pending:this.currentEvent?
      {id:this.currentEvent.id,title:this.currentEvent.title,choices:this.preview.eventChoices(this.currentEvent).map(c=>({id:c.id,label:c.label}))}:null};
  }
  // Advance the actual experimental calendar one day at a time. Never skip a pending item.
  tickDay(){
    if(this.phase!=='running')throw new Error('Calendar must be running');
    const next=this.timeline[this.cursor];
    if(next&&this.day>=next.day)throw new Error('Process the scheduled item before advancing');
    if(this.day>=daysInYear(this.year))throw new Error('Process year completion');
    const priorMonth=new Date(Date.UTC(this.year,0,this.day)).getUTCMonth()+1;
    this.day++;
    const currentMonth=new Date(Date.UTC(this.year,0,this.day)).getUTCMonth()+1;
    if(currentMonth!==priorMonth)this.settleMonth(priorMonth);
    return this.snapshot();
  }
  settleMonth(month){
    return settleExperimentalMonth(this.preview.state,month);
  }
  pause(){
    if(this.phase!=='running')throw new Error('Only a running calendar can be paused');
    this.phase='paused';return this.snapshot();
  }
  resume(){
    if(this.phase!=='paused')throw new Error('Only a paused calendar can resume');
    this.phase='running';return this.snapshot();
  }
  // A scheduled item may only be processed when the calendar reaches its day.
  advance(){
    if(this.phase==='ready')throw new Error('Start the year first');
    if(this.phase==='waiting')throw new Error('Resolve the pending decision first');
    if(this.phase==='paused')throw new Error('Resume the calendar first');
    if(this.phase==='complete')return {type:'complete',...this.snapshot()};
    const item=this.timeline[this.cursor];
    if(!item){
      if(this.day!==daysInYear(this.year))throw new Error('Reach December 31 before completing the year');
      this.settleMonth(12);
      this.phase='complete';
      return {type:'complete',...this.snapshot()};
    }
    if(this.day!==item.day)throw new Error('Reach scheduled day before processing item');
    this.cursor++;
    if(item.type==='notice')return {type:'notice',day:this.day,text:item.text,...this.snapshot()};
    const event=this.preview.events.events.find(e=>e.id===item.id);
    if(!event||!this.preview.events.eligible(this.preview.state).some(e=>e.id===event.id)||
      this.recentlyRepeated(event)||this.presentedIds.has(event.id))return {type:'skipped',day:this.day,...this.snapshot()};
    this.currentEvent=event;this.presentedIds.add(event.id);
    this.phase='waiting';
    return {type:'decision',day:this.day,...this.snapshot()};
  }
  recentlyRepeated(event){
    // Keep meaningful recurring events possible, but prevent identical unresolved
    // dilemmas from occupying consecutive years in the experimental flow.
    const gap=eventCalendar(event).cooldown??({'gap-year-direction':2,'university-application':2}[event.id]??0);
    if(!gap)return false;
    return this.preview.state.history.some(h=>h.kind==='choice'&&h.eventId===event.id&&
      Number.isFinite(h.age)&&this.preview.state.player.age-h.age<gap);
  }
  choose(choiceId){
    if(this.phase!=='waiting'||!this.currentEvent)throw new Error('No pending decision');
    const event=this.currentEvent;
    const result=this.preview.makeChoice(event,choiceId);
    this.currentEvent=null;this.decisions++;
    this.phase='running';
    if(this.preview.state.player.alive&&this.decisions<this.maxDecisions){
      // Re-evaluate eligibility AFTER the choice. Never repeat an event in one year.
      const candidates=this.preview.events.eligible(this.preview.state)
        .filter(e=>!this.presentedIds.has(e.id)&&!this.recentlyRepeated(e)&&
          Number.isFinite(e.weight?.(this.preview.state)??1)&&(e.weight?.(this.preview.state)??1)>0);
      const schedulable=candidates.filter(e=>scheduleEventDay({event:e,year:this.year,rng:new RNG(this.seed+':window-check:'+e.id),afterDay:this.day+19,totalDays:daysInYear(this.year)})!=null);
      if(schedulable.length){
        const priority=Math.max(...schedulable.map(e=>e.priority??0));
        const pool=schedulable.filter(e=>(e.priority??0)===priority);
        const next=this.rng.weighted(pool.map(e=>({value:e,weight:e.weight?.(this.preview.state)??1})));
        const day=scheduleEventDay({event:next,year:this.year,rng:this.rng,afterDay:this.day+19,totalDays:daysInYear(this.year)});
        if(day!=null){
          const remaining=this.timeline.slice(this.cursor);
          remaining.push({type:'decision',day,id:next.id,title:next.title});
          remaining.sort((a,b)=>a.day-b.day||(a.type==='notice'?-1:1));
          this.timeline=remaining;
          this.cursor=0;
        }
      }
    }
    return {type:'choice-result',result,...this.snapshot()};
  }
  exportCheckpoint(){
    return {version:1,game:createSavePayload(this.game),preview:createSavePayload(this.preview),
      maxDecisions:this.maxDecisions,year:this.year,day:this.day,phase:this.phase,
      committed:this.committed,timeline:structuredClone(this.timeline),cursor:this.cursor,
      currentEventId:this.currentEvent?.id??null,decisions:this.decisions,
      presentedIds:[...this.presentedIds],historyStart:this.historyStart,seed:this.seed,
      sessionRng:{seed:this.rng.seed,state:this.rng.state}};
  }
  // Only an explicit caller can adopt the preview; the live Game stays untouched otherwise.
  commit(){
    if(this.phase!=='complete')throw new Error('Complete the year before committing');
    if(this.committed)throw new Error('Year already committed');
    if(this.game.state.year!==this.year-1)throw new Error('Live game changed during the experimental year');
    this.game.state=structuredClone(this.preview.state);
    this.game.rng.seed=this.preview.rng.seed;
    this.game.rng.state=this.preview.rng.state;
    this.game.activeEventId=null;
    this.committed=true;
    return this.game;
  }
}

export function restoreExperimentalYearSession(Game,checkpoint){
 if(checkpoint?.version!==1||!checkpoint.game||!checkpoint.preview)throw new Error('Invalid experimental checkpoint');
 const game=Game.fromSave(checkpoint.game);
 const session=new ExperimentalYearSession(game,{maxDecisions:checkpoint.maxDecisions});
 session.preview=Game.fromSave(checkpoint.preview);
 if(session.preview.state.year!==checkpoint.year||game.state.year!==checkpoint.year-1)throw new Error('Checkpoint year mismatch');
 if(!Number.isInteger(checkpoint.day)||checkpoint.day<1||checkpoint.day>daysInYear(checkpoint.year))throw new Error('Checkpoint day invalid');
 if(!['ready','running','paused','waiting','complete'].includes(checkpoint.phase))throw new Error('Checkpoint phase invalid');
 if(!Array.isArray(checkpoint.timeline)||!Number.isInteger(checkpoint.cursor)||checkpoint.cursor<0||checkpoint.cursor>checkpoint.timeline.length)throw new Error('Checkpoint timeline invalid');
 session.year=checkpoint.year;session.day=checkpoint.day;session.phase=checkpoint.phase;
 session.timeline=structuredClone(checkpoint.timeline);session.cursor=checkpoint.cursor;
 session.currentEvent=checkpoint.currentEventId?session.preview.events.events.find(e=>e.id===checkpoint.currentEventId):null;
 if(checkpoint.phase==='waiting'&&!session.currentEvent)throw new Error('Pending checkpoint event missing');
 session.decisions=checkpoint.decisions;session.presentedIds=new Set(checkpoint.presentedIds);
 session.historyStart=checkpoint.historyStart;session.seed=checkpoint.seed;
 session.rng.seed=checkpoint.sessionRng.seed;session.rng.state=checkpoint.sessionRng.state;
 session.committed=Boolean(checkpoint.committed);
 return session;
}
