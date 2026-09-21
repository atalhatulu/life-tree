import test from 'node:test';
import assert from 'node:assert/strict';
import {growTrait,changeTrait} from '../src/character/personality_dynamics.js';

test('repeated positive trait growth has diminishing returns',()=>{
 let value=50;
 for(let i=0;i<100;i++)value=growTrait(value,2);
 assert.ok(value>80,'growth should remain meaningful');
 assert.ok(value<95,'repeated activity should not pin trait to 100');
});

test('high traits gain less from the same activity than mid traits',()=>{
 const midGain=growTrait(50,3)-50;
 const highGain=growTrait(90,3)-90;
 assert.ok(midGain>highGain);
 assert.ok(highGain>0);
});

test('negative personality drift remains effective',()=>{
 assert.equal(changeTrait(80,-4),76);
});
