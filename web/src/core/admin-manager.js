// Administrator / Coach / Parent Record-Management Engine (Study Glass style)
// Provides PIN-protected lock, session audit & verification, erroneous session deletion,
// point adjustment with anti-cheese unearned spending reconciliation, managed student/member roster,
// and clean UTF-8 CSV export.

import { reconcileCompanionRecruits, reconcileUnearnedSpending } from './rpg-engine.js';

export const DEFAULT_ADMIN_PIN = '0000';

export function verifyAdminPin(state, pin) {
  const input = String(pin ?? '').trim();
  const expected = String(state?.settings?.adminPin || DEFAULT_ADMIN_PIN).trim();
  return input.length > 0 && input === expected;
}

export function updateAdminPin(state, newPin) {
  const clean = String(newPin ?? '').trim();
  if (clean.length < 4 || clean.length > 8) {
    return { ok: false, reason: 'invalid_length', state };
  }
  return {
    ok: true,
    state: {
      ...state,
      settings: {
        ...(state?.settings || {}),
        adminPin: clean
      }
    }
  };
}

export function getAdminAuditReport(state) {
  const rawSessions = Array.isArray(state?.sessions) ? state.sessions : [];
  let timerSessions = 0;
  let manualSessions = 0;
  let correctedSessions = 0;
  let verifiedSessions = 0;
  let totalSeconds = 0;

  const sessions = rawSessions.map((s) => {
    const sec = Math.max(0, Math.floor(Number(s?.seconds) || 0));
    totalSeconds += sec;
    if (s?.source === 'timer') timerSessions++;
    else manualSessions++;

    const wasCorrected = s?.originalSeconds != null && Number(s.originalSeconds) !== sec;
    if (wasCorrected) correctedSessions++;

    const verifiedByAdmin = Boolean(s?.verifiedByAdmin);
    if (verifiedByAdmin) verifiedSessions++;

    return {
      ...s,
      seconds: sec,
      minutes: Math.round(sec / 60),
      originalMinutes: s?.originalSeconds != null ? Math.round(Number(s.originalSeconds) / 60) : Math.round(sec / 60),
      wasCorrected,
      verifiedByAdmin
    };
  });

  return {
    totalSessions: sessions.length,
    timerSessions,
    manualSessions,
    correctedSessions,
    verifiedSessions,
    totalSeconds,
    totalMinutes: Math.round(totalSeconds / 60),
    pointsBalance: Math.max(0, Number(state?.points) || 0),
    pointLog: Array.isArray(state?.pointLog) ? state.pointLog : [],
    rosterCount: Array.isArray(state?.adminRoster) ? state.adminRoster.length : 0,
    sessions
  };
}

export function adminVerifySession(state, sessionId, verified = true) {
  const rawSessions = Array.isArray(state?.sessions) ? state.sessions : [];
  let found = false;
  const sessions = rawSessions.map((s) => {
    if (s?.id !== sessionId) return s;
    found = true;
    return {
      ...s,
      verifiedByAdmin: Boolean(verified)
    };
  });
  if (!found) return { changed: false, state };
  return {
    changed: true,
    state: {
      ...state,
      sessions
    }
  };
}

export function adminDeleteSession(state, sessionId) {
  const rawSessions = Array.isArray(state?.sessions) ? state.sessions : [];
  const target = rawSessions.find((s) => s?.id === sessionId);
  if (!target) return { deleted: false, state };

  const sessions = rawSessions.filter((s) => s?.id !== sessionId);
  const sec = Math.max(0, Math.floor(Number(target.seconds) || 0));
  const compId = target.companionId;
  const nextBonds = { ...(state?.companionBonds || {}) };
  if (compId && nextBonds[compId] != null) {
    nextBonds[compId] = Math.max(0, (Number(nextBonds[compId]) || 0) - sec);
  }

  const pendingGems = (state?.pendingGems || []).filter((g) => g?.sessionId !== sessionId);

  let next = {
    ...state,
    sessions,
    companionBonds: nextBonds,
    pendingGems
  };
  next = reconcileCompanionRecruits(next).state;
  return {
    deleted: true,
    removedSession: target,
    state: next
  };
}

export function adminAdjustPoints(state, deltaPoints, reason = 'Coach adjustment', nowMs = Date.now()) {
  const delta = Math.round(Number(deltaPoints) || 0);
  if (delta === 0) return { changed: false, delta: 0, state };

  const current = Number(state?.points) || 0;
  const rawBalance = current + delta;
  const logEntry = {
    id: `pt_${nowMs}`,
    rule: 'admin-adjust',
    amount: delta,
    detail: String(reason || 'Coach adjustment').slice(0, 80),
    at: nowMs
  };

  let next = {
    ...state,
    points: rawBalance,
    pointLog: [logEntry, ...(state?.pointLog || []).slice(0, 49)]
  };

  if (rawBalance < 0) {
    next = reconcileUnearnedSpending(next);
  } else {
    next.points = Math.max(0, rawBalance);
  }

  return {
    changed: true,
    delta,
    points: next.points,
    state: next
  };
}

export function adminUpsertRosterMember(state, memberEntry = {}, nowMs = Date.now()) {
  const roster = Array.isArray(state?.adminRoster) ? [...state.adminRoster] : [];
  const cleanName = String(memberEntry.name || 'Student').trim().slice(0, 40) || 'Student';
  const id = String(memberEntry.id || `mbr_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || nowMs}`);

  const record = {
    id,
    name: cleanName,
    weekKey: String(memberEntry.weekKey || ''),
    totalSeconds: Math.max(0, Math.floor(Number(memberEntry.totalSeconds) || 0)),
    activeDays: Math.max(0, Math.min(7, Math.floor(Number(memberEntry.activeDays) || 0))),
    timelapseFrames: Math.max(0, Math.floor(Number(memberEntry.timelapseFrames) || 0)),
    lastCode: String(memberEntry.lastCode || ''),
    updatedAt: Number(memberEntry.updatedAt) || nowMs
  };

  const idx = roster.findIndex((m) => m.id === id || m.name.toLowerCase() === cleanName.toLowerCase());
  if (idx >= 0) {
    roster[idx] = { ...roster[idx], ...record, id: roster[idx].id };
  } else {
    roster.unshift(record);
  }

  return {
    member: idx >= 0 ? roster[idx] : record,
    state: {
      ...state,
      adminRoster: roster.slice(0, 50)
    }
  };
}

export function adminRemoveRosterMember(state, memberId) {
  const roster = Array.isArray(state?.adminRoster) ? state.adminRoster : [];
  const nextRoster = roster.filter((m) => m?.id !== memberId);
  return {
    removed: nextRoster.length !== roster.length,
    state: {
      ...state,
      adminRoster: nextRoster
    }
  };
}

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportAdminCsv(state) {
  const header = 'dayKey,source,category,minutes,originalMinutes,verifiedByAdmin,frameCount,note';
  const rows = (Array.isArray(state?.sessions) ? state.sessions : []).map((s) => {
    const sec = Math.max(0, Math.floor(Number(s?.seconds) || 0));
    const min = Math.round(sec / 60);
    const origMin = s?.originalSeconds != null ? Math.round(Number(s.originalSeconds) / 60) : min;
    const cells = [
      s?.dayKey || '',
      s?.source || 'timer',
      s?.category || 'study',
      min,
      origMin,
      Boolean(s?.verifiedByAdmin),
      Math.max(0, Math.floor(Number(s?.frameCount) || 0)),
      s?.note || ''
    ];
    return cells.map(escapeCsvCell).join(',');
  });
  return [header, ...rows].join('\n');
}
