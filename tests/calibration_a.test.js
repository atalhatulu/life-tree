import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processHealthYear,ensureHealthProfile} from '../src/health/health_system.js';
import {ensureMentalHealth,processMentalHealthYear} from '../src/health/mental_health_system.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {validateState} from '../src/simulation/invariants.js';

test('healthy older adult has non-zero age mortality hazard',()=>{
 const g=new Game('age-hazard');
 g.state.player.age=78;
 g.state.player.health.current=85;
 ensureHealthProfile(g.state);
 g.state.healthProfile.fitness=65;
 const rng={int:()=>0,chance:p=>{assert.ok(p>0);return false;},fork:()=>rng};
 processHealthYear(g.state,rng);
 assert.equal(g.state.player.alive,true);
});

test('hypertension exposure becomes meaningful before old age',()=>{
 const g=new Game('earlier-hypertension');
 g.state.player.age=45;
 g.state.player.health.current=80;
 ensureHealthProfile(g.state);
 g.state.healthProfile.fitness=45;
 g.state.healthProfile.stress=40;
 const rng={int:()=>0,chance:()=>false,fork:()=>rng};
 for(let i=0;i<12;i++){
  g.state.player.age=45+i;
  processHealthYear(g.state,rng);
 }
 assert.ok((g.state.healthProfile.riskExposure.hypertension??0)>=20);
});

test('sustained ordinary life stress can create a temporary mental-health episode',()=>{
 const g=new Game('episodic-mental-health');
 g.state.player.age=38;
 g.state.healthProfile={conditions:[],stress:62,fitness:42,lastCheckupAge:null,riskExposure:{}};
 g.state.finance={debt:900000,cash:100000,savings:100000};
 g.state.career={employed:true,satisfaction:32};
 g.state.social={friends:[],romance:null};
 const m=ensureMentalHealth(g.state);
 for(let i=0;i<12;i++){
  g.state.player.age++;
  g.state.year++;
  processMentalHealthYear(g.state,new RNG('episodic-'+i));
 }
 assert.ok(m.episodes.length>0);
 assert.ok(m.strain>=42);
});

test('human-like life can use therapy when strain becomes high',()=>{
 const g=new Game('human-like-therapy-calibration');
 autoplay(g,{toAge:30,policy:'human-like'});
 if(!g.state.player.alive)return;
 ensureMentalHealth(g.state).strain=60;
 g.state.mentalHealth.status='strained';
 g.state.actions.remaining=3;
 // One more year gives the human-like activity policy a chance to act.
 autoplay(g,{toAge:g.state.player.age+1,policy:'human-like'});
 assert.ok((g.state.mentalHealth.therapyYears??0)>=1);
});

test('calibrated health still preserves state invariants',()=>{
 const g=new Game('calibration-a-invariants');
 autoplay(g,{toAge:70,policy:'human-like'});
 assert.deepEqual(validateState(g.state),[]);
});
