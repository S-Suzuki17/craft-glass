import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcGuildLevel,
  evaluateWeeklyExpedition,
  claimExpeditionChest,
  spawnBreakGemForSession,
  claimBreakGem,
  correctSessionDuration,
  purchaseItem,
  companionBondInfo,
  recordMonsterSealEvent,
  claimSealedMonsterRewards,
  EXPEDITION_DAILY_CAP_SECONDS
} from '../web/src/core/rpg-engine.js';
import { createInitialState } from '../web/src/core/storage.js';
import { HOURS_400_MINUTES } from '../web/src/core/catalog.js';

test('25 guild ranks reach Lv.99 at exactly 400 hours (24000 minutes)', () => {
  const lv1 = calcGuildLevel(0, 'en');
  assert.equal(lv1.level, 1);
  assert.equal(lv1.rank, 'Novice');

  const lv99 = calcGuildLevel(HOURS_400_MINUTES * 60, 'ja');
  assert.equal(lv99.level, 99);
  assert.equal(lv99.rankStep, 25);
  assert.equal(lv99.rank, '殿堂入り');
  assert.equal(lv99.unlockedWorld.id, 20);
});

test('weekly expedition caps single-day credit at 90 minutes to prevent cramming', () => {
  const weekKey = '2026-11-16';
  // 5 hours crammed on a single Sunday only counts as 90 min effective (Bronze unlocked, Silver NOT unlocked)
  const cramSession = {
    id: 's1',
    dayKey: '2026-11-22',
    seconds: 300 * 60
  };
  const cramResult = evaluateWeeklyExpedition({ weekKey, sessions: [cramSession] });
  assert.equal(cramResult.rawSeconds, 300 * 60);
  assert.equal(cramResult.effectiveSeconds, EXPEDITION_DAILY_CAP_SECONDS);
  assert.equal(cramResult.tierId, 'bronze');
  assert.equal(cramResult.campBonus, false);

  // Spread across 4 days x 75m = 300m -> unlocks Gold + Camp Bonus!
  const spreadSessions = [0, 1, 2, 3].map((i) => ({
    id: `sp_${i}`,
    dayKey: `2026-11-${16 + i}`,
    seconds: 75 * 60
  }));
  const spreadResult = evaluateWeeklyExpedition({ weekKey, sessions: spreadSessions });
  assert.equal(spreadResult.effectiveSeconds, 300 * 60);
  assert.equal(spreadResult.activeDays, 4);
  assert.equal(spreadResult.tierId, 'gold');
  assert.equal(spreadResult.campBonus, true);
  assert.equal(spreadResult.eligiblePoints, 55); // 45 Gold + 10 Camp
});

test('break gems require break screen to claim and cap at 30pt/day', () => {
  const now = Date.parse('2026-11-23T10:00:00');
  let state = createInitialState({ locale: 'en', nowMs: now });
  const s1 = { id: 's1', source: 'timer', seconds: 90 * 60, dayKey: '2026-11-23', weekKey: '2026-11-23', startedAt: now };
  state = spawnBreakGemForSession(state, s1, now);
  assert.equal(state.pendingGems.length, 1);
  assert.equal(state.pendingGems[0].points, 15); // Dawn Star Relic

  const outsideBreak = claimBreakGem(state, state.pendingGems[0].id, now, { inBreak: false });
  assert.equal(outsideBreak.granted, 0);
  assert.equal(outsideBreak.reason, 'break_only');

  const inBreak = claimBreakGem(state, state.pendingGems[0].id, now, { inBreak: true });
  assert.equal(inBreak.granted, 15);
  assert.equal(inBreak.state.points, 15);
});

test('honest time correction reconciles gems, expedition, companion bond, and unearned gear', () => {
  const now = Date.parse('2026-11-23T12:00:00');
  let state = createInitialState({ locale: 'en', nowMs: now });
  const sess = {
    id: 's_fix',
    source: 'timer',
    dayKey: '2026-11-23',
    weekKey: '2026-11-23',
    seconds: 90 * 60,
    expeditionEligibleSeconds: 90 * 60,
    companionId: 'twigfox',
    startedAt: now
  };
  state.sessions.push(sess);
  state.companionBonds.twigfox = 90 * 60;
  state = spawnBreakGemForSession(state, sess, now);
  state = claimBreakGem(state, state.pendingGems[0].id, now, { inBreak: true }).state; // +15pt
  state = claimExpeditionChest(state, '2026-11-23', now).state; // +10pt (bronze) => total 25pt

  // Buy an item costing 18pt -> balance becomes 7pt
  const bought = purchaseItem(state, 'gear', 'head-cap', now);
  assert.equal(bought.ok, true);
  state = bought.state;
  assert.equal(state.points, 7);
  assert.ok(state.ownedGear.includes('head-cap'));

  // User corrects timer down from 90m to 20m -> loses Bronze chest (10pt) + downgrades gem 15pt->4pt (11pt clawback) = -21pt!
  // Balance would drop to 7 - 21 = -14 -> automatically reverts head-cap (+18pt) -> balance 4pt!
  const fixed = correctSessionDuration(state, 's_fix', 20 * 60, now + 1000);
  assert.equal(fixed.changed, true);
  assert.equal(fixed.shortened, true);
  assert.equal(fixed.state.companionBonds.twigfox, 20 * 60);
  assert.equal(fixed.state.ownedGear.includes('head-cap'), false);
  assert.equal(fixed.state.points, 4);

  // Increasing duration never grants extra expedition credit
  const stretched = correctSessionDuration(fixed.state, 's_fix', 120 * 60, now + 2000);
  assert.equal(stretched.state.sessions[0].expeditionEligibleSeconds, 20 * 60);
});

test('companion bond tiers and monster sealing cap at 10pt/day', () => {
  assert.equal(companionBondInfo(0, 'en').hearts, 1);
  assert.equal(companionBondInfo(600 * 60, 'ja').hearts, 5);
  assert.equal(companionBondInfo(600 * 60, 'ja').label, '最高の相棒');

  const now = Date.parse('2026-11-23T14:00:00');
  let state = createInitialState({ locale: 'en', nowMs: now });
  for (let i = 0; i < 6; i++) {
    state = recordMonsterSealEvent(state, 'card', `c${i}`, now + i);
  }
  const claimed = claimSealedMonsterRewards(state, now + 100);
  assert.equal(claimed.granted, 10); // capped at 10pt/day even for 6 seals (12pt raw)
});
