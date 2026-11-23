import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendProofLedgerEntry,
  verifyProofLedgerChain,
  buildWeeklyProofSummary,
  encodeProofPact,
  decodeProofPact,
  issueHumanBlessing,
  redeemHumanBlessing,
  getActiveBlessing
} from '../web/src/core/proof-ledger.js';
import { createInitialState } from '../web/src/core/storage.js';

test('SHA-256 Proof Ledger detects tampering and validates intact chains', async () => {
  let ledger = [];
  ledger = await appendProofLedgerEntry(ledger, {
    id: 's1', dayKey: '2026-11-23', category: 'study', seconds: 1500, timelapseId: 'tl1', frameCount: 42, startedAt: 1000
  });
  ledger = await appendProofLedgerEntry(ledger, {
    id: 's2', dayKey: '2026-11-23', category: 'coding', seconds: 2400, timelapseId: null, frameCount: 0, startedAt: 5000
  });

  const ok = await verifyProofLedgerChain(ledger);
  assert.equal(ok.valid, true);
  assert.equal(ok.checked, 2);

  // Tamper seconds in entry 0
  const tampered = [{ ...ledger[0], seconds: 99999 }, ledger[1]];
  const bad = await verifyProofLedgerChain(tampered);
  assert.equal(bad.valid, false);
  assert.equal(bad.brokenIndex, 0);
});

test('Human Blessing Pact enforces anti-self-blessing, MAC integrity, and anti-replay', async () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  let alice = createInitialState({ locale: 'en', nowMs: now });
  alice.deviceId = 'alice_dev_1';
  alice.profile.displayName = 'Alice';
  alice.sessions.push({ id: 's1', dayKey: '2026-11-23', category: 'study', seconds: 1800, frameCount: 12, startedAt: now });
  alice.proofLedger = await appendProofLedgerEntry(alice.proofLedger, alice.sessions[0]);

  const summary = await buildWeeklyProofSummary(alice, '2026-11-23');
  alice.issuedProofHashes.push(summary.proofHash);
  const pactCode = await encodeProofPact(summary);

  const decoded = await decodeProofPact(pactCode);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.totalSeconds, 1800);
  assert.equal(decoded.proofHash, summary.proofHash);

  // Self-blessing MUST be rejected
  const selfAttempt = await issueHumanBlessing(pactCode, {
    stampKey: 'well-done',
    senderName: 'Alice',
    senderDeviceId: 'alice_dev_1',
    nowMs: now
  });
  assert.equal(selfAttempt.ok, false);
  assert.equal(selfAttempt.error, 'selfBlessing');

  // Bob issues genuine human blessing
  const bobBlessing = await issueHumanBlessing(pactCode, {
    stampKey: 'well-done',
    senderName: 'Bob',
    note: 'Keep going!',
    senderDeviceId: 'bob_dev_2',
    nowMs: now
  });
  assert.equal(bobBlessing.ok, true);

  // Alice redeems Bob's blessing -> activates 7-day Golden Aura
  const redeemed = await redeemHumanBlessing(alice, bobBlessing.code, now);
  assert.equal(redeemed.ok, true);
  const active = getActiveBlessing(redeemed.state, 'en', now);
  assert.equal(active.theme, 'gold');
  assert.equal(active.senderName, 'Bob');
  assert.equal(active.remainingDays, 7);

  // Replay MUST be rejected
  const replay = await redeemHumanBlessing(redeemed.state, bobBlessing.code, now + 5000);
  assert.equal(replay.ok, false);
  assert.equal(replay.error, 'replayBlessing');
});
