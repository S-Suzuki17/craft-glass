import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeroFighter,
  createDuelCode,
  parseDuelCode,
  GUILD_RIVALS,
  simulateAutoDuel
} from '../web/src/core/duel-arena.js';
import { createInitialState } from '../web/src/core/storage.js';

test('Duel Arena builds fighter from real effort and signs/verifies CGD1 Duel Codes', () => {
  const state = createInitialState();
  state.profile.displayName = 'Aria';
  state.sessions = [{ id: 's1', seconds: 3600 * 5 }];
  state.totalMonstersSealed = 4;

  const fighter = buildHeroFighter(state);
  assert.equal(fighter.name, 'Aria');
  assert.ok(fighter.level >= 2);
  assert.ok(fighter.maxHp > 120);
  assert.ok(fighter.atk > 18);

  const code = createDuelCode(state);
  assert.ok(code.startsWith('CGD1:'));

  const parsed = parseDuelCode(code);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.fighter.name, 'Aria');
  assert.equal(parsed.fighter.level, fighter.level);
  assert.equal(parsed.fighter.maxHp, fighter.maxHp);

  // Tampered code must be rejected
  const tampered = `${code.slice(0, -3)}fff`;
  assert.equal(parseDuelCode(tampered).valid, false);
});

test('Auto-Battler simulates deterministic rounds between raised heroes and guild rivals', () => {
  const lowHero = GUILD_RIVALS[0];
  const highHero = GUILD_RIVALS[3];
  const sim = simulateAutoDuel(highHero, lowHero, 42);
  assert.equal(sim.winner, 'left');
  assert.ok(sim.turns.length >= 1);
  assert.equal(sim.turns.at(-1).rightHp, 0);
});
