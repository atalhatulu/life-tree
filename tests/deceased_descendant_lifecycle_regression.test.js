import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {processChildrenYear} from '../src/family/parenting_system.js';
import {processChildDevelopmentYear} from '../src/family/child_development_system.js';
import {processDescendantLives} from '../src/family/descendant_life_system.js';
import {processLateLifeYear,setRetirementStyle} from '../src/life/late_age_system.js';
import {processPersonalFinanceYear} from '../src/finance/personal_finance.js';

function stateFor(seed,age=45){
 const state=new Game(seed).state;
 state.player.age=age;
 state.children=[];
 state.social.romance=null;
 state.social.friends=[];
 state.finance={cash:100000,savings:0,debt:0,debts:{consumer:0,medical:0,housing:0,car:0,emergency:0},childMonthlyCost:0,lifestyle:{housing:'shared',food:'standard',clothing:'basic',transport:'public'}};
 state.career={employed:false,monthlyIncome:0};
 return state;
}
function child(id,age,alive){
 return {id,name:id,age,alive,relationship:70,health:{current:70},personality:{curiosity:60,discipline:60,sociability:60,ambition:60},parenting:{involvement:55,stability:68,emotionalSecurity:72,conflict:8,accumulatedSupport:0}};
}

test('deceased dependent children incur no monthly costs; living and legacy children still do',()=>{
 const state=stateFor('dead-child-cost');
 state.children=[child('dead-young',7,false),child('dead-teen',16,false),child('living',12,true),child('legacy',20,undefined)];
 state.children[3].educationPlan='university';
 processChildrenYear(state,new RNG('dead-child-cost-rng'));
 assert.equal(state.finance.childMonthlyCost,7500+8500);
});

test('deceased children do not age, receive parenting changes or produce school milestones',()=>{
 const state=stateFor('dead-child-parenting');
 const dead=child('dead',17,false);
 dead.upbringingStyle='supportive';
 const living=child('living',17,true);
 state.children=[dead,living];
 const snapshot=structuredClone(dead);
 const entries=processChildrenYear(state,new RNG('dead-child-parenting-rng'));
 assert.deepEqual(dead,snapshot);
 assert.equal(living.age,18);
 assert.ok(entries.some(e=>e.text.includes('living')));
 assert.ok(!entries.some(e=>e.text.includes('dead')));
});

test('child development never mutates deceased children or creates posthumous milestones',()=>{
 const state=stateFor('dead-child-development');
 const dead=child('dead',17,false);
 dead.development={confidence:60,independence:50,academicDrive:65,socialSecurity:50,parentAttachment:60,identityStress:10,milestones:[],lastStage:'teen'};
 const living=child('living',18,true);
 state.children=[dead,living];
 const snapshot=structuredClone(dead);
 const entries=processChildDevelopmentYear(state,new RNG('dead-child-development-rng'));
 assert.deepEqual(dead,snapshot);
 assert.ok(entries.some(e=>e.text.includes('living')));
 assert.ok(!entries.some(e=>e.text.includes('dead')));
});

test('deceased adult descendants cannot start relationships, have children or change health',()=>{
 const state=stateFor('dead-descendant-life',75);
 const dead=child('dead',30,false);
 dead.adultLife={initialized:true,partnered:true,children:0};
 const living=child('living',30,true);
 living.adultLife={initialized:true,partnered:true,children:0};
 state.children=[dead,living];
 const snapshot=structuredClone(dead);
 const always={fork:()=>({chance:()=>true,int:()=>0}),int:()=>0};
 const entries=processDescendantLives(state,always);
 assert.deepEqual(dead,snapshot);
 assert.equal(living.adultLife.children,1);
 assert.equal(state.grandchildren,1);
 assert.equal(entries.filter(e=>e.text.includes('çocuk sahibi oldu')).length,1);
});

test('only living adult children contribute late-life financial support',()=>{
 const state=stateFor('dead-adult-support',70);
 state.children=[child('dead',30,false),child('living',32,true),child('legacy',33,undefined)];
 state.lateLife={mobility:60,isolation:30,careNeed:false,careMode:null};
 processLateLifeYear(state,{int:()=>0,chance:()=>false});
 assert.equal(state.lateLife.familySupportMonthly,7000);
 processPersonalFinanceYear(state);
 assert.equal(state.finance.adultChildSupportMonthly,7000);
});

test('no living supportive adult children means no late-life income',()=>{
 const state=stateFor('dead-only-adult-support',70);
 state.children=[child('dead',30,false),child('unsupportive',33,true)];
 state.children[1].relationship=40;
 state.lateLife={mobility:60,isolation:30,careNeed:false,careMode:null};
 processLateLifeYear(state,{int:()=>0,chance:()=>false});
 assert.equal(state.lateLife.familySupportMonthly,0);
 processPersonalFinanceYear(state);
 assert.equal(state.finance.adultChildSupportMonthly,0);
});

test('deceased descendants do not reduce isolation compared with no descendants',()=>{
 const withDead=stateFor('dead-isolation',70);
 const without=stateFor('dead-isolation',70);
 withDead.children=[child('dead',30,false)];
 for(const s of [withDead,without])s.lateLife={mobility:60,isolation:50,careNeed:false,careMode:null};
 const rng={int:()=>0,chance:()=>false};
 processLateLifeYear(withDead,rng);
 processLateLifeYear(without,rng);
 assert.equal(withDead.lateLife.isolation,without.lateLife.isolation);
});

test('deceased friends and partner do not provide late-life social protection',()=>{
 const withDead=stateFor('dead-social-buffer',70);
 const without=stateFor('dead-social-buffer',70);
 withDead.social.romance={name:'Late partner',status:'married',alive:false};
 withDead.social.friends=[{id:'late-friend',alive:false}];
 for(const s of [withDead,without])s.lateLife={mobility:60,isolation:50,careNeed:false,careMode:null};
 const rng={int:()=>0,chance:()=>false};
 processLateLifeYear(withDead,rng);
 processLateLifeYear(without,rng);
 assert.equal(withDead.lateLife.isolation,without.lateLife.isolation);
});

test('family retirement improves only living children relationships',()=>{
 const state=stateFor('dead-retirement-style',70);
 state.children=[child('dead',30,false),child('living',32,true),child('legacy',31,undefined)];
 state.lateLife={mobility:60,isolation:50,careNeed:false,careMode:null};
 setRetirementStyle(state,'family');
 assert.deepEqual(state.children.map(c=>c.relationship),[70,75,75]);
});
