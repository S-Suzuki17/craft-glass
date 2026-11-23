// Multi-SNS Share Hub, 9:16 Vertical Story Proof & Duel Card Generator, and Real-Time Co-Focus Campfire Beacon (CGF1)

import { COMPANIONS } from '../core/catalog.js';
import { ALLOWED_CATEGORIES, getWeekStartKey, summarizeWeekByUnit } from '../core/weekly-pool.js';
import { calcTotalFocusSeconds, calcGuildLevel, companionBondInfo } from '../core/rpg-engine.js';
import { buildHeroFighter, createDuelCode } from '../core/duel-arena.js';
import { formatMinutes, t } from '../core/i18n.js';
import { loadImage } from './pixel-renderer.js';

const BEACON_PREFIX = 'CGF1:';
const BEACON_SALT = 'craft-glass-cofocus-v1';

export const RANKING_CATEGORIES = Object.freeze([
  'all',
  'study',
  'coding',
  'language',
  'reading',
  'art',
  'music',
  'fitness',
  'other'
]);

const COMPANION_MAP = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));

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

export function buildSnsShareLinks({
  locale = 'en',
  summary = {},
  heroFighter = {},
  duelCode = '',
  pactCode = '',
  appUrl = ''
} = {}) {
  const totalSeconds = Math.max(0, Number(summary?.totalSeconds) || 0);
  const hours = (totalSeconds / 3600).toFixed(1);
  const minutes = Math.round(totalSeconds / 60);
  const activeDays = Math.max(0, Number(summary?.activeDays) || 0);
  const proofHash = String(summary?.proofHash || '00000000').toUpperCase();
  const hashPrefix = proofHash.slice(0, 8);

  const heroName = String(heroFighter?.name || (locale === 'ja' ? 'クラフト冒険者' : 'Craft Explorer')).slice(0, 20);
  const heroLv = Math.max(1, Number(heroFighter?.level) || 1);
  const compLv = Math.max(1, Number(heroFighter?.compLevel) || 1);
  const compId = COMPANION_MAP[heroFighter?.companionId] ? heroFighter.companionId : 'twigfox';
  const compMeta = COMPANION_MAP[compId] || COMPANIONS[0];
  const compName = locale === 'ja' ? (compMeta.ja || compMeta.en) : compMeta.en;

  const cleanDuel = String(duelCode || '').trim();
  const cleanPact = String(pactCode || '').trim();
  const resolvedUrl = String(
    appUrl ||
      (typeof globalThis.location !== 'undefined' && globalThis.location?.href
        ? globalThis.location.href
        : 'https://craftglass.app')
  ).trim();

  const xText = locale === 'ja'
    ? [
        `🛡️ Craft Glass 週間証明: ${hours}h (${minutes}m) 集中!`,
        `${heroName} Lv.${heroLv} & ${compName} ★Lv.${compLv} • #CG-${hashPrefix}`,
        cleanDuel ? `⚔️ 対戦コード: ${cleanDuel}` : '',
        '#CraftGlass #StudyWithMe'
      ].filter(Boolean).join('\n')
    : [
        `🛡️ Craft Glass Weekly Proof: ${hours}h (${minutes}m) focused!`,
        `${heroName} Lv.${heroLv} & ${compName} ★Lv.${compLv} • #CG-${hashPrefix}`,
        cleanDuel ? `⚔️ Duel Challenge: ${cleanDuel}` : '',
        '#CraftGlass #StudyWithMe'
      ].filter(Boolean).join('\n');

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(xText)}`;
  const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(resolvedUrl)}&text=${encodeURIComponent(xText)}`;

  const discordLines = locale === 'ja'
    ? [
        `🛡️ **Craft Glass — 週間集中証明 & ギルド挑戦状**`,
        `• **冒険者:** ${heroName} (\`Lv.${heroLv}\` • ${compName} \`★Lv.${compLv}\`)`,
        `• **週間集中:** \`${hours}h\` (\`${minutes}m\`) • **活動日数:** \`${activeDays}/7\``,
        `• **SHA-256 証明ハッシュ:** \`#CG-${proofHash}\``,
        cleanDuel ? `• **⚔️ 対戦コード (Duel):** \`${cleanDuel}\`` : '',
        cleanPact ? `• **🤝 証明パクト (Pact):** \`${cleanPact}\`` : ''
      ]
    : [
        `🛡️ **Craft Glass — Weekly Proof & Guild Challenge**`,
        `• **Explorer:** ${heroName} (\`Lv.${heroLv}\` • ${compName} \`★Lv.${compLv}\`)`,
        `• **Weekly Focus:** \`${hours}h\` (\`${minutes}m\`) • **Active Days:** \`${activeDays}/7\``,
        `• **SHA-256 Proof Seal:** \`#CG-${proofHash}\``,
        cleanDuel ? `• **⚔️ Duel Challenge:** \`${cleanDuel}\`` : '',
        cleanPact ? `• **🤝 Proof Pact:** \`${cleanPact}\`` : ''
      ];

  const discordText = discordLines.filter(Boolean).join('\n');

  return {
    xUrl,
    lineUrl,
    discordText,
    xText
  };
}

export function createCoFocusBeacon(state = {}, overrides = {}) {
  const totalSec = calcTotalFocusSeconds(state?.sessions || []);
  const rank = calcGuildLevel(totalSec, 'en');
  const compId = COMPANION_MAP[overrides.companionId || state?.activeCompanion]
    ? (overrides.companionId || state?.activeCompanion)
    : 'twigfox';
  const bondSec = state?.companionBonds?.[compId] ?? totalSec;
  const bond = companionBondInfo(bondSec, 'en');

  const latestSession = (state?.sessions || [])[0] || null;
  const rawCat = overrides.category || latestSession?.category || 'study';
  const category = ALLOWED_CATEGORIES.includes(rawCat) ? rawCat : 'study';

  let recentMinutes = 0;
  if (overrides.recentMinutes != null) {
    recentMinutes = Math.max(0, Math.min(1440, Math.round(Number(overrides.recentMinutes) || 0)));
  } else if (latestSession) {
    const latestDay = latestSession.dayKey;
    const daySec = (state?.sessions || [])
      .filter((s) => s && s.dayKey === latestDay)
      .reduce((acc, s) => acc + Math.max(0, Number(s.seconds) || 0), 0);
    recentMinutes = Math.max(1, Math.min(1440, Math.round((daySec || latestSession.seconds || 0) / 60)));
  }

  const name = String(overrides.name || state?.profile?.displayName || 'Craft Explorer').trim().slice(0, 20) || 'Craft Explorer';
  const heroBase = ['boy', 'girl', 'boy-b', 'girl-b'].includes(overrides.heroBase || state?.profile?.heroBase)
    ? (overrides.heroBase || state.profile.heroBase)
    : 'boy-b';
  const compLevel = Math.max(1, Math.min(50, Math.floor(Number(overrides.compLevel || bond.compLevel) || 1)));
  const level = Math.max(1, Math.min(99, Math.floor(Number(overrides.level || rank.level) || 1)));
  const timestamp = Math.max(0, Math.floor(Number(overrides.timestamp) || Date.now()));

  const payload = {
    v: 1,
    n: name,
    hb: heroBase,
    c: compId,
    cl: compLevel,
    lv: level,
    cat: category,
    rm: recentMinutes,
    ts: timestamp
  };

  const body = toBase64Url(JSON.stringify(payload));
  const mac = fnv1aHex(`${BEACON_SALT}|${body}`);
  return `${BEACON_PREFIX}${body}.${mac}`;
}

export function parseCoFocusBeacon(rawCode) {
  const trimmed = String(rawCode || '').trim();
  if (!trimmed.startsWith(BEACON_PREFIX)) {
    return { valid: false, error: 'prefix' };
  }
  const rest = trimmed.slice(BEACON_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot <= 0) {
    return { valid: false, error: 'format' };
  }
  const body = rest.slice(0, dot);
  const mac = rest.slice(dot + 1);
  if (fnv1aHex(`${BEACON_SALT}|${body}`) !== mac) {
    return { valid: false, error: 'tampered' };
  }

  try {
    const p = JSON.parse(fromBase64Url(body));
    if (!p || p.v !== 1) {
      return { valid: false, error: 'version' };
    }
    const name = String(p.n || 'Craft Explorer').trim().slice(0, 20) || 'Craft Explorer';
    const heroBase = ['boy', 'girl', 'boy-b', 'girl-b'].includes(p.hb) ? p.hb : 'boy-b';
    const companionId = COMPANION_MAP[p.c] ? String(p.c) : 'twigfox';
    const compLevel = Math.max(1, Math.min(50, Math.floor(Number(p.cl) || 1)));
    const level = Math.max(1, Math.min(99, Math.floor(Number(p.lv) || 1)));
    const category = ALLOWED_CATEGORIES.includes(p.cat) ? p.cat : 'study';
    const recentMinutes = Math.max(0, Math.min(1440, Math.floor(Number(p.rm) || 0)));
    const timestamp = Math.max(0, Math.floor(Number(p.ts) || 0));

    const beacon = {
      name,
      heroBase,
      companionId,
      compLevel,
      level,
      category,
      recentMinutes,
      timestamp
    };

    return {
      valid: true,
      beacon,
      ...beacon
    };
  } catch {
    return { valid: false, error: 'decode' };
  }
}

const CATEGORY_RIVAL_ROSTERS = Object.freeze({
  all: ['Aoi', 'Liam', 'Sora', 'Elena', 'Haru', 'Noah', 'Yuna', 'Felix'],
  study: ['Minato', 'Clara', 'Renji', 'Sophie', 'Kaito', 'Hana', 'Lucas', 'Mei'],
  coding: ['Ada', 'Kenji', 'Linus', 'Mika', 'Taro', 'Chloe', 'Devon', 'Riku'],
  language: ['Emiko', 'Mateo', 'Celine', 'Yuto', 'Aria', 'Nadia', 'Leo', 'Saki'],
  reading: ['Shiori', 'Arthur', 'Fumiko', 'Oliver', 'Natsuki', 'Iris', 'Hugo', 'Kana'],
  art: ['Hokusai', 'Mio', 'Camille', 'Satsuki', 'Julian', 'Rin', 'Theo', 'Koharu'],
  music: ['Hibiki', 'Clara', 'Takumi', 'Lyra', 'Souma', 'Viola', 'Ezra', 'Kanon'],
  fitness: ['Daichi', 'Maya', 'Ryota', 'Zoe', 'Gaku', 'Nina', 'Leon', 'Asuka'],
  other: ['itsuki', 'Nora', 'Hayato', 'Eva', 'Shin', 'Mila', 'Kou', 'Sara']
});

const HERO_BASE_LIST = Object.freeze(['boy', 'girl', 'boy-b', 'girl-b']);
const BASE_LADDER_MINUTES = Object.freeze([20, 48, 85, 130, 185, 245, 325, 410]);

export function buildCategoryLeaderboard(
  state = {},
  category = 'all',
  friends = [],
  weekKey = null
) {
  const cat = RANKING_CATEGORIES.includes(category) ? category : 'all';

  let playerSec = 0;
  for (const s of state?.sessions || []) {
    if (!s) continue;
    if (weekKey && s.weekKey && s.weekKey !== weekKey) continue;
    const sCat = ALLOWED_CATEGORIES.includes(s.category) ? s.category : 'study';
    if (cat !== 'all' && sCat !== cat) continue;
    playerSec += Math.max(0, Number(s.seconds) || 0);
  }
  const playerMinutes = Math.round(playerSec / 60);

  const totalSec = calcTotalFocusSeconds(state?.sessions || []);
  const rankInfo = calcGuildLevel(totalSec, 'en');
  const compId = COMPANION_MAP[state?.activeCompanion] ? state.activeCompanion : 'twigfox';
  const bondSec = state?.companionBonds?.[compId] ?? totalSec;
  const bond = companionBondInfo(bondSec, 'en');
  const playerName = String(state?.profile?.displayName || 'Craft Explorer').trim().slice(0, 20) || 'Craft Explorer';
  const playerHeroBase = HERO_BASE_LIST.includes(state?.profile?.heroBase) ? state.profile.heroBase : 'boy-b';

  const entries = [
    {
      id: 'self',
      isSelf: true,
      isFriend: false,
      name: playerName,
      heroBase: playerHeroBase,
      companionId: compId,
      compLevel: bond.compLevel,
      level: rankInfo.level,
      category: cat,
      minutes: playerMinutes,
      badge: 'YOU'
    }
  ];

  // Merge imported friends (parsed objects or raw CGF1:... beacon strings)
  const friendList = Array.isArray(friends) ? friends : (friends ? [friends] : []);
  friendList.forEach((rawFriend, idx) => {
    let f = rawFriend;
    if (typeof rawFriend === 'string') {
      const parsed = parseCoFocusBeacon(rawFriend);
      if (!parsed.valid) return;
      f = parsed.beacon;
    }
    if (!f || typeof f !== 'object') return;
    const fCat = ALLOWED_CATEGORIES.includes(f.category) ? f.category : 'study';
    if (cat !== 'all' && f.category && fCat !== cat) return;
    const fComp = COMPANION_MAP[f.companionId] ? f.companionId : 'twigfox';
    const fMins = Math.max(0, Math.round(Number(f.minutes ?? f.recentMinutes ?? 0) || 0));
    entries.push({
      id: `friend_${idx}_${f.name || 'buddy'}`,
      isSelf: false,
      isFriend: true,
      name: String(f.name || 'Campfire Buddy').slice(0, 20),
      heroBase: HERO_BASE_LIST.includes(f.heroBase) ? f.heroBase : 'girl-b',
      companionId: fComp,
      compLevel: Math.max(1, Math.min(50, Math.floor(Number(f.compLevel) || 1))),
      level: Math.max(1, Math.min(99, Math.floor(Number(f.level) || Math.max(1, Math.floor(fMins / 30) + 1)))),
      category: fCat,
      minutes: fMins,
      badge: 'FRIEND'
    });
  });

  // 8 deterministic Guild Division Crafters for this category + weekKey
  const roster = CATEGORY_RIVAL_ROSTERS[cat] || CATEGORY_RIVAL_ROSTERS.all;
  const seedKey = `${cat}|${weekKey || 'eternal'}`;
  const seedHex = fnv1aHex(seedKey);
  const seedNum = parseInt(seedHex.slice(0, 8), 16) >>> 0;

  for (let i = 0; i < 8; i++) {
    const h = (seedNum + Math.imul(i + 1, 0x9e3779b9)) >>> 0;
    const baseMin = BASE_LADDER_MINUTES[i];
    const jitter = (h % 23) - 8; // -8..+14
    const minutes = Math.max(15, Math.min(420, baseMin + jitter));
    const heroBase = HERO_BASE_LIST[(h >>> 4) % HERO_BASE_LIST.length];
    const comp = COMPANIONS[(h >>> 7) % Math.min(COMPANIONS.length, 6 + i * 2)];
    const level = Math.max(1, Math.min(60, Math.round(minutes / 12) + (i + 1)));
    const compLevel = Math.max(1, Math.min(50, Math.round(minutes / 16) + 1));

    entries.push({
      id: `guild_${cat}_${i}`,
      isSelf: false,
      isFriend: false,
      name: roster[i],
      heroBase,
      companionId: comp.id,
      compLevel,
      level,
      category: cat === 'all' ? ALLOWED_CATEGORIES[i % ALLOWED_CATEGORIES.length] : cat,
      minutes,
      badge: 'GUILD'
    });
  }

  entries.sort((a, b) => {
    if (b.minutes !== a.minutes) return b.minutes - a.minutes;
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
    return (b.level || 1) - (a.level || 1);
  });

  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  const selfIdx = entries.findIndex((e) => e.isSelf);
  const playerRank = selfIdx >= 0 ? entries[selfIdx].rank : entries.length;
  const aboveEntry = selfIdx > 0 ? entries[selfIdx - 1] : null;
  const minsToNextRank = aboveEntry ? Math.max(1, aboveEntry.minutes - playerMinutes) : 0;

  const division =
    playerRank === 1 || playerMinutes >= 350
      ? 'Diamond'
      : playerRank <= 3 || playerMinutes >= 180
        ? 'Gold'
        : playerRank <= 6 || playerMinutes >= 60
          ? 'Silver'
          : 'Bronze';

  return {
    category: cat,
    division,
    playerRank,
    playerMinutes,
    totalEntries: entries.length,
    minsToNextRank,
    entries
  };
}

export async function generateVerticalStoryCardBlob({
  state = {},
  summary = {},
  heroFighter = null,
  duelCode = '',
  timelapseFrames = [],
  locale = 'en'
} = {}) {
  const width = 1080;
  const height = 1920;

  if (typeof document === 'undefined') {
    return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
  }

  const fighter = heroFighter || buildHeroFighter(state);
  const resolvedDuelCode = String(duelCode || createDuelCode(state)).trim();
  const totalSec = Math.max(0, Number(summary?.totalSeconds ?? calcTotalFocusSeconds(state?.sessions || [])) || 0);
  const activeDays = Math.max(0, Number(summary?.activeDays) || 0);
  const proofHash = String(summary?.proofHash || '000000000000').toUpperCase();
  const wk = summary?.weekKey || getWeekStartKey(Date.now(), state?.settings?.weekStart || 'mon');
  const poolSummary = summarizeWeekByUnit(state?.pools || [], wk);
  const poolPct = Math.max(0, Math.min(100, Number(poolSummary?.overallPercent) || 0));
  const rank = calcGuildLevel(calcTotalFocusSeconds(state?.sessions || []), locale);
  const compMeta = COMPANION_MAP[fighter.companionId] || COMPANIONS[0];
  const compName = locale === 'ja' ? (compMeta.ja || compMeta.en) : compMeta.en;

  // 1. Deep Emerald & Obsidian Gradient Backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#022c22');
  bgGrad.addColorStop(0.5, '#064e3b');
  bgGrad.addColorStop(1, '#022019');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Gold Glass Frame
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.72)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(36, 36, width - 72, height - 72, 40);
  ctx.stroke();

  // Top Header Crest
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(72, 78, width - 144, 150, 28);
  ctx.fill();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 46px system-ui, -apple-system, sans-serif';
  ctx.fillText('CRAFT GLASS', 110, 146);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '600 24px system-ui, -apple-system, sans-serif';
  ctx.fillText(t(locale, 'tagline'), 110, 192);

  // SHA-256 Proof Hash Seal Badge (Top-Right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(wk, width - 110, 138);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 26px ui-monospace, monospace';
  ctx.fillText(`#CG-${proofHash.slice(0, 10)}`, width - 110, 188);
  ctx.textAlign = 'left';

  // 2. Hero + Companion Pixel Showcase Stage
  ctx.fillStyle = 'rgba(6, 95, 70, 0.55)';
  ctx.strokeStyle = 'rgba(167, 243, 208, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(72, 260, width - 144, 340, 32);
  ctx.fill();
  ctx.stroke();

  const [heroImg, compImg] = await Promise.all([
    loadImage(`./assets/heroes/${fighter.heroBase || 'boy-b'}-idle.png`),
    loadImage(`./assets/companions/${fighter.companionId || 'twigfox'}-idle.png`)
  ]);

  ctx.imageSmoothingEnabled = false;
  if (heroImg && heroImg.naturalWidth > 0) {
    ctx.drawImage(heroImg, 0, 0, 80, 80, 118, 305, 190, 190);
  }
  if (compImg && compImg.naturalWidth > 0) {
    ctx.drawImage(compImg, 0, 0, 64, 64, 290, 355, 140, 140);
  }
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(fighter.name || 'Craft Explorer', 460, 355);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`Lv.${fighter.level}  •  ★Lv.${fighter.compLevel}`, 460, 412);

  ctx.fillStyle = '#a7f3d0';
  ctx.font = '600 25px system-ui, sans-serif';
  ctx.fillText(`${rank.rank} (${rank.rankTitle})`, 460, 462);

  const skillName = locale === 'ja' ? (fighter.skill?.ja || fighter.skill?.en || '') : (fighter.skill?.en || '');
  ctx.fillStyle = '#fde68a';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText(`🐾 ${compName}${skillName ? ` • ${skillName}` : ''}`, 460, 512);

  ctx.fillStyle = '#d1fae5';
  ctx.font = 'bold 22px ui-monospace, monospace';
  ctx.fillText(`HP ${fighter.maxHp}  |  ATK ${fighter.atk}  |  SPD ${fighter.spd}  |  CRIT ${fighter.critPct}%`, 118, 566);

  // 3. Weekly Focus Metrics & Weekly Pool Progress Bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.roundRect(72, 634, width - 144, 300, 32);
  ctx.fill();

  const statCols = [
    [locale === 'ja' ? '週間集中時間' : 'Weekly Focus', formatMinutes(locale, totalSec)],
    [locale === 'ja' ? '活動日数' : 'Active Days', `${activeDays} / 7`],
    [locale === 'ja' ? 'プール達成率' : 'Weekly Pool', `${poolPct}%`]
  ];
  const colW = (width - 144 - 80) / 3;
  statCols.forEach(([lbl, val], idx) => {
    const cx = 112 + idx * colW;
    ctx.fillStyle = '#475569';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText(lbl, cx, 704);
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText(val, cx, 772);
  });

  // Weekly Pool Progress Bar
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(
    locale === 'ja' ? `週間プール進捗 (${poolPct}%)` : `Weekly Pool Completion (${poolPct}%)`,
    112,
    838
  );

  const barX = 112;
  const barY = 858;
  const barW = width - 224;
  const barH = 34;
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 17);
  ctx.fill();

  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.roundRect(barX, barY, Math.max(28, Math.round((poolPct / 100) * barW)), barH, 17);
  ctx.fill();

  // 4. Blurred Desk Timelapse Filmstrip (up to 4 frames)
  ctx.fillStyle = 'rgba(6, 78, 59, 0.65)';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(72, 968, width - 144, 470, 32);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(
    locale === 'ja' ? '🎬 ぼかし保護済みタイムラプス証跡' : '🎬 Blurred Desk Timelapse Filmstrip',
    112,
    1024
  );

  const slice = (timelapseFrames || []).slice(0, 4);
  const frameW = 408;
  const frameH = 172;
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = 112 + col * (frameW + 40);
    const fy = 1054 + row * (frameH + 24);

    ctx.fillStyle = 'rgba(2, 44, 34, 0.85)';
    ctx.beginPath();
    ctx.roundRect(fx, fy, frameW, frameH, 18);
    ctx.fill();

    if (slice[i]?.dataUrl) {
      const fImg = await loadImage(slice[i].dataUrl);
      if (fImg) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fx, fy, frameW, frameH, 18);
        ctx.clip();
        ctx.drawImage(fImg, fx, fy, frameW, frameH);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = 'rgba(167, 243, 208, 0.45)';
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillText(
        locale === 'ja' ? `フレーム #${i + 1} (記録待機中)` : `Timelapse Slot #${i + 1}`,
        fx + 28,
        fy + 96
      );
    }
  }

  // 5. Duel Challenge Banner & SHA-256 Proof Seal Footer
  ctx.fillStyle = 'rgba(251, 191, 36, 0.14)';
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(72, 1472, width - 144, 280, 32);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillText(
    locale === 'ja' ? '⚔️ ギルド対戦チャレンジ (CGD1)' : '⚔️ GUILD DUEL CHALLENGE (CGD1)',
    112,
    1532
  );

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText(
    locale === 'ja'
      ? '実作業時間と相棒スキルだけで戦う自動バトル！コードを貼って対戦：'
      : '100% effort-driven RPG Auto-Duel! Paste my code in Craft Glass:',
    112,
    1578
  );

  ctx.fillStyle = 'rgba(2, 44, 34, 0.9)';
  ctx.beginPath();
  ctx.roundRect(112, 1604, width - 224, 114, 18);
  ctx.fill();

  const codeLine1 = resolvedDuelCode.slice(0, 44);
  const codeLine2 = resolvedDuelCode.slice(44, 88);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 23px ui-monospace, monospace';
  ctx.fillText(codeLine1, 136, 1652);
  if (codeLine2) {
    ctx.fillText(codeLine2 + (resolvedDuelCode.length > 88 ? '…' : ''), 136, 1692);
  }

  // Footer Seal
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 24px ui-monospace, monospace';
  ctx.fillText(`SHA-256 PROOF SEAL • #CG-${proofHash}`, width / 2, 1814);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '500 20px system-ui, sans-serif';
  ctx.fillText('Craft Glass • Verified On-Device Focus Ledger • Zero Pay-to-Win', width / 2, 1852);
  ctx.textAlign = 'left';

  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b || new Blob([], { type: 'image/png' })), 'image/png'));
  }
  return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
}
