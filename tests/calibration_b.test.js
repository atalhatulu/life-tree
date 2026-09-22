import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {autoplay} from '../src/simulation/autoplay.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {ensurePartnershipState,marryPartner,processPartnershipYear} from '../src/social/partnership_system.js';
import {parenthoodReadiness,attemptChild} from '../src/family/parenting_system.js';
import {validateState} from '../src/simulation/invariants.js';

function relationshipFixture(seed='cal-b'){
 const g=new Game(seed);
 g.state.player.age=29;
 g.state.year=2055;
 g.state.preferences={partnershipDesire:65,marriageDesire:62,parenthoodDesire:55,hometownAttachment:50,riskTolerance:40};
 g.state.finance={cash:450000,savings:350000,debt:0,financialDistressYears:0,lifestyle:{housing:'shared',food:'standard',clothing:'standard',transport:'public'}};
 g.state.career={employed:true,monthlyIncome:80000,satisfaction:58};
 g.state.healthProfile={conditions:[],stress:28,fitness:55,lastCheckupAge:null,riskExposure:{}};
 const r=createRomanticInterest(g.state,new RNG(seed+':partner'),'partner');
 r.relationship=76;
 r.relationshipTension=10;
 r.preferences.marriageDesire=65;
 r.preferences.parenthoodDesire=55;
 r.yearsTogether=4;
 g.state.social.romance=r;
 ensurePartnershipState(g.state);
 return g;
}

test('marriage-ready couple can commit before age 30',()=>{
 const g=relationshipFixture('marry-before-30');
 const event=g.events.events.find(e=>e.id==='relationship-commitment');
 assert.equal(event.condition(g.state),true);
 const choices=g.eventChoices(event);
 assert.ok(choices.some(c=>c.id==='marry'));
});

test('sustained conflict can create non-catastrophic divorce risk',()=>{
 const g=relationshipFixture('divorce-risk');
 marryPartner(g.state);
 const r=g.state.social.romance;
 r.marriageYears=5;
 r.yearsTogether=8;
 r.relationship=50;
 r.relationshipTension=58;
 r.relationshipState='conflict';
 r.conflictYears=3;
 r.compatibility=48;
 const rng={int:()=>0,chance:p=>p>=.1,fork:()=>rng};
 processPartnershipYear(g.state,rng);
 assert.equal(g.state.social.romance,null);
 assert.equal(g.state.social.exSpouses.length,1);
});

test('additional children reduce readiness',()=>{
 const g=relationshipFixture('parity-readiness');
 marryPartner(g.state);
 const base=parenthoodReadiness(g.state);
 g.state.children=[{age:4},{age:2}];
 const after=parenthoodReadiness(g.state);
 assert.ok(after<base-15,{base,after});
});

test('fertility attempt remains probabilistic rather than guaranteed',()=>{
 const g=relationshipFixture('fertility-probability');
 marryPartner(g.state);
 const rng={chance:p=>{assert.ok(p<.9);return false;},fork:()=>rng};
 const child=attemptChild(g.state,rng);
 assert.equal(child,null);
});

test('calibrated relationship life remains invariant-valid',()=>{
 const g=new Game('calibration-b-invariants');
 autoplay(g,{toAge:70,policy:'human-like'});
 assert.deepEqual(validateState(g.state),[]);
});
