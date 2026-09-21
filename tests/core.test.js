import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/core/rng.js';
import { generateFamily } from '../src/family/family_generator.js';
import { Game } from '../src/core/game.js';

test('same seed generates identical family', () => {
  const a = generateFamily(new RNG('abc-123'));
  const b = generateFamily(new RNG('abc-123'));
  assert.deepEqual(a, b);
});

test('different seeds generate different families', () => {
  const a = generateFamily(new RNG('alpha'));
  const b = generateFamily(new RNG('beta'));
  assert.notDeepEqual(a, b);
});

test('player genetics remain valid', () => {
  const family = generateFamily(new RNG('genetics'));
  for (const value of Object.values(family.player.appearance)) {
    assert.ok(value >= 1 && value <= 100);
  }
  assert.ok(family.player.health.constitution >= 1 && family.player.health.constitution <= 100);
});

test('aging increments age and year', () => {
  const game = new Game('aging');
  game.ageOneYear();
  assert.equal(game.state.player.age, 1);
  assert.equal(game.state.year, 2027);
});
