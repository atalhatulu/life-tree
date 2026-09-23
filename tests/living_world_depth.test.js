import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processChildDevelopmentYear,ensureChildDevelopment} from '../src/family/child_development_system.js';
import {processPartnerLifeYear} from '../src/social/partner_life_system.js';
import {processFriendLivesYear} from '../src/social/friend_life_system.js';
import {ensureConsequenceChains,processConsequenceChainsYear} from '../src/life/consequence_chain_system.js';

test('child development persists trajectory and can derive adult direction',()=>{
 const g=new Game('child-depth');
 g.state.player.age=40;
 const child=g.state.children?.[0]??{
  id:'c',name:'Test',age:17,relationship:70,
  personality:{curiosity:72,discipline:74,sociability:60,ambition:62},
  parenting:{involvement:78,stability:75,emotionalSecurity:80,conflict:5,accumulatedSupport:25},
  health:{current:80}
 };
 if(!g.state.children?.length)g.state.children=[child];
 ensureChildDevelopment(child);
 child.age=18;
 processChildDevelopmentYear(g.state,new RNG('child-year'));
 assert.ok(['university','vocational','work'].includes(child.educationPlan));
 assert.ok(child.development.milestones.length>=1);
});

test('partner autonomous life creates persistent life state',()=>{
 const g=new Game('partner-life');
 g.state.player.age=32;
 g.state.social.romance={
  id:'p',name:'Partner',age:31,relationship:70,relationshipTension:10,
  personality:{ambition:65,sociability:55},monthlyIncome:50000,job:'Test',jobId:'test',
  trust:65,intimacy:65,resentment:15
 };
 processPartnerLifeYear(g.state,new RNG('partner-year'));
 assert.ok(g.state.social.romance.life);
 assert.ok(Number.isFinite(g.state.social.romance.life.lifeSatisfaction));
});

test('friend autonomous life initializes friend life state',()=>{
 const g=new Game('friend-life');
 g.state.player.age=35;
 g.state.social.friends=[{
  id:'f',name:'Arkadaş',surname:'Test',age:35,relationship:75,closeFriend:true,
  personality:{sociability:60},health:{current:80}
 }];
 processFriendLivesYear(g.state,new RNG('friend-year'));
 assert.ok(g.state.social.friends[0].life);
});

test('consequence chain starts from burnout and progresses',()=>{
 const g=new Game('chain');
 g.state.player.age=40;
 g.state.healthProfile={stress:30,conditions:[],fitness:50};
 g.state.career={employed:true,performance:60,workplace:{burnout:80,reputation:55}};
 ensureConsequenceChains(g.state);
 const entries=processConsequenceChainsYear(g.state,new RNG('chain-year'));
 assert.ok(g.state.consequenceChains.some(x=>x.type==='burnout-spiral'));
 assert.ok(entries.length>=1);
});
