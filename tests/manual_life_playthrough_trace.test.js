import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {validateState} from '../src/simulation/invariants.js';
import {computePrimaryStats} from '../src/life/primary_stats.js';

test('one narrated life from birth to death with deliberate choices',()=>{
 const game=new Game('teha-playthrough-2026-09-25');
 const prefer={
  'high-school-path':['academic','vocational'],
  'after-high-school':['university','work'],
  'first-romance':['approach','leave'],
  'adult-dating':['meet','focus-self'],
  'relationship-commitment':['cohabit','marry','wait'],
  'marriage-after-cohabiting':['marry','continue'],
  'child-decision':['have-child','wait-child'],
  'retirement-decision':['retire','keep-working'],
  'career-switch':['stay'],
  'health-treatment':[]
 };
 const shown=new Set();
 const printable=(x)=>String(x??'').replace(/\\s+/g,' ').slice(0,220);
 const print=(tag,x)=>console.log('PLAY '+tag+' '+printable(x));
 print('SEED',game.seedText);
 print('BIRTH',JSON.stringify({name:game.state.player.name,surname:game.state.player.surname,city:game.state.origin?.cityName,class:game.state.household.economicClass,stats:game.state.primaryStats}));
 for(let i=0;i<135&&game.state.player.alive;i++){
  const before=game.state.history.length;
  const event=game.ageOneYear();
  let s=game.state;
  if(!s.player.alive){
   print('DEATH',JSON.stringify({age:s.player.age,cause:s.deathSummary?.cause??s.death?.cause,recap:s.deathSummary?.recap,treeNodes:s.lifeTree?.nodes?.length,stats:s.primaryStats}));
   break;
  }
  let picked=null,result=null;
  if(event){
   const choices=game.eventChoices(event);
   const first=prefer[event.id]?.map(id=>choices.find(c=>c.id===id)).find(Boolean);
   const treatment=event.id==='health-treatment'?choices.find(c=>c.id.startsWith('treat:')):null;
   const selected=first??treatment??choices.find(c=>/study|help|support|work|care|exercise|save|honest|accept|talk|marry|child/i.test(c.id))??choices[0];
   if(selected){
    picked=selected;
    result=game.makeChoice(event,selected.id);
    s=game.state;
    print('CHOICE',JSON.stringify({age:s.player.age,eventId:event.id,title:event.title,choiceId:selected.id,label:selected.label,result}));
   }
  }
  const order=s.player.age<18?['study','exercise','socialize']:s.player.age<65?['work-hard','study','exercise','socialize','checkup']:['checkup','exercise','socialize'];
  for(const id of order){
   if(s.actions?.remaining<=0)break;
   if(game.availableActivities().some(a=>a.id===id)){
    try{game.performActivity(id);}catch(e){print('ACTIVITY_ERROR',JSON.stringify({age:s.player.age,id,message:e.message}));}
   }
  }
  const errors=validateState(s);
  assert.deepEqual(errors,[],game.seedText+' age '+s.player.age);
  assert.deepEqual(s.primaryStats,computePrimaryStats(s));
  const newHistory=s.history.slice(before).filter(x=>x.text||x.result);
  if(s.player.age<=12||s.player.age%5===0||event||newHistory.some(x=>/öl|evlen|çocuk|mezun|işten|terfi|hastalık|boşan/i.test(x.text??x.result??''))){
   print('YEAR',JSON.stringify({age:s.player.age,year:s.year,city:s.location?.cityName,job:s.career?.title,partner:s.social?.romance?.name,children:s.children?.length,cash:Math.round(s.finance?.cash??0),stats:s.primaryStats,history:newHistory.slice(-3).map(x=>printable(x.text??x.result))}));
  }
  if(picked)shown.add(event.id);
 }
 print('FINAL',JSON.stringify({age:game.state.player.age,alive:game.state.player.alive,events:[...shown],nodes:game.state.lifeTree?.nodes?.map(n=>({age:n.age,title:n.title,choice:n.choiceId})),deathSummary:game.state.deathSummary??null}));
 assert.ok(game.state.player.age>=1);
});
