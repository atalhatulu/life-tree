import test from 'node:test';
import assert from 'node:assert/strict';
import {RNG} from '../src/core/rng.js';
import {FIRST_NAMES,SURNAMES,UNISEX_NAMES,pickFirstName,pickSurname} from '../src/data/countries/turkey/names.js';
import {generateFamily,generateNewbornSibling} from '../src/family/family_generator.js';

test('expanded given-name and surname pools have no duplicates and preserve Turkish strings',()=>{
 assert.ok(FIRST_NAMES.female.length>=140);
 assert.ok(FIRST_NAMES.male.length>=170);
 assert.ok(SURNAMES.length>=200);
 for(const values of [FIRST_NAMES.female,FIRST_NAMES.male,SURNAMES,UNISEX_NAMES]){
  assert.equal(new Set(values).size,values.length);
  assert.ok(values.every(value=>typeof value==='string'&&value.trim()===value&&value.length>1));
 }
 for(const name of UNISEX_NAMES){
  assert.ok(FIRST_NAMES.female.includes(name));
  assert.ok(FIRST_NAMES.male.includes(name));
 }
});

test('name generation is seed-stable and excludes close relatives',()=>{
 const first=new RNG('weighted-names');
 const second=new RNG('weighted-names');
 assert.deepEqual(
  Array.from({length:50},()=>pickFirstName(first,'female')),
  Array.from({length:50},()=>pickFirstName(second,'female'))
 );
 const male=new RNG('excluded-name');
 const chosen=pickFirstName(male,'male',{avoid:FIRST_NAMES.male.filter(value=>value!=='Kerem')});
 assert.equal(chosen,'Kerem');
 const family=generateFamily(new RNG('family-names'));
 const familyAgain=generateFamily(new RNG('family-names'));
 assert.deepEqual(family,familyAgain);
 const relatives=[family.player.name,family.parents.mother.name,family.parents.father.name,
  ...family.siblings.map(person=>person.name),
  ...Object.values(family.grandparents).flatMap(branch=>Object.values(branch).map(person=>person.name))];
 assert.equal(new Set(relatives).size,relatives.length);
 assert.equal(family.player.surname,family.parents.father.surname);
 assert.equal(family.player.surname,family.siblings[0]?.surname??family.player.surname);
});

test('a newborn sibling gets a family-consistent surname and a distinct first name',()=>{
 const family=generateFamily(new RNG('newborn-name-family'));
 const sibling=generateNewbornSibling(new RNG('newborn-name-seed'),family,'newborn');
 const used=new Set([family.player.name,family.parents.mother.name,family.parents.father.name,
  ...family.siblings.map(person=>person.name)]);
 assert.ok(!used.has(sibling.name));
 assert.equal(sibling.surname,family.parents.father.surname);
 assert.ok(FIRST_NAMES[sibling.sex].includes(sibling.name));
});

test('weighted surname selection returns only catalog entries deterministically',()=>{
 const a=new RNG('surname-samples');
 const b=new RNG('surname-samples');
 const one=Array.from({length:300},()=>pickSurname(a));
 const two=Array.from({length:300},()=>pickSurname(b));
 assert.deepEqual(one,two);
 assert.ok(one.every(value=>SURNAMES.includes(value)));
 assert.ok(new Set(one).size>=50);
});
