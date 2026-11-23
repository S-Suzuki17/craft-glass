import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelapseCalendarMonth } from '../web/src/ui/timelapse.js';
import {
  RANKING_CATEGORIES,
  buildSnsShareLinks,
  createCoFocusBeacon,
  parseCoFocusBeacon,
  buildCategoryLeaderboard,
  generateVerticalStoryCardBlob
} from '../web/src/ui/social-hub.js';
import { buildHeroFighter, createDuelCode } from '../web/src/core/duel-arena.js';
import { createInitialState } from '../web/src/core/storage.js';

test('buildTimelapseCalendarMonth computes leading empty cells, day cells, focus minutes, and timelapse thumbnails', () => {
  // November 2026 starts on Sunday (month = 10 in 0-indexed JS months -> 0 leading empty cells, 30 days)
  const sessions = [
    { id: 's1', dayKey: '2026-11-03', seconds: 25 * 60, frameCount: 12, timelapseId: 'tl_1' },
    { id: 's2', dayKey: '2026-11-03', seconds: 35 * 60, frameCount: 0, timelapseId: null },
    { id: 's3', dayKey: '2026-11-18', seconds: 45 * 60, frameCount: 8, timelapseId: 'tl_2' }
  ];
  const timelapses = [
    {
      id: 'tl_1',
      dayKey: '2026-11-03',
      startedAt: 1000,
      seconds: 25 * 60,
      frames: [
        { at: 100, dataUrl: 'data:image/jpeg;base64,AAA' },
        { at: 200, dataUrl: 'data:image/jpeg;base64,BBB' },
        { at: 300, dataUrl: 'data:image/jpeg;base64,CCC' }
      ]
    },
    {
      id: 'tl_2',
      dayKey: '2026-11-18',
      startedAt: 2000,
      seconds: 45 * 60,
      frames: [
        { at: 400, dataUrl: 'data:image/jpeg;base64,DDD' }
      ]
    }
  ];

  const cal = buildTimelapseCalendarMonth(sessions, timelapses, 2026, 10);
  assert.equal(cal.year, 2026);
  assert.equal(cal.month, 10);
  assert.equal(cal.monthLabel, '2026-11');
  assert.equal(cal.totalMonthMinutes, 105);
  assert.equal(cal.recordedDaysCount, 2);

  const dayCells = cal.cells.filter((c) => !c.empty && c.day != null);
  assert.equal(dayCells.length, 30);

  const nov3 = dayCells.find((c) => c.dayKey === '2026-11-03');
  assert.ok(nov3);
  assert.equal(nov3.day, 3);
  assert.equal(nov3.minutes, 60);
  assert.equal(nov3.sessionCount, 2);
  assert.equal(nov3.timelapseId, 'tl_1');
  assert.equal(nov3.thumbDataUrl, 'data:image/jpeg;base64,BBB');
  assert.equal(nov3.frameCount, 12);

  const nov18 = dayCells.find((c) => c.dayKey === '2026-11-18');
  assert.ok(nov18);
  assert.equal(nov18.minutes, 45);
  assert.equal(nov18.timelapseId, 'tl_2');
  assert.equal(nov18.thumbDataUrl, 'data:image/jpeg;base64,DDD');

  // December 2026 starts on Tuesday (2 leading empty cells, 31 days)
  const decCal = buildTimelapseCalendarMonth([], [], 2026, 11);
  const leading = decCal.cells.filter((c) => c.empty);
  assert.equal(leading.length, 2);
  assert.equal(decCal.cells.length, 33);
});

test('buildSnsShareLinks builds ready-to-open X, LINE, and Discord/Community share strings with Duel & Pact codes', () => {
  const state = createInitialState();
  state.profile.displayName = 'Kai';
  state.activeCompanion = 'candleknight';
  state.sessions = [{ id: 's1', dayKey: '2026-11-23', seconds: 7200, category: 'code' }];
  state.companionBonds = { candleknight: 7200 };

  const heroFighter = buildHeroFighter(state);
  const duelCode = createDuelCode(state);
  const pactCode = 'CGP1:testpactpayload.123456';
  const summary = {
    totalSeconds: 7200,
    activeDays: 4,
    timelapseFrames: 18,
    proofHash: 'a1b2c3d4e5f60718'
  };

  const links = buildSnsShareLinks({
    locale: 'en',
    summary,
    heroFighter,
    duelCode,
    pactCode,
    appUrl: 'https://craftglass.example/app'
  });

  assert.ok(links.xUrl.startsWith('https://twitter.com/intent/tweet?text='));
  assert.ok(decodeURIComponent(links.xUrl).includes('2.0h'));
  assert.ok(decodeURIComponent(links.xUrl).includes('#CG-A1B2C3D4'));
  assert.ok(decodeURIComponent(links.xUrl).includes(duelCode));

  assert.ok(links.lineUrl.startsWith('https://social-plugins.line.me/lineit/share?url='));
  assert.ok(links.discordText.includes(duelCode));
  assert.ok(links.discordText.includes(pactCode));
  assert.ok(links.discordText.includes('#CG-A1B2C3D4E5F60718'));
});

test('createCoFocusBeacon and parseCoFocusBeacon sign and verify CGF1 Campfire codes with tamper protection', async () => {
  const state = createInitialState();
  state.profile.displayName = 'Mio';
  state.profile.heroBase = 'girl';
  state.activeCompanion = 'ribbonphoenix';
  state.sessions = [
    { id: 's1', dayKey: '2026-11-23', seconds: 50 * 60, category: 'art' }
  ];
  state.companionBonds = { ribbonphoenix: 3600 * 6 };

  const ts = 1763888000000;
  const code = createCoFocusBeacon(state, { timestamp: ts });
  assert.ok(code.startsWith('CGF1:'));

  const parsed = parseCoFocusBeacon(code);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.name, 'Mio');
  assert.equal(parsed.heroBase, 'girl');
  assert.equal(parsed.companionId, 'ribbonphoenix');
  assert.ok(parsed.compLevel >= 8);
  assert.equal(parsed.category, 'art');
  assert.equal(parsed.recentMinutes, 50);
  assert.equal(parsed.timestamp, ts);
  assert.deepEqual(parsed.beacon, {
    name: 'Mio',
    heroBase: 'girl',
    companionId: 'ribbonphoenix',
    compLevel: parsed.compLevel,
    level: parsed.level,
    category: 'art',
    recentMinutes: 50,
    timestamp: ts
  });

  // Tamper MAC
  const tamperedMac = `${code.slice(0, -3)}000`;
  assert.equal(parseCoFocusBeacon(tamperedMac).valid, false);
  assert.equal(parseCoFocusBeacon(tamperedMac).error, 'tampered');

  // Invalid prefix
  assert.equal(parseCoFocusBeacon('CGD1:abc.def').valid, false);
  assert.equal(parseCoFocusBeacon('CGD1:abc.def').error, 'prefix');

  // Verify 9:16 vertical story card generator returns a PNG Blob safely
  const storyBlob = await generateVerticalStoryCardBlob({
    state,
    summary: { totalSeconds: 3000, activeDays: 1, proofHash: 'abcdef123456' },
    duelCode: createDuelCode(state),
    locale: 'en'
  });
  assert.ok(storyBlob instanceof Blob);
  assert.equal(storyBlob.type, 'image/png');
});

test('buildCategoryLeaderboard ranks player, friends, and 8 deterministic Guild Crafters across all, study, and coding', () => {
  assert.deepEqual(RANKING_CATEGORIES, [
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

  const state = createInitialState();
  state.profile.displayName = 'Souta';
  state.sessions = [
    { id: 's1', dayKey: '2026-11-23', weekKey: '2026-11-23', category: 'study', seconds: 140 * 60 },
    { id: 's2', dayKey: '2026-11-23', weekKey: '2026-11-23', category: 'coding', seconds: 260 * 60 }
  ];

  const friends = [
    { name: 'Rina', heroBase: 'girl-b', companionId: 'acornling', compLevel: 5, category: 'study', recentMinutes: 210 },
    { name: 'Kenta', heroBase: 'boy', companionId: 'candleknight', compLevel: 12, category: 'coding', recentMinutes: 450 }
  ];

  const allBoard = buildCategoryLeaderboard(state, 'all', friends, '2026-11-23');
  assert.equal(allBoard.category, 'all');
  assert.equal(allBoard.totalEntries, 11); // 1 self + 2 friends + 8 guild
  const selfAll = allBoard.entries.find((e) => e.isSelf);
  assert.equal(selfAll.minutes, 400);
  assert.equal(selfAll.rank, allBoard.playerRank);
  assert.equal(allBoard.division, 'Diamond');
  // Sorted descending by minutes
  for (let i = 1; i < allBoard.entries.length; i++) {
    assert.ok(allBoard.entries[i - 1].minutes >= allBoard.entries[i].minutes);
    assert.equal(allBoard.entries[i].rank, i + 1);
  }

  const studyBoard = buildCategoryLeaderboard(state, 'study', friends, '2026-11-23');
  assert.equal(studyBoard.category, 'study');
  assert.equal(studyBoard.totalEntries, 10); // 1 self + 1 study friend + 8 study guild crafters
  const selfStudy = studyBoard.entries.find((e) => e.isSelf);
  assert.equal(selfStudy.minutes, 140);
  assert.ok(studyBoard.entries.some((e) => e.isFriend && e.name === 'Rina' && e.minutes === 210));
  assert.ok(!studyBoard.entries.some((e) => e.isFriend && e.name === 'Kenta'));

  const codingBoard = buildCategoryLeaderboard(state, 'coding', friends, '2026-11-23');
  assert.equal(codingBoard.category, 'coding');
  assert.equal(codingBoard.totalEntries, 10); // 1 self + 1 coding friend + 8 coding guild crafters
  const selfCoding = codingBoard.entries.find((e) => e.isSelf);
  assert.equal(selfCoding.minutes, 260);
  assert.equal(codingBoard.entries[0].name, 'Kenta');
  assert.equal(codingBoard.entries[0].isFriend, true);
  assert.ok(codingBoard.minsToNextRank > 0);
});
