import test from 'node:test';
import assert from 'node:assert/strict';
import {
 emptyDiscovery,recordLivedChoice,recordSimulatedChoice,recordEnding,
 recordCompletedLife,discoveryStatus,discoveryStats,loadDiscovery,saveDiscovery,
 DISCOVERY_STORAGE_KEY
} from '../src/life/discovery_system.js';

function node(choiceId='accept'){
 return {
  eventId:'career-choice',choiceId,label:choiceId==='accept'?'Kabul et':'Reddet',
  title:'Büyük iş teklifi',age:28
 };
}
function simulated(choiceId='reject'){
 return {
  choiceId,label:'Reddet',completedSamples:12,requestedSamples:12,
  averageAge:78,averageNetWorth:1000,childrenProbability:50,
  strongFamilyProbability:40,strongCareerProbability:60,
  averageChildren:1,averageMajorDecisions:7,
  endingDistribution:[{id:'quiet-security',title:'Sessiz Güvenlik',count:6,probability:50}],
  mostLikelyEnding:{id:'quiet-security',title:'Sessiz Güvenlik',count:6,probability:50}
 };
}
function storage(){
 const map=new Map();
 return {
  getItem:k=>map.has(k)?map.get(k):null,
  setItem:(k,v)=>map.set(k,String(v)),
  removeItem:k=>map.delete(k)
 };
}

test('simulated path becomes simulated discovery state',()=>{
 let d=emptyDiscovery();
 d=recordSimulatedChoice(d,node('accept'),simulated('reject'));
 assert.equal(discoveryStatus(d,'career-choice','reject'),'simulated');
 assert.equal(discoveryStats(d).simulatedChoices,1);
});

test('actually living a simulated path upgrades it from simulated to lived',()=>{
 let d=emptyDiscovery();
 d=recordSimulatedChoice(d,node('accept'),simulated('reject'));
 const lived={...node('reject'),choiceId:'reject',label:'Reddet'};
 d=recordLivedChoice(d,lived,{seedText:'run-2'});
 assert.equal(discoveryStatus(d,'career-choice','reject'),'lived');
 assert.equal(discoveryStats(d).simulatedChoices,0);
 assert.equal(discoveryStats(d).livedChoices,1);
 assert.equal(d.livedChoices['career-choice::reject'].timesLived,1);
});

test('completed life records every lived major choice and reached ending',()=>{
 let d=emptyDiscovery();
 const state={
  lifeTree:{
   nodes:[node('accept'),{eventId:'move',choiceId:'stay',label:'Kal',title:'Şehir',age:35}],
   finale:{
    ending:{id:'quiet-security',title:'Sessiz Güvenlik',description:'x'},
    lifespan:{age:81}
   }
  }
 };
 d=recordCompletedLife(d,state,{seedText:'life-1'});
 assert.equal(d.livesCompleted,1);
 assert.equal(discoveryStatus(d,'career-choice','accept'),'lived');
 assert.equal(discoveryStatus(d,'move','stay'),'lived');
 assert.equal(d.endings['quiet-security'].timesReached,1);
});

test('ending discovery counts repeated endings across lives',()=>{
 let d=emptyDiscovery();
 const finale={ending:{id:'ordinary-life',title:'Yaşanmış Bir Hayat',description:'x'},lifespan:{age:70}};
 d=recordEnding(d,finale,{seedText:'a'});
 d=recordEnding(d,finale,{seedText:'b'});
 assert.equal(d.endings['ordinary-life'].timesReached,2);
 assert.equal(d.endings['ordinary-life'].firstAge,70);
});

test('discovery profile persists through storage and corrupt data fails safe',()=>{
 const s=storage();
 let d=recordLivedChoice(emptyDiscovery(),node('accept'),{seedText:'x'});
 saveDiscovery(d,s);
 assert.ok(s.getItem(DISCOVERY_STORAGE_KEY));
 const restored=loadDiscovery(s);
 assert.equal(discoveryStatus(restored,'career-choice','accept'),'lived');
 s.setItem(DISCOVERY_STORAGE_KEY,'{broken-json');
 const safe=loadDiscovery(s);
 assert.equal(discoveryStats(safe).livesCompleted,0);
});
