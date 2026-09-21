import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {createRomanticInterest} from '../src/social/romance_system.js';
import {marryPartner} from '../src/social/partnership_system.js';
import {addChild} from '../src/family/parenting_system.js';
import {setUpbringingStyle,setChildEducationPlan} from '../src/family/parenting_decisions.js';
import {processDescendantLives} from '../src/family/descendant_life_system.js';
import {ensurePersonalFinance} from '../src/finance/personal_finance.js';

function familyWithChild(seed='second-gen'){
 const g=new Game(seed);
 g.state.player.age=35;
 g.state.year=2061;
 ensurePersonalFinance(g.state);
 g.state.finance.cash=500000;
 g.state.career={employed:true,title:'Öğretmen',monthlyIncome:80000,years:10,totalYears:10,performance:65,satisfaction:60,stability:70};
 const rng=new RNG(seed+'-partner');
 g.state.social.romance=createRomanticInterest(g.state,rng,'partner');
 g.state.social.romance.relationship=90;
 marryPartner(g.state);
 const child=addChild(g.state,rng.fork('child'));
 return {g,child,rng};
}

test('supportive parenting improves bond and curiosity',()=>{
 const {g,child}=familyWithChild('supportive-parent');
 child.age=4;
 const rel=child.relationship;
 const curiosity=child.personality.curiosity;
 setUpbringingStyle(g.state,child.id,'supportive');
 assert.equal(child.upbringingStyle,'supportive');
 assert.ok(child.relationship>rel);
 assert.ok(child.personality.curiosity>curiosity);
});

test('strict parenting increases discipline but can cost relationship',()=>{
 const {g,child}=familyWithChild('strict-parent');
 child.age=5;
 const rel=child.relationship;
 const discipline=child.personality.discipline;
 setUpbringingStyle(g.state,child.id,'strict');
 assert.ok(child.personality.discipline>discipline);
 assert.ok(child.relationship<rel);
});

test('university support stores a high education-support state',()=>{
 const {g,child}=familyWithChild('university-child');
 child.age=16;
 setChildEducationPlan(g.state,child.id,'university');
 assert.equal(child.educationPlan,'university');
 assert.equal(child.educationSupport,85);
});

test('education plan affects adult child route initialization',()=>{
 const {g,child}=familyWithChild('adult-child-plan');
 child.age=18;
 child.personality.curiosity=80;
 child.personality.discipline=80;
 setChildEducationPlan(g.state,child.id,'university');
 processDescendantLives(g.state,new RNG('adult-child-route'));
 assert.equal(child.adultLife?.initialized,true);
 assert.ok(child.adultLife?.educationLevel>=1);
 assert.ok(child.adultLife?.jobTitle);
});

test('parenting events appear for eligible children',()=>{
 const {g,child}=familyWithChild('parenting-event');
 child.age=4;
 const eligible=g.events.eligible(g.state).map(e=>e.id);
 assert.ok(eligible.includes('parenting-style'));
 child.upbringingStyle='supportive';
 child.age=16;
 const later=g.events.eligible(g.state).map(e=>e.id);
 assert.ok(later.includes('child-education-plan'));
});
