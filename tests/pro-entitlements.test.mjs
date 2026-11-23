import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRO_SKUS,
  FREE_LIMITS,
  PRO_LIMITS,
  isProActive,
  getPlanLimits,
  canAddFsrsCard,
  canUseProofTheme,
  getAvailableRoomIds,
  applyBillingEntitlement
} from '../web/src/core/pro-entitlements.js';
import { createInitialState } from '../web/src/core/storage.js';
import { ROOMS } from '../web/src/core/catalog.js';

test('Free tier enforces balanced limits while Pro expands archive, FSRS, themes, and rooms', () => {
  const freeState = createInitialState({ locale: 'en' });
  assert.equal(isProActive(freeState), false);
  assert.deepEqual(getPlanLimits(freeState), FREE_LIMITS);
  assert.equal(canUseProofTheme(freeState, 'emerald'), true);
  assert.equal(canUseProofTheme(freeState, 'midnight'), false);
  assert.equal(getAvailableRoomIds(freeState, ROOMS).length, 2);

  // Fill 25 FSRS cards -> 26th blocked on Free
  freeState.cards = Array.from({ length: 25 }, (_, i) => ({ id: `c_${i}` }));
  assert.equal(canAddFsrsCard(freeState), false);

  // Apply Pro entitlement
  const proState = applyBillingEntitlement(freeState, {
    isPro: true,
    activeSku: PRO_SKUS[0].id
  });
  assert.equal(isProActive(proState), true);
  assert.deepEqual(getPlanLimits(proState), PRO_LIMITS);
  assert.equal(canAddFsrsCard(proState), true);
  assert.equal(canUseProofTheme(proState, 'midnight'), true);
  assert.equal(canUseProofTheme(proState, 'gilded'), true);
  assert.equal(canUseProofTheme(proState, 'sakura'), true);
  assert.equal(getAvailableRoomIds(proState, ROOMS).length, ROOMS.length);
});

test('Anti-Pay-to-Win: applying Pro entitlement never alters points, sessions, or blessings', () => {
  const state = createInitialState({ locale: 'ja' });
  state.points = 12;
  state.sessions = [{ id: 's1', seconds: 600 }];
  state.blessings = [{ id: 'b1', theme: 'gold' }];

  const upgraded = applyBillingEntitlement(state, { isPro: true, activeSku: 'craft_pro_lifetime' });
  assert.equal(upgraded.points, 12);
  assert.equal(upgraded.sessions.length, 1);
  assert.equal(upgraded.blessings.length, 1);

  const downgraded = applyBillingEntitlement(upgraded, { isPro: false });
  assert.equal(downgraded.points, 12);
  assert.equal(isProActive(downgraded), false);
});
