import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {proceduralActionPlan} from '../src/simulation/procedural_player.js';
import {processRelationshipMaintenanceYear} from '../src/social/relationship_maintenance.js';
import {processPartnershipYear} from '../src/social/partnership_system.js';
import {RNG} from '../src/core/rng.js';

function coupled(seed='relationship-calibration'){
 const g=new Game(seed);
 g.state.player.age=30;
 g.state.actions={remaining:3,max:3};
 g.state.finance={cash:250000,savings:150000,debt:0,monthlyIncome:70000,lifestyle:{housing:'shared'}};
 g.state.healthProfile={conditions:[],stress:30,fitness:55,lastCheckupAge:null};
 g.state.social.romance={
  id:'partner-cal',name:'Ece',surname:'Kaya',alive:true,age:30,status:'dating',
  relationship:56,compatibility:84,yearsTogether:3,
  health:{current:85},personality:{ambition:50},
  preferencesProfile:{food:{pizza:1},activities:{cinema:1}}
 };
 g.state.relationshipMemories={
  'partner-cal':{interactions:3,lastInteractionAge:28,recentActivities:[],positiveImpact:5,negativeImpact:0,knownPreferences:{}}
 };
 return g;
}

test('balanced procedural planning gives a neglected partner meaningful social priority',()=>{
 const g=coupled('partner-priority');
 const plan=proceduralActionPlan(g,'balanced',new RNG('partner-priority-plan'));
 const social=plan.find(x=>x.type==='social');
 assert.ok(social,'balanced plan should include a social option');
 assert.equal(social.targetId,'partner-cal');
 assert.ok(plan.indexOf(social)<=2,'partner care should be competitive for one of the three yearly actions');
});

test('partnership neglect is charged once, not separately by maintenance and partnership systems',()=>{
 const g=coupled('single-neglect');
 g.state.social.romance.relationship=60;
 g.state.social.romance.compatibility=60;
 g.state.relationshipMemories['partner-cal'].lastInteractionAge=26;
 const before=g.state.social.romance.relationship;
 processRelationshipMaintenanceYear(g.state);
 const afterMaintenance=g.state.social.romance.relationship;
 const rng={int:()=>0,chance:()=>false,fork:()=>({chance:()=>false})};
 processPartnershipYear(g.state,rng);
 const afterPartnership=g.state.social.romance.relationship;
 assert.ok(afterMaintenance<before,'maintenance should apply neglect decay');
 assert.ok(afterPartnership>=afterMaintenance-0.01,'partnership processing should not charge neglect a second time');
});

test('healthy dating relationship can reach commitment gate at moderate relationship score',()=>{
 const g=coupled('commitment-gate');
 g.state.social.romance.relationship=55;
 g.state.social.romance.yearsTogether=3;
 g.state.preferences={...(g.state.preferences??{}),partnershipDesire:60,marriageDesire:45};
 const event=g.events.events.find(e=>e.id==='relationship-commitment');
 assert.equal(event.condition(g.state),true);
});
