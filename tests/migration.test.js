import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {generateJobOffers,acceptJob} from '../src/career/job_market.js';
import {
 moveToCity,returnHome,generatePartnerMoveOpportunity,resolvePartnerMove
} from '../src/world/migration_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {marryPartner} from '../src/social/partnership_system.js';

test('cross-city job offers exist and contain moving costs',()=>{
 const game=new Game('migration-offers');
 game.state.player.age=24;
 game.state.location={countryId:'TR',cityId:'konya',cityName:'Konya',sinceYear:2050};
 game.state.higherEducation={completed:false};
 let cross=null;
 for(let i=0;i<100&&!cross;i++){
  const offers=generateJobOffers(game.state,new RNG('offer-'+i),8);
  cross=offers.find(x=>x.requiresMove);
 }
 assert.ok(cross);
 assert.ok(cross.cityId!==game.state.location.cityId);
 assert.ok(cross.moveCost>0);
});

test('accepting cross-city job moves household and records migration',()=>{
 const game=new Game('migration-job');
 game.state.player.age=27;
 game.state.year=2053;
 game.state.location={countryId:'TR',cityId:'konya',cityName:'Konya',sinceYear:2048};
 ensurePersonalFinance(game.state);
 game.state.finance.cash=150000;

 const partner=createRomanticInterest(game.state,new RNG('partner'),'partner');
 game.state.social.romance=partner;
 partner.relationship=90;
 marryPartner(game.state);

 let offer=null;
 for(let i=0;i<200&&!offer;i++){
  offer=generateJobOffers(game.state,new RNG('cross-job-'+i),8).find(x=>x.requiresMove);
 }
 assert.ok(offer);

 game.state.pendingJobOffers=[offer];
 const oldCash=game.state.finance.cash;
 const accepted=acceptJob(game.state,offer.id);

 assert.equal(game.state.location.cityId,offer.cityId);
 assert.equal(game.state.social.romance.cityId,offer.cityId);
 assert.equal(game.state.career.cityId,offer.cityId);
 assert.equal(game.state.migrationHistory.at(-1).reason,'job');
 assert.ok(game.state.finance.cash<oldCash||game.state.finance.debt>0);
 assert.ok(accepted.moveResult?.moved);
});

test('partner career relocation moves the couple together',()=>{
 const game=new Game('partner-migration');
 game.state.player.age=33;
 game.state.year=2059;
 game.state.location={countryId:'TR',cityId:'bursa',cityName:'Bursa',sinceYear:2050};
 ensurePersonalFinance(game.state);
 game.state.finance.cash=300000;
 const partner=createRomanticInterest(game.state,new RNG('partner-move-person'),'partner');
 game.state.social.romance=partner;
 partner.relationship=88;
 marryPartner(game.state);

 let opportunity=null;
 for(let i=0;i<200&&!opportunity;i++){
  game.state.pendingPartnerMove=null;
  game.state.nextPartnerMoveAge=23;
  opportunity=generatePartnerMoveOpportunity(game.state,new RNG('partner-op-'+i));
 }
 assert.ok(opportunity);
 const oldIncome=partner.monthlyIncome;
 const targetCity=opportunity.cityId;

 resolvePartnerMove(game.state,true);

 assert.equal(game.state.location.cityId,targetCity);
 assert.equal(game.state.social.romance.cityId,targetCity);
 assert.ok(game.state.social.romance.monthlyIncome>=oldIncome);
 assert.equal(game.state.migrationHistory.at(-1).reason,'partner-job');
 assert.equal(game.state.pendingPartnerMove,null);
});

test('returning home leaves old-city salaried job',()=>{
 const game=new Game('return-home');
 game.state.player.age=38;
 game.state.year=2064;
 const home=game.state.origin;
 const away=home.cityId==='istanbul'
  ? {countryId:'TR',cityId:'ankara',cityName:'Ankara',sinceYear:2058}
  : {countryId:'TR',cityId:'istanbul',cityName:'İstanbul',sinceYear:2058};
 game.state.location=away;
 ensurePersonalFinance(game.state);
 game.state.finance.cash=400000;
 game.state.career={
  employed:true,jobId:'accountant',title:'Muhasebeci',monthlyIncome:80000,
  years:6,totalYears:12,performance:65,previousJobs:[]
 };
 game.state.player.job='Muhasebeci';
 game.state.player.jobId='accountant';
 game.state.player.monthlyIncome=80000;

 const result=returnHome(game.state);

 assert.equal(game.state.location.cityId,home.cityId);
 assert.equal(game.state.career.employed,false);
 assert.equal(game.state.player.job,null);
 assert.equal(game.state.nextPath,'work');
 assert.equal(result.leftJob,true);
 assert.equal(game.state.migrationHistory.at(-1).reason,'return-home');
});

test('migration history remains chronological and city-valid',()=>{
 const game=new Game('migration-history');
 game.state.player.age=30;
 game.state.year=2056;
 ensurePersonalFinance(game.state);
 game.state.finance.cash=1000000;
 const first=game.state.location.cityId==='istanbul'?'ankara':'istanbul';
 moveToCity(game.state,first,'test-one');
 game.state.player.age=31;
 game.state.year=2057;
 const second=first==='izmir'?'bursa':'izmir';
 moveToCity(game.state,second,'test-two');

 assert.equal(game.state.migrationHistory.length,2);
 assert.ok(game.state.migrationHistory[0].year<game.state.migrationHistory[1].year);
 assert.equal(game.state.location.cityId,second);
});


test('hometown return is a one-time major life decision',async()=>{
 const game=new Game('return-home-once');
 game.state.player.age=40;
 game.state.year=2066;
 const home=game.state.origin;
 const away=home.cityId==='istanbul'
  ? {countryId:'TR',cityId:'ankara',cityName:'Ankara',sinceYear:2060}
  : {countryId:'TR',cityId:'istanbul',cityName:'İstanbul',sinceYear:2060};
 game.state.location=away;
 ensurePersonalFinance(game.state);
 game.state.finance.cash=500000;

 returnHome(game.state);
 assert.equal(game.state.hasReturnedHome,true);

 const secondAway=home.cityId==='izmir'?'bursa':'izmir';
 moveToCity(game.state,secondAway,'later-job');
 game.state.player.age=45;
 game.state.year=2071;

 const {canConsiderReturnHome}=await import('../src/world/migration_system.js');
 assert.equal(canConsiderReturnHome(game.state),false);
});
