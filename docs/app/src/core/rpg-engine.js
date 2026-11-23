// Craft Glass RPG Engine:
// 1. 25 Guild Ranks (1 min = 1 EXP, Lv.99 at 400h)
// 2. Weekly Expedition Chests (90 min/day anti-cramming cap + Camp Bonus)
// 3. Companion Bond (5 tiers per companion based on saved minutes)
// 4. Break Gems (spawn on >=5m timer finish, claimable ONLY on break, 24h TTL, 30pt/day cap)
// 5. Sealed Monsters (FSRS overdue cards + neglected habits, 2pt each, 10pt/day cap)
// 6. Honest Time Correction with full anti-cheese point & gear reconciliation

import {
  GUILD_RANKS,
  reqExpForLevel,
  WORLDS,
  COMPANIONS,
  BOND_TIERS,
  BREAK_GEMS,
  SEALED_MONSTER_KINDS,
  WILD_MONSTERS,
  EQUIPMENT_CATALOG,
  ROOMS
} from './catalog.js';
import { getLocalDayKey, addDaysToKey, getWeekDates, findNeglectedPools } from './weekly-pool.js';
import { getDueCards } from './fsrs.js';
import { t } from './i18n.js';

const DAY_MS = 86_400_000;

export const EXPEDITION_DAILY_CAP_SECONDS = 90 * 60;
export const EXPEDITION_CAMP_BONUS_POINTS = 10;
export const EXPEDITION_TIERS = Object.freeze([
  { id: 'bronze', tier: 1, requiredSeconds: 60 * 60, requiredDays: 1, points: 10 },
  { id: 'silver', tier: 2, requiredSeconds: 180 * 60, requiredDays: 3, points: 25 },
  { id: 'gold', tier: 3, requiredSeconds: 300 * 60, requiredDays: 4, points: 45 }
]);

export const BREAK_GEM_MIN_SECONDS = 5 * 60;
export const BREAK_GEM_DAILY_POINT_CAP = 30;
export const BREAK_GEM_TTL_MS = DAY_MS;

export const MONSTER_SEAL_POINTS = 2;
export const MONSTER_SEAL_DAILY_CAP = 10;
export const MONSTER_SEAL_MAX_ACTIVE = 5;
export const WILD_DEFEAT_UNIT_SECONDS = 15 * 60; // Every 15m of real focus defeats 1 wild creature

export function calcWildDefeats(state) {
  const focusSec = calcTotalFocusSeconds(state?.sessions || []);
  const sealed = Math.max(0, Math.floor(Number(state?.totalMonstersSealed) || 0));
  return Math.floor(focusSec / WILD_DEFEAT_UNIT_SECONDS) + sealed;
}

/**
 * Evaluates wild creature defeats from recorded focus time & sealed monsters.
 * Once defeats reach a companion's encounter zone (`minDefeats`), each defeat rolls a
 * deterministic befriend chance (`recruitChance`), with 100% guarantee at `pityDefeats`.
 */
export function reconcileCompanionRecruits(state) {
  const defeats = calcWildDefeats(state);
  const prevOwned = new Set(state?.ownedCompanions || ['twigfox']);
  const nextOwned = [];
  const newlyRecruited = [];
  const deviceSeed = String(state?.deviceId || 'craft-glass');

  for (const c of COMPANIONS) {
    if (c.id === 'twigfox' || defeats >= c.pityDefeats) {
      nextOwned.push(c.id);
      if (!prevOwned.has(c.id)) newlyRecruited.push(c);
      continue;
    }
    if (defeats < c.minDefeats) {
      continue;
    }
    let befriended = false;
    for (let d = Math.max(1, c.minDefeats); d <= defeats; d++) {
      const roll = (stableHash(`${deviceSeed}:${c.id}:${d}`) % 1000) / 1000;
      if (roll < (c.recruitChance || 0.35)) {
        befriended = true;
        break;
      }
    }
    if (befriended) {
      nextOwned.push(c.id);
      if (!prevOwned.has(c.id)) newlyRecruited.push(c);
    }
  }

  const activeCompanion = nextOwned.includes(state?.activeCompanion)
    ? state.activeCompanion
    : 'twigfox';

  return {
    defeats,
    newlyRecruited,
    state: {
      ...state,
      ownedCompanions: nextOwned,
      activeCompanion
    }
  };
}

export function getBestiaryProgress(state) {
  const totalDefeats = calcWildDefeats(state);
  const totalSec = calcTotalFocusSeconds(state?.sessions || []);
  const { level, unlockedWorld } = calcGuildLevel(totalSec, 'en');
  const maxWorldId = unlockedWorld?.id || 1;
  const total = WILD_MONSTERS.length;

  let discoveredCount = 0;
  const monsters = WILD_MONSTERS.map((m, idx) => {
    const baseCount = Math.floor(totalDefeats / total);
    const extra = idx < (totalDefeats % total) ? 1 : 0;
    const defeatedCount = baseCount + extra;
    const unlocked = defeatedCount > 0 || m.worldId <= maxWorldId || level >= m.baseLv;
    if (unlocked) discoveredCount++;
    return {
      ...m,
      defeatedCount,
      unlocked
    };
  });

  return {
    totalMonsters: total,
    discoveredCount,
    totalDefeats,
    monsters
  };
}

function stableHash(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str || '')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function calcTotalFocusSeconds(sessions = []) {
  return (Array.isArray(sessions) ? sessions : []).reduce(
    (sum, s) => sum + Math.max(0, Math.floor(Number(s?.seconds) || 0)),
    0
  );
}

export function calcGuildLevel(totalSeconds = 0, locale = 'en') {
  const mins = Math.max(0, Math.floor(Number(totalSeconds) / 60));
  let level = 1;
  while (level < 99 && reqExpForLevel(level + 1) <= mins) level++;

  const currentLevelExp = reqExpForLevel(level);
  const nextLevelExp = level < 99 ? reqExpForLevel(level + 1) : currentLevelExp;
  const neededForNext = Math.max(0, nextLevelExp - mins);
  const range = Math.max(1, nextLevelExp - currentLevelExp);
  const percent = level >= 99 ? 100 : Math.min(100, Math.round(((mins - currentLevelExp) / range) * 100));

  let rankIdx = 0;
  for (let i = 0; i < GUILD_RANKS.length; i++) {
    if (level >= GUILD_RANKS[i].minLevel) rankIdx = i;
  }
  const rankMeta = GUILD_RANKS[rankIdx];
  const nextRankMeta = GUILD_RANKS[rankIdx + 1] || null;
  const ranksDict = t(locale, 'ranks');
  const [rankLabel, rankTitle] = ranksDict[rankIdx] || ranksDict[0];
  const nextPair = nextRankMeta ? ranksDict[rankIdx + 1] : null;

  let unlockedWorld = WORLDS[0];
  for (const w of WORLDS) {
    if (level >= w.minLevel) unlockedWorld = w;
  }

  return {
    level,
    exp: mins,
    totalSeconds: Math.max(0, Math.floor(Number(totalSeconds) || 0)),
    currentLevelExp,
    nextLevelExp,
    neededForNext,
    percent,
    rankStep: rankMeta.step,
    rankCount: GUILD_RANKS.length,
    rank: rankLabel,
    rankTitle,
    unlockedWorld,
    nextRank: nextRankMeta ? {
      rank: nextPair[0],
      title: nextPair[1],
      level: nextRankMeta.minLevel,
      requiredMinutes: nextRankMeta.requiredMinutes,
      remainingMinutes: Math.max(0, nextRankMeta.requiredMinutes - mins)
    } : null
  };
}

export function reqCompanionMinutes(compLevel) {
  if (compLevel <= 1) return 0;
  return Math.round(Math.pow(compLevel - 1, 1.25) * 12);
}

export function companionBondInfo(seconds = 0, locale = 'en') {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(total / 60);
  let tier = BOND_TIERS[0];
  for (const b of BOND_TIERS) {
    if (total >= b.minSeconds) tier = b;
  }
  let compLevel = 1;
  while (compLevel < 50 && reqCompanionMinutes(compLevel + 1) <= mins) {
    compLevel++;
  }
  const curLvMin = reqCompanionMinutes(compLevel);
  const nextLvMin = compLevel < 50 ? reqCompanionMinutes(compLevel + 1) : curLvMin;
  const compExpPercent = compLevel >= 50
    ? 100
    : Math.min(100, Math.round(((mins - curLvMin) / Math.max(1, nextLvMin - curLvMin)) * 100));

  const next = BOND_TIERS.find((b) => b.level === tier.level + 1) || null;
  const dictList = t(locale, 'bondLevels');
  const localized = dictList[tier.level - 1] || dictList[0];
  return {
    seconds: total,
    level: tier.level,
    compLevel,
    compExpPercent,
    hearts: tier.hearts,
    maxHearts: BOND_TIERS.length,
    label: localized.label,
    quote: localized.quote,
    nextLevelSeconds: next ? next.minSeconds : null,
    remainingSeconds: next ? Math.max(0, next.minSeconds - total) : 0
  };
}

export function gemForStudySeconds(seconds = 0) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  if (sec < BREAK_GEM_MIN_SECONDS) return null;
  let picked = BREAK_GEMS[0];
  for (const g of BREAK_GEMS) {
    if (sec >= g.minSeconds) picked = g;
  }
  return picked;
}

export function evaluateWeeklyExpedition({
  weekKey,
  sessions = [],
  earlyCompleted = false,
  claimedPoints = 0
}) {
  const weekDates = getWeekDates(weekKey);
  const dailyMap = new Map(weekDates.map((d) => [d, 0]));
  for (const s of sessions || []) {
    const day = s.dayKey || getLocalDayKey(s.startedAt);
    if (!dailyMap.has(day)) continue;
    const sec = Math.max(0, Math.floor(Number(s.expeditionEligibleSeconds ?? s.seconds) || 0));
    dailyMap.set(day, dailyMap.get(day) + sec);
  }

  let rawSeconds = 0;
  let effectiveSeconds = 0;
  let activeDays = 0;
  const days = [];
  for (const day of weekDates) {
    const sec = dailyMap.get(day) || 0;
    const capped = Math.min(sec, EXPEDITION_DAILY_CAP_SECONDS);
    rawSeconds += sec;
    effectiveSeconds += capped;
    if (sec >= 60) activeDays++;
    days.push({
      dayKey: day,
      seconds: sec,
      effectiveSeconds: capped,
      studied: sec >= 60,
      capped: sec > EXPEDITION_DAILY_CAP_SECONDS
    });
  }

  let achieved = null;
  for (const tier of EXPEDITION_TIERS) {
    if (effectiveSeconds >= tier.requiredSeconds && activeDays >= tier.requiredDays) {
      achieved = tier;
    }
  }
  const campBonus = Boolean(achieved && (activeDays >= 4 || earlyCompleted));
  const tierPoints = achieved ? achieved.points : 0;
  const eligiblePoints = tierPoints + (campBonus ? EXPEDITION_CAMP_BONUS_POINTS : 0);
  const claimed = Math.max(0, Math.floor(Number(claimedPoints) || 0));
  const claimablePoints = Math.max(0, eligiblePoints - claimed);

  return {
    weekKey,
    dailyCapMinutes: 90,
    rawSeconds,
    effectiveSeconds,
    activeDays,
    earlyCompleted: Boolean(earlyCompleted),
    campBonus,
    tier: achieved ? achieved.tier : 0,
    tierId: achieved ? achieved.id : 'none',
    tierPoints,
    eligiblePoints,
    claimedPoints: claimed,
    claimablePoints,
    days,
    tiers: EXPEDITION_TIERS.map((tier) => ({
      ...tier,
      unlocked: Boolean(achieved && achieved.tier >= tier.tier)
    }))
  };
}

export function claimExpeditionChest(state, weekKey, nowMs = Date.now()) {
  const earlyCompleted = (state.pools || []).some((p) => p.weekKey === weekKey && p.earlyCompleted);
  const claimedSoFar = Number(state.expeditionClaims?.[weekKey]) || 0;
  const status = evaluateWeeklyExpedition({
    weekKey,
    sessions: state.sessions,
    earlyCompleted,
    claimedPoints: claimedSoFar
  });
  if (status.claimablePoints <= 0) {
    return { granted: 0, status, state };
  }
  const next = {
    ...state,
    points: (Number(state.points) || 0) + status.claimablePoints,
    expeditionClaims: {
      ...(state.expeditionClaims || {}),
      [weekKey]: status.eligiblePoints
    },
    pointLog: [
      { id: `pt_${nowMs}`, rule: 'expedition', amount: status.claimablePoints, detail: weekKey, at: nowMs },
      ...(state.pointLog || []).slice(0, 49)
    ]
  };
  return { granted: status.claimablePoints, status, state: next };
}

export function spawnBreakGemForSession(state, session, nowMs = Date.now()) {
  if (!session || session.source !== 'timer') return state;
  const gem = gemForStudySeconds(session.seconds);
  if (!gem) return state;
  const newGem = {
    id: `gem_${session.id}`,
    sessionId: session.id,
    gemId: gem.id,
    color: gem.color,
    points: gem.points,
    studySeconds: session.seconds,
    createdAt: nowMs,
    expiresAt: nowMs + BREAK_GEM_TTL_MS,
    claimedAt: null,
    awardedPoints: 0
  };
  return {
    ...state,
    pendingGems: [newGem, ...(state.pendingGems || []).filter((g) => g.sessionId !== session.id)].slice(0, 20)
  };
}

export function getActivePendingGems(state, nowMs = Date.now()) {
  return (state.pendingGems || []).filter((g) => !g.claimedAt && g.expiresAt > nowMs);
}

export function getDailyGemEarned(state, dayKey) {
  return (state.pendingGems || [])
    .filter((g) => g.claimedDay === dayKey && g.claimedAt)
    .reduce((sum, g) => sum + Math.max(0, Number(g.awardedPoints) || 0), 0);
}

export function claimBreakGem(state, gemId, nowMs = Date.now(), { inBreak = true } = {}) {
  if (!inBreak) return { granted: 0, reason: 'break_only', state };
  const idx = (state.pendingGems || []).findIndex((g) => g.id === gemId && !g.claimedAt && g.expiresAt > nowMs);
  if (idx === -1) return { granted: 0, reason: 'not_found', state };

  const gem = state.pendingGems[idx];
  const dayKey = getLocalDayKey(nowMs);
  const earnedToday = getDailyGemEarned(state, dayKey);
  const room = Math.max(0, BREAK_GEM_DAILY_POINT_CAP - earnedToday);
  const granted = Math.min(gem.points, room);

  const updatedGem = {
    ...gem,
    claimedAt: nowMs,
    claimedDay: dayKey,
    awardedPoints: granted
  };
  const nextGems = [...state.pendingGems];
  nextGems[idx] = updatedGem;

  const prevCount = Number(state.gemCollection?.[gem.gemId]) || 0;
  const next = {
    ...state,
    points: (Number(state.points) || 0) + granted,
    pendingGems: nextGems,
    gemCollection: {
      ...(state.gemCollection || {}),
      [gem.gemId]: prevCount + 1
    },
    pointLog: [
      ...(granted > 0
        ? [{ id: `pt_${nowMs}`, rule: 'break-gem', amount: granted, detail: gem.gemId, at: nowMs }]
        : []),
      ...(state.pointLog || []).slice(0, 49)
    ]
  };
  return { granted, dailyEarned: earnedToday + granted, cap: BREAK_GEM_DAILY_POINT_CAP, state: next };
}

export function getSealedMonsters(state, currentWeekKey, nowMs = Date.now()) {
  const dueCards = getDueCards(state.cards || [], nowMs);
  const neglected = findNeglectedPools(state.pools || [], currentWeekKey, nowMs);
  const monsters = [];

  for (const card of dueCards) {
    if (monsters.length >= MONSTER_SEAL_MAX_ACTIVE) break;
    const kind = SEALED_MONSTER_KINDS[stableHash(`card:${card.id}`) % SEALED_MONSTER_KINDS.length];
    monsters.push({
      id: `seal_card_${card.id}`,
      sourceKind: 'card',
      sourceId: card.id,
      title: card.front,
      subtitle: card.deck,
      kind: kind.id,
      kindNameEn: kind.en,
      kindNameJa: kind.ja
    });
  }
  for (const pool of neglected) {
    if (monsters.length >= MONSTER_SEAL_MAX_ACTIVE) break;
    const kind = SEALED_MONSTER_KINDS[stableHash(`pool:${pool.id}`) % SEALED_MONSTER_KINDS.length];
    monsters.push({
      id: `seal_pool_${pool.id}`,
      sourceKind: 'pool',
      sourceId: pool.id,
      title: pool.title,
      subtitle: pool.category,
      kind: kind.id,
      kindNameEn: kind.en,
      kindNameJa: kind.ja
    });
  }
  return monsters;
}

export function recordMonsterSealEvent(state, sourceKind, sourceId, nowMs = Date.now()) {
  const dayKey = getLocalDayKey(nowMs);
  const key = `${dayKey}:${sourceKind}:${sourceId}`;
  const events = state.sealEvents || [];
  if (events.some((e) => e.key === key)) return state;
  const event = {
    id: `seal_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    key,
    dayKey,
    sourceKind,
    sourceId,
    points: MONSTER_SEAL_POINTS,
    awardedPoints: 0,
    claimedAt: null,
    sealedAt: nowMs
  };
  return {
    ...state,
    sealEvents: [event, ...events].slice(0, 100)
  };
}

export function claimSealedMonsterRewards(state, nowMs = Date.now()) {
  const dayKey = getLocalDayKey(nowMs);
  const events = [...(state.sealEvents || [])];
  const earnedToday = events
    .filter((e) => e.dayKey === dayKey && e.claimedAt)
    .reduce((sum, e) => sum + (Number(e.awardedPoints) || 0), 0);
  let remainingCap = Math.max(0, MONSTER_SEAL_DAILY_CAP - earnedToday);
  let totalGranted = 0;

  for (let i = 0; i < events.length; i++) {
    if (events[i].claimedAt) continue;
    const grant = Math.min(events[i].points, remainingCap);
    events[i] = { ...events[i], claimedAt: nowMs, awardedPoints: grant };
    remainingCap -= grant;
    totalGranted += grant;
  }

  return {
    granted: totalGranted,
    state: {
      ...state,
      points: (Number(state.points) || 0) + totalGranted,
      totalMonstersSealed: (Number(state.totalMonstersSealed) || 0) +
        events.filter((e) => e.claimedAt === nowMs).length,
      sealEvents: events,
      pointLog: totalGranted > 0
        ? [{ id: `pt_${nowMs}`, rule: 'monster-seal', amount: totalGranted, detail: dayKey, at: nowMs }, ...(state.pointLog || []).slice(0, 49)]
        : state.pointLog
    }
  };
}

export function reconcileUnearnedSpending(state) {
  let balance = Number(state.points) || 0;
  if (balance >= 0) return { ...state, points: balance };

  // User shortened time after spending unearned points -> revert newest paid unlocks until balance >= 0
  const purchaseHistory = [...(state.purchaseHistory || [])];
  let ownedGear = [...(state.ownedGear || [])];
  let ownedCompanions = [...(state.ownedCompanions || [])];
  let ownedRooms = [...(state.ownedRooms || [])];
  let equipped = { ...(state.equipped || {}) };
  let activeCompanion = state.activeCompanion || 'twigfox';
  let activeRoom = state.activeRoom || 'mint';

  while (balance < 0 && purchaseHistory.length > 0) {
    const latest = purchaseHistory.pop();
    balance += Number(latest.cost) || 0;
    if (latest.kind === 'gear') {
      ownedGear = ownedGear.filter((id) => id !== latest.itemId);
      const item = EQUIPMENT_CATALOG.find((g) => g.id === latest.itemId);
      if (item && equipped[item.slot] === item.key) {
        equipped[item.slot] = item.slot === 'head' ? 'bandana'
          : item.slot === 'body' ? 'cloth'
            : item.slot === 'weapon' ? 'pencil' : 'none';
      }
    } else if (latest.kind === 'companion') {
      ownedCompanions = ownedCompanions.filter((id) => id !== latest.itemId);
      if (activeCompanion === latest.itemId) activeCompanion = 'twigfox';
    } else if (latest.kind === 'room') {
      ownedRooms = ownedRooms.filter((id) => id !== latest.itemId);
      if (activeRoom === latest.itemId) activeRoom = 'mint';
    }
  }

  return {
    ...state,
    points: Math.max(0, balance),
    purchaseHistory,
    ownedGear,
    ownedCompanions,
    ownedRooms,
    equipped,
    activeCompanion,
    activeRoom
  };
}

/**
 * Honest Time Correction:
 * - Shortening recalculates EXP, Companion Bond, Expedition Chest clawback, and Break Gem downgrade/clawback.
 * - Lengthening records honest EXP & session time, WITHOUT granting bonus Expedition / Gem exploits.
 */
export function correctSessionDuration(state, sessionId, newSecondsRaw, nowMs = Date.now()) {
  const newSeconds = Math.max(60, Math.round(Number(newSecondsRaw) || 60));
  const sessions = [...(state.sessions || [])];
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return { changed: false, state };

  const target = sessions[idx];
  const oldSeconds = Math.max(0, Math.floor(Number(target.seconds) || 0));
  if (newSeconds === oldSeconds) return { changed: false, state };

  const shortened = newSeconds < oldSeconds;
  const nextSession = {
    ...target,
    seconds: newSeconds,
    // Anti-cheat: expeditionEligibleSeconds can never grow via manual lengthening
    expeditionEligibleSeconds: Math.min(
      Number(target.expeditionEligibleSeconds ?? oldSeconds),
      newSeconds
    ),
    correctedAt: nowMs,
    originalSeconds: target.originalSeconds ?? oldSeconds
  };
  sessions[idx] = nextSession;

  let next = { ...state, sessions };

  // 1. Companion Bond reconciliation (only subtract if shortened)
  if (shortened && target.companionId) {
    const delta = oldSeconds - newSeconds;
    const prevBond = Math.max(0, Number(next.companionBonds?.[target.companionId]) || 0);
    next.companionBonds = {
      ...(next.companionBonds || {}),
      [target.companionId]: Math.max(0, prevBond - delta)
    };
  }

  // 2. Break Gem reconciliation (only downgrade/clawback if shortened)
  if (shortened) {
    const gems = [...(next.pendingGems || [])];
    const gIdx = gems.findIndex((g) => g.sessionId === sessionId);
    if (gIdx !== -1) {
      const gemRow = gems[gIdx];
      const revisedGem = gemForStudySeconds(newSeconds);
      if (!revisedGem) {
        // Below 5m -> expire & clawback awarded points
        const clawback = Number(gemRow.awardedPoints) || 0;
        next.points = (Number(next.points) || 0) - clawback;
        gems[gIdx] = { ...gemRow, studySeconds: newSeconds, points: 0, awardedPoints: 0, expiresAt: 0 };
      } else if (revisedGem.points < gemRow.points) {
        const prevAwarded = Number(gemRow.awardedPoints) || 0;
        const newAwarded = gemRow.claimedAt ? Math.min(prevAwarded, revisedGem.points) : 0;
        const clawback = Math.max(0, prevAwarded - newAwarded);
        next.points = (Number(next.points) || 0) - clawback;
        gems[gIdx] = {
          ...gemRow,
          gemId: revisedGem.id,
          color: revisedGem.color,
          points: revisedGem.points,
          studySeconds: newSeconds,
          awardedPoints: newAwarded
        };
      }
      next.pendingGems = gems;
    }
  }

  // 3. Weekly Expedition clawback if shortened
  if (shortened && target.weekKey) {
    const claimed = Number(next.expeditionClaims?.[target.weekKey]) || 0;
    if (claimed > 0) {
      const earlyCompleted = (next.pools || []).some((p) => p.weekKey === target.weekKey && p.earlyCompleted);
      const after = evaluateWeeklyExpedition({
        weekKey: target.weekKey,
        sessions: next.sessions,
        earlyCompleted,
        claimedPoints: claimed
      });
      if (after.eligiblePoints < claimed) {
        const clawback = claimed - after.eligiblePoints;
        next.points = (Number(next.points) || 0) - clawback;
        next.expeditionClaims = {
          ...(next.expeditionClaims || {}),
          [target.weekKey]: after.eligiblePoints
        };
      }
    }
  }

  next = reconcileUnearnedSpending(next);
  next = reconcileCompanionRecruits(next).state;
  return { changed: true, shortened, oldSeconds, newSeconds, state: next };
}

export function purchaseItem(state, kind, itemId, nowMs = Date.now()) {
  let catalogItem = null;
  let ownedKey = 'ownedGear';
  if (kind === 'gear') {
    catalogItem = EQUIPMENT_CATALOG.find((x) => x.id === itemId);
    ownedKey = 'ownedGear';
  } else if (kind === 'companion') {
    catalogItem = COMPANIONS.find((x) => x.id === itemId);
    ownedKey = 'ownedCompanions';
  } else if (kind === 'room') {
    catalogItem = ROOMS.find((x) => x.id === itemId);
    ownedKey = 'ownedRooms';
  }
  if (!catalogItem) return { ok: false, reason: 'not_found', state };

  const owned = state[ownedKey] || [];
  if (owned.includes(itemId)) return { ok: true, alreadyOwned: true, state };
  const balance = Number(state.points) || 0;
  if (balance < catalogItem.cost) return { ok: false, reason: 'insufficient_points', state };

  return {
    ok: true,
    state: {
      ...state,
      points: balance - catalogItem.cost,
      [ownedKey]: [...owned, itemId],
      purchaseHistory: [
        ...(state.purchaseHistory || []),
        { kind, itemId, cost: catalogItem.cost, at: nowMs }
      ]
    }
  };
}
