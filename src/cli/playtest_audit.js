import { Game } from '../core/game.js';
import { RNG } from '../core/rng.js';
import { humanLikeChoice, activityOrder } from '../simulation/autoplay.js';
import { assertValidState } from '../simulation/invariants.js';
import { setLifestyle } from '../lifestyle/lifestyle_system.js';

const lives=Number(process.argv[2]??60);
const summaries=[];
const totals={years:0,eventYears:0,activityYears:0,emptyYears:0,choices:0,activities:0,lifestyleChanges:0,everRomance:0,everMarried:0,everChildren:0,everHome:0,everCar:0,deaths:0,invalid:0};
const eventCounts=new Map(), activityCounts=new Map();

function maybeLifestyle(game){
  const s=game.state;
  if(!s.finance||s.player.age<18||s.player.age%5!==0)return 0;
  let changed=0;
  const l=s.finance.lifestyle;
  const cash=(s.finance.cash??0)+(s.finance.savings??0);
  const income=s.career?.monthlyIncome??0;
  const stress=s.healthProfile?.stress??0;
  const food=stress>60?'healthy':income>100000?'premium':income>45000?'healthy':'standard';
  if(l.food!==food){setLifestyle(s,{food});changed++;}
  const clothing=income>120000&&cash>300000?'premium':income>50000?'standard':'basic';
  if(l.clothing!==clothing){setLifestyle(s,{clothing});changed++;}
  const transport=s.assets?.car?'car':'public';
  if(l.transport!==transport){setLifestyle(s,{transport});changed++;}
  return changed;
}

for(let i=0;i<lives;i++){
  const seed='playtest-'+i;
  const game=new Game(seed);
  const rng=new RNG(seed+':player');
  let years=0,eventYears=0,activityYears=0,emptyYears=0,choices=0,activities=0,lifestyleChanges=0;
  let everRomance=false,everMarried=false,everChildren=false,everHome=false,everCar=false;
  let invalid=null;

  try{
    while(game.state.player.alive&&game.state.player.age<100){
      const event=game.ageOneYear();
      years++; totals.years++;
      let meaningful=false;

      if(event){
        eventYears++; totals.eventYears++; meaningful=true;
        eventCounts.set(event.id,(eventCounts.get(event.id)??0)+1);
        const options=game.eventChoices(event);
        const chosen=humanLikeChoice(game,event,options,rng.fork('event-'+game.state.year));
        if(chosen){game.makeChoice(event,chosen.id);choices++;totals.choices++;}
      }

      if(game.state.player.alive){
        const before=game.state.actions.remaining;
        const order=activityOrder(game,'human-like',rng.fork('act-'+game.state.year));
        for(const id of order){
          if(game.state.actions.remaining<=0)break;
          if(game.availableActivities().some(a=>a.id===id)){
            try{
              game.performActivity(id);
              activities++;totals.activities++;
              activityCounts.set(id,(activityCounts.get(id)??0)+1);
            }catch{}
          }
        }
        if(game.state.actions.remaining<before){activityYears++;totals.activityYears++;meaningful=true;}
        const changed=maybeLifestyle(game);
        lifestyleChanges+=changed;totals.lifestyleChanges+=changed;
        if(changed>0)meaningful=true;
      }

      if(!meaningful){emptyYears++;totals.emptyYears++;}
      everRomance ||= Boolean(game.state.social?.romance)||(game.state.relationshipHistory?.length??0)>0;
      everMarried ||= game.state.social?.romance?.status==='married'||(game.state.relationshipHistory??[]).some(r=>r.status==='married'||r.everMarried);
      everChildren ||= (game.state.children?.length??0)>0;
      everHome ||= Boolean(game.state.assets?.home);
      everCar ||= Boolean(game.state.assets?.car);
      assertValidState(game.state);
    }
  }catch(error){
    invalid=error?.stack??String(error);
    totals.invalid++;
  }

  if(!game.state.player.alive)totals.deaths++;
  if(everRomance)totals.everRomance++;
  if(everMarried)totals.everMarried++;
  if(everChildren)totals.everChildren++;
  if(everHome)totals.everHome++;
  if(everCar)totals.everCar++;

  summaries.push({seed,age:game.state.player.age,alive:game.state.player.alive,years,eventYears,activityYears,emptyYears,choices,activities,lifestyleChanges,everRomance,everMarried,children:game.state.children?.length??0,home:Boolean(game.state.assets?.home),car:Boolean(game.state.assets?.car),debt:Math.round(game.state.finance?.debt??0),cash:Math.round((game.state.finance?.cash??0)+(game.state.finance?.savings??0)),invalid});
}

const pct=(n,d)=>d?Math.round(n/d*1000)/10:0;
const avg=(key)=>Math.round((summaries.reduce((s,x)=>s+(x[key]??0),0)/summaries.length)*10)/10;
const top=(map,n=10)=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n);

console.log('=== Player-like Playtest Audit ===');
console.log('Lives:',lives,'Invalid:',totals.invalid,'Deaths:',totals.deaths);
console.log('Avg age:',avg('age'),'Avg years:',avg('years'));
console.log('Avg choices:',avg('choices'),'Avg activities:',avg('activities'),'Avg lifestyle changes:',avg('lifestyleChanges'));
console.log('Event-year rate:',pct(totals.eventYears,totals.years)+'%');
console.log('Activity-year rate:',pct(totals.activityYears,totals.years)+'%');
console.log('Empty-year rate:',pct(totals.emptyYears,totals.years)+'%');
console.log('Ever romance:',pct(totals.everRomance,lives)+'%','Ever married:',pct(totals.everMarried,lives)+'%','Ever children:',pct(totals.everChildren,lives)+'%');
console.log('Ever home:',pct(totals.everHome,lives)+'%','Ever car:',pct(totals.everCar,lives)+'%');
console.log('Top events:',JSON.stringify(top(eventCounts)));
console.log('Top activities:',JSON.stringify(top(activityCounts)));
console.log('Most empty-year lives:',JSON.stringify([...summaries].sort((a,b)=>b.emptyYears-a.emptyYears).slice(0,5),null,2));

if(totals.invalid>0)process.exitCode=1;
