import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/core/game.js';
import {RNG} from '../src/core/rng.js';
import {ensureRelationshipDepth,processRelationshipDepthYear} from '../src/social/relationship_depth.js';
import {ensureWorkplaceState,processWorkplaceYear} from '../src/career/workplace_system.js';
import {ensureHouseholdDepth} from '../src/finance/household_depth.js';
import {ensureLifeMemory} from '../src/life/memory_system.js';
import {systemicStorylets} from '../src/events/systemic_storylets.js';

test('relationship depth initializes persistent partner dimensions',()=>{
 const g=new Game('depth-rel');
 g.state.player.age=30;
 g.state.social.romance={
  id:'p',name:'Test',surname:'Partner',relationship:70,relationshipTension:15,yearsTogether:4,
  preferences:{parenthoodDesire:55,hometownAttachment:45,riskTolerance:50},
  personality:{sociability:60,ambition:55}
 };
 g.state.preferences={parenthoodDesire:50,hometownAttachment:50,riskTolerance:55};
 ensureRelationshipDepth(g.state);
 const r=g.state.social.romance;
 for(const key of ['trust','intimacy','resentment','sharedGoals','moneyAlignment'])assert.equal(Number.isFinite(r[key]),true,key);
 processRelationshipDepthYear(g.state,new RNG('rel-year'));
 assert.ok(r.trust>=0&&r.trust<=100);
});

test('workplace depth creates culture and burnout model for employed career',()=>{
 const g=new Game('depth-work');
 g.state.player.age=34;
 g.state.career={employed:true,performance:68,satisfaction:55,network:60};
 g.state.healthProfile={stress:30,conditions:[],fitness:50};
 const w=ensureWorkplaceState(g.state,new RNG('work-init'));
 assert.ok(w.bossQuality>=0&&w.bossQuality<=100);
 processWorkplaceYear(g.state,new RNG('work-year'));
 assert.ok(g.state.career.workplace.burnout>=0&&g.state.career.workplace.burnout<=100);
});

test('household and memory depth state are structurally persistent',()=>{
 const g=new Game('depth-memory');
 g.state.player.age=40;
 const h=ensureHouseholdDepth(g.state);
 const m=ensureLifeMemory(g.state);
 h.financialPressure=67;
 m.memories.push({id:'x',label:'test',age:40,valence:-1,intensity:4,tags:['scar']});
 assert.equal(g.state.householdDynamics.financialPressure,67);
 assert.equal(g.state.lifeMemory.memories.length,1);
});

test('systemic storylet catalog has unique ids, choices and cross-system conditions',()=>{
 const ids=new Set();
 for(const e of systemicStorylets){
  assert.ok(e.id&&e.title);
  assert.equal(ids.has(e.id),false,'duplicate '+e.id);
  ids.add(e.id);
  assert.equal(typeof e.condition,'function');
  assert.ok(Array.isArray(e.choices)||typeof e.choices==='function');
 }
 assert.ok(systemicStorylets.length>=10);
});
