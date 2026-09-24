import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {schoolAgeYearMoment} from '../src/life/school_age_year_moments.js';
import {teenYearMoment} from '../src/life/teen_year_moments.js';
import {validateState} from '../src/simulation/invariants.js';

const COSTS={'game-spend':450,snack:120,book:280,'meal-small':300,'clothes-small':650};

test('hobby selection trains requested interest, does not silently switch, and uses one action',()=>{
 const game=new Game('select-specific-hobby-2026');
 game.state.player.age=10;
 game.state.actions={remaining:3,max:3};
 game.state.player.interests={futbol:84,resim:24};
 const before={...game.state.player.interests};
 const result=game.performActivity('hobby:resim');
 assert.match(result,/resim/);
 assert.equal(game.state.player.interests.futbol,before.futbol);
 assert.ok(game.state.player.interests.resim>before.resim);
 assert.equal(game.state.actions.remaining,2);
 assert.equal(game.availableActivities().some(a=>a.id==='hobby'),false);
 assert.throws(()=>game.performActivity('hobby:futbol'),/zaten yaptın/);
 assert.throws(()=>game.performActivity('hobby:invalid-hobby'),/Bilinmeyen hobi/);
 assert.deepEqual(validateState(game.state),[]);
});

test('age-choice audit group 3: 80 complete childhood paths through ages 10-13',()=>{
 const eventCounts={},momentCounts={},activityCounts={},examples=[],flags=[];
 let checked=0;
 for(let i=0;i<80;i++){
  const seed='age-choice-preteen-2026-'+String(i).padStart(3,'0');
  const game=new Game(seed);
  while(game.state.player.alive&&game.state.player.age<13){
   const event=game.ageOneYear();
   const age=game.state.player.age;
   if(!game.state.player.alive)break;
   const choices=event?game.eventChoices(event):[];
   if(age>=10){
    checked++;
    const available=game.availableActivities();
    for(const a of available)activityCounts[a.id]=(activityCounts[a.id]??0)+1;
    if(available.some(a=>a.minAge>age))flags.push({seed,age,kind:'activity-before-min-age'});
    const moment=age<13?
     schoolAgeYearMoment(game.state,new RNG(seed+':moment:'+age)):
     teenYearMoment(game.state,new RNG(seed+':moment:'+age));
    momentCounts[moment.title]=(momentCounts[moment.title]??0)+1;
    const wallet=game.state.childMoney?.wallet??0;
    for(const choice of moment.choices){
     if((COSTS[choice.id]??0)>wallet)flags.push({seed,age,kind:'unaffordable-offer',choice:choice.id,wallet});
     if(['study','club'].includes(choice.id)&&!game.state.education?.enrolled)
      flags.push({seed,age,kind:'school-activity-without-enrollment',choice:choice.id});
    }
    if(event){
     eventCounts[event.id]=(eventCounts[event.id]??0)+1;
     if(examples.length<10)examples.push({seed,age,eventId:event.id,choices:choices.map(c=>c.label)});
    }
   }
   if(event&&choices.length)game.makeChoice(event,choices[0].id);
   const errors=validateState(game.state);
   if(errors.length)flags.push({seed,age,kind:'invalid-state',errors});
  }
 }
 const poor=new Game('age13-no-money-probe');
 poor.state.player.age=13;
 poor.state.childMoney={wallet:0,saved:0};
 poor.state.education=null;
 for(let i=0;i<40;i++){
  const moment=teenYearMoment(poor.state,new RNG('age13-poor-'+i));
  assert.equal(moment.title,'Kendine yatırım');
  assert.ok(moment.choices.every(c=>!(c.id in COSTS)&&!['study','club'].includes(c.id)));
 }
 const report={group:'10-13',lives:80,checkedYears:checked,eventCounts,momentCounts,
  activityCounts,flags:flags.slice(0,12),flagTotal:flags.length,examples};
 console.log('AGE_CHOICE_GROUP_3_START');
 console.log(JSON.stringify(report,null,2));
 console.log('AGE_CHOICE_GROUP_3_END');
 assert.equal(checked,320);
 assert.deepEqual(flags,[]);
});
