import test from 'node:test';
import assert from 'node:assert/strict';
import { FSRSCard, Rating, getDueCards } from '../web/src/core/fsrs.js';

test('FSRS schedules higher intervals for Good/Easy and resets Again to 1 day with lapse', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  const card = new FSRSCard({ id: 'fc1', deck: 'Core', front: 'Q', back: 'A', lastReviewed: now, due: now });

  const afterAgain = card.schedule(Rating.Again, now);
  assert.equal(afterAgain.reps, 1);
  assert.equal(afterAgain.lapses, 1);
  assert.equal(afterAgain.intervalDays, 1);

  const afterEasy = card.schedule(Rating.Easy, now);
  assert.equal(afterEasy.reps, 1);
  assert.equal(afterEasy.lapses, 0);
  assert.ok(afterEasy.intervalDays > afterAgain.intervalDays);

  const nextReview = new Date(now.getTime() + afterEasy.intervalDays * 86_400_000);
  const secondEasy = afterEasy.schedule(Rating.Easy, nextReview);
  assert.ok(secondEasy.stability > afterEasy.stability);
});

test('FSRS getDueCards returns due items sorted earliest-first with localized labels', () => {
  const nowMs = Date.parse('2026-11-23T10:00:00Z');
  const c1 = new FSRSCard({ id: '1', due: new Date(nowMs - 1000) });
  const c2 = new FSRSCard({ id: '2', due: new Date(nowMs + 3 * 86_400_000) });
  const due = getDueCards([c2.toJSON(), c1.toJSON()], nowMs);
  assert.equal(due.length, 1);
  assert.equal(due[0].id, '1');
  assert.equal(c1.dueLabel('en', nowMs), 'Due today');
  assert.equal(c2.dueLabel('ja', nowMs), '3日後復習');
});
