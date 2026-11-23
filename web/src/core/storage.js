// Local-First State Persistence + Starter Hydration + Full JSON Export/Import

import { detectLocale } from './i18n.js';
import { STARTER_PACKS } from './catalog.js';
import { createPoolTask, getWeekStartKey } from './weekly-pool.js';
import { FSRSCard } from './fsrs.js';

export const STORAGE_KEY = 'craft-glass-state-v1';

function generateDeviceId() {
  if (globalThis.crypto?.randomUUID) return `cg_${globalThis.crypto.randomUUID()}`;
  return `cg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createInitialState({ locale = detectLocale(), nowMs = Date.now() } = {}) {
  return {
    version: 1,
    deviceId: generateDeviceId(),
    onboarded: false,
    settings: {
      locale,
      weekStart: 'mon',
      soundEnabled: true,
      reducedMotion: false,
      cameraBlur: 'soft', // 'off' | 'soft' | 'heavy'
      ambientSound: 'off',
      proofTheme: 'emerald'
    },
    entitlement: {
      isPro: false,
      activeSku: null,
      verifiedAt: null,
      rewardPasses: 0
    },
    profile: {
      displayName: locale === 'ja' ? 'クラフト冒険者' : 'Craft Explorer',
      heroBase: 'boy-b'
    },
    points: 0,
    ownedGear: ['head-bandana', 'body-cloth', 'weapon-pencil', 'shield-none'],
    ownedCompanions: ['twigfox', 'acornling'],
    ownedRooms: ['mint', 'forest'],
    purchaseHistory: [],
    equipped: {
      head: 'bandana',
      body: 'cloth',
      weapon: 'pencil',
      shield: 'none'
    },
    activeCompanion: 'twigfox',
    activeRoom: 'mint',
    companionBonds: {},
    pools: [],
    milestones: [],
    sessions: [],
    cards: [],
    pendingGems: [],
    gemCollection: {},
    expeditionClaims: {},
    sealEvents: [],
    totalMonstersSealed: 0,
    proofLedger: [],
    issuedProofHashes: [],
    redeemedBlessingIds: [],
    blessings: [],
    pointLog: [],
    createdAt: nowMs
  };
}

export function applyStarterPack(state, packKey, nowMs = Date.now()) {
  const pack = STARTER_PACKS[packKey];
  if (!pack) return { ...state, onboarded: true };
  const locale = state.settings?.locale || 'en';
  const weekKey = getWeekStartKey(nowMs, state.settings?.weekStart || 'mon');
  const poolSpecs = pack.pools[locale] || pack.pools.en;
  const cardSpecs = pack.cards[locale] || pack.cards.en;

  const pools = poolSpecs.map((spec, idx) => createPoolTask({
    ...spec,
    id: `pool_${nowMs}_${idx}`,
    weekKey,
    nowMs
  }));
  const cards = cardSpecs.map((spec, idx) => new FSRSCard({
    id: `card_${nowMs}_${idx}`,
    deck: spec.deck,
    front: spec.front,
    back: spec.back,
    lastReviewed: new Date(nowMs).toISOString(),
    due: new Date(nowMs).toISOString()
  }).toJSON());

  return {
    ...state,
    onboarded: true,
    pools: [...(state.pools || []), ...pools],
    cards: [...(state.cards || []), ...cards]
  };
}

export function loadState() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return createInitialState();
    }
    const base = createInitialState({ locale: parsed.settings?.locale });
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      profile: { ...base.profile, ...(parsed.profile || {}) },
      equipped: { ...base.equipped, ...(parsed.equipped || {}) },
      entitlement: {
        ...base.entitlement,
        ...(parsed.entitlement || {}),
        rewardPasses: Math.max(0, Math.floor(Number(parsed.entitlement?.rewardPasses || 0)))
      }
    };
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportStateBackupJson(state) {
  return JSON.stringify({
    app: 'craft-glass',
    exportedAt: new Date().toISOString(),
    data: state
  }, null, 2);
}

export function parseStateBackupJson(jsonText) {
  const parsed = JSON.parse(String(jsonText || ''));
  const candidate = parsed?.app === 'craft-glass' && parsed?.data ? parsed.data : parsed;
  if (!candidate || candidate.version !== 1 || !Array.isArray(candidate.sessions) || !Array.isArray(candidate.pools)) {
    throw new Error('Invalid Craft Glass backup JSON');
  }
  const base = createInitialState({ locale: candidate.settings?.locale });
  return {
    ...base,
    ...candidate,
    settings: { ...base.settings, ...(candidate.settings || {}) },
    profile: { ...base.profile, ...(candidate.profile || {}) },
    equipped: { ...base.equipped, ...(candidate.equipped || {}) },
    entitlement: {
      ...base.entitlement,
      ...(candidate.entitlement || {}),
      rewardPasses: Math.max(0, Math.floor(Number(candidate.entitlement?.rewardPasses || 0)))
    }
  };
}
