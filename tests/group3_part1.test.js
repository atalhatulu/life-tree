import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {ensureHealthProfile,processHealthYear} from '../src/health/health_system.js';
import {ensureMentalHealth,processMentalHealthYear,applyMentalHealthActivity} from '../src/health/mental_health_system.js';
import {availableActivities,performActivity} from '../src/life/activity_system.js';
import {validateState} from '../src/simulation/invariants.js';

test('human-like autoplay remains deterministic',()=>{
 const a=new Game('human-like-deterministic');
 const b=new Game('human-like-deterministic');
 autoplay(a,{toAge:40,policy:'human-like'});
 autoplay(b,{toAge:40,policy:'human-like'});
 assert.deepEqual(a.state,b.state);
});

test('physical diseases require accumulated exposure instead of instant diagnosis',()=>{
 const g=new Game('risk-exposure');
 g.state.player.age=55;
 g.state.player.health.current=80;
 g.state.player.health.constitution=60;
 ensureHealthProfile(g.state);
 g.state.healthProfile.fitness=55;
 g.state.healthProfile.stress=30;
 const rng={int:()=>0,chance:()=>true,fork:()=>rng};
 processHealthYear(g.state,rng);
 assert.equal(g.state.healthProfile.conditions.length,0);
 assert.ok(Object.keys(g.state.healthProfile.riskExposure).length>0);
});

test('anxiety is no longer stored as a physical chronic condition',()=>{
 const g=new Game('no-physical-anxiety');
 autoplay(g,{toAge:65,policy:'human-like'});
 assert.equal((g.state.healthProfile?.conditions??[]).some(c=>c.id==='anxiety'),false);
});

test('sustained stress raises mental strain and can create episodes',()=>{
 const g=new Game('mental-pressure');
 g.state.player.age=35;
 g.state.year=2061;
 g.state.healthProfile={conditions:[],stress:90,fitness:30,lastCheckupAge:null,riskExposure:{}};
 g.state.finance={debt:5000000,cash:0,savings:0};
 g.state.career={employed:false};
 g.state.higherEducation=null;
 g.state.social={friends:[],romance:null};
 const m=ensureMentalHealth(g.state);
 const before=m.strain;
 for(let i=0;i<6;i++)processMentalHealthYear(g.state,new RNG('mental-'+i));
 assert.ok(m.strain>before);
 assert.notEqual(m.status,'stable');
 assert.ok(m.episodes.length>0);
});

test('therapy reduces strain and becomes available when needed',()=>{
 const g=new Game('therapy');
 g.state.player.age=30;
 g.state.actions={remaining:3,max:3};
 g.state.healthProfile={conditions:[],stress:70,fitness:45,lastCheckupAge:null,riskExposure:{}};
 const m=ensureMentalHealth(g.state);
 m.strain=70;
 m.status='distressed';
 assert.ok(availableActivities(g.state).some(a=>a.id==='therapy'));
 const before=m.strain;
 performActivity(g.state,'therapy',new RNG('therapy-action'));
 assert.ok(m.strain<before);
 assert.ok(m.therapyYears>=1);
});

test('mental and physical health states remain invariant-valid',()=>{
 const g=new Game('health-invariants');
 autoplay(g,{toAge:55,policy:'human-like'});
 assert.deepEqual(validateState(g.state),[]);
});
