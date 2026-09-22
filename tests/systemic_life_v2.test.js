import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {socialWellbeing,processSocialWellbeingYear} from '../src/social/social_wellbeing.js';
import {processMentalHealthYear} from '../src/health/mental_health_system.js';
import {processBodyYear} from '../src/health/body_system.js';

test('strong relationships create higher connection than an isolated life',()=>{
 const connected=new Game('connected');
 connected.state.player.age=35;
 connected.state.social.friends=[{alive:true,relationship:85},{alive:true,relationship:75}];
 connected.state.social.romance={alive:true,relationship:82,status:'married'};
 const isolated=new Game('isolated');
 isolated.state.player.age=35;
 isolated.state.social.friends=[];
 isolated.state.social.romance=null;
 assert.ok(socialWellbeing(connected.state).connection>socialWellbeing(isolated.state).connection);
});

test('social isolation feeds stress instead of directly changing health',()=>{
 const g=new Game('isolation-stress');
 g.state.player.age=40;
 g.state.healthProfile={conditions:[],stress:40,fitness:50};
 g.state.social={friends:[],romance:null};
 const health=g.state.player.health.current;
 processSocialWellbeingYear(g.state);
 assert.ok(g.state.healthProfile.stress>40);
 assert.equal(g.state.player.health.current,health);
});

test('financial and career pressure can accumulate burnout',()=>{
 const g=new Game('burnout');
 g.state.player.age=38;
 g.state.healthProfile={conditions:[],stress:82,fitness:50};
 g.state.socialWellbeing={connection:25,isolation:75};
 g.state.finance={debt:4000000};
 g.state.career={employed:true,satisfaction:20,performance:70};
 const before=processMentalHealthYear(g.state).length;
 assert.equal(before,0);
 assert.ok(g.state.mentalHealth.burnout>0);
 processMentalHealthYear(g.state);
 assert.ok(g.state.mentalHealth.wellbeing<=70);
});

test('age chronic disease and low fitness reduce body reserves',()=>{
 const g=new Game('body-reserve');
 g.state.player.age=72;
 g.state.healthProfile={fitness:30,stress:45,conditions:[{severity:3},{severity:2}]};
 const before={cardioReserve:70,mobility:80,recovery:75,chronicLoad:0};
 g.state.body={...before};
 processBodyYear(g.state);
 assert.ok(g.state.body.cardioReserve<before.cardioReserve);
 assert.ok(g.state.body.mobility<before.mobility);
 assert.ok(g.state.body.recovery<before.recovery);
 assert.ok(g.state.body.chronicLoad>0);
});
