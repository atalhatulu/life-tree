import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {earlyYearMoment} from '../src/life/early_year_moments.js';
import {schoolAgeYearMoment} from '../src/life/school_age_year_moments.js';
import {validateState} from '../src/simulation/invariants.js';

// Group 1: ages 0-4. Diagnostic reports real presented events as well as
// the separate browser-only moment and activity surfaces.
test('age-choice audit group 1: 80 newborn-to-preschool lives',()=>{
 const events={},examples=[],activityCounts={};
 let years=0,moments=0,medicalDecisions=0;
 const allowed=new Set(['play','family','rest','draw','learn']);
 for(let i=0;i<80;i++){
  const seed='age-choice-infant-2026-'+String(i).padStart(3,'0');
  const game=new Game(seed);
  assert.equal(game.state.player.age,0);
  assert.deepEqual(game.availableActivities().map(a=>a.id),[],seed+': newborn activity');
  assert.equal(earlyYearMoment(0,new RNG(seed+':moment')),null);
  while(game.state.player.alive&&game.state.player.age<4){
   const event=game.ageOneYear();
   const age=game.state.player.age;
   years++;
   const activities=game.availableActivities().map(a=>a.id);
   for(const id of activities)activityCounts[id]=(activityCounts[id]??0)+1;
   assert.deepEqual(activities,[],seed+': age '+age+' offered an activity');
   if(!game.state.player.alive)break;
   const moment=earlyYearMoment(age,new RNG(seed+':moment:'+age));
   if(age<3)assert.equal(moment,null,seed+': toddler must not make decisions');
   else{
    assert.ok(moment?.choices?.length>=2,seed+': preschool moment absent');
    assert.ok(moment.choices.every(c=>allowed.has(c.id)),seed+': age-inappropriate preschool choice');
    moments++;
   }
   if(event){
    events[event.id]=(events[event.id]??0)+1;
    const choices=game.eventChoices(event);
    if(age<3&&event.id==='health-treatment')medicalDecisions++;
    if(examples.length<8)examples.push({seed,age,eventId:event.id,title:event.title,
     choices:choices.map(c=>c.label)});
    if(choices.length)game.makeChoice(event,choices[0].id);
   }
   assert.deepEqual(validateState(game.state),[],seed+': invalid state at '+age);
  }
 }
 const probe=new Game('age-choice-medical-probe');
 probe.state.player.age=2;
 probe.state.healthProfile??={conditions:[],stress:20,fitness:50,lastCheckupAge:null};
 probe.state.healthProfile.conditions.push({id:'childhood-condition-probe',label:'Çocukluk sağlık sorunu',severity:2});
 const treatment=probe.events.events.find(e=>e.id==='health-treatment');
 const canAppear=treatment.condition(probe.state);
 const choiceLabels=probe.eventChoices(treatment).map(c=>c.label);
 const pediatricTreatmentBlocked=!canAppear;
 const medicalWordingNeedsReview=choiceLabels.some(label=>/tedavi ol|tedaviyi ertele/i.test(label));
 const summary={group:'0-4',lives:80,years,moments,activityCounts,events,
  sampleEvents:examples,infantTreatmentDecisions:medicalDecisions,
  medicalProbe:{canAppear,age:2,choiceLabels,pediatricTreatmentBlocked,medicalWordingNeedsReview}};
 console.log('AGE_CHOICE_GROUP_1_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('AGE_CHOICE_GROUP_1_END');
 assert.equal(pediatricTreatmentBlocked,true,
  'review pediatric treatment eligibility when the age restriction is fixed');
});

test('age-choice audit group 2: 80 lives from ages 5-9 and affordable options',()=>{
 const eventCounts={},activityCounts={},momentCounts={},examples=[];
 let checkedYears=0,checkedMoments=0,schoolByAge9=0,zeroWalletYears=0,hobbyAutoChoices=0;
 const prices={'snack':120,'book':280,'game-spend':450};
 for(let i=0;i<80;i++){
  const seed='age-choice-school-2026-'+String(i).padStart(3,'0');
  const game=new Game(seed);
  while(game.state.player.alive&&game.state.player.age<9){
   const event=game.ageOneYear();
   const age=game.state.player.age;
   if(!game.state.player.alive)break;
   if(age<5)continue;
   checkedYears++;
   const available=game.availableActivities();
   for(const a of available)activityCounts[a.id]=(activityCounts[a.id]??0)+1;
   assert.ok(available.every(a=>a.minAge<=age),seed+': activity before minAge');
   assert.equal(available.some(a=>a.id==='work-hard'||a.id==='course'||a.id==='budget'||a.id==='date'),false);
   if(age===9&&game.state.education?.enrolled)schoolByAge9++;
   const moment=age<7?earlyYearMoment(age,new RNG(seed+':moment:'+age)):
    schoolAgeYearMoment(game.state,new RNG(seed+':moment:'+age));
   assert.ok(moment?.choices?.length>=2,seed+': no age-appropriate moment at '+age);
   momentCounts[moment.title]=(momentCounts[moment.title]??0)+1;
   checkedMoments++;
   const wallet=game.state.childMoney?.wallet??0;
   if(age>=7&&wallet<=0)zeroWalletYears++;
   for(const choice of moment.choices){
    assert.ok((prices[choice.id]??0)<=wallet,
     seed+': unaffordable choice '+choice.id+' at '+age+', wallet='+wallet);
    if(choice.id==='study')assert.ok(game.state.education?.enrolled,
     seed+': homework while not enrolled');
   }
   if(event){
    eventCounts[event.id]=(eventCounts[event.id]??0)+1;
    const choices=game.eventChoices(event);
    assert.ok(choices.every(x=>x.label&&x.id),seed+': malformed choice');
    if(examples.length<10)examples.push({seed,age,event:event.id,choices:choices.map(x=>x.label)});
    if(choices.length)game.makeChoice(event,choices[0].id);
   }
   if(available.some(a=>a.id==='hobby')&&Object.keys(game.state.player.interests).length>1){
    hobbyAutoChoices++;
   }
   assert.deepEqual(validateState(game.state),[],seed+': invalid state at '+age);
  }
 }
 const testState=new Game('school-moment-poverty-probe').state;
 testState.player.age=8;
 testState.education=null;
 testState.childMoney={wallet:0,saved:0};
 for(let i=0;i<30;i++){
  const moment=schoolAgeYearMoment(testState,new RNG('poverty-'+i));
  assert.equal(moment.title,'Hafta sonu');
  assert.ok(moment.choices.every(c=>!['snack','book','game-spend','study'].includes(c.id)));
 }
 const summary={group:'5-9',lives:80,checkedYears,checkedMoments,schoolByAge9,
  momentCounts,eventCounts,activityCounts,zeroWalletYears,hobbyAutoChoices,
  exampleEvents:examples};
 console.log('AGE_CHOICE_GROUP_2_START');
 console.log(JSON.stringify(summary,null,2));
 console.log('AGE_CHOICE_GROUP_2_END');
 assert.ok(checkedYears>=300);
 assert.ok(checkedMoments>=300);
});
