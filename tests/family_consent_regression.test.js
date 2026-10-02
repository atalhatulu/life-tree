import test from 'node:test';
import assert from 'node:assert/strict';
import {mutuallyWantChildren,parenthoodReadiness,attemptChild} from '../src/family/parenting_system.js';
const couple=(desire=65,years=5)=>({player:{age:32},preferences:{parenthoodDesire:desire},social:{romance:{status:'married',relationship:80,yearsTogether:years,preferences:{parenthoodDesire:65}}},children:[],finance:{cash:0,savings:0},career:{monthlyIncome:20000}});
test('family planning increases with years together',()=>assert.ok(parenthoodReadiness(couple(65,8))>parenthoodReadiness(couple(65,1))));
test('either partner can decline parenthood',()=>{const s=couple(10);assert.equal(mutuallyWantChildren(s),false);assert.equal(parenthoodReadiness(s),0);assert.equal(attemptChild(s,{chance(){throw Error('must not roll')}}),null);assert.equal(s.children.length,0);});
test('unpartnered or over-age attempts cannot create children',()=>{const s=couple();s.player.age=50;assert.equal(attemptChild(s,{chance(){throw Error('must not roll')}}),null);});
