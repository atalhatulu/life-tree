import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {serializeGame} from '../src/core/save_system.js';
import {RNG} from '../src/core/rng.js';
import {processSocialYear} from '../src/social/social_simulation.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';
import {generatePartnerMoveOpportunity,resolvePartnerMove,moveToCity} from '../src/world/migration_system.js';
import {adultEvents} from '../src/events/adult_events.js';

const neverRng={chance:()=>false,int:()=>0,fork(){return this;}};
function setup(seed){
 const s=new Game(seed).state;
 s.player.age=35;s.year=2061;
 return s;
}
function partner(){return {
 id:'p-1',name:'Ece',age:34,alive:true,status:'married',relationship:82,
 personality:{ambition:60,sociability:60},monthlyIncome:50000,job:'Mühendis',jobId:'engineer',
 trust:70,intimacy:70,resentment:10
};}
function friend(){return {id:'f-1',name:'Can',surname:'Y',age:34,alive:true,relationship:75,yearsKnown:5,health:{current:80}};}
function otherCity(cityId){return cityId==='ankara'?'istanbul':'ankara';}

test('partner autonomous year runs once per calendar year and consumes no extra RNG on replay',()=>{
 const s=setup('partner-once');s.social.romance=partner();
 processPartnerLifeYear(s,new RNG('partner-first'));
 const after=structuredClone(s.social.romance);
 const replayRng={int(){throw Error('RNG consumed');},fork(){throw Error('RNG consumed');}};
 assert.deepEqual(processPartnerLifeYear(s,replayRng),[]);
 assert.deepEqual(s.social.romance,after);
 assert.equal(s.social.romance.life.lastProcessedYear,2061);
 s.year=2062;
 processPartnerLifeYear(s,new RNG('partner-next'));
 assert.equal(s.social.romance.life.lastProcessedYear,2062);
 assert.equal(s.social.romance.life.careerYears,after.life.careerYears+1);
});

test('partner autonomous life rejects out-of-order years without mutation',()=>{
 const s=setup('partner-order');s.social.romance=partner();
 processPartnerLifeYear(s,new RNG('partner-order'));
 const before=structuredClone(s.social.romance);
 s.year=2060;
 assert.throws(()=>processPartnerLifeYear(s,new RNG('earlier')),/earlier year/);
 assert.deepEqual(s.social.romance,before);
});

test('deceased partner stays untouched even with a processed-year marker',()=>{
 const s=setup('partner-dead');s.social.romance={...partner(),alive:false,life:{lastProcessedYear:2065}};
 const before=structuredClone(s.social.romance);
 assert.deepEqual(processPartnerLifeYear(s,new RNG('dead')),[]);
 assert.deepEqual(s.social.romance,before);
});

test('friend social year ages and drifts only once per calendar year',()=>{
 const s=setup('friend-once');s.social.friends=[friend()];
 processSocialYear(s,neverRng);
 const after=structuredClone(s.social);
 assert.deepEqual(processSocialYear(s,{chance(){throw Error('RNG consumed');}}),[]);
 assert.deepEqual(s.social,after);
 assert.equal(s.social.lastProcessedYear,2061);
 s.year=2062;s.player.age++;
 processSocialYear(s,neverRng);
 assert.equal(s.social.friends[0].age,after.friends[0].age+1);
});

test('friend social year rejects earlier calendar years without mutation',()=>{
 const s=setup('friend-order');s.social.friends=[friend()];
 processSocialYear(s,neverRng);
 const before=structuredClone(s.social);
 s.year=2060;
 assert.throws(()=>processSocialYear(s,neverRng),/earlier year/);
 assert.deepEqual(s.social,before);
});

test('friend social year preserves old saves with no prior processed-year marker',()=>{
 const s=setup('friend-legacy');s.social.friends=[friend()];
 delete s.social.lastProcessedYear;
 processSocialYear(s,neverRng);
 assert.equal(s.social.friends[0].age,35);
 assert.equal(s.social.lastProcessedYear,2061);
});

test('stale partner move from another departure city is unavailable in event and resolver',()=>{
 const s=setup('move-stale');s.social.romance=partner();
 const current=s.location.cityId;
 s.pendingPartnerMove={partnerId:'p-1',previousCityId:otherCity(current),cityId:current,cityName:s.location.cityName,newIncome:65000};
 const before=structuredClone(s);
 assert.equal(adultEvents.find(e=>e.id==='partner-job-relocation').condition(s),false);
 for(const accept of [true,false]){
  assert.throws(()=>resolvePartnerMove(s,accept),/Aktif eş taşınma fırsatı yok/);
  assert.deepEqual(s,before);
 }
});

test('generation removes stale partner move opportunities after a city change',()=>{
 const s=setup('move-regenerate');s.social.romance=partner();
 s.pendingPartnerMove={partnerId:'p-1',previousCityId:otherCity(s.location.cityId),cityId:'izmir',newIncome:65000};
 assert.equal(generatePartnerMoveOpportunity(s,neverRng),null);
 assert.equal(s.pendingPartnerMove,null);
});

test('a separate move invalidates an existing partner move opportunity immediately',()=>{
 const s=setup('move-invalidate');s.social.romance=partner();
 const current=s.location.cityId;
 const destination=otherCity(current);
 s.pendingPartnerMove={partnerId:'p-1',previousCityId:current,cityId:'izmir',newIncome:65000};
 const result=moveToCity(s,destination,'job');
 assert.equal(result.moved,true);
 assert.equal(s.pendingPartnerMove,null);
 assert.throws(()=>resolvePartnerMove(s,true),/Aktif eş taşınma fırsatı yok/);
});

test('legacy pending partner move without departure-city metadata remains valid',()=>{
 const s=setup('move-legacy');s.social.romance=partner();
 s.pendingPartnerMove={partnerId:'p-1',cityId:otherCity(s.location.cityId),newIncome:65000};
 assert.equal(adultEvents.find(e=>e.id==='partner-job-relocation').condition(s),true);
 assert.deepEqual(resolvePartnerMove(s,false),{moved:false});
 assert.equal(s.pendingPartnerMove,null);
});


test('annual social and partner markers survive save/load and prevent replay',()=>{
 const game=new Game('year-markers-save');
 game.state.player.age=35;game.state.year=2061;
 game.state.social.friends=[friend()];game.state.social.romance=partner();
 processSocialYear(game.state,neverRng);
 processPartnerLifeYear(game.state,new RNG('save-partner'));
 const restored=Game.fromSave(serializeGame(game));
 const before=structuredClone(restored.state.social);
 assert.deepEqual(processSocialYear(restored.state,neverRng),[]);
 assert.deepEqual(processPartnerLifeYear(restored.state,new RNG('replay-partner')),[]);
 assert.deepEqual(restored.state.social,before);
});
