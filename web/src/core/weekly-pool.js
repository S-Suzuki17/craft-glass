// Weekly Pool Management & Anti-Burnout Weekly Streak Engine
// Units ('min', 'pages', 'problems', 'sessions') are NEVER cross-summed.

export const ALLOWED_UNITS = Object.freeze(['min', 'pages', 'problems', 'sessions']);
export const ALLOWED_CATEGORIES = Object.freeze([
  'study', 'coding', 'language', 'reading', 'art', 'music', 'fitness', 'other'
]);

const DAY_MS = 86_400_000;

export function getLocalDayKey(ms = Date.now()) {
  const d = new Date(Number(ms) || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysToKey(dayKey, deltaDays) {
  const [y, m, d] = String(dayKey).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function daysBetweenKeys(fromKey, toKey) {
  const a = Date.parse(`${fromKey}T12:00:00Z`);
  const b = Date.parse(`${toKey}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / DAY_MS);
}

export function getWeekStartKey(msOrDayKey = Date.now(), weekStart = 'mon') {
  const dayKey = typeof msOrDayKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(msOrDayKey)
    ? msOrDayKey
    : getLocalDayKey(msOrDayKey);
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const offset = weekStart === 'sun' ? dow : (dow + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - offset);
  return dt.toISOString().slice(0, 10);
}

export function getWeekDates(weekKey) {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekKey, i));
}

export function generateChunks(targetAmount, chunkSize) {
  const total = Math.max(1, Math.round(Number(targetAmount) || 1));
  const step = Math.max(1, Math.min(total, Math.round(Number(chunkSize) || Math.ceil(total / 4))));
  const chunks = [];
  let remaining = total;
  let index = 1;
  while (remaining > 0) {
    const amount = Math.min(step, remaining);
    chunks.push({
      id: `c${index}`,
      index,
      amount,
      done: false
    });
    remaining -= amount;
    index++;
  }
  return chunks;
}

export function createPoolTask({
  id,
  title,
  category = 'study',
  unit = 'min',
  target = 60,
  chunkSize = 15,
  weekKey,
  pinnedDays = [],
  nowMs = Date.now()
}) {
  const safeTitle = String(title || '').trim();
  if (!safeTitle) throw new Error('Pool title is required');
  const safeUnit = ALLOWED_UNITS.includes(unit) ? unit : 'min';
  const safeCategory = ALLOWED_CATEGORIES.includes(category) ? category : 'other';
  const safeTarget = Math.max(1, Math.round(Number(target) || 1));
  const safeChunkSize = Math.max(1, Math.min(safeTarget, Math.round(Number(chunkSize) || Math.ceil(safeTarget / 4))));
  const safeWeek = weekKey || getWeekStartKey(nowMs);
  const safePins = [...new Set((Array.isArray(pinnedDays) ? pinnedDays : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b);

  return {
    id: id || `pool_${nowMs}_${Math.random().toString(36).slice(2, 7)}`,
    title: safeTitle,
    category: safeCategory,
    unit: safeUnit,
    target: safeTarget,
    chunkSize: safeChunkSize,
    weekKey: safeWeek,
    pinnedDays: safePins,
    chunks: generateChunks(safeTarget, safeChunkSize),
    extraDone: 0,
    completedAt: null,
    earlyCompleted: false,
    createdAt: nowMs
  };
}

export function poolProgress(task) {
  const chunkDone = (Array.isArray(task?.chunks) ? task.chunks : [])
    .reduce((sum, c) => sum + (c.done ? Math.max(0, Number(c.amount) || 0) : 0), 0);
  const done = Math.min(task.target, chunkDone + Math.max(0, Number(task.extraDone) || 0));
  const remaining = Math.max(0, task.target - done);
  const percent = task.target > 0 ? Math.min(100, Math.round((done / task.target) * 100)) : 0;
  return {
    done,
    target: task.target,
    remaining,
    percent,
    completed: remaining === 0,
    doneChunks: (task.chunks || []).filter((c) => c.done).length,
    totalChunks: (task.chunks || []).length
  };
}

function updatePoolCompletionState(task, nowMs) {
  const prog = poolProgress(task);
  const weekEndKey = addDaysToKey(task.weekKey, 6);
  const todayKey = getLocalDayKey(nowMs);
  if (prog.completed) {
    if (!task.completedAt) task.completedAt = nowMs;
    const daysEarly = daysBetweenKeys(todayKey, weekEndKey);
    task.earlyCompleted = daysEarly >= 2;
  } else {
    task.completedAt = null;
    task.earlyCompleted = false;
  }
  return task;
}

export function togglePoolChunk(task, chunkId, nowMs = Date.now()) {
  const next = {
    ...task,
    chunks: (task.chunks || []).map((c) => (c.id === chunkId ? { ...c, done: !c.done } : { ...c }))
  };
  return updatePoolCompletionState(next, nowMs);
}

export function advancePoolAmount(task, deltaAmount, nowMs = Date.now()) {
  const add = Math.max(0, Math.round(Number(deltaAmount) || 0));
  if (add === 0) return task;
  let budget = add;
  const chunks = (task.chunks || []).map((c) => ({ ...c }));
  for (const chunk of chunks) {
    if (!chunk.done && budget >= chunk.amount) {
      chunk.done = true;
      budget -= chunk.amount;
    }
  }
  const extraDone = Math.min(
    task.target,
    Math.max(0, Number(task.extraDone) || 0) + budget
  );
  const next = { ...task, chunks, extraDone };
  return updatePoolCompletionState(next, nowMs);
}

export function summarizeWeekByUnit(pools = [], weekKey) {
  const matching = pools.filter((p) => p.weekKey === weekKey);
  const byUnit = {};
  for (const unit of ALLOWED_UNITS) {
    byUnit[unit] = { unit, done: 0, target: 0, remaining: 0, count: 0 };
  }
  let totalRatioSum = 0;
  for (const pool of matching) {
    const prog = poolProgress(pool);
    const bucket = byUnit[pool.unit];
    bucket.done += prog.done;
    bucket.target += prog.target;
    bucket.remaining += prog.remaining;
    bucket.count += 1;
    totalRatioSum += prog.target > 0 ? Math.min(1, prog.done / prog.target) : 0;
  }
  const activeUnits = ALLOWED_UNITS.map((u) => byUnit[u]).filter((b) => b.count > 0);
  const overallPercent = matching.length > 0 ? Math.round((totalRatioSum / matching.length) * 100) : 0;
  const anyEarlyCompleted = matching.some((p) => p.earlyCompleted);
  return {
    weekKey,
    taskCount: matching.length,
    overallPercent,
    anyEarlyCompleted,
    byUnit: activeUnits
  };
}

export function calculateWeeklyStreak(pools = [], currentWeekKey) {
  const weekTotals = new Map();
  for (const pool of pools) {
    if (!pool?.weekKey) continue;
    if (!weekTotals.has(pool.weekKey)) weekTotals.set(pool.weekKey, []);
    weekTotals.get(pool.weekKey).push(pool);
  }
  const qualifies = (wk) => {
    const list = weekTotals.get(wk);
    if (!list || list.length === 0) return false;
    const summary = summarizeWeekByUnit(list, wk);
    return summary.overallPercent >= 80;
  };

  let streak = 0;
  if (qualifies(currentWeekKey)) streak++;
  let cursor = addDaysToKey(currentWeekKey, -7);
  while (qualifies(cursor)) {
    streak++;
    cursor = addDaysToKey(cursor, -7);
  }
  return streak;
}

export function findNeglectedPools(pools = [], currentWeekKey, nowMs = Date.now()) {
  const todayKey = getLocalDayKey(nowMs);
  const daysIntoWeek = Math.max(0, daysBetweenKeys(currentWeekKey, todayKey));
  if (daysIntoWeek < 2) return [];
  return pools
    .filter((p) => p.weekKey === currentWeekKey)
    .map((p) => ({ pool: p, progress: poolProgress(p) }))
    .filter(({ progress }) => !progress.completed && progress.percent < 25)
    .map(({ pool }) => pool);
}
