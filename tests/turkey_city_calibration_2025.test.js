import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/core/rng.js';
import {Game} from '../src/core/game.js';
import {PROVINCE_POPULATION_2025,NATIONAL_POPULATION_2025,POPULATION_YEAR} from '../src/data/countries/turkey/population_2025.js';
import {TURKEY_CITIES,cityById,populationBirthWeight,migrationAttractionWeight,pickBirthCity} from '../src/data/countries/turkey/cities.js';
import {UNIVERSITIES} from '../src/data/countries/turkey/education.js';
import {generateUniversityApplications} from '../src/education/university_system.js';
import {chooseJobOfferCity} from '../src/world/migration_system.js';

test('2025 resident-population baseline covers 81 provinces and balances to the national total',()=>{
 assert.equal(POPULATION_YEAR,2025);
 assert.equal(Object.keys(PROVINCE_POPULATION_2025).length,81);
 assert.equal(Object.values(PROVINCE_POPULATION_2025).reduce((a,b)=>a+b,0),NATIONAL_POPULATION_2025);
 assert.equal(NATIONAL_POPULATION_2025,86092168);
 assert.equal(PROVINCE_POPULATION_2025.istanbul,15754053);
 assert.equal(PROVINCE_POPULATION_2025.ankara,5910320);
 assert.equal(PROVINCE_POPULATION_2025.bayburt,82836);
 for(const city of TURKEY_CITIES){
  assert.equal(city.population2025,PROVINCE_POPULATION_2025[city.id]);
  assert.equal(city.populationYear,2025);
  assert.equal(city.weight,populationBirthWeight(city.population2025));
 }
});

test('population-sampled births remain seeded and cover every province',()=>{
 const a=new RNG('population-2025-sample'),b=new RNG('population-2025-sample');
 const aIds=Array.from({length:30000},()=>pickBirthCity(a).id);
 const bIds=Array.from({length:30000},()=>pickBirthCity(b).id);
 assert.deepEqual(aIds,bIds);
 assert.equal(new Set(aIds).size,81);
 const ist=aIds.filter(x=>x==='istanbul').length;
 const ank=aIds.filter(x=>x==='ankara').length;
 const small=aIds.filter(x=>x==='bayburt').length;
 assert.ok(ist>ank&&ank>small);
 assert.ok(ist>3000&&ist<6500,'Istanbul should be near a smoothed resident share');
});

test('new-city economy stays bounded and differentiated without changing legacy cities',()=>{
 for(const city of TURKEY_CITIES){
  for(const field of ['cost','wage','housing','jobs','university']){
   assert.ok(city[field]>=.7&&city[field]<=1.6,city.name+' '+field);
  }
  assert.ok(migrationAttractionWeight(city)>=.65&&migrationAttractionWeight(city)<=4.5);
 }
 assert.ok(cityById('kocaeli').jobs>cityById('bayburt').jobs);
 assert.ok(cityById('mugla').housing>cityById('bayburt').housing);
 assert.ok(cityById('tekirdag').wage>cityById('tokat').wage);
 assert.equal(cityById('istanbul').cost,1.35);
 assert.equal(cityById('konya').housing,.80);
 assert.notEqual(cityById('istanbul').weight,18);
});

test('university catalog covers additional cities, all campuses resolve to a real province',()=>{
 const ids=UNIVERSITIES.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(UNIVERSITIES.length>=50);
 const cities=new Set(UNIVERSITIES.map(x=>x.cityId));
 assert.ok(cities.size>=45);
 for(const school of UNIVERSITIES)assert.ok(TURKEY_CITIES.some(x=>x.id===school.cityId),school.name);
 for(const id of ['kocaeli','sakarya','denizli','mugla','sanliurfa','van','bayburt'])
  assert.ok(cities.has(id),id+' should have a representative university');
});

test('calibrated university and migration destinations remain deterministic',()=>{
 const g=new Game('city-calibration-applications');
 g.state.player.age=18;
 g.state.education={enrolled:true,stage:'high',performance:75,motivation:72,attendance:90,
  quality:65,aptitude:75,graduationReadiness:74};
 const copy=structuredClone(g.state);
 const first=generateUniversityApplications(g.state,new RNG('uni-city-calibration'),5);
 const second=generateUniversityApplications(copy,new RNG('uni-city-calibration'),5);
 assert.deepEqual(first,second);
 assert.ok(first.every(x=>x.cityId&&x.universityName));
 const jobGame=new Game('city-calibration-migration');
 jobGame.state.player.age=25;
 const cityA=chooseJobOfferCity(jobGame.state,new RNG('migration-weight'));
 const cityB=chooseJobOfferCity(jobGame.state,new RNG('migration-weight'));
 assert.equal(cityA.id,cityB.id);
});
