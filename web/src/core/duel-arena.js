// PvP & Rival Auto-Battler ("Guild Duel Arena")
// Combat stats are derived 100% from real effort: focus minutes (level), earned equipment,
// companion bond, FSRS monsters sealed, and active human blessing aura — zero Pay-to-Win.

import { calcTotalFocusSeconds, calcGuildLevel, companionBondInfo } from './rpg-engine.js';
import { getActiveBlessing } from './proof-ledger.js';
import { EQUIPMENT_CATALOG } from './catalog.js';

const DUEL_PREFIX = 'CGD1:';
const DUEL_SALT = 'craft-glass-duel-v1';

const GEAR_POWER = Object.fromEntries(
  EQUIPMENT_CATALOG.map((item) => [item.id, Math.max(0, Math.round((item.cost || 0) * 0.45))])
);

function fnv1aHex(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0').slice(0, 4);
}

function toBase64Url(jsonStr) {
  const bytes = new TextEncoder().encode(jsonStr);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64u) {
  const b64 = String(b64u).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function computeFighterStats({
  level = 1,
  equipped = {},
  bondTier = 1,
  seals = 0,
  hasBlessing = false
} = {}) {
  const lvl = Math.max(1, Math.min(99, Math.floor(Number(level) || 1)));
  const bTier = Math.max(1, Math.min(5, Math.floor(Number(bondTier) || 1)));
  const sealCnt = Math.max(0, Math.min(500, Math.floor(Number(seals) || 0)));

  const headBonus = GEAR_POWER[`head-${equipped.head}`] || 0;
  const bodyBonus = GEAR_POWER[`body-${equipped.body}`] || 0;
  const weaponBonus = GEAR_POWER[`weapon-${equipped.weapon}`] || 0;
  const shieldBonus = GEAR_POWER[`shield-${equipped.shield}`] || 0;

  const maxHp = 120 + lvl * 14 + shieldBonus * 4 + bodyBonus * 3 + bTier * 16;
  const atk = 18 + lvl * 3 + weaponBonus * 2 + headBonus + Math.min(30, sealCnt * 2);
  const spd = 10 + Math.floor(lvl * 0.6) + bodyBonus + bTier * 3;
  const critPct = Math.min(60, 8 + bTier * 3 + (hasBlessing ? 12 : 0) + Math.floor(headBonus * 0.3));

  return { maxHp, atk, spd, critPct };
}

export function buildHeroFighter(state) {
  const totalSec = calcTotalFocusSeconds(state?.sessions || []);
  const rank = calcGuildLevel(totalSec, 'en');
  const compId = state?.activeCompanion || 'twigfox';
  const bondSec = state?.companionBonds?.[compId] || 0;
  const bond = companionBondInfo(bondSec, 'en');
  const blessing = getActiveBlessing(state, 'en');
  const equipped = {
    head: state?.equipped?.head || 'bandana',
    body: state?.equipped?.body || 'cloth',
    weapon: state?.equipped?.weapon || 'pencil',
    shield: state?.equipped?.shield || 'none'
  };

  const stats = computeFighterStats({
    level: rank.level,
    equipped,
    bondTier: bond.level,
    seals: state?.totalMonstersSealed || 0,
    hasBlessing: Boolean(blessing)
  });

  return {
    name: String(state?.profile?.displayName || 'Craft Explorer').slice(0, 20),
    heroBase: state?.profile?.heroBase || 'boy-b',
    companionId: compId,
    blessingTheme: blessing?.theme || null,
    equipped,
    level: rank.level,
    bondTier: bond.level,
    seals: Math.max(0, Math.min(500, Number(state?.totalMonstersSealed || 0))),
    ...stats
  };
}

export function createDuelCode(state) {
  const f = buildHeroFighter(state);
  const payload = {
    v: 1,
    n: f.name,
    hb: f.heroBase,
    c: f.companionId,
    bt: f.blessingTheme || '',
    eq: [f.equipped.head, f.equipped.body, f.equipped.weapon, f.equipped.shield],
    lv: f.level,
    bd: f.bondTier,
    sl: f.seals
  };
  const body = toBase64Url(JSON.stringify(payload));
  const mac = fnv1aHex(`${DUEL_SALT}|${body}`);
  return `${DUEL_PREFIX}${body}.${mac}`;
}

export function parseDuelCode(rawCode) {
  const trimmed = String(rawCode || '').trim();
  if (!trimmed.startsWith(DUEL_PREFIX)) {
    return { valid: false, error: 'prefix' };
  }
  const rest = trimmed.slice(DUEL_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot <= 0) return { valid: false, error: 'format' };
  const body = rest.slice(0, dot);
  const mac = rest.slice(dot + 1);
  if (fnv1aHex(`${DUEL_SALT}|${body}`) !== mac) {
    return { valid: false, error: 'tampered' };
  }
  try {
    const p = JSON.parse(fromBase64Url(body));
    if (!p || p.v !== 1) return { valid: false, error: 'version' };
    const equipped = {
      head: String(p.eq?.[0] || 'bandana'),
      body: String(p.eq?.[1] || 'cloth'),
      weapon: String(p.eq?.[2] || 'pencil'),
      shield: String(p.eq?.[3] || 'none')
    };
    const level = Math.max(1, Math.min(99, Math.floor(Number(p.lv) || 1)));
    const bondTier = Math.max(1, Math.min(5, Math.floor(Number(p.bd) || 1)));
    const seals = Math.max(0, Math.min(500, Math.floor(Number(p.sl) || 0)));
    const blessingTheme = ['gold', 'emerald', 'sky', 'violet'].includes(p.bt) ? p.bt : null;

    const stats = computeFighterStats({
      level,
      equipped,
      bondTier,
      seals,
      hasBlessing: Boolean(blessingTheme)
    });

    return {
      valid: true,
      fighter: {
        name: String(p.n || 'Rival').slice(0, 20),
        heroBase: ['boy', 'girl', 'boy-b', 'girl-b'].includes(p.hb) ? p.hb : 'girl-b',
        companionId: String(p.c || 'twigfox'),
        blessingTheme,
        equipped,
        level,
        bondTier,
        seals,
        ...stats
      }
    };
  } catch {
    return { valid: false, error: 'decode' };
  }
}

export const GUILD_RIVALS = Object.freeze([
  {
    id: 'mira',
    name: 'Mira',
    heroBase: 'girl-b',
    companionId: 'twigfox',
    blessingTheme: null,
    equipped: { head: 'bandana', body: 'cloth', weapon: 'pencil', shield: 'none' },
    level: 2,
    bondTier: 1,
    seals: 1
  },
  {
    id: 'kai',
    name: 'Kai',
    heroBase: 'boy',
    companionId: 'candleknight',
    blessingTheme: 'emerald',
    equipped: { head: 'hood', body: 'tunic', weapon: 'quill', shield: 'buckler' },
    level: 10,
    bondTier: 2,
    seals: 6
  },
  {
    id: 'aria',
    name: 'Aria',
    heroBase: 'girl',
    companionId: 'nestowl',
    blessingTheme: 'sky',
    equipped: { head: 'circlet', body: 'cloak', weapon: 'staff', shield: 'crest' },
    level: 25,
    bondTier: 4,
    seals: 14
  },
  {
    id: 'ren',
    name: 'Ren',
    heroBase: 'boy-b',
    companionId: 'astraldragon',
    blessingTheme: 'gold',
    equipped: { head: 'crown', body: 'armor', weapon: 'relic', shield: 'aegis' },
    level: 50,
    bondTier: 5,
    seals: 30
  }
].map((r) => Object.freeze({
  ...r,
  ...computeFighterStats({
    level: r.level,
    equipped: r.equipped,
    bondTier: r.bondTier,
    seals: r.seals,
    hasBlessing: Boolean(r.blessingTheme)
  })
})));

export function simulateAutoDuel(leftFighter, rightFighter, seed = Date.now()) {
  let rng = (Number(seed) >>> 0) || 123456789;
  const nextRand = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return ((rng >>> 0) % 1000) / 1000;
  };

  let leftHp = leftFighter.maxHp;
  let rightHp = rightFighter.maxHp;
  const turns = [];

  const leftFirst = leftFighter.spd >= rightFighter.spd;
  const order = leftFirst ? ['left', 'right'] : ['right', 'left'];

  for (let round = 1; round <= 12 && leftHp > 0 && rightHp > 0; round++) {
    for (const side of order) {
      if (leftHp <= 0 || rightHp <= 0) break;
      const atkF = side === 'left' ? leftFighter : rightFighter;
      const isCrit = nextRand() * 100 < atkF.critPct;
      const isComp = !isCrit && round % 2 === 0;
      const variance = 0.9 + nextRand() * 0.22;
      const mult = isCrit ? 1.55 : isComp ? 1.25 : 1.0;
      const dmg = Math.max(6, Math.round(atkF.atk * variance * mult));

      if (side === 'left') {
        rightHp = Math.max(0, rightHp - dmg);
      } else {
        leftHp = Math.max(0, leftHp - dmg);
      }

      turns.push({
        round,
        actor: side,
        kind: isCrit ? 'crit' : isComp ? 'companion' : 'strike',
        dmg,
        leftHp,
        rightHp
      });
    }
  }

  const winner = leftHp === rightHp
    ? (leftFighter.spd >= rightFighter.spd ? 'left' : 'right')
    : (leftHp > rightHp ? 'left' : 'right');

  return {
    winner,
    turns,
    left: leftFighter,
    right: rightFighter
  };
}
