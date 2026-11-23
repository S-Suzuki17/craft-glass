// SHA-256 Proof Ledger + Human Blessing Pact Engine (Anti-AI Praise, Anti-Self, Anti-Replay)
// Works identically in Web browsers (crypto.subtle) and Node 22 (globalThis.crypto.subtle).

import { BLESSING_STAMPS } from './catalog.js';
import { getLocalDayKey, getWeekDates } from './weekly-pool.js';
import { t } from './i18n.js';

const DAY_MS = 86_400_000;
export const HUMAN_BLESSING_DAYS = 7;
export const HUMAN_BLESSING_MS = HUMAN_BLESSING_DAYS * DAY_MS;

const PACT_HMAC_SALT = 'CraftGlass-HumanCraft-v1';

function getSubtleCrypto() {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  throw new Error('Web Crypto subtle API unavailable');
}

export async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(String(input ?? ''));
  const digest = await getSubtleCrypto().digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64u) {
  const b64 = String(b64u || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function computeMac(payloadJson) {
  const hex = await sha256Hex(`${PACT_HMAC_SALT}:${payloadJson}`);
  return hex.slice(0, 12);
}

/**
 * Appends an entry to the chained SHA-256 Proof Ledger.
 */
export async function appendProofLedgerEntry(ledger = [], session) {
  const prevHash = ledger.length > 0 ? ledger[ledger.length - 1].entryHash : 'GENESIS';
  const payload = {
    seq: ledger.length + 1,
    sessionId: session.id,
    dayKey: session.dayKey,
    category: session.category,
    seconds: session.seconds,
    hasTimelapse: Boolean(session.timelapseId),
    frameCount: Number(session.frameCount) || 0,
    startedAt: session.startedAt,
    prevHash
  };
  const entryHash = await sha256Hex(JSON.stringify(payload));
  return [...ledger, { ...payload, entryHash }];
}

export async function verifyProofLedgerChain(ledger = []) {
  let expectedPrev = 'GENESIS';
  for (let i = 0; i < ledger.length; i++) {
    const entry = ledger[i];
    if (entry.prevHash !== expectedPrev) {
      return { valid: false, checked: i, brokenIndex: i };
    }
    const payload = {
      seq: entry.seq,
      sessionId: entry.sessionId,
      dayKey: entry.dayKey,
      category: entry.category,
      seconds: entry.seconds,
      hasTimelapse: Boolean(entry.hasTimelapse),
      frameCount: Number(entry.frameCount) || 0,
      startedAt: entry.startedAt,
      prevHash: entry.prevHash
    };
    const actualHash = await sha256Hex(JSON.stringify(payload));
    if (actualHash !== entry.entryHash) {
      return { valid: false, checked: i, brokenIndex: i };
    }
    expectedPrev = entry.entryHash;
  }
  return { valid: true, checked: ledger.length, brokenIndex: -1 };
}

export async function buildWeeklyProofSummary(state, weekKey) {
  const dates = new Set(getWeekDates(weekKey));
  const weekSessions = (state.sessions || []).filter((s) => dates.has(s.dayKey || getLocalDayKey(s.startedAt)));
  const totalSeconds = weekSessions.reduce((sum, s) => sum + Math.max(0, Number(s.seconds) || 0), 0);
  const activeDays = new Set(weekSessions.filter((s) => s.seconds >= 60).map((s) => s.dayKey)).size;
  const timelapseFrames = weekSessions.reduce((sum, s) => sum + (Number(s.frameCount) || 0), 0);
  const canonical = JSON.stringify({
    deviceId: state.deviceId,
    weekKey,
    totalSeconds,
    activeDays,
    sessionCount: weekSessions.length,
    timelapseFrames,
    ledgerTip: (state.proofLedger || []).slice(-1)[0]?.entryHash || 'GENESIS'
  });
  const proofHash = (await sha256Hex(canonical)).slice(0, 16);
  return {
    weekKey,
    deviceId: state.deviceId,
    name: state.profile?.displayName || 'Craft Explorer',
    totalSeconds,
    activeDays,
    sessionCount: weekSessions.length,
    timelapseFrames,
    proofHash
  };
}

export async function encodeProofPact(summary) {
  const body = {
    v: 1,
    d: summary.deviceId,
    w: summary.weekKey,
    n: String(summary.name || 'Crafter').slice(0, 28),
    s: Math.round(summary.totalSeconds),
    a: summary.activeDays,
    c: summary.sessionCount,
    f: summary.timelapseFrames,
    h: summary.proofHash
  };
  const bodyJson = JSON.stringify(body);
  const mac = await computeMac(bodyJson);
  return `CGP1:${toBase64Url(JSON.stringify({ b: body, m: mac }))}`;
}

export async function decodeProofPact(pactCode) {
  try {
    const raw = String(pactCode || '').trim();
    if (!raw.startsWith('CGP1:')) return { valid: false };
    const parsed = JSON.parse(fromBase64Url(raw.slice(5)));
    if (!parsed?.b || !parsed?.m) return { valid: false };
    const expectedMac = await computeMac(JSON.stringify(parsed.b));
    if (expectedMac !== parsed.m) return { valid: false };
    const b = parsed.b;
    return {
      valid: true,
      deviceId: String(b.d),
      weekKey: String(b.w),
      name: String(b.n || 'Crafter'),
      totalSeconds: Number(b.s) || 0,
      activeDays: Number(b.a) || 0,
      sessionCount: Number(b.c) || 0,
      timelapseFrames: Number(b.f) || 0,
      proofHash: String(b.h)
    };
  } catch {
    return { valid: false };
  }
}

export async function issueHumanBlessing(pactCode, {
  stampKey = 'well-done',
  senderName = 'Friend',
  note = '',
  senderDeviceId,
  nowMs = Date.now()
} = {}) {
  const pact = await decodeProofPact(pactCode);
  if (!pact.valid) return { ok: false, error: 'invalidPact' };
  if (!senderDeviceId || senderDeviceId === pact.deviceId) {
    return { ok: false, error: 'selfBlessing' };
  }
  const stamp = BLESSING_STAMPS.find((s) => s.key === stampKey) || BLESSING_STAMPS[0];
  const blessingId = (await sha256Hex(`${pact.proofHash}:${senderDeviceId}:${nowMs}`)).slice(0, 12);
  const body = {
    v: 1,
    id: blessingId,
    ph: pact.proofHash,
    td: pact.deviceId,
    sd: senderDeviceId,
    sn: String(senderName || 'Friend').trim().slice(0, 24) || 'Friend',
    sk: stamp.key,
    nt: String(note || '').trim().slice(0, 80),
    at: nowMs
  };
  const mac = await computeMac(JSON.stringify(body));
  return {
    ok: true,
    code: `CGB1:${toBase64Url(JSON.stringify({ b: body, m: mac }))}`,
    blessing: body
  };
}

export async function redeemHumanBlessing(state, blessingCode, nowMs = Date.now()) {
  let parsed;
  try {
    const raw = String(blessingCode || '').trim();
    if (!raw.startsWith('CGB1:')) return { ok: false, error: 'invalidBlessing', state };
    parsed = JSON.parse(fromBase64Url(raw.slice(5)));
    if (!parsed?.b || !parsed?.m) return { ok: false, error: 'invalidBlessing', state };
    const expectedMac = await computeMac(JSON.stringify(parsed.b));
    if (expectedMac !== parsed.m) return { ok: false, error: 'invalidBlessing', state };
  } catch {
    return { ok: false, error: 'invalidBlessing', state };
  }

  const b = parsed.b;
  if (b.sd === state.deviceId || (b.td && b.td !== state.deviceId)) {
    return { ok: false, error: b.sd === state.deviceId ? 'selfBlessing' : 'wrongProofHash', state };
  }
  const knownHashes = new Set(state.issuedProofHashes || []);
  if (!knownHashes.has(b.ph)) {
    return { ok: false, error: 'wrongProofHash', state };
  }
  const redeemedIds = new Set(state.redeemedBlessingIds || []);
  if (redeemedIds.has(b.id)) {
    return { ok: false, error: 'replayBlessing', state };
  }

  const stamp = BLESSING_STAMPS.find((s) => s.key === b.sk) || BLESSING_STAMPS[0];
  const record = {
    id: b.id,
    proofHash: b.ph,
    senderDeviceId: b.sd,
    senderName: b.sn,
    stampKey: stamp.key,
    stampSrc: stamp.src,
    theme: stamp.theme,
    note: b.nt,
    createdAt: b.at,
    redeemedAt: nowMs,
    expiresAt: nowMs + HUMAN_BLESSING_MS
  };

  return {
    ok: true,
    blessing: record,
    state: {
      ...state,
      redeemedBlessingIds: [...redeemedIds, b.id].slice(-100),
      blessings: [record, ...(state.blessings || [])].slice(0, 30)
    }
  };
}

export function getActiveBlessing(state, locale = 'en', nowMs = Date.now()) {
  const valid = (state.blessings || []).filter((b) => b.expiresAt > nowMs);
  if (!valid.length) return null;
  const latest = valid[0];
  const remainingDays = Math.max(1, Math.ceil((latest.expiresAt - nowMs) / DAY_MS));
  const themeCopy = t(locale, `blessings.${latest.theme}`);
  const stampLabel = t(locale, `stamps.${latest.stampKey}`);
  return {
    ...latest,
    remainingDays,
    title: themeCopy.title,
    description: themeCopy.desc,
    stampLabel
  };
}
