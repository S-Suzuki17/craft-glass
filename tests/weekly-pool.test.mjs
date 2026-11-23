import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPoolTask,
  poolProgress,
  togglePoolChunk,
  advancePoolAmount,
  summarizeWeekByUnit,
  calculateWeeklyStreak,
  getWeekStartKey,
  addDaysToKey,
  findNeglectedPools
} from '../web/src/core/weekly-pool.js';

test('weekly pool auto-chunks and tracks remaining without mixing units', () => {
  const weekKey = '2026-11-16';
  const mondayMs = Date.parse('2026-11-16T10:00:00Z');
  const pagesPool = createPoolTask({
    id: 'p1',
    title: 'Algorithms Textbook',
    category: 'study',
    unit: 'pages',
    target: 10,
    chunkSize: 3,
    weekKey,
    pinnedDays: [0, 2, 4],
    nowMs: mondayMs
  });
  assert.equal(pagesPool.chunks.length, 4); // 3, 3, 3, 1
  assert.deepEqual(pagesPool.chunks.map((c) => c.amount), [3, 3, 3, 1]);

  const minPool = createPoolTask({
    id: 'p2',
    title: 'Rust Practice',
    category: 'coding',
    unit: 'min',
    target: 120,
    chunkSize: 30,
    weekKey,
    nowMs: mondayMs
  });

  const updatedPages = togglePoolChunk(pagesPool, 'c1', mondayMs);
  assert.equal(poolProgress(updatedPages).done, 3);
  assert.equal(poolProgress(updatedPages).remaining, 7);

  const summary = summarizeWeekByUnit([updatedPages, minPool], weekKey);
  assert.equal(summary.byUnit.length, 2);
  const pUnit = summary.byUnit.find((u) => u.unit === 'pages');
  const mUnit = summary.byUnit.find((u) => u.unit === 'min');
  assert.equal(pUnit.done, 3);
  assert.equal(pUnit.remaining, 7);
  assert.equal(mUnit.done, 0);
  assert.equal(mUnit.remaining, 120);
});

test('early completion bonus flags when completed >= 2 days before week end', () => {
  const weekKey = '2026-11-16'; // Week ends Sunday 2026-11-22
  const wednesdayMs = Date.parse('2026-11-18T12:00:00');
  let task = createPoolTask({
    id: 'p_early',
    title: 'Sketching',
    unit: 'sessions',
    target: 2,
    chunkSize: 1,
    weekKey,
    nowMs: wednesdayMs
  });
  task = advancePoolAmount(task, 2, wednesdayMs);
  assert.equal(poolProgress(task).completed, true);
  assert.equal(task.earlyCompleted, true);
});

test('weekly streak counts consecutive >=80% weeks even with skipped days', () => {
  const w1 = '2026-11-02';
  const w2 = '2026-11-09';
  const w3 = '2026-11-16';
  const p1 = advancePoolAmount(createPoolTask({ id: 'a', title: 'A', unit: 'min', target: 100, chunkSize: 20, weekKey: w1 }), 80);
  const p2 = advancePoolAmount(createPoolTask({ id: 'b', title: 'B', unit: 'pages', target: 10, chunkSize: 2, weekKey: w2 }), 9);
  const p3 = advancePoolAmount(createPoolTask({ id: 'c', title: 'C', unit: 'min', target: 100, chunkSize: 20, weekKey: w3 }), 50);

  // w1 and w2 qualify; w3 is in progress at 50%, so streak from w2 is 2!
  assert.equal(calculateWeeklyStreak([p1, p2, p3], w3), 2);
  // Once w3 reaches 80%, streak climbs to 3
  const p3Done = advancePoolAmount(p3, 30);
  assert.equal(calculateWeeklyStreak([p1, p2, p3Done], w3), 3);
});

test('week start supports Monday and Sunday locales + detects neglected pools mid-week', () => {
  assert.equal(getWeekStartKey('2026-11-22', 'mon'), '2026-11-16');
  assert.equal(getWeekStartKey('2026-11-22', 'sun'), '2026-11-22');
  const wk = '2026-11-16';
  const task = createPoolTask({ id: 'n1', title: 'Neglected', unit: 'min', target: 60, chunkSize: 15, weekKey: wk });
  const thursdayMs = Date.parse(`${addDaysToKey(wk, 3)}T12:00:00`);
  assert.equal(findNeglectedPools([task], wk, thursdayMs).length, 1);
});
