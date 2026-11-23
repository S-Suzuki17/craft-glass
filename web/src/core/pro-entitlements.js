// Craft Pro Entitlements & Anti-Pay-to-Win Guardrails
// Craft Pro expands archive capacity, HD/Vlog export, Proof Card themes, FSRS card limits,
// and study room backdrops — it NEVER sells EXP, Craft Points, Guild Ranks, or Human Blessings.

export const PRO_SKUS = Object.freeze([
  { id: 'craft_pro_yearly', type: 'subs', fallbackEn: '$19.99 / year', fallbackJa: '¥2,900 / 年', bestValue: true },
  { id: 'craft_pro_monthly', type: 'subs', fallbackEn: '$2.99 / month', fallbackJa: '¥480 / 月', bestValue: false },
  { id: 'craft_pro_lifetime', type: 'inapp', fallbackEn: '$39.99 once', fallbackJa: '¥5,800 買い切り', bestValue: false }
]);

export const PROOF_CARD_THEMES = Object.freeze([
  {
    id: 'emerald',
    proOnly: false,
    headerBg: '#065f46',
    accent: '#0f766e',
    cardBg: '#ffffff',
    bannerBg: '#f0fdf4',
    bannerBorder: '#bbf7d0',
    subtext: '#a7f3d0',
    hashColor: '#fde68a'
  },
  {
    id: 'midnight',
    proOnly: true,
    headerBg: '#0f172a',
    accent: '#334155',
    cardBg: '#f8fafc',
    bannerBg: '#e2e8f0',
    bannerBorder: '#94a3b8',
    subtext: '#94a3b8',
    hashColor: '#7dd3fc'
  },
  {
    id: 'gilded',
    proOnly: true,
    headerBg: '#78350f',
    accent: '#b45309',
    cardBg: '#fffbeb',
    bannerBg: '#fef3c7',
    bannerBorder: '#fcd34d',
    subtext: '#fde68a',
    hashColor: '#ffffff'
  },
  {
    id: 'sakura',
    proOnly: true,
    headerBg: '#831843',
    accent: '#be185d',
    cardBg: '#fff1f2',
    bannerBg: '#ffe4e6',
    bannerBorder: '#fda4af',
    subtext: '#fbcfe8',
    hashColor: '#fde68a'
  }
]);

export const FREE_LIMITS = Object.freeze({
  maxTimelapses: 3,
  maxFsrsCards: 25,
  proofThemes: Object.freeze(['emerald']),
  hdExport: false,
  weeklyVlog: false,
  allRoomsUnlocked: false
});

export const PRO_LIMITS = Object.freeze({
  maxTimelapses: 60,
  maxFsrsCards: Infinity,
  proofThemes: Object.freeze(['emerald', 'midnight', 'gilded', 'sakura']),
  hdExport: true,
  weeklyVlog: true,
  allRoomsUnlocked: true
});

export function isProActive(state) {
  return Boolean(state?.entitlement?.isPro);
}

export function getPlanLimits(state) {
  return isProActive(state) ? PRO_LIMITS : FREE_LIMITS;
}

export function canAddFsrsCard(state) {
  const limits = getPlanLimits(state);
  const count = Array.isArray(state?.cards) ? state.cards.length : 0;
  return count < limits.maxFsrsCards;
}

export function canUseProofTheme(state, themeId) {
  const theme = PROOF_CARD_THEMES.find((t) => t.id === themeId);
  if (!theme) return false;
  if (!theme.proOnly) return true;
  return isProActive(state);
}

export function getAvailableRoomIds(state, allRooms = []) {
  if (isProActive(state)) {
    return allRooms.map((r) => r.id);
  }
  return state?.ownedRooms || ['mint', 'forest'];
}

/**
 * Purely updates subscription/one-time purchase entitlement without EVER modifying
 * earned effort points, focus sessions, guild EXP, or human blessings.
 */
export function applyBillingEntitlement(state, billingPayload = {}, nowMs = Date.now()) {
  const isPro = Boolean(billingPayload.isPro);
  const activeSku = isPro ? String(billingPayload.activeSku || state?.entitlement?.activeSku || 'craft_pro') : null;
  return {
    ...state,
    entitlement: {
      isPro,
      activeSku,
      verifiedAt: nowMs
    }
  };
}
