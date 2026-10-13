import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/game.js';
import { serializeGame, parseSave, repairSavePayload } from '../src/core/save_system.js';

test('web save export serialization roundtrips into identical Game instance', () => {
  const game = new Game('web-export-test-seed');
  game.state.player.name = 'Ahmet';
  game.state.player.surname = 'Yılmaz';
  game.state.player.age = 25;
  game.state.year = 2051;
  game.state.savedAtYear = 2051;
  game.state.savedAtAge = 25;

  const jsonText = serializeGame(game, true);
  assert.ok(typeof jsonText === 'string');
  assert.ok(jsonText.includes('"Ahmet"'));
  assert.ok(jsonText.includes('"Yılmaz"'));

  const parsed = parseSave(jsonText);
  assert.equal(parsed.state.player.name, 'Ahmet');
  assert.equal(parsed.state.player.surname, 'Yılmaz');
  assert.equal(parsed.state.player.age, 25);
  assert.equal(parsed.state.year, 2051);

  const restored = Game.fromSave(parsed);
  assert.equal(restored.state.player.name, 'Ahmet');
  assert.equal(restored.state.player.age, 25);
  assert.equal(restored.state.year, 2051);
  assert.equal(restored.seedText, 'web-export-test-seed');
});

test('web import repairs corrupted optional containers before loading into Game', () => {
  const game = new Game('web-repair-test-seed');
  const payload = JSON.parse(serializeGame(game, false));
  payload.state.finance ??= {};
  payload.state.finance.debts = 'corrupted_debts_string';

  // Strict parse fails
  assert.throws(() => parseSave(payload), /Invalid save/);

  // Repair succeeds and restores default empty debts container
  const repaired = repairSavePayload(payload);
  assert.ok(repaired.repairs.includes('finance.debts'));
  assert.equal(typeof repaired.payload.state.finance.debts, 'object');
  assert.equal(repaired.payload.state.finance.debts.consumer, 0);
  const restored = Game.fromSave(repaired.payload);
  assert.equal(typeof restored.state.finance.debts, 'object');
  assert.equal(restored.state.finance.debts.consumer, 0);
});
