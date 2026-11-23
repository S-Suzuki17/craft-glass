// FSRS (Free Spaced Repetition Scheduler) Engine — Bilingual EN/JA

import { t } from './i18n.js';

export const Rating = Object.freeze({
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4
});

const DEFAULT_W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01,
  1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
];

const DAY_MS = 86_400_000;

export class FSRSCard {
  constructor(card = {}) {
    this.id = card.id || `card_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.deck = card.deck || 'General';
    this.front = card.front || '';
    this.back = card.back || '';
    this.reps = Number(card.reps) || 0;
    this.lapses = Number(card.lapses) || 0;
    this.difficulty = Number(card.difficulty) || 5.0;
    this.stability = Number(card.stability) || 2.0;
    this.lastReviewed = card.lastReviewed ? new Date(card.lastReviewed) : new Date();
    this.due = card.due ? new Date(card.due) : new Date();
    this.lastRating = card.lastRating ?? null;
  }

  schedule(rating, now = new Date()) {
    const nowDate = now instanceof Date ? now : new Date(now);
    const elapsedDays = Math.max(0, (nowDate.getTime() - this.lastReviewed.getTime()) / DAY_MS);
    let nextStability;
    let nextDifficulty;

    if (this.reps === 0) {
      nextDifficulty = Math.min(10, Math.max(1, DEFAULT_W[4] - Math.exp(DEFAULT_W[5] * (rating - 1)) + 1));
      nextStability = Math.max(0.1, DEFAULT_W[rating - 1]);
    } else {
      const retrievability = Math.pow(1 + elapsedDays / (9 * this.stability), -1);
      const diffChange = -DEFAULT_W[6] * (rating - 3);
      nextDifficulty = Math.min(10, Math.max(1, this.difficulty + diffChange));

      if (rating === Rating.Again) {
        nextStability = Math.max(
          0.1,
          DEFAULT_W[11] *
            Math.pow(nextDifficulty, -DEFAULT_W[12]) *
            (Math.pow(this.stability + 1, DEFAULT_W[13]) - 1) *
            Math.exp(DEFAULT_W[14] * (1 - retrievability))
        );
      } else {
        const hardPenalty = rating === Rating.Hard ? DEFAULT_W[15] : 1.0;
        const easyBonus = rating === Rating.Easy ? DEFAULT_W[16] : 1.0;
        nextStability =
          this.stability *
          (1 +
            Math.exp(DEFAULT_W[8]) *
              (11 - nextDifficulty) *
              Math.pow(this.stability, -DEFAULT_W[9]) *
              (Math.exp((1 - retrievability) * DEFAULT_W[10]) - 1) *
              hardPenalty *
              easyBonus);
      }
    }

    const intervalDays = rating === Rating.Again ? 1 : Math.max(1, Math.round(nextStability));
    const nextDue = new Date(nowDate.getTime() + intervalDays * DAY_MS);

    return new FSRSCard({
      id: this.id,
      deck: this.deck,
      front: this.front,
      back: this.back,
      reps: this.reps + 1,
      lapses: rating === Rating.Again ? this.lapses + 1 : this.lapses,
      difficulty: Number(nextDifficulty.toFixed(2)),
      stability: Number(nextStability.toFixed(2)),
      lastReviewed: nowDate.toISOString(),
      due: nextDue.toISOString(),
      lastRating: rating
    });
  }

  get intervalDays() {
    return Math.max(1, Math.round((this.due.getTime() - this.lastReviewed.getTime()) / DAY_MS));
  }

  isDue(nowMs = Date.now()) {
    return this.due.getTime() <= nowMs;
  }

  dueLabel(locale = 'en', nowMs = Date.now()) {
    const days = Math.round((this.due.getTime() - nowMs) / DAY_MS);
    if (days <= 0) return t(locale, 'fsrs.dueToday');
    if (days === 1) return t(locale, 'fsrs.dueTomorrow');
    return t(locale, 'fsrs.dueDays', { d: days });
  }

  toJSON() {
    return {
      id: this.id,
      deck: this.deck,
      front: this.front,
      back: this.back,
      reps: this.reps,
      lapses: this.lapses,
      difficulty: this.difficulty,
      stability: this.stability,
      lastReviewed: this.lastReviewed.toISOString(),
      due: this.due.toISOString(),
      lastRating: this.lastRating
    };
  }
}

export function getDueCards(cards = [], nowMs = Date.now()) {
  return cards
    .map((c) => new FSRSCard(c))
    .filter((c) => c.isDue(nowMs))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}
