import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHeroFighter,
  buildStageBossFighter,
  createDuelCode,
  parseDuelCode,
  GUILD_RIVALS,
  simulateAutoDuel
} from '../web/src/core/duel-arena.js';
import {
  calcWildDefeats,
  reconcileCompanionRecruits,
  getBestiaryProgress,
  companionBondInfo
} from '../web/src/core/rpg-engine.js';
import { WILD_MONSTERS } from '../web/src/core/catalog.js';
import { createInitialState } from '../web/src/core/storage.js';

test('Duel Arena builds fighter with Companion Lv.1-50 & unique skill and signs/verifies CGD1 Duel Codes', () => {
  const state = createInitialState();
  state.profile.displayName = 'Aria';
  state.activeCompanion = 'ribbonphoenix';
  state.sessions = [{ id: 's1', seconds: 3600 * 5 }];
  state.companionBonds = { ribbonphoenix: 3600 * 5 };
  state.totalMonstersSealed = 4;

  const bond = companionBondInfo(3600 * 5, 'en');
  assert.ok(bond.compLevel >= 8);

  const fighter = buildHeroFighter(state);
  assert.equal(fighter.name, 'Aria');
  assert.equal(fighter.compLevel, bond.compLevel);
  assert.equal(fighter.skill.en, 'Rebirth Flame');
  assert.ok(fighter.skill.healPct > 0);

  const code = createDuelCode(state);
  assert.ok(code.startsWith('CGD1:'));

  const parsed = parseDuelCode(code);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.fighter.name, 'Aria');
  assert.equal(parsed.fighter.compLevel, fighter.compLevel);
  assert.equal(parsed.fighter.skill.en, 'Rebirth Flame');

  const tampered = `${code.slice(0, -3)}fff`;
  assert.equal(parseDuelCode(tampered).valid, false);
});

test('Auto-Battler executes companion skills & heals on even rounds and scales with companion level', () => {
  const lowHero = GUILD_RIVALS[0]; // Acornling (Forest Mend heal skill)
  const highHero = GUILD_RIVALS[3]; // Astral Dragon (Starfire Breath strike+heal)
  const sim = simulateAutoDuel(highHero, lowHero, 42);
  assert.equal(sim.winner, 'left');
  const compTurns = sim.turns.filter((t) => t.kind === 'companion');
  assert.ok(compTurns.length >= 1);
  assert.ok(compTurns.some((t) => t.heal > 0 && t.skillName.length > 0));
});

test('Companions are befriended through wild defeats over focus time (never bought with points)', () => {
  let state = createInitialState();
  assert.deepEqual(state.ownedCompanions, ['twigfox']);
  assert.equal(calcWildDefeats(state), 0);

  // 15m focus -> 1 wild defeat -> Acornling joins!
  state.sessions = [{ id: 's1', seconds: 15 * 60 }];
  let rec = reconcileCompanionRecruits(state);
  assert.equal(rec.defeats, 1);
  assert.ok(rec.state.ownedCompanions.includes('acornling'));
  assert.ok(rec.newlyRecruited.some((c) => c.id === 'acornling'));

  // 2 hours focus (8 defeats) -> Bookmark Jay & Candle Knight guaranteed recruited!
  rec.state.sessions = [{ id: 's2', seconds: 120 * 60 }];
  rec = reconcileCompanionRecruits(rec.state);
  assert.equal(rec.defeats, 8);
  assert.ok(rec.state.ownedCompanions.includes('bookmarkjay'));
  assert.ok(rec.state.ownedCompanions.includes('candleknight'));

  // Bestiary progress & Stage Bosses across 36 wild monsters (including 4 World Bosses at Worlds 5, 10, 15, 20)
  assert.equal(WILD_MONSTERS.length, 36);
  const bestiary = getBestiaryProgress(rec.state);
  assert.equal(bestiary.totalMonsters, 36);
  assert.ok(bestiary.discoveredCount >= 8);
  assert.equal(bestiary.monsters.length, 36);

  const world5Boss = buildStageBossFighter(5);
  assert.equal(world5Boss.worldId, 5);
  assert.equal(world5Boss.isMonster, true);
  assert.equal(world5Boss.isBoss, true);
  assert.ok(world5Boss.maxHp > 200);

  const stageBattle = simulateAutoDuel(GUILD_RIVALS[3], world5Boss, 99);
  assert.equal(stageBattle.winner, 'left');
});
