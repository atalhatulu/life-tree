import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEngine} from '../src/events/event_engine.js';
import {RNG} from '../src/core/rng.js';

const state=()=>({player:{age:30},flags:{completedEvents:[]},history:[],lifeTree:{nodes:[]}});
const event=(id,priority,weight)=>({id,title:id,minAge:18,priority,weight:()=>weight,choices:[{id:'ok',label:'OK'}]});

test('zero-weight top priority does not suppress an eligible lower-priority event',()=>{
 const engine=new EventEngine([event('disabled',200,0),event('eligible',100,1)]);
 const selected=engine.choose(state(),new RNG('phase2-disabled-high-priority'));
 assert.equal(selected?.id,'eligible');
});

test('invalid or negative event weights never enter the random draw',()=>{
 const engine=new EventEngine([event('nan',200,NaN),event('negative',180,-2),event('valid',100,1)]);
 assert.equal(engine.choose(state(),new RNG('phase2-invalid-weights'))?.id,'valid');
});

test('all disabled event weights yield no event',()=>{
 const engine=new EventEngine([event('zero',200,0),event('negative',180,-1)]);
 assert.equal(engine.choose(state(),new RNG('phase2-all-disabled')),null);
});

test('positive-weight events retain priority ordering',()=>{
 const engine=new EventEngine([event('lower',100,100),event('higher',110,1)]);
 assert.equal(engine.choose(state(),new RNG('phase2-priority'))?.id,'higher');
});
