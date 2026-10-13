import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {moveHousing} from '../src/assets/asset_system.js';
import {selectHighSchoolPath} from '../src/education/pathways.js';
import {setEstatePlan} from '../src/finance/estate_planning.js';
import {settleEstate} from '../src/finance/estate_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';
import {lateAgeEvents} from '../src/events/late_age_events.js';

const state=(seed)=>new Game('cycle36-'+seed).state;
const snap=(s)=>structuredClone(s);

function renter(seed){
 const s=state(seed);
 s.player.age=30;
 ensurePersonalFinance(s);
 s.finance.cash=100_000;
 s.finance.lifestyle.housing='family';
 s.assets={home:null,car:null};
 return s;
}
function pupil(seed){
 const s=state(seed);
 s.player.age=14;
 s.education={enrolled:true,stage:'middle',schoolName:'Ortaokul',quality:65,performance:75,motivation:65,attendance:90};
 return s;
}

test('repeated housing choice is a no-op and does not charge a second deposit',()=>{
 const s=renter('housing-repeat');
 const first=moveHousing(s,'studio');
 assert.equal(first.cost,24_000);
 const before=snap(s);
 assert.deepEqual(moveHousing(s,'studio'),{mode:'studio',cost:0,changed:false});
 assert.deepEqual(s,before);
});

test('repeated housing choice with low cash is still a no-op',()=>{
 const s=renter('housing-poor');
 moveHousing(s,'apartment');
 s.finance.cash=0;
 const before=snap(s);
 assert.equal(moveHousing(s,'apartment').cost,0);
 assert.deepEqual(s,before);
});

test('housing move to a different mode still charges the corresponding deposit',()=>{
 const s=renter('housing-switch');
 moveHousing(s,'shared');
 const before=s.finance.cash;
 const result=moveHousing(s,'studio');
 assert.equal(result.cost,24_000);
 assert.equal(result.changed,true);
 assert.equal(s.finance.cash,before-24_000);
 assert.equal(s.finance.lifestyle.housing,'studio');
});

test('invalid housing mode or owned home rejects without any mutation',()=>{
 const s=renter('housing-invalid');
 const before=snap(s);
 assert.throws(()=>moveHousing(s,'palace'));
 assert.deepEqual(s,before);
 s.assets.home={id:'home',price:1_000_000};
 const owned=snap(s);
 assert.throws(()=>moveHousing(s,'family'));
 assert.deepEqual(s,owned);
});

test('high school path can be chosen exactly once, without a second admission RNG draw',()=>{
 const s=pupil('school-replay');
 const rng=new RNG('school-path-once');
 const first=selectHighSchoolPath(s,rng,'academic');
 assert.equal(s.education.stage,'high');
 assert.equal(first.option.id,'academic');
 const before=snap(s), rngState=rng.state;
 assert.throws(()=>selectHighSchoolPath(s,rng,'academic'),/lise|middle|ortaokul|seçil/i);
 assert.deepEqual(s,before);
 assert.equal(rng.state,rngState);
});

test('a different high school path cannot overwrite an existing admission',()=>{
 const s=pupil('school-switch');
 const rng=new RNG('school-path-switch');
 selectHighSchoolPath(s,rng,'vocational');
 const before=snap(s), rngState=rng.state;
 assert.throws(()=>selectHighSchoolPath(s,rng,'academic'));
 assert.deepEqual(s,before);
 assert.equal(rng.state,rngState);
});

test('school choice rejects unenrolled or pre-middle pupils without mutation',()=>{
 const s=pupil('school-unenrolled');
 const rng=new RNG('school-guard');
 s.education.enrolled=false;
 const before=snap(s);
 assert.throws(()=>selectHighSchoolPath(s,rng,'academic'));
 assert.deepEqual(s,before);
 s.education.enrolled=true;
 s.education.stage='primary';
 const primary=snap(s);
 assert.throws(()=>selectHighSchoolPath(s,rng,'academic'));
 assert.deepEqual(s,primary);
});

test('school path validation rejects invalid and unavailable options without mutation',()=>{
 const s=pupil('school-invalid');
 const rng=new RNG('school-invalid-rng');
 const before=snap(s);
 assert.throws(()=>selectHighSchoolPath(s,rng,'unknown'));
 assert.deepEqual(s,before);
});

test('invalid estate plan is rejected atomically rather than silently becoming balanced',()=>{
 const s=state('estate-invalid');
 const before=snap(s);
 assert.throws(()=>setEstatePlan(s,'unknown'),/miras|plan|geçersiz/i);
 assert.deepEqual(s,before);
});

test('reaffirming an estate plan does not change its original selection age',()=>{
 const s=state('estate-repeat');
 s.player.age=62;
 setEstatePlan(s,'children-first');
 s.player.age=70;
 const before=snap(s);
 assert.deepEqual(setEstatePlan(s,'children-first'),before.estatePlan);
 assert.deepEqual(s,before);
});

test('estate plan can be changed before settlement but not after settlement',()=>{
 const s=state('estate-settled');
 s.player.age=75;
 ensurePersonalFinance(s);
 s.finance.cash=1_000_000;
 setEstatePlan(s,'children-first');
 setEstatePlan(s,'charity');
 assert.equal(s.estatePlan.type,'charity');
 const estate=settleEstate(s);
 assert.equal(estate.plan,'charity');
 const before=snap(s);
 assert.throws(()=>setEstatePlan(s,'balanced'),/miras|tereke|kapan|settle/i);
 assert.deepEqual(s,before);
});

test('deceased heirs do not unlock children-first or spouse-first estate event choices',()=>{
 const s=state('estate-dead-heirs');
 s.player.age=75;
 ensurePersonalFinance(s);
 s.finance.cash=2_000_000;
 s.children=[{id:'c',name:'Child',alive:false}];
 s.social.romance={name:'Spouse',status:'married',alive:false};
 const event=lateAgeEvents.find(e=>e.id==='estate-plan');
 assert.equal(event.condition(s),true);
 const choices=event.choices.filter(c=>!c.condition||c.condition(s)).map(c=>c.id);
 assert.ok(!choices.includes('children-estate'));
 assert.ok(!choices.includes('spouse-estate'));
 assert.ok(choices.includes('charity-estate'));
});

test('living heirs still unlock the corresponding estate event choices',()=>{
 const s=state('estate-living-heirs');
 s.player.age=75;
 s.children=[{id:'c',name:'Child',alive:true}];
 s.social.romance={name:'Spouse',status:'married',alive:true};
 const event=lateAgeEvents.find(e=>e.id==='estate-plan');
 const choices=event.choices.filter(c=>!c.condition||c.condition(s)).map(c=>c.id);
 assert.ok(choices.includes('children-estate'));
 assert.ok(choices.includes('spouse-estate'));
});
