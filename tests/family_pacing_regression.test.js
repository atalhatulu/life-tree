import test from 'node:test';
import assert from 'node:assert/strict';
import {canPresentPacedEvent,pacingRule} from '../src/life/pacing_system.js';

test('family planning is not suppressed by unrelated recent milestones',()=>{
 const state={player:{age:36},history:[],lifeTree:{nodes:[{age:35,eventId:'career-switch',pacingCategory:'career'}]}};
 assert.equal(canPresentPacedEvent(state,{id:'child-decision'}),true);
 assert.equal(canPresentPacedEvent(state,{id:'buy-home'}),false);
 assert.equal(pacingRule({id:'child-decision'}).categoryGap,1);
});
test('family planning respects explicit same-year pace blocks',()=>{
 const state={player:{age:36},history:[{age:36,paceBlock:true}],lifeTree:{nodes:[]}};
 assert.equal(canPresentPacedEvent(state,{id:'child-decision'}),false);
});
