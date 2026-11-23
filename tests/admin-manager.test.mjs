import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ADMIN_PIN,
  verifyAdminPin,
  updateAdminPin,
  getAdminAuditReport,
  adminVerifySession,
  adminDeleteSession,
  adminAdjustPoints,
  adminUpsertRosterMember,
  adminRemoveRosterMember,
  exportAdminCsv
} from '../web/src/core/admin-manager.js';
import { createInitialState } from '../web/src/core/storage.js';
import { purchaseItem } from '../web/src/core/rpg-engine.js';

test('Admin PIN lock verifies default PIN and updates 4-8 char PIN cleanly', () => {
  let state = createInitialState();
  assert.equal(verifyAdminPin(state, DEFAULT_ADMIN_PIN), true);
  assert.equal(verifyAdminPin(state, '9999'), false);

  const tooShort = updateAdminPin(state, '12');
  assert.equal(tooShort.ok, false);

  const updated = updateAdminPin(state, '2580');
  assert.equal(updated.ok, true);
  state = updated.state;
  assert.equal(verifyAdminPin(state, '2580'), true);
  assert.equal(verifyAdminPin(state, '0000'), false);
});

test('Admin session audit, verification, deletion, and CSV export work cleanly', () => {
  let state = createInitialState();
  state.sessions = [
    {
      id: 'sess_1',
      dayKey: '2026-11-22',
      source: 'timer',
      category: 'study',
      seconds: 45 * 60,
      originalSeconds: 60 * 60,
      companionId: 'twigfox',
      frameCount: 18,
      note: 'Math chapter 3'
    },
    {
      id: 'sess_2',
      dayKey: '2026-11-23',
      source: 'manual',
      category: 'coding',
      seconds: 30 * 60,
      companionId: 'twigfox',
      frameCount: 0,
      note: 'Algorithm practice, pair'
    }
  ];
  state.companionBonds = { twigfox: 75 * 60 };

  const audit1 = getAdminAuditReport(state);
  assert.equal(audit1.totalSessions, 2);
  assert.equal(audit1.timerSessions, 1);
  assert.equal(audit1.manualSessions, 1);
  assert.equal(audit1.correctedSessions, 1);
  assert.equal(audit1.verifiedSessions, 0);
  assert.equal(audit1.totalMinutes, 75);

  const verifiedRes = adminVerifySession(state, 'sess_1', true);
  assert.equal(verifiedRes.changed, true);
  state = verifiedRes.state;
  assert.equal(getAdminAuditReport(state).verifiedSessions, 1);

  const csv = exportAdminCsv(state);
  assert.ok(csv.startsWith('dayKey,source,category,minutes,originalMinutes,verifiedByAdmin,frameCount,note'));
  assert.ok(csv.includes('2026-11-22,timer,study,45,60,true,18,Math chapter 3'));
  assert.ok(csv.includes('"Algorithm practice, pair"'));

  const deleted = adminDeleteSession(state, 'sess_2');
  assert.equal(deleted.deleted, true);
  state = deleted.state;
  assert.equal(state.sessions.length, 1);
  assert.equal(state.companionBonds.twigfox, 45 * 60);
});

test('Admin point adjustment logs entry and reconciles unearned gear on negative deduction', () => {
  let state = createInitialState();
  const grant = adminAdjustPoints(state, 25, 'Weekly milestone bonus', 1000);
  assert.equal(grant.changed, true);
  state = grant.state;
  assert.equal(state.points, 25);
  assert.equal(state.pointLog[0].rule, 'admin-adjust');
  assert.equal(state.pointLog[0].amount, 25);

  const bought = purchaseItem(state, 'gear', 'head-cap', 2000); // costs 18
  assert.equal(bought.ok, true);
  state = bought.state;
  assert.equal(state.points, 7);
  assert.ok(state.ownedGear.includes('head-cap'));

  // Deduct 15 points -> balance drops below 0 (-8) -> reverts head-cap (+18) -> 10 points left
  const deduct = adminAdjustPoints(state, -15, 'Revoke duplicate log', 3000);
  state = deduct.state;
  assert.equal(state.ownedGear.includes('head-cap'), false);
  assert.equal(state.points, 10);
});

test('Admin student/member roster upserts and removes managed members', () => {
  let state = createInitialState();
  const r1 = adminUpsertRosterMember(state, {
    name: 'Hana',
    weekKey: '2026-11-23',
    totalSeconds: 180 * 60,
    activeDays: 4,
    timelapseFrames: 32,
    lastCode: 'CGP1:demo'
  });
  state = r1.state;
  assert.equal(state.adminRoster.length, 1);
  assert.equal(state.adminRoster[0].name, 'Hana');

  // Upserting same student name updates their record
  const r2 = adminUpsertRosterMember(state, {
    name: 'Hana',
    weekKey: '2026-11-23',
    totalSeconds: 240 * 60,
    activeDays: 5,
    timelapseFrames: 44
  });
  state = r2.state;
  assert.equal(state.adminRoster.length, 1);
  assert.equal(state.adminRoster[0].totalSeconds, 240 * 60);

  const rem = adminRemoveRosterMember(state, state.adminRoster[0].id);
  assert.equal(rem.removed, true);
  assert.equal(rem.state.adminRoster.length, 0);
});
