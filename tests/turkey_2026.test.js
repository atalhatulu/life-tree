import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {TURKEY_PROFILE} from '../src/data/countries/turkey/profile.js';
import {TURKEY_2026_ECONOMY} from '../src/data/countries/turkey/economy.js';
import {lifestyleMonthlyCost} from '../src/lifestyle/lifestyle_system.js';
import {affordableHomeOptions} from '../src/assets/asset_system.js';
import {generateJobOffers} from '../src/career/job_market.js';
import {generateUniversityApplications} from '../src/education/university_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {availableActivities} from '../src/life/activity_system.js';
import {processCareerDynamics} from '../src/career/career_system.js';

test('new life starts in Türkiye with a deterministic valid city',()=>{
 const a=new Game('turkey-city-seed');
 const b=new Game('turkey-city-seed');
 assert.equal(a.state.country.id,'TR');
 assert.equal(a.state.origin.cityId,b.state.origin.cityId);
 assert.ok(TURKEY_PROFILE.cities.some(city=>city.id===a.state.origin.cityId));
 assert.equal(a.state.location.cityId,a.state.origin.cityId);
});

test('2026 Türkiye game economy uses configured 30000 TRY minimum wage baseline',()=>{
 assert.equal(TURKEY_2026_ECONOMY.netMinimumWage,30000);
 const cleaner=TURKEY_PROFILE.jobs.find(job=>job.id==='cleaner');
 assert.ok(cleaner.income[0]>=28075);
});

test('same lifestyle costs more in İstanbul than Konya',()=>{
 const game=new Game('city-cost');
 game.state.finance={lifestyle:{housing:'studio',food:'standard',clothing:'standard',transport:'public'}};
 game.state.location={countryId:'TR',cityId:'istanbul',cityName:'İstanbul'};
 const istanbul=lifestyleMonthlyCost(game.state);
 game.state.location={countryId:'TR',cityId:'konya',cityName:'Konya'};
 const konya=lifestyleMonthlyCost(game.state);
 assert.ok(istanbul>konya);
});

test('home prices respond to city housing market',()=>{
 const game=new Game('city-home');
 game.state.finance={cash:5000000,lifestyle:{housing:'family',food:'standard',clothing:'basic',transport:'public'}};
 game.state.career={employed:true,monthlyIncome:200000};
 game.state.location={countryId:'TR',cityId:'istanbul',cityName:'İstanbul'};
 const istanbul=affordableHomeOptions(game.state)[0];
 game.state.location={countryId:'TR',cityId:'konya',cityName:'Konya'};
 const konya=affordableHomeOptions(game.state)[0];
 assert.ok(istanbul.price>konya.price);
});

test('job offers use city wage context',()=>{
 const base=new Game('city-jobs');
 base.state.player.age=25;
 base.state.higherEducation={completed:false};
 base.state.career=null;
 base.state.location={countryId:'TR',cityId:'istanbul',cityName:'İstanbul'};
 const istanbul=generateJobOffers(base.state,new RNG('same-job-rng'),6);
 const clone=structuredClone(base.state);
 clone.location={countryId:'TR',cityId:'konya',cityName:'Konya'};
 const konya=generateJobOffers(clone,new RNG('same-job-rng'),6);
 const shared=istanbul.find(a=>konya.some(b=>b.id===a.id));
 assert.ok(shared);
 const other=konya.find(b=>b.id===shared.id);
 assert.ok(shared.salary>other.salary);
});

test('university applications carry Türkiye campus and city data',()=>{
 const game=new Game('turkey-university');
 game.state.player.age=18;
 game.state.education={
  enrolled:true,stage:'high',performance:72,motivation:70,attendance:95,
  quality:65,aptitude:70,graduationReadiness:72
 };
 const offers=generateUniversityApplications(game.state,new RNG('university-offers'));
 assert.ok(offers.length>=1);
 for(const offer of offers){
  assert.ok(offer.universityName);
  assert.ok(offer.cityName);
  assert.ok(TURKEY_PROFILE.cities.some(city=>city.id===offer.cityId));
 }
});

test('student moving to another city does not default to family housing',()=>{
 const game=new Game('student-away');
 game.state.higherEducation={enrolled:true,movedForUniversity:true};
 game.state.finance=null;
 ensurePersonalFinance(game.state);
 assert.equal(game.state.finance.lifestyle.housing,'shared');
});

test('adult learning replaces school study after high school',()=>{
 const game=new Game('adult-learning');
 game.state.player.age=60;
 game.state.education={enrolled:true,stage:'high'};
 game.state.higherEducation=null;
 const ids=availableActivities(game.state).map(x=>x.id);
 assert.equal(ids.includes('study'),false);
 assert.equal(ids.includes('course'),true);
});

test('promotion and firing never happen in the same career year',()=>{
 for(let i=0;i<500;i++){
  const game=new Game('career-conflict-'+i);
  game.state.player.age=40;
  game.state.career={
   employed:true,jobId:'mechanic',title:'Oto tamircisi',monthlyIncome:60000,
   years:8,totalYears:15,performance:92,degreeRelated:false,level:2,
   satisfaction:45,stability:5
  };
  game.state.player.job='Oto tamircisi';
  game.state.player.monthlyIncome=60000;
  const entries=processCareerDynamics(game.state,new RNG('career-roll-'+i));
  const promoted=entries.some(e=>e.text.includes('Terfi aldın'));
  const fired=entries.some(e=>e.text.includes('işinden çıkarıldın'));
  assert.equal(promoted&&fired,false,'seed '+i+' produced promotion and firing together');
 }
});
