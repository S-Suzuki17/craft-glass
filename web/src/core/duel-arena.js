// PvP & Rival Auto-Battler ("Guild Duel Arena")
// Combat stats & Companion Battle Skills are derived 100% from real effort:
// focus minutes (hero level), companion focus minutes (companion Lv.1-50 & unique skill),
// earned equipment, FSRS monsters sealed, and active human blessing aura — zero Pay-to-Win.

import { calcTotalFocusSeconds, calcGuildLevel, companionBondInfo } from './rpg-engine.js';
import { getActiveBlessing } from './proof-ledger.js';
import { EQUIPMENT_CATALOG, COMPANIONS, WILD_MONSTERS, WORLDS } from './catalog.js';

const DUEL_PREFIX = 'CGD1:';
const DUEL_SALT = 'craft-glass-duel-v1';

const GEAR_POWER = Object.fromEntries(
  EQUIPMENT_CATALOG.map((item) => [item.id, Math.max(0, Math.round((item.cost || 0) * 0.45))])
);

const COMPANION_MAP = Object.fromEntries(
  COMPANIONS.map((c) => [c.id, c])
);

export function getCompanionSkill(companionId) {
  return COMPANION_MAP[companionId]?.skill || COMPANIONS[0].skill;
}

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
  compLevel = null,
  seals = 0,
  hasBlessing = false
} = {}) {
  const lvl = Math.max(1, Math.min(99, Math.floor(Number(level) || 1)));
  const bTier = Math.max(1, Math.min(5, Math.floor(Number(bondTier) || 1)));
  const cLvl = Math.max(1, Math.min(50, Math.floor(Number(compLevel) || (bTier - 1) * 6 + 1)));
  const sealCnt = Math.max(0, Math.min(500, Math.floor(Number(seals) || 0)));

  const headBonus = GEAR_POWER[`head-${equipped.head}`] || 0;
  const bodyBonus = GEAR_POWER[`body-${equipped.body}`] || 0;
  const weaponBonus = GEAR_POWER[`weapon-${equipped.weapon}`] || 0;
  const shieldBonus = GEAR_POWER[`shield-${equipped.shield}`] || 0;

  const maxHp = 120 + lvl * 14 + shieldBonus * 4 + bodyBonus * 3 + bTier * 14 + cLvl * 6;
  const atk = 18 + lvl * 3 + weaponBonus * 2 + headBonus + Math.min(30, sealCnt * 2) + cLvl * 2;
  const spd = 10 + Math.floor(lvl * 0.6) + bodyBonus + bTier * 2 + Math.floor(cLvl * 0.5);
  const critPct = Math.min(65, 8 + bTier * 2 + Math.floor(cLvl * 0.35) + (hasBlessing ? 12 : 0) + Math.floor(headBonus * 0.3));

  return { maxHp, atk, spd, critPct, compLevel: cLvl };
}

export function buildHeroFighter(state) {
  const totalSec = calcTotalFocusSeconds(state?.sessions || []);
  const rank = calcGuildLevel(totalSec, 'en');
  const compId = state?.activeCompanion || 'twigfox';
  const bondSec = state?.companionBonds?.[compId] ?? totalSec;
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
    compLevel: bond.compLevel,
    seals: state?.totalMonstersSealed || 0,
    hasBlessing: Boolean(blessing)
  });

  const skill = getCompanionSkill(compId);

  return {
    name: String(state?.profile?.displayName || 'Craft Explorer').slice(0, 20),
    heroBase: state?.profile?.heroBase || 'boy-b',
    companionId: compId,
    skill,
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
    cl: f.compLevel,
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
    const compLevel = p.cl != null ? Math.max(1, Math.min(50, Math.floor(Number(p.cl) || 1))) : null;
    const seals = Math.max(0, Math.min(500, Math.floor(Number(p.sl) || 0)));
    const blessingTheme = ['gold', 'emerald', 'sky', 'violet'].includes(p.bt) ? p.bt : null;
    const companionId = COMPANION_MAP[p.c] ? String(p.c) : 'twigfox';

    const stats = computeFighterStats({
      level,
      equipped,
      bondTier,
      compLevel,
      seals,
      hasBlessing: Boolean(blessingTheme)
    });

    return {
      valid: true,
      fighter: {
        name: String(p.n || 'Rival').slice(0, 20),
        heroBase: ['boy', 'girl', 'boy-b', 'girl-b'].includes(p.hb) ? p.hb : 'girl-b',
        companionId,
        skill: getCompanionSkill(companionId),
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
    companionId: 'acornling',
    blessingTheme: null,
    equipped: { head: 'bandana', body: 'cloth', weapon: 'pencil', shield: 'none' },
    level: 2,
    bondTier: 1,
    compLevel: 2,
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
    compLevel: 8,
    seals: 6
  },
  {
    id: 'aria',
    name: 'Aria',
    heroBase: 'girl',
    companionId: 'ribbonphoenix',
    blessingTheme: 'sky',
    equipped: { head: 'circlet', body: 'cloak', weapon: 'staff', shield: 'crest' },
    level: 25,
    bondTier: 4,
    compLevel: 20,
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
    compLevel: 40,
    seals: 30
  }
].map((r) => Object.freeze({
  ...r,
  skill: getCompanionSkill(r.companionId),
  ...computeFighterStats({
    level: r.level,
    equipped: r.equipped,
    bondTier: r.bondTier,
    compLevel: r.compLevel,
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
      const skill = atkF.skill || getCompanionSkill(atkF.companionId);
      const cLvl = Math.max(1, Number(atkF.compLevel) || 1);

      const isComp = round === 1 || round % 2 === 0;
      const isCrit = !isComp && nextRand() * 100 < atkF.critPct;
      const variance = 0.92 + nextRand() * 0.18;

      const compScale = 1 + cLvl * 0.015;
      const mult = isComp ? (skill.mult || 1.3) * compScale : isCrit ? 1.55 : 1.0;
      const dmg = Math.max(6, Math.round(atkF.atk * variance * mult));

      let heal = 0;
      if (isComp && skill.healPct > 0) {
        heal = Math.max(8, Math.round(atkF.maxHp * skill.healPct * (1 + cLvl * 0.01)));
      }

      if (side === 'left') {
        rightHp = Math.max(0, rightHp - dmg);
        if (heal > 0) leftHp = Math.min(leftFighter.maxHp, leftHp + heal);
      } else {
        leftHp = Math.max(0, leftHp - dmg);
        if (heal > 0) rightHp = Math.min(rightFighter.maxHp, rightHp + heal);
      }

      turns.push({
        round,
        actor: side,
        kind: isComp ? 'companion' : isCrit ? 'crit' : 'strike',
        skillName: isComp ? skill.en : '',
        skillNameJa: isComp ? skill.ja : '',
        dmg,
        heal,
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

const ELEMENT_SKILLS = Object.freeze({
  verdant: { kind: 'strike', mult: 1.35, healPct: 0.08, en: 'Bramble Lash', ja: '荊棘の蔦撃' },
  ember: { kind: 'crit', mult: 1.50, healPct: 0, en: 'Cinder Nova', ja: '紅蓮の焔波' },
  tide: { kind: 'heal', mult: 1.28, healPct: 0.12, en: 'Abyssal Surge', ja: '深海の奔流' },
  gale: { kind: 'double', mult: 1.44, healPct: 0, en: 'Tempest Gust', ja: '烈風の刃' },
  astral: { kind: 'dragon', mult: 1.62, healPct: 0.10, en: 'Starlight Ray', ja: '星辰の閃光' }
});

export function buildStageBossFighter(worldId = 1, locale = 'en') {
  const wid = Math.max(1, Math.min(20, Math.floor(Number(worldId) || 1)));
  const worldMonsters = WILD_MONSTERS.filter((m) => m.worldId === wid);
  const picked = worldMonsters.find((m) => m.isBoss)
    || worldMonsters[worldMonsters.length - 1]
    || WILD_MONSTERS[0];
  const world = WORLDS.find((w) => w.id === wid) || WORLDS[0];

  const level = picked.baseLv || world.minLevel || 1;
  const isBoss = Boolean(picked.isBoss);
  const compLevel = Math.max(1, Math.min(50, Math.round(level * 0.5)));
  const bondTier = Math.max(1, Math.min(5, Math.ceil(level / 20)));

  const baseStats = computeFighterStats({
    level,
    equipped: { head: 'bandana', body: 'cloth', weapon: 'pencil', shield: 'none' },
    bondTier,
    compLevel,
    seals: Math.round(level * 0.6),
    hasBlessing: isBoss
  });

  const maxHp = Math.round(baseStats.maxHp * (isBoss ? 1.25 : 1.0));
  const atk = Math.round(baseStats.atk * (isBoss ? 1.15 : 0.95));
  const skill = ELEMENT_SKILLS[picked.element] || ELEMENT_SKILLS.verdant;

  return {
    id: `stage_${wid}_${picked.id}`,
    monsterId: picked.id,
    spriteId: picked.spriteId || picked.id,
    worldId: wid,
    worldSrc: world.src,
    isMonster: true,
    isBoss,
    element: picked.element,
    name: locale === 'ja' ? picked.ja : picked.en,
    nameEn: picked.en,
    nameJa: picked.ja,
    heroBase: 'girl-b',
    companionId: picked.spriteId || picked.id,
    idleSrc: picked.idleSrc,
    moveSrc: picked.moveSrc,
    skill,
    blessingTheme: isBoss ? 'violet' : null,
    equipped: { head: 'bandana', body: 'cloth', weapon: 'pencil', shield: 'none' },
    level,
    bondTier,
    compLevel,
    seals: Math.round(level * 0.6),
    maxHp,
    atk,
    spd: baseStats.spd,
    critPct: baseStats.critPct
  };
}
