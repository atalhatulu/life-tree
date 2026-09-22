import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';
import {REGRESSION_SEEDS} from '../src/simulation/regression_seeds.js';
import {buildScenario} from '../src/simulation/scenarios.js';

function median(values){
 const s=[...values].sort((a,b)=>a-b);
 if(!s.length)return 0;
 const m=Math.floor(s.length/2);
 return s.length%2?s[m]:(s[m-1]+s[m])/2;
}

test('regression seed corpus completes without invalid state',()=>{
 for(const item of REGRESSION_SEEDS){
  const g=new Game(item.id);
  autoplay(g,{toAge:60,policy:'human-like'});
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],item.id+' -> '+errors.join('; '));
 }
});

test('controlled scenarios start invariant-valid',()=>{
 for(const id of ['low-income-student','career-professional','long-unemployed','two-child-family','heavy-debt','mental-strain']){
  const g=buildScenario(id,'scenario-valid');
  const errors=validateState(g.state);
  assert.deepEqual(errors,[],id+' -> '+errors.join('; '));
 }
});

test('heavy debt scenario does not create negative finance state after progression',()=>{
 const g=buildScenario('heavy-debt','scenario-debt');
 autoplay(g,{toAge:47,policy:'human-like'});
 assert.ok((g.state.finance?.cash??0)>=0);
 assert.ok((g.state.finance?.savings??0)>=0);
 assert.ok((g.state.finance?.debt??0)>=0);
 assert.deepEqual(validateState(g.state),[]);
});

test('long unemployment scenario either reconnects to labor market or keeps explicit unemployment state',()=>{
 const g=buildScenario('long-unemployed','scenario-unemployed');
 autoplay(g,{toAge:44,policy:'human-like'});
 const laborAttached=Boolean(g.state.career?.employed||g.state.pendingJobOffers?.length||g.state.unemployment||g.state.nextPath==='work');
 assert.equal(laborAttached,true);
 assert.deepEqual(validateState(g.state),[]);
});

test('two-child household retains coherent children and family state',()=>{
 const g=buildScenario('two-child-family','scenario-family');
 autoplay(g,{toAge:43,policy:'human-like'});
 assert.equal(g.state.children.length>=2,true);
 assert.ok(g.state.children.every(c=>c.age>=0&&c.age<=g.state.player.age));
 assert.deepEqual(validateState(g.state),[]);
});

test('balance regression sample remains inside broad health family and finance guardrails',()=>{
 const N=60;
 const children=[],conditions=[],debt=[],netWorth=[],datingAges=[];
 let invalid=0,everRomance=0,childless=0,extremeDebt=0;
 for(let i=0;i<N;i++){
  const g=new Game('balance-regression-'+i);
  try{autoplay(g,{toAge:75,policy:'human-like'});}catch{invalid++;continue;}
  const errors=validateState(g.state);
  if(errors.length){invalid++;continue;}
  const s=g.state;
  const partners=[
   ...(s.social?.exPartners??[]),...(s.social?.exSpouses??[]),
   ...(s.social?.deceasedPartners??[]),...(s.social?.romance?[s.social.romance]:[])
  ];
  if(partners.length)everRomance++;
  const count=s.children?.length??0;
  children.push(count);if(count===0)childless++;
  conditions.push(s.healthProfile?.conditions?.length??0);
  const d=s.finance?.debt??0;debt.push(d);if(d>20000000)extremeDebt++;
  const nw=(s.finance?.cash??0)+(s.finance?.savings??0)+(s.assets?.home?.price??0)+(s.assets?.car?.price??0)-d;
  netWorth.push(nw);
  const ages=(s.history??[]).filter(x=>x.kind==='choice'&&x.eventId==='adult-dating'&&x.choiceId==='meet').map(x=>x.age);
  if(ages.length)datingAges.push(Math.min(...ages));
 }
 assert.equal(invalid,0,'invalid lives='+invalid);
 assert.ok(everRomance/N>=.45,'romance collapsed: '+everRomance+'/'+N);
 assert.ok(childless/N<=.90,'parenthood collapsed: childless '+childless+'/'+N);
 assert.ok(median(conditions)<=5,'condition median too high: '+median(conditions));
 assert.ok(extremeDebt/N<=.08,'extreme debt too common: '+extremeDebt+'/'+N);
 assert.ok(median(netWorth)>-2000000,'median net worth collapsed: '+median(netWorth));
 if(datingAges.length>=10)assert.ok(median(datingAges)<=38,'dating timing regressed: '+median(datingAges));
});
