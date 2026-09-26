import {RNG} from '../core/rng.js';
import {createSavePayload} from '../core/save_system.js';
import {daysInYear,scheduleYearPresentation} from './year_flow_scheduler.js';

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
    const first=this.preview.ageOneYear();
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
    return {year:this.year,day:this.day,totalDays:daysInYear(this.year),
      phase:this.phase,decisions:this.decisions,pending:this.currentEvent?
      {id:this.currentEvent.id,title:this.currentEvent.title,choices:this.preview.eventChoices(this.currentEvent).map(c=>({id:c.id,label:c.label}))}:null};
  }
  // Advance the actual experimental calendar one day at a time. Never skip a pending item.
  tickDay(){
    if(this.phase!=='running')throw new Error('Calendar must be running');
    const next=this.timeline[this.cursor];
    if(next&&this.day>=next.day)throw new Error('Process the scheduled item before advancing');
    if(this.day>=daysInYear(this.year))throw new Error('Process year completion');
    this.day++;
    return this.snapshot();
  }
  // One synchronous step reaches the next scheduled item, without timers.
  advance(){
    if(this.phase==='ready')throw new Error('Start the year first');
    if(this.phase==='waiting')throw new Error('Resolve the pending decision first');
    if(this.phase==='complete')return {type:'complete',...this.snapshot()};
    const item=this.timeline[this.cursor++];
    if(!item){
      this.day=daysInYear(this.year);this.phase='complete';
      return {type:'complete',...this.snapshot()};
    }
    this.day=Math.max(this.day,item.day);
    if(item.type==='notice')return {type:'notice',day:this.day,text:item.text,...this.snapshot()};
    const event=this.preview.events.events.find(e=>e.id===item.id);
    if(!event||!this.preview.eventChoices(event).length)return this.advance();
    this.currentEvent=event;this.presentedIds.add(event.id);
    this.phase='waiting';
    return {type:'decision',day:this.day,...this.snapshot()};
  }
  recentlyRepeated(event){
    // Keep meaningful recurring events possible, but prevent identical unresolved
    // dilemmas from occupying consecutive years in the experimental flow.
    const gap={'gap-year-direction':2,'university-application':2,
      'military-service-decision':3,'adult-dating':2,'parent-study-pressure':3}[event.id];
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
      if(candidates.length){
        const priority=Math.max(...candidates.map(e=>e.priority??0));
        const pool=candidates.filter(e=>(e.priority??0)===priority);
        const next=this.rng.weighted(pool.map(e=>({value:e,weight:e.weight?.(this.preview.state)??1})));
        const earliest=Math.min(daysInYear(this.year)-3,this.day+20);
        if(earliest<daysInYear(this.year)-2){
          const day=this.rng.int(earliest,daysInYear(this.year)-2);
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
  // Only an explicit caller can adopt the preview; the live Game stays untouched otherwise.
  commit(){
    if(this.phase!=='complete')throw new Error('Complete the year before committing');
    this.game.state=structuredClone(this.preview.state);
    this.game.rng.seed=this.preview.rng.seed;
    this.game.rng.state=this.preview.rng.state;
    this.game.activeEventId=null;
    return this.game;
  }
}
