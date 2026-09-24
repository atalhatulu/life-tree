import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {TURKEY_CITIES,TURKEY_REGIONS,cityById,cityByPlate,cityByName,pickBirthCity,locationProfile} from '../src/data/countries/turkey/cities.js';
import {TURKEY_PROFILE} from '../src/data/countries/turkey/profile.js';
import {movingCost,moveToCity} from '../src/world/migration_system.js';

test('Türkiye province catalog has 81 unique real provinces and plates 01–81',()=>{
 assert.equal(TURKEY_CITIES.length,81);
 assert.equal(new Set(TURKEY_CITIES.map(city=>city.id)).size,81);
 assert.equal(new Set(TURKEY_CITIES.map(city=>city.name)).size,81);
 assert.deepEqual(TURKEY_CITIES.map(city=>city.plate),Array.from({length:81},(_,index)=>index+1));
 assert.equal(TURKEY_PROFILE.cities,TURKEY_CITIES);
 assert.equal(TURKEY_CITIES.filter(city=>city.regionName===TURKEY_REGIONS[city.region]).length,81);
 assert.equal(TURKEY_CITIES.filter(city=>city.plate>=68).length,14);
 assert.equal(cityByPlate(34)?.name,'İstanbul');
 assert.equal(cityByPlate('06')?.name,'Ankara');
 assert.equal(cityByPlate(33)?.name,'Mersin');
 assert.equal(cityByPlate(81)?.name,'Düzce');
 assert.equal(cityByName(' şanlıurfa ')?.id,'sanliurfa');
 assert.equal(cityByName('IĞDIR')?.id,'igdir');
 assert.equal(cityByPlate(82),null);
 assert.equal(cityByName('olmayan il'),null);
});

test('all 81 provinces have finite valid balancing fields and resolve by ID',()=>{
 for(const city of TURKEY_CITIES){
  assert.equal(cityById(city.id),city);
  assert.equal(cityByPlate(city.plate),city);
  for(const field of ['weight','cost','wage','housing','jobs','university']){
   assert.ok(Number.isFinite(city[field])&&city[field]>0,city.name+' has invalid '+field);
  }
 }
 assert.equal(cityById('legacy-unknown')?.id,'istanbul');
});

test('previous 14 city economics remain unchanged for saved gameplay balance',()=>{
 const expected={
  istanbul:[18,1.35,1.18,1.55,1.24,1.20],
  ankara:[8,1.12,1.08,1.15,1.10,1.18],
  izmir:[7,1.18,1.05,1.22,1.06,1.12],
  bursa:[6,1.02,1.04,1.00,1.10,1.02],
  antalya:[5,1.12,1.00,1.18,1.02,.98],
  adana:[4,.90,.92,.84,.94,.96],
  konya:[4,.86,.93,.80,.96,.98],
  gaziantep:[4,.90,.95,.83,1.00,.92],
  mersin:[4,.94,.94,.90,.94,.94],
  eskisehir:[3,.95,.91,.92,.90,1.15],
  samsun:[3,.88,.91,.84,.90,.96],
  kayseri:[3,.86,.94,.80,.98,.94],
  diyarbakir:[3,.84,.89,.76,.86,.92],
  trabzon:[2,.92,.90,.88,.88,.96]
 };
 for(const [id,values] of Object.entries(expected)){
  assert.deepEqual(
   ['weight','cost','wage','housing','jobs','university'].map(key=>cityById(id)[key]),
   values,id
  );
 }
});

test('weighted birth choice is deterministic and can reach all 81 provinces',()=>{
 const first=new RNG('81-iller'),second=new RNG('81-iller');
 const a=Array.from({length:25000},()=>pickBirthCity(first).id);
 const b=Array.from({length:25000},()=>pickBirthCity(second).id);
 assert.deepEqual(a,b);
 assert.equal(new Set(a).size,81);
 assert.ok(a.filter(id=>id==='istanbul').length>a.filter(id=>id==='bayburt').length);
});

test('every province can be used by a new or relocated player',()=>{
 const game=new Game('81-province-migration');
 for(const city of TURKEY_CITIES){
  game.state.location={countryId:'TR',cityId:city.id,cityName:city.name,sinceYear:2026};
  assert.equal(locationProfile(game.state).id,city.id);
  assert.ok(Number.isFinite(movingCost(city.id,'ankara',2)));
 }
 game.state.location={countryId:'TR',cityId:'ankara',cityName:'Ankara',sinceYear:2026};
 const move=moveToCity(game.state,'bayburt','personal',{costMultiplier:0});
 assert.equal(move.moved,true);
 assert.equal(game.state.location.cityId,'bayburt');
 assert.equal(game.state.location.cityName,'Bayburt');
 assert.equal(game.state.migrationHistory.at(-1).toCityId,'bayburt');
});
