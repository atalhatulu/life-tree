import {RNG} from '../core/rng.js';
import {assertValidState} from './invariants.js';

function humanLikeChoice(game,event,choices,rng){
 const s=game.state;
 const has=id=>choices.find(c=>c.id===id);
 const score=new Map(choices.map(c=>[c.id,rng.int(0,8)]));
 const add=(id,value)=>{if(score.has(id))score.set(id,score.get(id)+value);};
 const p=s.player.personality??{};
 const prefs=s.preferences??{};
 const f=s.finance??{};
 const romance=s.social?.romance;
 const debt=f.debt??0, liquid=(f.cash??0)+(f.savings??0);
 const health=s.player.health.current??70, stress=s.healthProfile?.stress??30;

 if(event.id==='high-school-path'){
  add('academic',(p.discipline??50)+(p.curiosity??50)-70);
  add('vocational',70-(p.curiosity??50)+(p.discipline??50)*.25);
 }
 if(event.id==='after-high-school'){
  add('university',(p.ambition??50)+(p.curiosity??50)+(s.education?.performance??50)-110);
  add('work',100-(s.education?.performance??50)+(prefs.riskTolerance??50)*.2);
  add('gap',stress>65?25:0);
 }
 if(event.id==='adult-dating'){
  add('meet',(prefs.partnershipDesire??50)-35+(p.sociability??50)*.25);
  add('focus-self',55-(prefs.partnershipDesire??50)+(stress>65?20:0));
 }
 if(event.id==='relationship-commitment'){
  add('marry',(prefs.marriageDesire??50)+(romance?.relationship??50)-95);
  add('cohabit',(prefs.partnershipDesire??50)+(romance?.relationship??50)-80);
  add('wait',Math.max(0,(romance?.relationshipTension??0)-25));
 }
 if(event.id==='marriage-after-cohabiting'){
  add('marry',(prefs.marriageDesire??50)+(romance?.relationship??50)-(romance?.relationshipTension??0)-55);
  add('wait',55-(prefs.marriageDesire??50)+(romance?.relationshipTension??0));
 }
 if(event.id==='child-decision'){
  const readiness=(prefs.parenthoodDesire??50)+(romance?.preferences?.parenthoodDesire??50)+(romance?.relationship??50)-debt/100000;
  add('have-child',readiness-100+(liquid>250000?18:0));
  add('wait-child',120-readiness+(stress>60?20:0));
 }
 if(event.id==='buy-car'){
  add('skip-car',debt>0?45:0);
  for(const c of choices)if(c.id.startsWith('car:'))add(c.id,liquid>600000?25:-10);
 }
 if(event.id==='buy-home'){
  add('skip-home',debt>0?35:0);
  for(const c of choices)if(c.id.startsWith('home:'))add(c.id,liquid>1500000?35:-15);
 }
 if(event.id==='career-switch'){
  add('stay',(s.career?.satisfaction??50)-45+(stress>70?10:0));
  for(const c of choices)if(c.id!=='stay')add(c.id,(p.ambition??50)-50);
 }
 if(event.id==='health-treatment'){
  for(const c of choices)if(c.id.startsWith('treat:'))add(c.id,80+(100-health)+(stress>60?10:0));
  add('delay-treatment',debt>1500000?18:-30);
 }
 if(event.id==='retirement-decision'){
  add('retire',(100-health)+(stress>65?20:0)+(s.player.age-60)*3);
  add('keep-working',(p.ambition??50)+(health-50));
 }

 return [...choices].sort((x,y)=>(score.get(y.id)??0)-(score.get(x.id)??0))[0]??rng.pick(choices);
}

function chooseByPolicy(game,event,policy,rng){
 const choices=game.eventChoices(event);
 if(!choices.length) return null;
 if(policy==='random') return rng.pick(choices);
 if(policy==='human-like') return humanLikeChoice(game,event,choices,rng);

 const common={
  'adult-lifestyle':'balanced',
  'move-out':'shared',
  'relationship-commitment':'cohabit',
  'marriage-after-cohabiting':'marry',
  'child-decision':'have-child',
  'buy-car':'car:used',
  'buy-home':'home:small-flat',
  'career-switch':'stay'
 };
 const preferred={
  academic:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'leave','gap-year-direction':'retry-university'},
  social:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university','relationship-commitment':'marry'},
  vocational:{...common,'high-school-path':'vocational','after-high-school':'work','first-romance':'approach','gap-year-direction':'seek-work','career-switch':null},
  balanced:{...common,'high-school-path':'academic','after-high-school':'university','first-romance':'approach','gap-year-direction':'retry-university'}
 }[policy]??common;

 const target=preferred[event.id];
 if(event.id==='career-switch'&&policy==='vocational'){
  const better=choices.find(c=>c.id!=='stay');
  if(better)return better;
 }
 return choices.find(c=>c.id===target)??choices[0];
}

function shuffled(ids,rng){
 const pool=[...ids],out=[];
 while(pool.length){const index=rng.int(0,pool.length-1);out.push(pool.splice(index,1)[0]);}
 return out;
}

function activityOrder(game,policy,rng){
 const age=game.state.player.age;
 if(policy==='random') return shuffled(game.availableActivities().map(a=>a.id),rng);
 if(policy==='human-like'){
  const s=game.state, order=[];
  const stress=s.healthProfile?.stress??30, health=s.player.health.current??70;
  const mentalStrain=s.mentalHealth?.strain??0;
  const debt=s.finance?.debt??0, employed=Boolean(s.career?.employed);
  if(mentalStrain>=44)order.push('therapy');
  if(health<55||stress>65)order.push('exercise');
  if(debt>250000)order.push('budget');
  if(s.higherEducation?.enrolled)order.push('study');
  if(employed&&(s.career?.performance??50)<60&&stress<70)order.push('work-hard');
  if(s.social?.romance&&(s.social.romance.relationship??60)<70)order.push('date');
  if((s.social?.friends?.length??0)<2)order.push('socialize');
  if(s.healthProfile?.lastCheckupAge==null||age-s.healthProfile.lastCheckupAge>=4)order.push('checkup');
  order.push('hobby','course','exercise','socialize','budget');
  return [...new Set(order)];
 }
 if(age>=19){
  if(policy==='academic'&&game.state.higherEducation?.enrolled) return ['study','exercise','checkup'];
  if(policy==='social') return ['date','socialize','exercise','checkup'];
  if(policy==='vocational') return ['work-hard','budget','exercise','checkup'];
  return ['work-hard','exercise','budget','date','checkup'];
 }
 if(policy==='academic') return ['study','hobby','exercise'];
 if(policy==='social') return ['socialize','hobby','exercise'];
 if(policy==='vocational') return ['hobby','study','exercise'];
 return ['study','exercise','socialize'];
}

export function autoplay(game,{toAge=18,policy='balanced',onYear=null}={}){
 const rng=new RNG(game.seedText+':autoplay:'+policy);
 while(game.state.player.age<toAge&&game.state.player.alive){
  const event=game.ageOneYear();
  if(event&&game.state.player.alive){
   const choice=chooseByPolicy(game,event,policy,rng.fork('event-'+game.state.year));
   if(choice) game.makeChoice(event,choice.id);
  }

  if(!game.state.player.alive)break;
  const order=activityOrder(game,policy,rng.fork('activities-'+game.state.year));
  for(const id of order){
   if(game.state.actions.remaining<=0) break;
   if(game.availableActivities().some(a=>a.id===id)){
    try{game.performActivity(id);}catch{}
   }
  }
  assertValidState(game.state);
  if(typeof onYear==='function')onYear(game.state,{event});
 }
 return game.state;
}
