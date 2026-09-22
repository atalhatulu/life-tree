import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {ensurePartnershipState,processPartnershipYear,marryPartner,moveInTogether} from '../src/social/partnership_system.js';
import {parenthoodReadiness,addChild,processChildrenYear} from '../src/family/parenting_system.js';
import {setUpbringingStyle} from '../src/family/parenting_decisions.js';
import {createFriend} from '../src/social/friend_generator.js';
import {performActivity} from '../src/life/activity_system.js';

function adultState(seed='group1'){
 const g=new Game(seed);
 g.state.player.age=32;
 g.state.year=2058;
 g.state.finance={cash:300000,savings:200000,debt:0,financialDistressYears:0,lifestyle:{housing:'shared',food:'standard',clothing:'basic',transport:'public'}};
 g.state.career={employed:true,monthlyIncome:70000};
 g.state.healthProfile={conditions:[],stress:25,fitness:55,lastCheckupAge:null};
 g.state.preferences={partnershipDesire:65,marriageDesire:60,parenthoodDesire:70,hometownAttachment:50,riskTolerance:50};
 return g;
}

test('romantic interests carry independent adult preferences',()=>{
 const g=adultState('partner-preferences');
 const r=createRomanticInterest(g.state,new RNG('partner-preferences-rng'),'partner');
 assert.ok(r.preferences);
 assert.ok(r.preferences.parenthoodDesire>=0&&r.preferences.parenthoodDesire<=100);
 assert.ok(r.preferences.marriageDesire>=0&&r.preferences.marriageDesire<=100);
});

test('partnership state includes compatibility tension and relationship state',()=>{
 const g=adultState('partnership-state');
 g.state.social.romance=createRomanticInterest(g.state,new RNG('partnership-state-rng'),'partner');
 ensurePartnershipState(g.state);
 const r=g.state.social.romance;
 assert.ok(r.compatibility>=30&&r.compatibility<=95);
 assert.ok(r.relationshipTension>=0);
 assert.equal(typeof r.relationshipState,'string');
});

test('severe sustained marital conflict can deterministically end in divorce',()=>{
 const g=adultState('divorce');
 const r=createRomanticInterest(g.state,new RNG('divorce-partner'),'partner');
 g.state.social.romance=r;
 marryPartner(g.state);
 r.age=32;
 r.health.current=100;
 r.relationship=10;
 r.relationshipTension=95;
 r.marriageYears=4;
 r.yearsTogether=7;
 r.compatibility=35;
 processPartnershipYear(g.state,new RNG('divorce-year'));
 assert.equal(g.state.social.romance,null);
 assert.equal(g.state.social.exSpouses.length,1);
 assert.equal(g.state.social.exSpouses[0].status,'divorced');
 assert.equal(g.state.lastDivorceAge,32);
});

test('cohabiting couples can become parenthood-ready without requiring marriage',()=>{
 const g=adultState('cohabiting-parent');
 const r=createRomanticInterest(g.state,new RNG('cohabiting-parent-rng'),'partner');
 g.state.social.romance=r;
 r.relationship=80;
 r.relationshipTension=8;
 r.preferences.parenthoodDesire=75;
 moveInTogether(g.state);
 const readiness=parenthoodReadiness(g.state);
 assert.ok(readiness>=48,'readiness='+readiness);
});

test('parenting style has persistent annual effects beyond the initial choice',()=>{
 const g=adultState('parenting-depth');
 const r=createRomanticInterest(g.state,new RNG('parenting-depth-rng'),'partner');
 g.state.social.romance=r;
 marryPartner(g.state);
 const child=addChild(g.state,new RNG('parenting-child'));
 child.age=4;
 setUpbringingStyle(g.state,child.id,'supportive');
 const beforeSupport=child.parenting.accumulatedSupport;
 const beforeInvolvement=child.parenting.involvement;
 processChildrenYear(g.state,new RNG('parenting-year'));
 assert.ok(child.parenting.accumulatedSupport>beforeSupport);
 assert.ok(child.parenting.involvement>=beforeInvolvement);
 assert.ok(child.parenting.emotionalSecurity>=0&&child.parenting.emotionalSecurity<=100);
});

test('socializing records friend contact and strengthens the selected bond',()=>{
 const g=adultState('friend-contact');
 const friend=createFriend(g.state,new RNG('friend-contact-rng'),'friend');
 g.state.social.friends=[friend];
 g.state.actions={remaining:3,max:3};
 const before=friend.relationship;
 performActivity(g.state,'socialize',new RNG('socialize'));
 assert.equal(friend.lastContactAge,g.state.player.age);
 assert.ok(friend.relationship>before);
});
