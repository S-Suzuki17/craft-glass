// Global RPG Catalog: 25 Guild Ranks (400h curve), 20 Worlds, 12 Companions,
// Equipment Shop, 12 Study Rooms, 5 Break Gems, 12 Blessing Stamps, and Starter Templates.

export const HOURS_400_MINUTES = 24000;

export function reqExpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(Math.pow((level - 1) / 98, 1.35) * HOURS_400_MINUTES);
}

export const RANK_LEVEL_STEPS = Object.freeze([
  1, 2, 3, 5, 7, 10, 13, 17, 21, 25,
  29, 33, 37, 41, 45, 50, 55, 60, 65, 70,
  75, 81, 87, 93, 99
]);

export const GUILD_RANKS = Object.freeze(
  RANK_LEVEL_STEPS.map((minLevel, idx) => Object.freeze({
    step: idx + 1,
    index: idx,
    minLevel,
    requiredMinutes: reqExpForLevel(minLevel)
  }))
);

export const WORLDS = Object.freeze([
  { id: 1, key: 'meadow', minLevel: 1, en: 'Verdant Meadow', ja: '若葉の草原' },
  { id: 2, key: 'forest', minLevel: 3, en: 'Sunlit Woods', ja: '木もれびの森' },
  { id: 3, key: 'cave', minLevel: 6, en: 'Crystal Cavern', ja: '水晶の洞窟' },
  { id: 4, key: 'snow', minLevel: 10, en: 'Lantern Peaks', ja: '雪あかりの山' },
  { id: 5, key: 'sky', minLevel: 14, en: 'Cloud Corridor', ja: '雲の回廊' },
  { id: 6, key: 'castle', minLevel: 18, en: 'Stargazer Keep', ja: '星見の城' },
  { id: 7, key: 'dunes', minLevel: 22, en: 'Amber Dunes', ja: '琥珀の砂丘' },
  { id: 8, key: 'coral', minLevel: 26, en: 'Coral Cove', ja: '珊瑚の入り江' },
  { id: 9, key: 'fen', minLevel: 30, en: 'Misty Fen', ja: '霧ゆれる湿原' },
  { id: 10, key: 'blossom', minLevel: 34, en: 'Blossom Terrace', ja: '花咲く段丘' },
  { id: 11, key: 'ruins', minLevel: 39, en: 'Windcarved Ruins', ja: '風削りの遺跡' },
  { id: 12, key: 'volcano', minLevel: 44, en: 'Ember Ridge', ja: '熾火の山道' },
  { id: 13, key: 'clockwork', minLevel: 49, en: 'Clockwork Canal', ja: '歯車の水路' },
  { id: 14, key: 'orchard', minLevel: 54, en: 'Harvest Orchard', ja: '実りの果樹園' },
  { id: 15, key: 'abyss', minLevel: 60, en: 'Emerald Trench', ja: '深碧の海溝' },
  { id: 16, key: 'moon', minLevel: 66, en: 'Moonlit Cloister', ja: '月影の回廊' },
  { id: 17, key: 'library', minLevel: 73, en: 'Silent Archive', ja: '静かな大書庫' },
  { id: 18, key: 'aurora', minLevel: 80, en: 'Aurora Glade', ja: '極光の氷原' },
  { id: 19, key: 'dream', minLevel: 87, en: 'Slumber Garden', ja: 'まどろみの庭' },
  { id: 20, key: 'astral', minLevel: 93, en: 'Dawn Observatory', ja: '暁星の天球' }
].map((w) => Object.freeze({ ...w, src: `./assets/worlds/world-${String(w.id).padStart(2, '0')}.png` })));

export const COMPANIONS = Object.freeze([
  { id: 'twigfox', en: 'Twig Fox', ja: '小枝ぎつね', cost: 0, minDefeats: 0, pityDefeats: 0, recruitChance: 1.0, skill: { kind: 'strike', mult: 1.35, healPct: 0, en: 'Swift Bite', ja: '疾風かみつき' } },
  { id: 'acornling', en: 'Acornling', ja: 'どんぐり歩き', cost: 0, minDefeats: 0, pityDefeats: 1, recruitChance: 1.0, skill: { kind: 'heal', mult: 0.85, healPct: 0.14, en: 'Forest Mend', ja: '森の癒やし' } },
  { id: 'bookmarkjay', en: 'Bookmark Jay', ja: 'しおりかけす', cost: 0, minDefeats: 2, pityDefeats: 4, recruitChance: 0.55, skill: { kind: 'crit', mult: 1.48, healPct: 0, en: 'Gale Feather', ja: '疾風の羽刃' } },
  { id: 'candleknight', en: 'Candle Knight', ja: '灯火の小騎士', cost: 0, minDefeats: 4, pityDefeats: 7, recruitChance: 0.50, skill: { kind: 'shield', mult: 1.18, healPct: 0.11, en: 'Aegis Bash', ja: '聖火の盾撃' } },
  { id: 'cometotter', en: 'Comet Otter', ja: '彗星かわうそ', cost: 0, minDefeats: 7, pityDefeats: 11, recruitChance: 0.45, skill: { kind: 'strike', mult: 1.45, healPct: 0, en: 'Comet Splash', ja: '彗星スプラッシュ' } },
  { id: 'lanternmoth', en: 'Lantern Moth', ja: '灯りの蛾', cost: 0, minDefeats: 11, pityDefeats: 16, recruitChance: 0.42, skill: { kind: 'heal', mult: 0.8, healPct: 0.18, en: 'Glow Dust', ja: '燐光の癒やし粉' } },
  { id: 'nestowl', en: 'Archive Owl', ja: '巣もりふくろう', cost: 0, minDefeats: 16, pityDefeats: 22, recruitChance: 0.40, skill: { kind: 'crit', mult: 1.58, healPct: 0, en: 'Wisdom Beam', ja: '叡智の閃光' } },
  { id: 'prismseal', en: 'Prism Seal', ja: 'プリズムあざらし', cost: 0, minDefeats: 22, pityDefeats: 30, recruitChance: 0.38, skill: { kind: 'shield', mult: 1.25, healPct: 0.15, en: 'Prism Ward', ja: 'プリズム護壁' } },
  { id: 'quillfawn', en: 'Quill Fawn', ja: '羽根ペンこじか', cost: 0, minDefeats: 30, pityDefeats: 40, recruitChance: 0.35, skill: { kind: 'strike', mult: 1.55, healPct: 0, en: 'Ink Pierce', ja: '黒耀の貫通矢' } },
  { id: 'clockrook', en: 'Clockwork Rook', ja: '時計のからす', cost: 0, minDefeats: 40, pityDefeats: 54, recruitChance: 0.32, skill: { kind: 'double', mult: 1.68, healPct: 0, en: 'Chrono Twin', ja: '時空二連撃' } },
  { id: 'ribbonphoenix', en: 'Ribbon Phoenix', ja: '尾帯の火鳥', cost: 0, minDefeats: 55, pityDefeats: 72, recruitChance: 0.30, skill: { kind: 'phoenix', mult: 1.5, healPct: 0.16, en: 'Rebirth Flame', ja: '不死鳥の焔' } },
  { id: 'astraldragon', en: 'Astral Dragon', ja: '星冠の守護竜', cost: 0, minDefeats: 75, pityDefeats: 96, recruitChance: 0.25, skill: { kind: 'dragon', mult: 1.85, healPct: 0.12, en: 'Starfire Breath', ja: '星冠の竜息吹' } }
].map((c) => Object.freeze({
  ...c,
  skill: Object.freeze(c.skill),
  idleSrc: `./assets/creatures/${c.id}-idle.png`,
  moveSrc: `./assets/creatures/${c.id}-move.png`
})));

export const SEALED_MONSTER_KINDS = Object.freeze([
  { id: 'scrollwyrm', en: 'Scroll Wyrm', ja: '巻物のへび' },
  { id: 'moonsphinx', en: 'Moon Sphinx', ja: '月砂の小獅子' },
  { id: 'froststag', en: 'Frost Stag', ja: '霜角の大鹿' },
  { id: 'compassdrake', en: 'Compass Drake', ja: '羅針の小竜' },
  { id: 'embernewt', en: 'Ember Newt', ja: '熾火いもり' },
  { id: 'dawnleviathan', en: 'Dawn Leviathan', ja: '暁の星海竜' },
  { id: 'starloom', en: 'Starloom Weaver', ja: '星糸の織機' },
  { id: 'cloudray', en: 'Cloud Ray', ja: '雲えい' },
  { id: 'lilypadfrog', en: 'Lotus Toad', ja: '浮葉がえる' },
  { id: 'snowhare', en: 'Frost Hare', ja: '雪うさぎ' },
  { id: 'teacupbee', en: 'Teacup Bee', ja: '茶花ばち' },
  { id: 'seedling', en: 'Sprout Imp', ja: '芽ばえこびと' }
]);

export const WILD_MONSTERS = Object.freeze([
  // World 1: Verdant Meadow
  { id: 'seedling', spriteId: 'seedling', worldId: 1, en: 'Sprout Imp', ja: '芽ばえこびと', element: 'verdant', isBoss: false, baseLv: 1 },
  { id: 'teacupbee', spriteId: 'teacupbee', worldId: 1, en: 'Teacup Bee', ja: '茶花ばち', element: 'gale', isBoss: false, baseLv: 2 },
  // World 2: Sunlit Woods
  { id: 'meadow-fox', spriteId: 'twigfox', worldId: 2, en: 'Briar Kit', ja: '野ばらぎつね', element: 'verdant', isBoss: false, baseLv: 3 },
  { id: 'oak-acorn', spriteId: 'acornling', worldId: 2, en: 'Moss Acorn', ja: '苔どんぐり', element: 'verdant', isBoss: false, baseLv: 4 },
  // World 3: Crystal Cavern
  { id: 'crystal-moth', spriteId: 'lanternmoth', worldId: 3, en: 'Quartz Moth', ja: '水晶蛾', element: 'astral', isBoss: false, baseLv: 6 },
  { id: 'cavern-wyrm', spriteId: 'scrollwyrm', worldId: 3, en: 'Glyph Wyrm', ja: '碑文のへび', element: 'astral', isBoss: false, baseLv: 8 },
  // World 4: Lantern Peaks
  { id: 'snowhare', spriteId: 'snowhare', worldId: 4, en: 'Frost Hare', ja: '雪うさぎ', element: 'tide', isBoss: false, baseLv: 10 },
  { id: 'froststag', spriteId: 'froststag', worldId: 4, en: 'Frost Stag', ja: '霜角の大鹿', element: 'tide', isBoss: false, baseLv: 12 },
  // World 5: Cloud Corridor (BOSS 1)
  { id: 'gale-jay', spriteId: 'bookmarkjay', worldId: 5, en: 'Zephyr Jay', ja: '疾風かけす', element: 'gale', isBoss: false, baseLv: 14 },
  { id: 'cloudray', spriteId: 'cloudray', worldId: 5, en: 'Sky Manta Sovereign', ja: '天雲の大えい', element: 'gale', isBoss: true, baseLv: 16 },
  // World 6: Stargazer Keep
  { id: 'keep-knight', spriteId: 'candleknight', worldId: 6, en: 'Vigil Sentinel', ja: '星見の衛兵', element: 'ember', isBoss: false, baseLv: 18 },
  { id: 'starloom', spriteId: 'starloom', worldId: 6, en: 'Starloom Weaver', ja: '星糸の織機', element: 'astral', isBoss: false, baseLv: 20 },
  // World 7: Amber Dunes
  { id: 'dune-newt', spriteId: 'embernewt', worldId: 7, en: 'Sandflare Newt', ja: '砂陽いもり', element: 'ember', isBoss: false, baseLv: 22 },
  { id: 'moonsphinx', spriteId: 'moonsphinx', worldId: 7, en: 'Moon Sphinx', ja: '月砂の小獅子', element: 'astral', isBoss: false, baseLv: 24 },
  // World 8: Coral Cove
  { id: 'reef-otter', spriteId: 'cometotter', worldId: 8, en: 'Tidepool Otter', ja: '潮騒かわうそ', element: 'tide', isBoss: false, baseLv: 26 },
  { id: 'coral-seal', spriteId: 'prismseal', worldId: 8, en: 'Lagoon Seal', ja: '珊瑚あざらし', element: 'tide', isBoss: false, baseLv: 28 },
  // World 9: Misty Fen
  { id: 'lilypadfrog', spriteId: 'lilypadfrog', worldId: 9, en: 'Lotus Toad', ja: '浮葉がえる', element: 'tide', isBoss: false, baseLv: 30 },
  { id: 'fen-wisp', spriteId: 'lanternmoth', worldId: 9, en: 'Will-o-Moth', ja: '霧灯りの蛾', element: 'verdant', isBoss: false, baseLv: 32 },
  // World 10: Blossom Terrace (BOSS 2)
  { id: 'petal-fawn', spriteId: 'quillfawn', worldId: 10, en: 'Blossom Fawn', ja: '桜花こじか', element: 'verdant', isBoss: false, baseLv: 34 },
  { id: 'sakura-phoenix', spriteId: 'ribbonphoenix', worldId: 10, en: 'Vermilion Crest', ja: '緋桜の霊鳥', element: 'ember', isBoss: true, baseLv: 37 },
  // World 11: Windcarved Ruins
  { id: 'ruin-owl', spriteId: 'nestowl', worldId: 11, en: 'Monolith Owl', ja: '古碑のふくろう', element: 'gale', isBoss: false, baseLv: 39 },
  { id: 'compassdrake', spriteId: 'compassdrake', worldId: 11, en: 'Compass Drake', ja: '羅針の小竜', element: 'gale', isBoss: false, baseLv: 42 },
  // World 12: Ember Ridge
  { id: 'embernewt', spriteId: 'embernewt', worldId: 12, en: 'Ember Newt', ja: '熾火いもり', element: 'ember', isBoss: false, baseLv: 44 },
  { id: 'cinder-drake', spriteId: 'compassdrake', worldId: 12, en: 'Magma Wing', ja: '熔岩の小竜', element: 'ember', isBoss: false, baseLv: 47 },
  // World 13: Clockwork Canal
  { id: 'gear-rook', spriteId: 'clockrook', worldId: 13, en: 'Chrono Rook', ja: '歯車からす', element: 'astral', isBoss: false, baseLv: 49 },
  { id: 'brass-knight', spriteId: 'candleknight', worldId: 13, en: 'Automaton Guard', ja: '機巧の騎士', element: 'ember', isBoss: false, baseLv: 52 },
  // World 14: Harvest Orchard
  { id: 'honey-bee', spriteId: 'teacupbee', worldId: 14, en: 'Nectar Queen Bee', ja: '黄金蜜ばち', element: 'verdant', isBoss: false, baseLv: 54 },
  { id: 'orchard-imp', spriteId: 'seedling', worldId: 14, en: ' Cider Mandrake', ja: '芳醇こびと', element: 'verdant', isBoss: false, baseLv: 57 },
  // World 15: Emerald Trench (BOSS 3)
  { id: 'abyss-ray', spriteId: 'cloudray', worldId: 15, en: 'Trench Ray', ja: '深海えい', element: 'tide', isBoss: false, baseLv: 60 },
  { id: 'dawnleviathan', spriteId: 'dawnleviathan', worldId: 15, en: 'Abyssal Leviathan', ja: '深碧の海竜王', element: 'tide', isBoss: true, baseLv: 64 },
  // World 16: Moonlit Cloister
  { id: 'lunar-sphinx', spriteId: 'moonsphinx', worldId: 16, en: 'Eclipse Sphinx', ja: '月蝕の守護獅子', element: 'astral', isBoss: false, baseLv: 68 },
  // World 17: Silent Archive
  { id: 'scrollwyrm', spriteId: 'scrollwyrm', worldId: 17, en: 'Forbidden Scroll Wyrm', ja: '禁書の古竜', element: 'astral', isBoss: false, baseLv: 74 },
  // World 18: Aurora Glade
  { id: 'aurora-stag', spriteId: 'froststag', worldId: 18, en: 'Aurora Greatstag', ja: '極光の神鹿', element: 'tide', isBoss: false, baseLv: 81 },
  // World 19: Slumber Garden
  { id: 'dream-weaver', spriteId: 'starloom', worldId: 19, en: 'Dreamloom Seraph', ja: '夢紡ぎの精霊', element: 'astral', isBoss: false, baseLv: 88 },
  // World 20: Dawn Observatory (BOSS 4)
  { id: 'cosmos-drake', spriteId: 'dawnleviathan', worldId: 20, en: 'Nebula Serpent', ja: '星雲の天竜', element: 'astral', isBoss: false, baseLv: 93 },
  { id: 'astral-overlord', spriteId: 'astraldragon', worldId: 20, en: 'Chronos Astral Dragon', ja: '暁星の創世竜', element: 'astral', isBoss: true, baseLv: 99 }
].map((m) => Object.freeze({
  ...m,
  en: m.en.trim(),
  idleSrc: `./assets/creatures/${m.spriteId}-idle.png`,
  moveSrc: `./assets/creatures/${m.spriteId}-move.png`
})));

export const BOND_TIERS = Object.freeze([
  { level: 1, minSeconds: 0, hearts: 1 },
  { level: 2, minSeconds: 30 * 60, hearts: 2 },
  { level: 3, minSeconds: 120 * 60, hearts: 3 },
  { level: 4, minSeconds: 300 * 60, hearts: 4 },
  { level: 5, minSeconds: 600 * 60, hearts: 5 }
]);

export const BREAK_GEMS = Object.freeze([
  { id: 'peridot', minSeconds: 5 * 60, points: 2, color: 'emerald' },
  { id: 'aquamarine', minSeconds: 15 * 60, points: 4, color: 'sky' },
  { id: 'citrine', minSeconds: 25 * 60, points: 6, color: 'amber' },
  { id: 'sapphire', minSeconds: 45 * 60, points: 10, color: 'indigo' },
  { id: 'prism', minSeconds: 90 * 60, points: 15, color: 'prism' }
]);

export const HERO_BASES = Object.freeze([
  { id: 'boy', en: 'Apprentice (Classic)', ja: '見習い冒険者 A' },
  { id: 'girl', en: 'Apprentice (Classic II)', ja: '見習い冒険者 B' },
  { id: 'boy-b', en: 'Scholar (Bright)', ja: '探求者 A' },
  { id: 'girl-b', en: 'Scholar (Bright II)', ja: '探求者 B' }
]);

export const ROOMS = Object.freeze([
  { id: 'mint', en: 'Mint Study', ja: 'ミント書斎', cost: 0 },
  { id: 'forest', en: 'Forest Cabin', ja: '森の木漏れ日', cost: 0 },
  { id: 'blue', en: 'Sky Atelier', ja: '青空アトリエ', cost: 10 },
  { id: 'peach', en: 'Warm Dawn', ja: '朝焼けの机', cost: 15 },
  { id: 'sakura', en: 'Sakura Terrace', ja: '桜テラス', cost: 20 },
  { id: 'lilac', en: 'Lilac Loft', ja: 'ライラック書庫', cost: 25 },
  { id: 'sunset', en: 'Sunset Window', ja: '夕暮れの窓辺', cost: 30 },
  { id: 'night', en: 'Midnight Lamp', ja: '深夜のランプ', cost: 35 },
  { id: 'aurora', en: 'Aurora Observatory', ja: '極光の観測室', cost: 50 },
  { id: 'gold', en: 'Gilded Library', ja: '黄金の大書庫', cost: 65 },
  { id: 'cyber', en: 'Neon Lab', ja: 'ネオン研究室', cost: 75 },
  { id: 'universe', en: 'Astral Void', ja: '星海の書斎', cost: 100 }
].map((r) => Object.freeze({ ...r, src: `./assets/rooms/room-${r.id}.png` })));

export const EQUIPMENT_CATALOG = Object.freeze([
  // Head
  { id: 'head-bandana', slot: 'head', key: 'bandana', en: 'Traveler Bandana', ja: '旅人のバンダナ', cost: 0 },
  { id: 'head-wood', slot: 'head', key: 'wood', en: 'Wooden Circlet', ja: '木漏れ日の額当て', cost: 12 },
  { id: 'head-cap', slot: 'head', key: 'cap', en: 'Explorer Cap', ja: '探検キャップ', cost: 18 },
  { id: 'head-ribbon', slot: 'head', key: 'ribbon', en: 'Emerald Ribbon', ja: '翠のリボン', cost: 22 },
  { id: 'head-cat', slot: 'head', key: 'cat', en: 'Cat-Ear Hood', ja: 'ねこみみフード', cost: 30 },
  { id: 'head-ranger', slot: 'head', key: 'ranger', en: 'Ranger Hood', ja: '斥候のフード', cost: 36 },
  { id: 'head-wizard', slot: 'head', key: 'wizard', en: 'Starlit Hat', ja: '星詠みの三角帽', cost: 45 },
  { id: 'head-sage', slot: 'head', key: 'sage', en: 'Sage Laurel', ja: '賢者の月桂冠', cost: 60 },
  { id: 'head-sakura', slot: 'head', key: 'sakura', en: 'Blossom Hairpin', ja: '桜花の髪飾り', cost: 65 },
  { id: 'head-cyber', slot: 'head', key: 'cyber', en: 'Focus Visor', ja: '集中バイザー', cost: 80 },
  { id: 'head-crown', slot: 'head', key: 'crown', en: 'Craft Crown', ja: '職人ギルド王冠', cost: 120 },
  // Body
  { id: 'body-cloth', slot: 'body', key: 'cloth', en: 'Linen Tunic', ja: '旅人の麻服', cost: 0 },
  { id: 'body-school', slot: 'body', key: 'school', en: 'Scholar Blazer', ja: '学徒のブレザー', cost: 15 },
  { id: 'body-leather', slot: 'body', key: 'leather', en: 'Artisan Vest', ja: '職人の革ベスト', cost: 25 },
  { id: 'body-forest', slot: 'body', key: 'forest', en: 'Forest Cloak', ja: '翠風のマント', cost: 35 },
  { id: 'body-robe', slot: 'body', key: 'robe', en: 'Archive Robe', ja: '書庫のローブ', cost: 45 },
  { id: 'body-iron', slot: 'body', key: 'iron', en: 'Iron Plate', ja: '鉄壁の胸当て', cost: 55 },
  { id: 'body-sakura', slot: 'body', key: 'sakura', en: 'Spring Haori', ja: '春霞の羽織', cost: 70 },
  { id: 'body-sage', slot: 'body', key: 'sage', en: 'Sage Mantle', ja: '賢者の法衣', cost: 85 },
  { id: 'body-astral', slot: 'body', key: 'astral', en: 'Astral Coat', ja: '星辰のコート', cost: 130 },
  // Weapon / Tool
  { id: 'weapon-pencil', slot: 'weapon', key: 'pencil', en: 'Graphite Pencil', ja: '職人の鉛筆', cost: 0 },
  { id: 'weapon-quill', slot: 'weapon', key: 'quill', en: 'Chronicle Quill', ja: '記録の羽根ペン', cost: 12 },
  { id: 'weapon-stick', slot: 'weapon', key: 'stick', en: 'Oak Staff', ja: '樫の杖', cost: 18 },
  { id: 'weapon-iron', slot: 'weapon', key: 'iron', en: 'Steel Blade', ja: '鍛錬の剣', cost: 28 },
  { id: 'weapon-staff', slot: 'weapon', key: 'staff', en: 'Amber Wand', ja: '琥珀の導杖', cost: 40 },
  { id: 'weapon-crystal', slot: 'weapon', key: 'crystal', en: 'Prism Scepter', ja: '水晶の笏', cost: 55 },
  { id: 'weapon-sakura', slot: 'weapon', key: 'sakura', en: 'Blossom Branch', ja: '花嵐の枝', cost: 65 },
  { id: 'weapon-moon', slot: 'weapon', key: 'moon', en: 'Crescent Halberd', ja: '三日月の杖', cost: 80 },
  { id: 'weapon-excalibur', slot: 'weapon', key: 'excalibur', en: 'Dawnbreaker', ja: '暁光の聖剣', cost: 140 },
  // Shield / Aura
  { id: 'shield-none', slot: 'shield', key: 'none', en: 'None', ja: 'なし', cost: 0 },
  { id: 'shield-glasses', slot: 'shield', key: 'glasses', en: 'Clarity Glasses', ja: '知性の丸眼鏡', cost: 15 },
  { id: 'shield-leaf', slot: 'shield', key: 'leaf', en: 'Leaf Buckler', ja: '若葉の盾', cost: 22 },
  { id: 'shield-moonbook', slot: 'shield', key: 'moonbook', en: 'Moon Tome', ja: '月夜の魔導書', cost: 38 },
  { id: 'shield-fairy', slot: 'shield', key: 'fairy', en: 'Wisp Lantern', ja: '精霊の灯り', cost: 55 },
  { id: 'shield-drone', slot: 'shield', key: 'drone', en: 'Chrono Drone', ja: '計測ドローン', cost: 75 },
  { id: 'shield-aura-blue', slot: 'shield', key: 'aura-blue', en: 'Cerulean Aura', ja: '蒼碧のオーラ', cost: 90 },
  { id: 'shield-aura-gold', slot: 'shield', key: 'aura-gold', en: 'Gilded Aura', ja: '黄金のオーラ', cost: 110 },
  { id: 'shield-aura-rainbow', slot: 'shield', key: 'aura-rainbow', en: 'Prism Aura', ja: '虹彩のオーラ', cost: 150 }
].map((item) => Object.freeze({
  ...item,
  src: item.key === 'none' ? '' : `./assets/equipment/${item.id}.png`
})));

export const BLESSING_STAMPS = Object.freeze([
  { key: 'well-done', art: 'applaud', theme: 'gold' },
  { key: 'applaud', art: 'applaud', theme: 'gold' },
  { key: 'thanks-work', art: 'applaud', theme: 'gold' },
  { key: 'early', art: 'applaud', theme: 'gold' },
  { key: 'cheer', art: 'cheer', theme: 'emerald' },
  { key: 'progress', art: 'cheer', theme: 'emerald' },
  { key: 'checked', art: 'checked', theme: 'sky' },
  { key: 'thinking', art: 'thinking', theme: 'violet' },
  { key: 'explain', art: 'explain', theme: 'violet' },
  { key: 'together', art: 'thinking', theme: 'violet' },
  { key: 'retry', art: 'retry', theme: 'violet' },
  { key: 'question-thanks', art: 'thinking', theme: 'violet' }
].map((s) => Object.freeze({
  ...s,
  src: `./assets/stamps/${s.art}.png`
})));

export const STARTER_PACKS = Object.freeze({
  study: {
    pools: {
      en: [
        { title: 'Core Textbook & Notes', category: 'study', unit: 'pages', target: 24, chunkSize: 3, pinnedDays: [0, 2, 4, 5] },
        { title: 'Practice Problem Sets', category: 'study', unit: 'problems', target: 30, chunkSize: 5, pinnedDays: [1, 3, 6] },
        { title: 'Deep Recall & Review', category: 'study', unit: 'min', target: 180, chunkSize: 30, pinnedDays: [0, 2, 4, 6] }
      ],
      ja: [
        { title: '参考書・基本問題を進める', category: 'study', unit: 'pages', target: 24, chunkSize: 3, pinnedDays: [0, 2, 4, 5] },
        { title: '演習問題チャレンジ', category: 'study', unit: 'problems', target: 30, chunkSize: 5, pinnedDays: [1, 3, 6] },
        { title: 'じっくり理解・まとめ時間', category: 'study', unit: 'min', target: 180, chunkSize: 30, pinnedDays: [0, 2, 4, 6] }
      ]
    },
    cards: {
      en: [
        { deck: 'Learning Science', front: 'Why does spaced repetition outperform cramming?', back: 'Spacing reviews near the forgetting curve strengthens long-term memory stability.' },
        { deck: 'Learning Science', front: 'What is the Desirable Difficulty principle?', back: 'Active retrieval that requires effort creates far stronger recall than passive rereading.' },
        { deck: 'Craft Philosophy', front: 'Why cap daily expedition time at 90 minutes?', back: 'To reward sustainable weekly rhythm and prevent late-week cramming burnout.' }
      ],
      ja: [
        { deck: '学習科学・習慣', front: '一夜漬けより間隔反復（分散学習）が定着する理由は？', back: '忘れかけたタイミングで思い出す負荷が記憶の安定度（Stability）を高めるため。' },
        { deck: '学習科学・習慣', front: 'アクティブ・リコール（能動的想起）とは？', back: 'テキストを見直すだけでなく、答えを見ずに思い出す練習をすること。' },
        { deck: 'Craft Glassの設計', front: '遠征ボーナスに「1日90分上限」がある理由は？', back: '最終日の詰め込みより、週4日以上の無理のない分散継続を優遇するため。' }
      ]
    }
  },
  language: {
    pools: {
      en: [
        { title: 'Active Listening Immersion', category: 'language', unit: 'min', target: 150, chunkSize: 25, pinnedDays: [0, 1, 3, 4, 6] },
        { title: 'Extensive Reading', category: 'language', unit: 'pages', target: 30, chunkSize: 5, pinnedDays: [1, 2, 5] }
      ],
      ja: [
        { title: 'リスニング＆シャドーイング', category: 'language', unit: 'min', target: 150, chunkSize: 25, pinnedDays: [0, 1, 3, 4, 6] },
        { title: '洋書・記事の多読', category: 'language', unit: 'pages', target: 30, chunkSize: 5, pinnedDays: [1, 2, 5] }
      ]
    },
    cards: {
      en: [
        { deck: 'Global Idioms', front: 'Break the ice', back: 'Initiate friendly conversation in an unfamiliar situation.' },
        { deck: 'Global Idioms', front: 'Steady as she goes', back: 'Keep a calm, consistent pace without rushing.' }
      ],
      ja: [
        { deck: '実用英語フレーズ', front: 'Consistent effort compounds.', back: '地道な努力は複利のように積み重なる。' },
        { deck: '実用英語フレーズ', front: 'Show your work, not just the result.', back: '結果だけでなく、取り組みのプロセスを示す。' }
      ]
    }
  },
  builder: {
    pools: {
      en: [
        { title: 'Deep Coding & Architecture', category: 'coding', unit: 'min', target: 240, chunkSize: 30, pinnedDays: [0, 2, 4, 5] },
        { title: 'Shipped Modules / Tests', category: 'coding', unit: 'sessions', target: 5, chunkSize: 1, pinnedDays: [1, 3, 5] }
      ],
      ja: [
        { title: '集中コーディング＆設計', category: 'coding', unit: 'min', target: 240, chunkSize: 30, pinnedDays: [0, 2, 4, 5] },
        { title: '実装・テスト完了セッション', category: 'coding', unit: 'sessions', target: 5, chunkSize: 1, pinnedDays: [1, 3, 5] }
      ]
    },
    cards: {
      en: [
        { deck: 'Engineering Craft', front: 'What makes local-first software resilient?', back: 'Your state works offline on your device and never vanishes when a cloud service shuts down.' },
        { deck: 'Engineering Craft', front: 'Why keep core domain logic pure & dependency-free?', back: 'Instant unit testing, zero supply-chain bloat, and effortless cross-platform reuse.' }
      ],
      ja: [
        { deck: '開発クラフト', front: 'ローカルファースト設計の最大の利点は？', back: 'オフラインで完結し、外部サービスの終了や課金変更で自分の記録が消えないこと。' },
        { deck: '開発クラフト', front: 'コアロジックを純粋なモジュールに分ける理由は？', back: '高速な単体テスト、依存ゼロの安全性、プラットフォーム間の再利用が可能になるため。' }
      ]
    }
  },
  mindful: {
    pools: {
      en: [
        { title: 'Book Reading Time', category: 'reading', unit: 'pages', target: 40, chunkSize: 5, pinnedDays: [0, 2, 4, 6] },
        { title: 'Creative Practice (Art / Music)', category: 'art', unit: 'min', target: 120, chunkSize: 20, pinnedDays: [1, 3, 5] }
      ],
      ja: [
        { title: '紙の本・教養書の読書', category: 'reading', unit: 'pages', target: 40, chunkSize: 5, pinnedDays: [0, 2, 4, 6] },
        { title: '創作・楽器練習タイム', category: 'art', unit: 'min', target: 120, chunkSize: 20, pinnedDays: [1, 3, 5] }
      ]
    },
    cards: {
      en: [
        { deck: 'Daily Wisdom', front: 'Why avoid daily-only streak pressure?', back: 'Real human lives have busy days; weekly streaks forgive rest and preserve joy over years.' }
      ],
      ja: [
        { deck: '習慣の知恵', front: '毎日ログイン義務を置かない理由は？', back: '忙しい日があっても罪悪感で挫折せず、週単位のリズムで何年も続けられるようにするため。' }
      ]
    }
  }
});
